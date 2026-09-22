import { buildMonthCells, visitKey } from "@/lib/admin-alloc-schedule";
import {
  type AllocationStatus,
  type AllocationWithRelations,
} from "@/lib/types";

export type LoadLevel = 0 | 1 | 2 | 3 | 4;

export const LOAD_HEAT: Record<
  LoadLevel,
  { bg: string; fg: string; label: string }
> = {
  0: { bg: "#FFFDFB", fg: "#A07050", label: "0명" },
  1: { bg: "#F5EDE3", fg: "#3D1F0A", label: "여유 1–2" },
  2: { bg: "#E8D5BE", fg: "#3D1F0A", label: "보통 3–5" },
  3: { bg: "#C9A177", fg: "#3D1F0A", label: "혼잡 6–9" },
  4: { bg: "#6B3B1F", fg: "#FFFFFF", label: "매우 혼잡 10+" },
};

export function loadLevel(visitorCount: number): LoadLevel {
  if (visitorCount <= 0) return 0;
  if (visitorCount <= 2) return 1;
  if (visitorCount <= 5) return 2;
  if (visitorCount <= 9) return 3;
  return 4;
}

export function isValidYmd(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function monthLabelKo(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${y}년 ${m}월`;
}

export function monthDelta(ym: string, baseYm: string) {
  const [y, m] = ym.split("-").map(Number);
  const [by, bm] = baseYm.split("-").map(Number);
  return y * 12 + m - (by * 12 + bm);
}

export function monthNavState(ym: string, todayYm: string) {
  const delta = monthDelta(ym, todayYm);
  return { canPrev: delta > -12, canNext: delta < 6 };
}

export const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function weekdayIndex(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export type VisitDaySummary = {
  date: string;
  visitorCount: number;
  allocationCount: number;
  pendingCount: number;
  visitedCount: number;
  pickedUpCount: number;
  loadLevel: LoadLevel;
};

function isActiveAlloc(item: { status: AllocationStatus }) {
  return item.status !== "cancelled";
}

export function summarizeVisitDays(
  items: AllocationWithRelations[],
): Map<string, VisitDaySummary> {
  const byDate = new Map<
    string,
    { ids: Set<string>; pending: number; visited: number; picked: number; n: number }
  >();

  for (const item of items) {
    if (!isActiveAlloc(item)) continue;
    const date = visitKey(item);
    if (!date) continue;
    const row =
      byDate.get(date) ||
      { ids: new Set<string>(), pending: 0, visited: 0, picked: 0, n: 0 };
    row.ids.add(item.influencer_id);
    const allocCount = item._allProducts?.length || 1;
    row.n += allocCount;
    if (item.status === "pending") row.pending += 1;
    else if (item.status === "picked_up") row.picked += 1;
    else row.visited += 1;
    byDate.set(date, row);
  }

  const out = new Map<string, VisitDaySummary>();
  for (const [date, row] of byDate) {
    const visitorCount = row.ids.size;
    out.set(date, {
      date,
      visitorCount,
      allocationCount: row.n,
      pendingCount: row.pending,
      visitedCount: row.visited,
      pickedUpCount: row.picked,
      loadLevel: loadLevel(visitorCount),
    });
  }
  return out;
}

export function monthVisitorTotal(
  items: AllocationWithRelations[],
  monthYm: string,
) {
  const ids = new Set<string>();
  for (const item of items) {
    if (!isActiveAlloc(item)) continue;
    const date = visitKey(item);
    if (!date.startsWith(monthYm)) continue;
    ids.add(item.influencer_id);
  }
  return ids.size;
}

export function undatedItems(items: AllocationWithRelations[]) {
  return items.filter((item) => isActiveAlloc(item) && !visitKey(item));
}

function statusRank(status: AllocationStatus) {
  if (status === "pending") return 0;
  if (status === "visited" || status === "ready") return 1;
  if (status === "picked_up") return 2;
  return 3;
}

export type DayVisitor = {
  influencerId: string;
  name: string;
  handle: string;
  initial: string;
  campaignName: string | null;
  products: { id: string; name: string; quantity: number }[];
  badgeStatus: AllocationStatus;
  badgeItem: AllocationWithRelations;
};

export function groupVisitors(items: AllocationWithRelations[]): DayVisitor[] {
  const groups = new Map<string, AllocationWithRelations[]>();
  for (const item of items) {
    const list = groups.get(item.influencer_id) || [];
    list.push(item);
    groups.set(item.influencer_id, list);
  }

  const cards: DayVisitor[] = [];
  for (const [influencerId, list] of groups) {
    const sorted = list
      .slice()
      .sort((a, b) => statusRank(a.status) - statusRank(b.status));
    const badgeItem = sorted[0];
    const inf = badgeItem.influencers;
    const name = inf?.name || "크리에이터";
    const handle = (inf?.instagram_handle || "").replace(/^@/, "");
    const campaign = (
      badgeItem as AllocationWithRelations & {
        campaigns?: { name: string | null } | null;
      }
    ).campaigns?.name;
    const products: { id: string; name: string; quantity: number }[] = [];
    const seenProductIds = new Set<string>();
    for (const item of list) {
      if (item._allProducts && item._allProducts.length > 0) {
        for (const p of item._allProducts) {
          if (!seenProductIds.has(p.id)) {
            seenProductIds.add(p.id);
            products.push(p);
          }
        }
      } else {
        if (!seenProductIds.has(item.id)) {
          seenProductIds.add(item.id);
          products.push({
            id: item.id,
            name: item.products?.name || "상품",
            quantity: item.quantity,
          });
        }
      }
    }

    cards.push({
      influencerId,
      name,
      handle,
      initial: name.slice(0, 1),
      campaignName: campaign || null,
      products,
      badgeStatus: badgeItem.status,
      badgeItem,
    });
  }

  return cards.sort((a, b) => {
    const r = statusRank(a.badgeStatus) - statusRank(b.badgeStatus);
    if (r !== 0) return r;
    return a.name.localeCompare(b.name, "ko");
  });
}

/** KST 기준 현재 시각의 hour (0~23) */
export function kstHourNow(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
}

/** URL에 tab이 없을 때: 항상 방문 달력 */
export function defaultPharTab(
  _todayVisitorCount?: number,
  _now?: Date,
): "calendar" | "counter" {
  return "calendar";
}

export function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** 앞으로 빼둘 상품: 오늘부터 days일 수령 예정 (취소·반출완료 제외) */
export function upcomingPlacement(
  items: AllocationWithRelations[],
  todayYmd: string,
  days = 7,
) {
  const end = addDaysYmd(todayYmd, days - 1);
  const byProduct = new Map<
    string,
    { name: string; qty: number; people: Set<string> }
  >();
  for (const item of items) {
    if (item.status === "cancelled" || item.status === "picked_up") continue;
    const d = item.visit_date;
    if (!d || d < todayYmd || d > end) continue;
    const list =
      item._allProducts && item._allProducts.length > 0
        ? item._allProducts
        : [
            {
              id: item.id,
              name: item.products?.name || "상품",
              quantity: item.quantity,
            },
          ];
    for (const p of list) {
      const name = p.name;
      const row = byProduct.get(name) || {
        name,
        qty: 0,
        people: new Set<string>(),
      };
      row.qty += p.quantity;
      row.people.add(item.influencer_id);
      byProduct.set(name, row);
    }
  }
  return [...byProduct.values()]
    .map((r) => ({
      name: r.name,
      qty: r.qty,
      visitorCount: r.people.size,
    }))
    .sort((a, b) => b.qty - a.qty);
}

export type ProductRankingRow = {
  rank: number;
  name: string;
  brand: string | null;
  visitorCount: number;
  qty: number;
};

/**
 * 향후 N일 방문 예정 배정 건수 기준 상품 Top 랭킹.
 * "트래픽"의 실측 지표가 없어 배정된 인플루언서 수(visitorCount)를 프록시로 쓴다 —
 * 진짜 방문객 예측 모델이 아니라 "이미 잡힌 일정" 집계다.
 */
export function upcomingProductRanking(
  items: AllocationWithRelations[],
  todayYmd: string,
  days = 14,
  limit = 10,
) {
  const end = addDaysYmd(todayYmd, days - 1);
  const byProduct = new Map<
    string,
    { name: string; brand: string | null; qty: number; people: Set<string> }
  >();
  for (const item of items) {
    if (item.status === "cancelled" || item.status === "picked_up") continue;
    const d = item.visit_date;
    if (!d || d < todayYmd || d > end) continue;
    const list =
      item._allProducts && item._allProducts.length > 0
        ? item._allProducts
        : [
            {
              id: item.id,
              name: item.products?.name || "상품",
              quantity: item.quantity,
            },
          ];
    for (const p of list) {
      const name = p.name;
      const brand = item.companies?.name || null;
      const key = `${name}|${brand ?? ""}`;
      const row = byProduct.get(key) || { name, brand, qty: 0, people: new Set<string>() };
      row.qty += p.quantity;
      row.people.add(item.influencer_id);
      byProduct.set(key, row);
    }
  }
  return [...byProduct.values()]
    .map((r) => ({ name: r.name, brand: r.brand, qty: r.qty, visitorCount: r.people.size }))
    .sort((a, b) => b.visitorCount - a.visitorCount || b.qty - a.qty)
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, ...r }));
}

export function monthHeatCells(
  monthYm: string,
  byDay: Map<string, VisitDaySummary>,
) {
  return buildMonthCells(monthYm, new Map()).map((cell) => ({
    ymd: cell.ymd,
    num: cell.num,
    inMonth: cell.inMonth,
    summary: byDay.get(cell.ymd) || null,
  }));
}

if (process.env.NODE_ENV !== "production") {
  console.assert(loadLevel(0) === 0);
  console.assert(loadLevel(1) === 1 && loadLevel(2) === 1);
  console.assert(loadLevel(3) === 2 && loadLevel(5) === 2);
  console.assert(loadLevel(6) === 3 && loadLevel(9) === 3);
  console.assert(loadLevel(10) === 4);
  console.assert(isValidYmd("2026-09-08") === true);
  console.assert(isValidYmd("2026-13-45") === false);
  console.assert(monthLabelKo("2026-09") === "2026년 9월");
  console.assert(monthNavState("2025-09", "2026-09").canPrev === false);
  console.assert(monthNavState("2027-03", "2026-09").canNext === false);
  const cells = monthHeatCells("2026-08", new Map());
  console.assert(cells[0]?.ymd === "2026-07-26");
  console.assert(addDaysYmd("2026-09-08", 6) === "2026-09-14");
  {
    // 인플루언서 수(visitorCount) 기준 정렬, qty로 동점 처리, 취소/반출완료 제외
    const base = { quantity: 1, influencer_id: "" } as unknown as AllocationWithRelations;
    const rows = upcomingProductRanking(
      [
        { ...base, influencer_id: "a", products: { name: "A" } as never, companies: { id: "c1", name: "브랜드A" } as never, visit_date: "2026-09-08", status: "pending" },
        { ...base, influencer_id: "b", products: { name: "A" } as never, companies: { id: "c1", name: "브랜드A" } as never, visit_date: "2026-09-09", status: "pending" },
        { ...base, influencer_id: "c", products: { name: "B" } as never, visit_date: "2026-09-10", status: "pending" },
        { ...base, influencer_id: "d", products: { name: "C" } as never, visit_date: "2026-09-10", status: "cancelled" },
        { ...base, influencer_id: "e", products: { name: "D" } as never, visit_date: "2026-09-30", status: "pending" },
      ],
      "2026-09-08",
      14,
    );
    console.assert(rows.length === 2, "cancelled/기간 밖 제외");
    console.assert(rows[0]?.name === "A" && rows[0]?.rank === 1 && rows[0]?.visitorCount === 2);
    console.assert(rows[1]?.name === "B" && rows[1]?.brand === null);
  }
}
