import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalBranchName } from "@/lib/store-name";

type RelName = { name?: string | null } | { name?: string | null }[] | null;

export type SharedVisitAlloc = {
  id: string;
  influencer_id: string;
  store_id?: string | null;
  visit_date?: string | null;
  status?: string | null;
  rollup_status?: string | null;
  picked_up_at?: string | null;
  created_at?: string | null;
  stores?: RelName;
  products?: RelName;
  creator_links?: unknown[] | null;
};

function productName(raw: RelName) {
  const one = Array.isArray(raw) ? raw[0] : raw;
  return (one?.name || "").trim();
}

function storeName(raw: RelName) {
  const one = Array.isArray(raw) ? raw[0] : raw;
  return (one?.name || "").trim();
}

function visitKey(row: SharedVisitAlloc) {
  const branch =
    canonicalBranchName(storeName(row.stores)) || row.store_id || "";
  return [
    row.influencer_id,
    branch,
    String(row.visit_date || "").slice(0, 10),
    productName(row.products),
  ].join("|");
}

function statusRank(row: SharedVisitAlloc) {
  if (row.status === "cancelled" || row.rollup_status === "취소") return 4;
  if (row.status === "picked_up" || row.picked_up_at) return 0;
  if (row.status === "visited" || row.status === "ready") return 1;
  return 2;
}

function mergeLinks(a: unknown[] | null | undefined, b: unknown[] | null | undefined) {
  const out: unknown[] = [];
  const seen = new Set<string>();
  for (const link of [...(a || []), ...(b || [])]) {
    const id = String((link as { id?: string })?.id || "");
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    out.push(link);
  }
  return out;
}

function better(a: SharedVisitAlloc, b: SharedVisitAlloc) {
  const d = statusRank(a) - statusRank(b);
  if (d !== 0) return d < 0 ? a : b;
  return String(a.created_at || "") <= String(b.created_at || "") ? a : b;
}

/**
 * CSV `company` 콤마 전개는 회원사별 배정 N건.
 * 인플·약사에게는 같은 방문(인플+매장+방문일+상품) 1건.
 */
export function collapseSharedVisitAllocations<T extends SharedVisitAlloc>(
  rows: T[],
): T[] {
  const keep = new Map<string, T>();
  const order: string[] = [];
  for (const row of rows) {
    const k = visitKey(row);
    const prev = keep.get(k);
    if (!prev) {
      keep.set(k, { ...row, creator_links: [...(row.creator_links || [])] });
      order.push(k);
      continue;
    }
    const win = better(prev, row) as T;
    const links = mergeLinks(prev.creator_links, row.creator_links);
    keep.set(k, { ...win, creator_links: links });
  }
  return order.map((k) => keep.get(k)!);
}

/** influencer + product + store + visit_date + company_id */
export async function findDuplicateAllocation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  input: {
    influencerId: string;
    productId: string;
    storeId: string;
    visitDate: string;
    companyId: string | null;
    excludeId?: string;
  },
) {
  let query = supabase
    .from("allocations")
    .select("id")
    .eq("influencer_id", input.influencerId)
    .eq("product_id", input.productId)
    .eq("store_id", input.storeId)
    .eq("visit_date", input.visitDate);

  if (input.companyId) {
    query = query.eq("company_id", input.companyId);
  } else {
    query = query.is("company_id", null);
  }

  if (input.excludeId) {
    query = query.neq("id", input.excludeId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ? String(data.id) : null;
}

if (process.env.RUN_ALLOC_DUP_SELF_CHECK === "1") {
  const collapsed = collapseSharedVisitAllocations([
    {
      id: "a",
      influencer_id: "i",
      store_id: "s1",
      visit_date: "2026-09-07",
      status: "picked_up",
      created_at: "2026-09-09T05:05:20",
      stores: { name: "명동점" },
      products: { name: "9월 상품" },
      creator_links: [{ id: "l1" }],
    },
    {
      id: "b",
      influencer_id: "i",
      store_id: "s2",
      visit_date: "2026-09-07",
      status: "picked_up",
      created_at: "2026-09-09T05:05:19",
      stores: { name: "약국 명동" },
      products: { name: "9월 상품" },
      creator_links: [{ id: "l2" }],
    },
    {
      id: "c",
      influencer_id: "i",
      store_id: "s1",
      visit_date: "2026-09-08",
      status: "pending",
      stores: { name: "명동점" },
      products: { name: "9월 상품" },
    },
  ]);
  if (collapsed.length !== 2 || collapsed[0]?.id !== "b") {
    throw new Error("collapseSharedVisitAllocations same-visit");
  }
  if ((collapsed[0]?.creator_links || []).length !== 2) {
    throw new Error("collapseSharedVisitAllocations merge links");
  }
  console.log("alloc-dup self-check ok");
}
