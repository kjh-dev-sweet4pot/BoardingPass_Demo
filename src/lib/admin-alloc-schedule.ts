import { addDaysYmd, type AllocationStatus } from "@/lib/types";

export type VisitBucket = "plan" | "visited" | "received";

export const VISIT_BUCKET_LABEL: Record<VisitBucket, string> = {
  plan: "방문예정",
  visited: "방문완료",
  received: "반출완료",
};

export function visitKey(item: { visit_date?: string | null }) {
  return item.visit_date ? String(item.visit_date).slice(0, 10) : "";
}

export function bucketOf(status: AllocationStatus): VisitBucket | null {
  if (status === "cancelled") return null;
  if (status === "picked_up") return "received";
  if (status === "visited" || status === "ready") return "visited";
  return "plan";
}

export function shiftMonthYm(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${y}.${m}`;
}

export function dayDiffYmd(a: string, b: string) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000,
  );
}

export function dayRelLabel(ymd: string, today: string) {
  const d = dayDiffYmd(ymd, today);
  if (d === 0) return "오늘";
  if (d === 1) return "내일";
  if (d === -1) return "어제";
  if (d < 0) return `${Math.abs(d)}일 전`;
  return `${d}일 후`;
}

export function padDateDot(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${y}.${m}.${d}`;
}

export function barWidths(plan: number, visited: number, received: number) {
  const t = plan + visited + received;
  if (!t) return { wPlan: 0, wVisited: 0, wReceived: 0 };
  return {
    wReceived: (received / t) * 100,
    wVisited: (visited / t) * 100,
    wPlan: (plan / t) * 100,
  };
}

export type BucketCounts = {
  plan: number;
  visited: number;
  received: number;
  total: number;
};

export function emptyCounts(): BucketCounts {
  return { plan: 0, visited: 0, received: 0, total: 0 };
}

export function addBucket(c: BucketCounts, b: VisitBucket) {
  c[b] += 1;
  c.total += 1;
}

/** 월 그리드: 앞뒤 빈칸 포함, 마지막 주가 전부 타월이면 자름 */
export function buildMonthCells(
  monthYm: string,
  byDay: Map<string, BucketCounts>,
) {
  const [y, m] = monthYm.split("-").map(Number);
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const out: {
    ymd: string;
    num: number;
    inMonth: boolean;
    counts: BucketCounts;
  }[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(y, m - 1, 1 - firstDow + i));
    const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const inMonth = ymd.startsWith(monthYm);
    if (i >= 35 && !inMonth) break;
    out.push({
      ymd,
      num: d.getUTCDate(),
      inMonth,
      counts: byDay.get(ymd) || emptyCounts(),
    });
  }
  return out;
}

// ponytail: self-check
if (process.env.NODE_ENV !== "production") {
  console.assert(bucketOf("pending") === "plan");
  console.assert(bucketOf("visited") === "visited");
  console.assert(bucketOf("ready") === "visited");
  console.assert(bucketOf("picked_up") === "received");
  console.assert(bucketOf("cancelled") === null);
  console.assert(shiftMonthYm("2026-08", 1) === "2026-09");
  console.assert(shiftMonthYm("2026-01", -1) === "2025-12");
  console.assert(dayRelLabel("2026-08-24", "2026-08-24") === "오늘");
  console.assert(
    dayRelLabel(addDaysYmd("2026-08-24", 1), "2026-08-24") === "내일",
  );
  console.assert(barWidths(1, 1, 2).wReceived === 50);
  const cells = buildMonthCells("2026-08", new Map());
  console.assert(cells[0]?.ymd === "2026-07-26"); // 2026-08-01 = 토
  console.assert(cells.filter((c) => c.inMonth).length === 31);
  console.assert(cells.at(-1)?.inMonth === true);
}
