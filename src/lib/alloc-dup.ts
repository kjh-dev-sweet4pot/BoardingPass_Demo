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

function productName(raw: RelName | undefined) {
  const one = Array.isArray(raw) ? raw[0] : raw;
  return (one?.name || "").trim();
}

function storeName(raw: RelName | undefined) {
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

export type SharedVisitGroup<T extends SharedVisitAlloc> = {
  key: string;
  primary: T;
  members: T[];
};

/**
 * CSV `company` 콤마 전개는 회원사별 배정 N건.
 * 같은 방문(인플+매장+방문일+상품)은 회원사 레코드를 한 묶음으로 둔다.
 * primary는 수령·방문이 앞선 쪽. 레코드 자체는 지우지 않는다.
 */
export function groupSharedVisitAllocations<T extends SharedVisitAlloc>(
  rows: T[],
): SharedVisitGroup<T>[] {
  const groups = new Map<string, T[]>();
  const order: string[] = [];
  for (const row of rows) {
    const k = visitKey(row);
    const list = groups.get(k);
    if (!list) {
      groups.set(k, [row]);
      order.push(k);
      continue;
    }
    list.push(row);
  }
  return order.map((key) => {
    const members = groups.get(key)!;
    let primary = members[0];
    for (const row of members.slice(1)) primary = better(primary, row);
    return { key, primary, members };
  });
}

/** 인플·약사 목록용. 묶음의 primary만 남기고 콘텐츠 링크는 합친다. */
export function collapseSharedVisitAllocations<T extends SharedVisitAlloc>(
  rows: T[],
): T[] {
  return groupSharedVisitAllocations(rows).map((group) => {
    let links: unknown[] = [];
    for (const row of group.members) {
      links = mergeLinks(links, row.creator_links);
    }
    return { ...group.primary, creator_links: links };
  });
}

const VISIT_SYNC_SELECT =
  "id, influencer_id, product_id, store_id, visit_date, status, rollup_status, picked_up_at, verified_at, last_visited_at, visit_source, visit_confirmed_by, created_at, products(name), stores(name)";

type VisitSyncRow = SharedVisitAlloc & {
  verified_at?: string | null;
  last_visited_at?: string | null;
  visit_source?: string | null;
  visit_confirmed_by?: string | null;
};

/**
 * 같은 방문의 다른 회원사 배정에 콘텐츠 링크를 맞춘다.
 * 이미 비반려 링크가 있으면 URL·상태만 갱신하고, 없으면 새로 넣는다.
 * 파일 경로는 회원사별로 달라 복사하지 않는다.
 */
export async function propagateSharedVisitCreatorLink(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  seedAllocationId: string,
  seedLink: {
    id: string;
    influencer_id: string;
    url: string;
    platform: string;
    status: string;
    content_status?: string | null;
    publish_url?: string | null;
    thumbnail_status?: string | null;
    submitted_at?: string | null;
  },
) {
  if (!seedLink.influencer_id || !seedAllocationId) return [] as string[];

  const { data: seedAlloc, error: seedErr } = await supabase
    .from("allocations")
    .select(VISIT_SYNC_SELECT)
    .eq("id", seedAllocationId)
    .maybeSingle();
  if (seedErr) throw new Error(seedErr.message);
  if (!seedAlloc) return [];

  const rows = await allocationsForInfluencer(supabase, seedLink.influencer_id);
  const siblings = membersOf(rows, seedAlloc as VisitSyncRow).filter(
    (row) => row.id !== seedAllocationId && row.status !== "cancelled",
  );
  if (!siblings.length) return [];

  const now = new Date().toISOString();
  const mirrored: string[] = [];

  for (const sib of siblings) {
    const { data: existing, error: exErr } = await supabase
      .from("creator_links")
      .select("id, status")
      .eq("allocation_id", sib.id)
      .neq("status", "rejected")
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);

    if (existing?.id) {
      const { error: upErr } = await supabase
        .from("creator_links")
        .update({
          url: seedLink.url,
          platform: seedLink.platform,
          status: seedLink.status,
          content_status: seedLink.content_status ?? null,
          publish_url: seedLink.publish_url ?? null,
          updated_at: now,
        })
        .eq("id", existing.id);
      if (upErr) throw new Error(upErr.message);
      mirrored.push(String(existing.id));
      continue;
    }

    let { data: created, error: insErr } = await supabase
      .from("creator_links")
      .insert({
        allocation_id: sib.id,
        influencer_id: seedLink.influencer_id,
        url: seedLink.url,
        platform: seedLink.platform,
        status: seedLink.status,
        content_status: seedLink.content_status ?? null,
        publish_url: seedLink.publish_url ?? null,
        thumbnail_status: seedLink.thumbnail_status ?? null,
        submitted_at: seedLink.submitted_at ?? now,
        updated_at: now,
      })
      .select("id")
      .maybeSingle();

    if (insErr && /platform_check/i.test(insErr.message) && seedLink.platform === "xiaohongshu") {
      const retry = await supabase
        .from("creator_links")
        .insert({
          allocation_id: sib.id,
          influencer_id: seedLink.influencer_id,
          url: seedLink.url,
          platform: "etc",
          status: seedLink.status,
          content_status: seedLink.content_status ?? null,
          publish_url: seedLink.publish_url ?? null,
          thumbnail_status: seedLink.thumbnail_status ?? null,
          submitted_at: seedLink.submitted_at ?? now,
          updated_at: now,
        })
        .select("id")
        .maybeSingle();
      created = retry.data;
      insErr = retry.error;
    }
    if (insErr) throw new Error(insErr.message);
    if (created?.id) mirrored.push(String(created.id));
  }

  return mirrored;
}

