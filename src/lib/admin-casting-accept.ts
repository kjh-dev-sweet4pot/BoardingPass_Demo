import type { SupabaseClient } from "@supabase/supabase-js";
import { findDuplicateAllocation } from "@/lib/alloc-dup";

export type AcceptCastingInput = {
  castingId: string;
  displayPrice: number;
  costAmount: number;
  targetContentCount: number;
  phone: string;
  email: string;
  storeId: string;
  visitDate: string;
};

export async function acceptCasting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  input: AcceptCastingInput,
) {
  const { data: casting, error: castErr } = await supabase
    .from("castings")
    .select(
      "id, status, campaign_id, company_id, influencer_id, allocation_id, campaigns(id, product_id, status)",
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
  } | null;
  if (!campaign?.product_id) throw new Error("캠페인 상품 정보가 없습니다.");
  if (campaign.status === "취소") throw new Error("취소된 캠페인에는 섭외 확정할 수 없습니다.");

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

  return { allocationId: allocation.id as string };
}
