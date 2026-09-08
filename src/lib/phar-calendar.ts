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
    row.n += 1;
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
    cards.push({
      influencerId,
      name,
      handle,
      initial: name.slice(0, 1),
      campaignName: campaign || null,
      products: list.map((item) => ({
        id: item.id,
        name: item.products?.name || "상품",
        quantity: item.quantity,
      })),
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

export function kstHourNow(now = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
}

/** URL에 tab이 없을 때만: 영업시간 + 오늘 방문자면 카운터 */
export function defaultPharTab(
  todayVisitorCount: number,
  now = new Date(),
): "calendar" | "counter" {
  const hour = kstHourNow(now);
  if (hour >= 9 && hour < 19 && todayVisitorCount >= 1) return "counter";
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
    const name = item.products?.name || "상품";
    const row = byProduct.get(name) || {
      name,
      qty: 0,
      people: new Set<string>(),
    };
    row.qty += item.quantity;
    row.people.add(item.influencer_id);
    byProduct.set(name, row);
  }
  return [...byProduct.values()]
    .map((r) => ({
      name: r.name,
      qty: r.qty,
      visitorCount: r.people.size,
    }))
    .sort((a, b) => b.qty - a.qty);
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
}
