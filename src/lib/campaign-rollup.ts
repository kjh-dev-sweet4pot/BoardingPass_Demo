/**
 * 캠페인 상태 롤업 — 배정 분포에서만 산출 (R2).
 * 보류·취소는 호출부에서 롤업보다 우선한다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampaignStatus } from "@/lib/types";

export type CampaignRollupStatus = Extract<
  CampaignStatus,
  "견적수립" | "시행" | "결과"
>;

/** 배정 0 → 견적수립 / 전부 발행완료 → 결과 / 그 외 → 시행 */
export function rollupCampaignStatus(
  allocations: { status?: string | null; rollup_status?: string | null }[],
): CampaignRollupStatus {
  const active = allocations.filter((a) => a.status !== "cancelled");
  if (active.length === 0) return "견적수립";
  if (active.every((a) => a.rollup_status === "발행완료")) return "결과";
  return "시행";
}

export async function recomputeCampaignStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  campaignId: string,
): Promise<CampaignRollupStatus> {
  const { data, error } = await supabase
    .from("allocations")
    .select("status, rollup_status")
    .eq("campaign_id", campaignId);
  if (error) throw new Error(error.message);
  return rollupCampaignStatus(data ?? []);
}

// ponytail: self-check
if (process.env.NODE_ENV !== "production") {
  console.assert(rollupCampaignStatus([]) === "견적수립");
  console.assert(
    rollupCampaignStatus([{ status: "pending", rollup_status: "제작중" }]) === "시행",
  );
  console.assert(
    rollupCampaignStatus([
      { status: "picked_up", rollup_status: "발행완료" },
      { status: "cancelled", rollup_status: "제작중" },
    ]) === "결과",
  );
}
