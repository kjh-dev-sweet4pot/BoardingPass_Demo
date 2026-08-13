import type { SupabaseClient } from "@supabase/supabase-js";
import { ymdKst } from "@/lib/types";

export function todayYmdKst() {
  return ymdKst(new Date());
}

/**
 * 본인확인 ≠ 방문 확정.
 * pending 이면서 방문 예정일이 오늘(KST)인 건만 visited 로 전이.
 * 이미 visited/ready 인 미수령 건의 last_visited_at 은 자동 갱신하지 않음.
 */
export async function applyInfluencerStoreVisit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  influencerId: string,
) {
  const today = todayYmdKst();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("allocations")
    .update({
      status: "visited",
      verified_at: now,
      last_visited_at: now,
      visit_source: "auto",
      visit_confirmed_by: null,
      updated_at: now,
    })
    .eq("influencer_id", influencerId)
    .eq("status", "pending")
    .eq("visit_date", today);

  if (error) {
    throw new Error(error.message);
  }
}
