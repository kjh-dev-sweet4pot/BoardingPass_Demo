import type { SupabaseClient } from "@supabase/supabase-js";
import { ymdKst } from "@/lib/types";

export function todayYmdKst() {
  return ymdKst(new Date());
}

/**
 * 인플루언서 매장 방문(본인확인/부트스트랩) 시 배정 상태 반영.
 *
 * - pending 전체 → visited (당일·지각·조기 방문 모두)
 *   verified_at / last_visited_at = 지금 (첫 방문 기록)
 * - 이미 visited/ready 인데 미수령인 건 재방문 시:
 *   last_visited_at 만 오늘로 갱신 → 화면 「오늘 방문 완료」
 *   verified_at(첫 방문일)은 절대 변경하지 않음
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
      last_visited_at: now,
      updated_at: now,
    })
    .eq("influencer_id", influencerId)
    .eq("status", "pending");

  if (visitError) {
    throw new Error(visitError.message);
  }

  const { data: openVisits, error: openError } = await supabase
    .from("allocations")
    .select("id, verified_at, last_visited_at")
    .eq("influencer_id", influencerId)
    .in("status", ["visited", "ready"]);

  if (openError) {
    throw new Error(openError.message);
  }

  const refreshIds = (openVisits || [])
    .filter((row) => {
      // 첫 방문 직후 update 로 이미 오늘이 찍힌 건은 스킵
      const latest = row.last_visited_at || row.verified_at;
      if (!latest) return true;
      return ymdKst(latest) !== today;
    })
    .map((row) => row.id as string);

  if (refreshIds.length > 0) {
    const { error: refreshError } = await supabase
      .from("allocations")
      .update({
        last_visited_at: now,
        updated_at: now,
      })
      .in("id", refreshIds);

    if (refreshError) {
      throw new Error(refreshError.message);
    }
  }
}
