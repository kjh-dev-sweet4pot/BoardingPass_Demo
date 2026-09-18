import { NextRequest, NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { isAdminTestCompany } from "@/lib/company";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

const OPEN_STATUSES = ["견적수립", "시행"];

/**
 * GET /api/admin/influencers/[id]/slot-suggestions
 * "슬롯" = 한 인플루언서가 여러 회사의 캠페인을 동시에 진행하는 것.
 * 이 인플루언서를 이미 캐스팅한 캠페인은 제외하고, 같은 등급(tier) 슬롯이
 * 아직 남아 있는 다른 회사 캠페인을 추천한다.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { data: influencer, error: infErr } = await supabase
    .from("influencers")
    .select("id, name, tier")
    .eq("id", id)
    .maybeSingle();
  if (infErr) return NextResponse.json({ error: infErr.message }, { status: 500 });
  if (!influencer) return NextResponse.json({ error: "인플루언서를 찾을 수 없습니다." }, { status: 404 });
  if (!influencer.tier) {
    return NextResponse.json({ suggestions: [], reason: "이 인플루언서는 등급(tier)이 지정되어 있지 않습니다." });
  }

  const { data: existingCastings, error: castErr } = await supabase
    .from("castings")
    .select("campaign_id")
    .eq("influencer_id", id);
  if (castErr) return NextResponse.json({ error: castErr.message }, { status: 500 });
  const excludedCampaignIds = new Set((existingCastings ?? []).map((c) => c.campaign_id as string));

  const { data: items, error: itemsErr } = await supabase
    .from("budget_plan_items")
    .select(
      `
      id, campaign_id, tier, content_type, platform, unit_cost, slot_count,
      campaigns!inner ( id, name, status, company_id, companies ( id, name, login_id ) )
      `,
    )
    .eq("tier", influencer.tier);
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

  type CampaignJoin = {
    id: string;
    name: string | null;
    status: string;
    company_id: string;
    companies: { id: string; name: string; login_id: string } | { id: string; name: string; login_id: string }[] | null;
  };
  const openItems = (items ?? []).filter((i) => {
    const campaign = i.campaigns as unknown as CampaignJoin;
    const company = Array.isArray(campaign?.companies) ? campaign.companies[0] : campaign?.companies;
    return (
      campaign &&
      OPEN_STATUSES.includes(campaign.status) &&
      !excludedCampaignIds.has(i.campaign_id as string) &&
      (!company || !isAdminTestCompany(company))
    );
  });

  const itemIds = openItems.map((i) => i.id as string);
  const { data: filledRows } = itemIds.length
    ? await supabase.from("castings").select("budget_plan_item_id").in("budget_plan_item_id", itemIds)
    : { data: [] as { budget_plan_item_id: string | null }[] };
  const filledCountByItem = new Map<string, number>();
  for (const row of filledRows ?? []) {
    if (!row.budget_plan_item_id) continue;
    filledCountByItem.set(
      row.budget_plan_item_id,
      (filledCountByItem.get(row.budget_plan_item_id) ?? 0) + 1,
    );
  }

  const suggestions = openItems
    .map((i) => {
      const campaign = i.campaigns as unknown as CampaignJoin;
      const company = Array.isArray(campaign.companies) ? campaign.companies[0] : campaign.companies;
      const filled = filledCountByItem.get(i.id as string) ?? 0;
      const remaining = Math.max(0, (i.slot_count as number) - filled);
      return {
        budget_plan_item_id: i.id,
        campaign_id: i.campaign_id,
        campaign_name: campaign.name,
        campaign_status: campaign.status,
        company_id: campaign.company_id,
        company_name: company?.name ?? null,
        content_type: i.content_type,
        platform: i.platform,
        unit_cost: i.unit_cost,
        remaining_count: remaining,
      };
    })
    .filter((s) => s.remaining_count > 0)
    .sort((a, b) => b.remaining_count - a.remaining_count);

  return NextResponse.json({ suggestions });
}
