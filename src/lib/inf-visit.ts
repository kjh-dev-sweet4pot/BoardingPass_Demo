import type { SupabaseClient } from "@supabase/supabase-js";
import { ymdKst } from "@/lib/types";

export function todayYmdKst() {
  return ymdKst(new Date());
}

/**
 * 인플루언서 매장 방문(본인확인/부트스트랩) 시 배정 상태 반영.
 *
 * - pending 전체 → visited (+ verified_at) — 당일·지각·조기 방문 모두
 * - 이미 방문했지만 아직 수령하지 않은 건(visited/ready):
 *   재방문 시 verified_at(실제 방문일)을 오늘로 갱신 → 약사 화면 「M월 D일 방문 완료」
 * - 수령 완료(picked_up)·취소는 변경하지 않음
 */
export async function applyInfluencerStoreVisit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  influencerId: string,
) {
  const today = todayYmdKst();
  const now = new Date().toISOString();

  const { error: visitError } = await supabase
    .from("allocations")
    .update({
      status: "visited",
      verified_at: now,
      updated_at: now,
    })
    .eq("influencer_id", influencerId)
    .eq("status", "pending");

  if (visitError) {
    throw new Error(visitError.message);
  }

  const { data: openVisits, error: openError } = await supabase
    .from("allocations")
    .select("id, verified_at")
    .eq("influencer_id", influencerId)
    .in("status", ["visited", "ready"]);

  if (openError) {
    throw new Error(openError.message);
  }

  const refreshIds = (openVisits || [])
    .filter((row) => {
      if (!row.verified_at) return true;
      return ymdKst(row.verified_at) !== today;
    })
    .map((row) => row.id as string);

  if (refreshIds.length > 0) {
    const { error: refreshError } = await supabase
      .from("allocations")
      .update({
        verified_at: now,
        updated_at: now,
      })
      .in("id", refreshIds);

    if (refreshError) {
      throw new Error(refreshError.message);
    }
  }
}
