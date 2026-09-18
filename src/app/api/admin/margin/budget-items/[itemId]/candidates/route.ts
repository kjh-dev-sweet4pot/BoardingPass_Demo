import { NextRequest, NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { isAdminTestCompany } from "@/lib/company";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

/**
 * GET /api/admin/margin/budget-items/[itemId]/candidates
 * 이 슬롯(등급)을 다른 회원사에 이미 Accept로 확정된 인플루언서로 채울 수
 * 있는지 추천한다 — 슬롯 = 한 인플루언서가 여러 회사 캠페인을 동시 진행.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const { itemId } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { data: item, error: itemErr } = await supabase
    .from("budget_plan_items")
    .select("id, campaign_id, tier")
    .eq("id", itemId)
    .maybeSingle();
  if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });
  if (!item) return NextResponse.json({ error: "슬롯을 찾을 수 없습니다." }, { status: 404 });

  const { data: campaign, error: campErr } = await supabase
    .from("campaigns")
    .select("id, company_id")
    .eq("id", item.campaign_id)
    .maybeSingle();
  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });

  // 이 캠페인에 이미 배정된 인플루언서(캐스팅 또는 엑셀 업로드 배정 모두)는 제외한다.
  // 엑셀 업로드 배정(allocations)은 campaign_id가 거의 안 채워져 있어 company_id로 판단한다.
  const [{ data: castInThis, error: castInThisErr }, { data: allocInThis, error: allocInThisErr }] = await Promise.all(
    [
      supabase.from("castings").select("influencer_id").eq("campaign_id", item.campaign_id),
      supabase.from("allocations").select("influencer_id").eq("company_id", campaign.company_id),
    ],
  );
  if (castInThisErr) return NextResponse.json({ error: castInThisErr.message }, { status: 500 });
  if (allocInThisErr) return NextResponse.json({ error: allocInThisErr.message }, { status: 500 });
  const excluded = new Set([
    ...(castInThis ?? []).map((c) => c.influencer_id as string),
    ...(allocInThis ?? []).map((a) => a.influencer_id as string),
  ]);

  // 다른 회사에 이미 실제로 활동 중인 인플루언서 — 캐스팅(Accept)과 엑셀 업로드 배정 둘 다 본다.
  const [{ data: acceptedElsewhere, error: acceptErr }, { data: allocatedElsewhere, error: allocErr }] =
    await Promise.all([
      supabase
        .from("castings")
        .select("influencer_id, campaign_id, campaigns ( id, name, companies ( id, name, login_id ) )")
        .eq("status", "Accept")
        .neq("campaign_id", item.campaign_id),
      supabase
        .from("allocations")
        .select("influencer_id, campaign_id, companies ( id, name, login_id ), campaigns ( id, name )")
        .not("company_id", "is", null)
        .neq("company_id", campaign.company_id),
    ]);
  if (acceptErr) return NextResponse.json({ error: acceptErr.message }, { status: 500 });
  if (allocErr) return NextResponse.json({ error: allocErr.message }, { status: 500 });

  type CampaignJoin = {
    id: string;
    name: string | null;
    companies: { id: string; name: string; login_id: string } | { id: string; name: string; login_id: string }[] | null;
  };
  type CompanyRow = { id: string; name: string; login_id: string };
  const byInfluencer = new Map<string, { campaign_name: string | null; company_name: string | null }[]>();

  function addRow(infId: string, campaignName: string | null, companyRaw: CompanyRow | CompanyRow[] | null) {
    if (excluded.has(infId)) return;
    const company = Array.isArray(companyRaw) ? companyRaw[0] : companyRaw;
    if (company && isAdminTestCompany(company)) return;
    const list = byInfluencer.get(infId) ?? [];
    list.push({ campaign_name: campaignName, company_name: company?.name ?? null });
    byInfluencer.set(infId, list);
  }

  for (const row of acceptedElsewhere ?? []) {
    const campaign = row.campaigns as unknown as CampaignJoin;
    const company = Array.isArray(campaign?.companies) ? campaign.companies[0] : campaign?.companies;
    addRow(row.influencer_id as string, campaign?.name ?? null, company ?? null);
  }
  for (const row of allocatedElsewhere ?? []) {
    const campaignRaw = row.campaigns as unknown as { id: string; name: string | null } | { id: string; name: string | null }[] | null;
    const campaign = Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw;
    addRow(row.influencer_id as string, campaign?.name ?? null, row.companies as CompanyRow | CompanyRow[] | null);
  }

  let candidateIds = [...byInfluencer.keys()];
  if (candidateIds.length === 0) return NextResponse.json({ candidates: [] });

  const { data: influencers, error: infErr } = await supabase
    .from("influencers")
    .select("id, name, instagram_handle, tier")
    .in("id", candidateIds);
  if (infErr) return NextResponse.json({ error: infErr.message }, { status: 500 });

  // 슬롯과 같은 등급인 인플루언서만 추천한다. 등급이 없는(followers 미수집) 인플루언서는 제외.
  const tierById = new Map((influencers ?? []).map((i) => [i.id as string, i.tier as string | null]));
  candidateIds = candidateIds.filter((id) => tierById.get(id) === item.tier);

  // 후보가 많으면(여러 회사에 걸쳐 있을수록) 우선순위 — 화면에는 상위 30명만 보여준다.
  candidateIds = candidateIds
    .sort((a, b) => (byInfluencer.get(b)?.length ?? 0) - (byInfluencer.get(a)?.length ?? 0))
    .slice(0, 30);
  if (candidateIds.length === 0) return NextResponse.json({ candidates: [] });

  const idSet = new Set(candidateIds);
  const candidates = (influencers ?? [])
    .filter((inf) => idSet.has(inf.id as string))
    .map((inf) => ({
      influencer_id: inf.id,
      name: inf.name,
      instagram_handle: inf.instagram_handle,
      already_cast_in: byInfluencer.get(inf.id as string) ?? [],
    }));

  return NextResponse.json({ candidates });
}
