import type { SupabaseClient } from "@supabase/supabase-js";
import { findDuplicateAllocation } from "@/lib/alloc-dup";
import { recomputeCampaignStatus } from "@/lib/campaign-rollup";
import { calcMarginRate, marginState, type WarnType } from "@/lib/types";

export type AcceptCastingInput = {
  castingId: string;
  displayPrice: number;
  costAmount: number;
  targetContentCount: number;
  phone: string;
  email: string;
  storeId: string;
  visitDate: string;
  /** 마진율 경고 구간(§9.6)일 때만 필요. soft warn — 있으면 항상 저장 가능. */
  marginReason?: string;
  actor?: string;
};

// 마진율이 60% 이상이면(과다 마진 포함) 경고하지 않는다 — 낮은 마진만 확인이 필요하다.
function marginWarnType(rate: number | null): WarnType | null {
  const state = marginState(rate);
  if (state === "caution" || state === "risk") return "margin_low";
  return null;
}

if (
  marginWarnType(null) !== null ||
  marginWarnType(70) !== null ||
  marginWarnType(90) !== null ||
  marginWarnType(58) !== "margin_low" ||
  marginWarnType(40) !== "margin_low"
) {
  throw new Error("marginWarnType failed");
}

export async function acceptCasting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  input: AcceptCastingInput,
) {
  const { data: casting, error: castErr } = await supabase
    .from("castings")
    .select(
      "id, status, campaign_id, company_id, influencer_id, allocation_id, campaigns(id, product_id, status, budget_amount)",
    )
    .eq("id", input.castingId)
    .maybeSingle();

  if (castErr) throw new Error(castErr.message);
  if (!casting) throw new Error("섭외를 찾을 수 없습니다.");
  if (casting.status === "Accept") throw new Error("이미 확정된 섭외입니다.");
  if (casting.status === "결렬") throw new Error("결렬된 섭외는 확정할 수 없습니다.");
  if (casting.status !== "Nego") {
    throw new Error("협의 개시(Nego) 상태에서만 섭외 확정이 가능합니다.");
  }
  if (casting.allocation_id) throw new Error("이미 배정이 연결된 섭외입니다.");

  const campaignRaw = casting.campaigns;
  const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as {
    id: string;
    product_id: string;
    status: string;
    budget_amount: number | null;
  } | null;
  if (!campaign?.product_id) throw new Error("캠페인 상품 정보가 없습니다.");
  if (campaign.status === "취소") throw new Error("취소된 캠페인에는 섭외 확정할 수 없습니다.");

  // 마진율 경고 확인 (§9.6) — hard block 아님. 경고 구간이면 사유 입력 시에만 진행.
  const { data: acceptedCastings } = await supabase
    .from("castings")
    .select("allocations(allocation_pricing(cost_amount))")
    .eq("campaign_id", casting.campaign_id)
    .eq("status", "Accept");
  const priorCost = (acceptedCastings ?? []).reduce((sum, row) => {
    const alloc = Array.isArray(row.allocations) ? row.allocations[0] : row.allocations;
    const pricing = Array.isArray(alloc?.allocation_pricing)
      ? alloc?.allocation_pricing[0]
      : alloc?.allocation_pricing;
    return sum + (pricing?.cost_amount ?? 0);
  }, 0);
  const marginBefore = calcMarginRate(campaign.budget_amount ?? 0, priorCost);
  const marginAfter = calcMarginRate(campaign.budget_amount ?? 0, priorCost + input.costAmount);
  const warnType = marginWarnType(marginAfter);
  if (warnType && !input.marginReason?.trim()) {
    throw new Error(
      `확정 시 캠페인 마진율이 ${marginAfter}%로 경고 구간입니다. 사유를 입력하면 확정할 수 있습니다.`,
    );
  }

  const { error: infErr } = await supabase
    .from("influencers")
    .update({
      phone: input.phone,
      email: input.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", casting.influencer_id);
  if (infErr) throw new Error(infErr.message);

  const dupId = await findDuplicateAllocation(supabase, {
    influencerId: casting.influencer_id,
    productId: campaign.product_id,
    storeId: input.storeId,
    visitDate: input.visitDate,
    companyId: casting.company_id,
  });
  if (dupId) throw new Error("동일 조건의 배정이 이미 있습니다.");

  const now = new Date().toISOString();
  const { data: allocation, error: allocErr } = await supabase
    .from("allocations")
    .insert({
      influencer_id: casting.influencer_id,
      product_id: campaign.product_id,
      store_id: input.storeId,
      company_id: casting.company_id,
      campaign_id: casting.campaign_id,
      target_content_count: input.targetContentCount,
      visit_date: input.visitDate,
      quantity: 1,
      status: "pending",
    })
    .select("id")
    .single();
  if (allocErr || !allocation) {
    throw new Error(allocErr?.message || "배정 생성 실패");
  }

  const { error: priceErr } = await supabase.from("allocation_pricing").insert({
    allocation_id: allocation.id,
    company_id: casting.company_id,
    display_price: input.displayPrice,
    cost_amount: input.costAmount,
    accepted_at: now,
  });
  if (priceErr) {
    await supabase.from("allocations").delete().eq("id", allocation.id);
    throw new Error(priceErr.message);
  }

  const { error: updErr } = await supabase
    .from("castings")
    .update({
      status: "Accept",
      allocation_id: allocation.id,
      updated_at: now,
    })
    .eq("id", casting.id);
  if (updErr) throw new Error(updErr.message);

  if (warnType) {
    await supabase.from("margin_override_logs").insert({
      campaign_id: casting.campaign_id,
      casting_id: casting.id,
      margin_before: marginBefore,
      margin_after: marginAfter,
      warn_type: warnType,
      reason: input.marginReason!.trim(),
      actor: input.actor || "unknown",
    });
  }

  // 보류·취소가 아니면 배정 추가로 캠페인 상태 롤업
  if (campaign.status !== "보류" && campaign.status !== "취소") {
    const next = await recomputeCampaignStatus(supabase, casting.campaign_id);
    if (next !== campaign.status) {
      await supabase
        .from("campaigns")
        .update({ status: next, updated_at: now })
        .eq("id", casting.campaign_id);
    }
  }

  return { allocationId: allocation.id as string };
}