/** 수령·방문 시각. 회원사·수량·콘텐츠는 행마다 둔다. */
export function visitSyncPatch(row: VisitSyncRow) {
  return {
    status: row.status ?? null,
    picked_up_at: row.picked_up_at ?? null,
    verified_at: row.verified_at ?? null,
    last_visited_at: row.last_visited_at ?? null,
    visit_source: row.visit_source ?? null,
    visit_confirmed_by: row.visit_confirmed_by ?? null,
  };
}

function sameVisitState(a: VisitSyncRow, b: VisitSyncRow) {
  const left = visitSyncPatch(a);
  const right = visitSyncPatch(b);
  return (Object.keys(left) as (keyof typeof left)[]).every(
    (key) => String(left[key] ?? "") === String(right[key] ?? ""),
  );
}

async function allocationsForInfluencer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  influencerId: string,
) {
  const { data, error } = await supabase
    .from("allocations")
    .select(VISIT_SYNC_SELECT)
    .eq("influencer_id", influencerId);
  if (error) throw new Error(error.message);
  return (data || []) as VisitSyncRow[];
}

function membersOf(
  rows: VisitSyncRow[],
  seed: SharedVisitAlloc,
) {
  const key = visitKey(seed);
  return rows.filter((row) => visitKey(row) === key);
}

/**
 * 같은 방문의 다른 회원사 행에 수령·방문 상태를 맞춘다.
 * 취소된 행은 그대로 둔다. 회원사 노출은 행을 지우지 않는다.
 */
export async function propagateSharedVisitState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  before: SharedVisitAlloc,
  after: VisitSyncRow,
) {
  if (!after.status || after.status === "cancelled" || !before.influencer_id) {
    return [] as string[];
  }
  const rows = await allocationsForInfluencer(supabase, before.influencer_id);
  const ids = membersOf(rows, before)
    .filter((row) => row.id !== after.id && row.status !== "cancelled")
    .filter((row) => !sameVisitState(row, after))
    .map((row) => String(row.id));
  if (!ids.length) return [];

  const patch: Record<string, unknown> = {
    ...visitSyncPatch(after),
    updated_at: new Date().toISOString(),
  };
  const beforeDay = String(before.visit_date || "").slice(0, 10);
  const afterDay = String(after.visit_date || "").slice(0, 10);
  if (beforeDay && afterDay && beforeDay !== afterDay) patch.visit_date = afterDay;
  if (before.store_id && after.store_id && before.store_id !== after.store_id) {
    patch.store_id = after.store_id;
  }

  const { error } = await supabase.from("allocations").update(patch).in("id", ids);
  if (error) throw new Error(error.message);
  return ids;
}

/** 새 회원사 행을 만들 때, 이미 있는 같은 방문의 수령 상태를 잇는다. */
export async function inheritedVisitState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  seed: SharedVisitAlloc,
) {
  if (!seed.influencer_id || !seed.visit_date) return null;
  const rows = await allocationsForInfluencer(supabase, seed.influencer_id);
  const live = membersOf(rows, seed).filter((row) => row.status !== "cancelled");
  if (!live.length) return null;
  let best = live[0];
  for (const row of live.slice(1)) best = better(best, row);
  return visitSyncPatch(best);
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
  const grouped = groupSharedVisitAllocations([
    {
      id: "c1",
      influencer_id: "i",
      store_id: "s",
      visit_date: "2026-09-07",
      status: "pending",
      products: { name: "9월 상품" },
    },
    {
      id: "c2",
      influencer_id: "i",
      store_id: "s",
      visit_date: "2026-09-07",
      status: "picked_up",
      products: { name: "9월 상품" },
    },
    {
      id: "c3",
      influencer_id: "i",
      store_id: "s",
      visit_date: "2026-09-07",
      status: "pending",
      products: { name: "9월 상품" },
    },
  ]);
  if (
    grouped.length !== 1 ||
    grouped[0]?.members.length !== 3 ||
    grouped[0]?.primary.id !== "c2"
  ) {
    throw new Error("groupSharedVisitAllocations company split");
  }
  const synced = visitSyncPatch({
    id: "c2",
    influencer_id: "i",
    status: "picked_up",
    picked_up_at: "2026-09-14T01:00:00Z",
    verified_at: null,
  });
  if (synced.status !== "picked_up" || synced.picked_up_at !== "2026-09-14T01:00:00Z") {
    throw new Error("visitSyncPatch");
  }
  console.log("alloc-dup self-check ok");
}
