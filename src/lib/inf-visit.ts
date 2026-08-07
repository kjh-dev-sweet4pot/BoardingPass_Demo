import type { SupabaseClient } from "@supabase/supabase-js";
import { ymdKst } from "@/lib/types";

export function todayYmdKst() {
  return ymdKst(new Date());
}

/**
 * 인플루언서 매장 방문(본인확인/부트스트랩) 시 배정 상태 반영.
 *
 * - 오늘(KST) 방문 예정인 pending → visited
 * - 이미 방문했지만 아직 수령하지 않은 건(visited/ready):
 *   재방문 시 verified_at(실제 방문일)을 오늘로 갱신
 * - 수령 완료(picked_up)·취소·미래 예정일은 변경하지 않음
 */
export async function applyInfluencerStoreVisit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  influencerId: string,
) {
  const today = todayYmdKst();
  const now = new Date().toISOString();

  await supabase
    .from("allocations")
    .update({
      status: "visited",
      verified_at: now,
      updated_at: now,
    })
    .eq("influencer_id", influencerId)
    .eq("status", "pending")
    .eq("visit_date", today);

  const { data: openVisits } = await supabase
    .from("allocations")
    .select("id, visit_date, verified_at")
    .eq("influencer_id", influencerId)
    .in("status", ["visited", "ready"]);

  const refreshIds = (openVisits || [])
    .filter((row) => {
      const visitDay = row.visit_date
        ? String(row.visit_date).slice(0, 10)
        : "";
      // 미래 예정 배정은 건드리지 않음
      if (visitDay && visitDay > today) return false;
      if (!row.verified_at) return true;
      return ymdKst(row.verified_at) !== today;
    })
    .map((row) => row.id as string);

  if (refreshIds.length > 0) {
    await supabase
      .from("allocations")
      .update({
        verified_at: now,
        updated_at: now,
      })
      .in("id", refreshIds);
  }
}
