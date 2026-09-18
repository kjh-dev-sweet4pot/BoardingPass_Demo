import { NextRequest, NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { calcMarginRate, marginState, type CampaignMarginRow } from "@/lib/types";

/**
 * GET /api/admin/margin/company/[id]
 * 이 회원사의 전체 캠페인을 합산한 회사 단위 마진율 — 인플루언서 배정 시
 * 이 캠페인 하나가 아니라 회사 전체 손익에 미치는 영향을 보기 위함.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const { id: companyId } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { data: campaigns, error: campErr } = await supabase
    .from("campaigns")
    .select("id, budget_amount")
    .eq("company_id", companyId)
    .neq("status", "취소");
  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 });

  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const { data: marginRows, error: marginErr } = campaignIds.length
    ? await supabase.from("v_campaign_margin").select("*").in("campaign_id", campaignIds)
    : { data: [] as CampaignMarginRow[], error: null };
  if (marginErr) return NextResponse.json({ error: marginErr.message }, { status: 500 });

  const marginByCampaign = new Map((marginRows ?? []).map((r) => [r.campaign_id, r as CampaignMarginRow]));

  let revenue = 0;
  let cost = 0;
  for (const c of campaigns ?? []) {
    const margin = marginByCampaign.get(c.id);
    revenue += margin?.revenue ?? c.budget_amount ?? 0;
    cost += margin?.committed_cost ?? 0;
  }

  const marginRate = calcMarginRate(revenue, cost);
  return NextResponse.json({ revenue, cost, marginRate, state: marginState(marginRate) });
}
