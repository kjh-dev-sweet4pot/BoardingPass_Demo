import type { SupabaseClient } from "@supabase/supabase-js";
import { findDuplicateAllocation } from "@/lib/alloc-dup";
import { recomputeCampaignStatus } from "@/lib/campaign-rollup";
import { calcMarginRate, marginState, type WarnType } from "@/lib/types";

export type AcceptCastingInput = {
  campaignId: string;
  companyId: string;
  influencerId: string;
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

/** 섭외(casting) 없이, 결정된 인플루언서를 캠페인에 바로 배정 확정한다. */
export async function acceptCasting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  input: AcceptCastingInput,
) {
  const { data: campaign, error: campErr } = await supabase
    .from("campaigns")
    .select("id, product_id, status, budget_amount")
    .eq("id", input.campaignId)
    .maybeSingle();
  if (campErr) throw new Error(campErr.message);
  if (!campaign) throw new Error("캠페인을 찾을 수 없습니다.");
  if (!campaign.product_id) throw new Error("캠페인 상품 정보가 없습니다.");
  if (campaign.status === "취소") throw new Error("취소된 캠페인에는 배정 확정할 수 없습니다.");

  // 마진율 경고 확인 (§9.6) — hard block 아님. 경고 구간이면 사유 입력 시에만 진행.
  const { data: priorPricing } = await supabase
    .from("allocation_pricing")
    .select("cost_amount, allocations!inner(campaign_id, status)")
    .eq("allocations.campaign_id", input.campaignId)
    .neq("allocations.status", "cancelled");
  const priorCost = (priorPricing ?? []).reduce(
    (sum: number, row: { cost_amount: number | null }) => sum + (row.cost_amount ?? 0),
    0,
  );
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
    .eq("id", input.influencerId);
  if (infErr) throw new Error(infErr.message);

  const dupId = await findDuplicateAllocation(supabase, {
    influencerId: input.influencerId,
    productId: campaign.product_id,
    storeId: input.storeId,
    visitDate: input.visitDate,
    companyId: input.companyId,
  });
  if (dupId) throw new Error("동일 조건의 배정이 이미 있습니다.");

  const now = new Date().toISOString();
  const { data: allocation, error: allocErr } = await supabase
    .from("allocations")
    .insert({
      influencer_id: input.influencerId,
      product_id: campaign.product_id,
      store_id: input.storeId,
      company_id: input.companyId,
      campaign_id: input.campaignId,
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
    company_id: input.companyId,
    display_price: input.displayPrice,
    cost_amount: input.costAmount,
    accepted_at: now,
  });
  if (priceErr) {
    await supabase.from("allocations").delete().eq("id", allocation.id);
    throw new Error(priceErr.message);
  }

  if (warnType) {
    await supabase.from("margin_override_logs").insert({
      campaign_id: input.campaignId,
      margin_before: marginBefore,
      margin_after: marginAfter,
      warn_type: warnType,
      reason: input.marginReason!.trim(),
      actor: input.actor || "unknown",
    });
  }

  // 보류·취소가 아니면 배정 추가로 캠페인 상태 롤업
  if (campaign.status !== "보류" && campaign.status !== "취소") {
    const next = await recomputeCampaignStatus(supabase, input.campaignId);
    if (next !== campaign.status) {
      await supabase
        .from("campaigns")
        .update({ status: next, updated_at: now })
        .eq("id", input.campaignId);
    }
  }

  return { allocationId: allocation.id as string };
}
