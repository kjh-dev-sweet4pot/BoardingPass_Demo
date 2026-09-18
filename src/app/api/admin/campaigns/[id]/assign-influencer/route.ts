import { NextRequest, NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { acceptCasting } from "@/lib/admin-casting-accept";
import { getAdminLoginId } from "@/lib/session";
import { isMoneyOk, parseMoney } from "@/lib/money";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

const ALLOCATION_SELECT = `
  id, campaign_id, company_id, influencer_id, visit_date, target_content_count,
  created_at, updated_at,
  influencers ( id, name, instagram_handle ),
  allocation_pricing ( display_price, cost_amount, accepted_at )
`;

/**
 * POST /api/admin/campaigns/[id]/assign-influencer
 * 사이트에서 확정된 인플루언서를 이 캠페인(회원사)에 바로 배정한다 —
 * 섭외(casting) 없이 곧바로 allocations를 만든다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const { id: campaignId } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const body = await request.json().catch(() => ({}));
  const influencerId = String(body.influencer_id || "").trim();
  if (!influencerId) return NextResponse.json({ error: "인플루언서를 선택하세요." }, { status: 400 });

  const displayPrice = parseMoney(body.display_price);
  const costAmount = parseMoney(body.cost_amount);
  const targetContentCount = parseMoney(body.target_content_count);
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();
  const storeId = String(body.store_id || "").trim();
  const visitDate = String(body.visit_date || "").trim();
  const marginReason = String(body.margin_reason || "").trim() || undefined;

  if (!isMoneyOk(displayPrice) || !isMoneyOk(costAmount) || !isMoneyOk(targetContentCount) || targetContentCount < 1) {
    return NextResponse.json({ error: "노출가·원가·목표 콘텐츠 수를 입력하세요." }, { status: 400 });
  }
  if (!phone || !email) return NextResponse.json({ error: "전화·이메일 연락처를 입력하세요." }, { status: 400 });
  if (!storeId || !visitDate) {
    return NextResponse.json({ error: "방문 지점·방문 예정일을 선택하세요." }, { status: 400 });
  }

  const { data: campaign, error: campErr } = await supabase
    .from("campaigns")
    .select("id, company_id, status")
    .eq("id", campaignId)
    .maybeSingle();
  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });

  const { data: existing } = await supabase
    .from("allocations")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("influencer_id", influencerId)
    .neq("status", "cancelled")
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "이미 이 캠페인에 배정된 인플루언서입니다." }, { status: 409 });
  }

  let allocationId: string;
  try {
    const result = await acceptCasting(supabase, {
      campaignId,
      companyId: campaign.company_id,
      influencerId,
      displayPrice,
      costAmount,
      targetContentCount,
      phone,
      email,
      storeId,
      visitDate,
      marginReason,
      actor: (await getAdminLoginId()) || "unknown",
    });
    allocationId = result.allocationId;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "배정 확정 실패" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("allocations")
    .select(ALLOCATION_SELECT)
    .eq("id", allocationId)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ allocation: data });
}
