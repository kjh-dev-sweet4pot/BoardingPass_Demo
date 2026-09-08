import type { SupabaseClient } from "@supabase/supabase-js";
import type { AllocationWithRelations } from "@/lib/types";

const PAGE = 1000;
const SELECT = "*, products(*), stores(*), influencers(*)";

/** PostgREST 기본 1000행. 긴자처럼 배정이 많으면 잘려 달력 건수가 폴링마다 흔들린다. */
export async function fetchPharAllocations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  storeId?: string | null,
): Promise<{ data: AllocationWithRelations[]; error: string | null }> {
  const all: AllocationWithRelations[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from("allocations")
      .select(SELECT)
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (storeId) q = q.eq("store_id", storeId);
    const { data, error } = await q;
    if (error) return { data: all, error: error.message };
    const rows = (data || []) as AllocationWithRelations[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    // ponytail: 5만 건이면 기간 필터로 바꿔야 함
    if (from + PAGE >= 50_000) break;
  }
  return { data: all, error: null };
}
