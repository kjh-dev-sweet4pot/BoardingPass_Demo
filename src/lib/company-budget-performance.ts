import { isDemoCompany } from "@/lib/company";
import { ymdKstNow } from "@/lib/company-home";
import { formatKrw } from "@/lib/creator-pool-mock";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BudgetSpendKind = "완료" | "예정";

export type BudgetPerformanceRow = {
  allocationId: string;
  influencerId: string;
  name: string;
  handle: string;
  product: string;
  stage: string;
  kind: BudgetSpendKind;
  /** 노출가. 없으면 합산·표시하지 않음 */
  displayPrice: number | null;
};

export type BudgetPerformancePayload = {
  asOf: string;
  budgetTotal: number | null;
  /** 발행완료 — 실제 사용 */
  spent: number;
  /** 진행~발행 이전 — 차감 예정 */
  scheduled: number;
  /** spent + scheduled */
  committed: number;
  remaining: number | null;
  spentPct: number | null;
  scheduledPct: number | null;
  committedPct: number | null;
  rows: BudgetPerformanceRow[];
};

export function isPublishedComplete(opts: {
  rollupStatus: string | null | undefined;
  targetContentCount: number | null | undefined;
  links: { content_status?: string | null; publish_url?: string | null }[];
}) {
  if (opts.rollupStatus === "발행완료") return true;
  const target = opts.targetContentCount ?? 1;
  const published = opts.links.filter(
    (l) =>
      l.content_status === "발행완료" ||
      (typeof l.publish_url === "string" && l.publish_url.trim() !== ""),
  ).length;
  return published >= target;
}

export function summarizeBudgetPerformance(
  budgetTotal: number | null,
  rows: BudgetPerformanceRow[],
  asOf: string,
): BudgetPerformancePayload {
  let spent = 0;
  let scheduled = 0;
  for (const r of rows) {
    const price = r.displayPrice ?? 0;
    if (price <= 0) continue;
    if (r.kind === "완료") spent += price;
    else scheduled += price;
  }
  const committed = spent + scheduled;
  const remaining =
    budgetTotal != null ? Math.max(0, budgetTotal - committed) : null;
  const pct = (n: number) =>
    budgetTotal != null && budgetTotal > 0
      ? Math.min(100, Math.round((n / budgetTotal) * 100))
      : null;
  return {
    asOf,
    budgetTotal,
    spent,
    scheduled,
    committed,
    remaining,
    spentPct: pct(spent),
    scheduledPct: pct(scheduled),
    committedPct: pct(committed),
    rows,
  };
}

export function formatBudgetKrw(n: number) {
  return `${formatKrw(n)}원`;
}

function stageLabel(opts: {
  rollupStatus: string | null | undefined;
  complete: boolean;
}) {
  if (opts.complete) return "발행완료";
  const r = (opts.rollupStatus || "").trim();
  if (r && r !== "취소") return r;
  return "진행중";
}

/** 홈·예산 성과 탭 공통. 노출가만. 없으면 합산에서 제외. (R3) */
export async function buildBudgetPerformanceForCompany(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  company: {
    id: string;
    login_id?: string | null;
    /** 회원사 배정 예산. 있으면 캠페인 합보다 우선 */
    budget_amount?: number | null;
  },
): Promise<BudgetPerformancePayload> {
  const companyId = company.id;
  const companyBudget = Number(company.budget_amount);
  const hasCompanyBudget =
    Number.isFinite(companyBudget) && companyBudget > 0;

  let campaignBudgetSum = 0;
  if (!hasCompanyBudget) {
    const { data: campaigns, error: campErr } = await supabase
      .from("campaigns")
      .select("budget_amount")
      .eq("company_id", companyId);
    if (campErr) throw new Error(campErr.message);
    campaignBudgetSum = (campaigns || []).reduce((sum, c) => {
      const n = Number(c.budget_amount);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }

  const budgetTotal = hasCompanyBudget
    ? companyBudget
    : campaignBudgetSum > 0
      ? campaignBudgetSum
      : isDemoCompany(company)
        ? 90_000_000
        : null;

  const { data: allocs, error: allocErr } = await supabase
    .from("allocations")
    .select(
      `
      id, company_id, influencer_id, status, rollup_status, target_content_count,
      influencers ( id, name, instagram_handle_normalized, instagram_handle ),
      products ( id, name ),
      allocation_pricing ( display_price ),
      creator_links ( id, content_status, publish_url, status )
    `,
    )
    .eq("company_id", companyId);
  if (allocErr) throw new Error(allocErr.message);

  const rows: BudgetPerformanceRow[] = [];

  for (const raw of allocs || []) {
    const cancelled =
      raw.status === "cancelled" || raw.rollup_status === "취소";
    if (cancelled) continue;

    const links = Array.isArray(raw.creator_links) ? raw.creator_links : [];
    const complete = isPublishedComplete({
      rollupStatus: raw.rollup_status,
      targetContentCount: raw.target_content_count,
      links,
    });

    const pricing = raw.allocation_pricing;
    const priceRow = Array.isArray(pricing) ? pricing[0] : pricing;
    const parsed = Number(priceRow?.display_price);
    const displayPrice =
      Number.isFinite(parsed) && parsed > 0 ? parsed : null;

    const inf = Array.isArray(raw.influencers)
      ? raw.influencers[0]
      : raw.influencers;
    const product = Array.isArray(raw.products)
      ? raw.products[0]
      : raw.products;
    const handleRaw =
      inf?.instagram_handle_normalized || inf?.instagram_handle || "";
    const handle = handleRaw
      ? `@${String(handleRaw).replace(/^@+/, "")}`
      : "—";

    rows.push({
      allocationId: raw.id,
      influencerId: inf?.id || raw.influencer_id,
      name: inf?.name || "인플루언서",
      handle,
      product: product?.name || "상품",
      stage: stageLabel({
        rollupStatus: raw.rollup_status,
        complete,
      }),
      kind: complete ? "완료" : "예정",
      displayPrice,
    });
  }

  rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "완료" ? -1 : 1;
    return (b.displayPrice ?? 0) - (a.displayPrice ?? 0);
  });

  return summarizeBudgetPerformance(budgetTotal, rows, ymdKstNow());
}

if (process.env.RUN_BUDGET_PERF_SELF_CHECK === "1") {
  if (
    !isPublishedComplete({
      rollupStatus: "발행완료",
      targetContentCount: 1,
      links: [],
    })
  ) {
    throw new Error("rollup 발행완료");
  }
  if (
    !isPublishedComplete({
      rollupStatus: "제작중",
      targetContentCount: 1,
      links: [{ content_status: "발행완료" }],
    })
  ) {
    throw new Error("link 발행완료");
  }
  const summary = summarizeBudgetPerformance(
    10_000_000,
    [
      {
        allocationId: "a",
        influencerId: "i",
        name: "A",
        handle: "@a",
        product: "p",
        stage: "발행완료",
        kind: "완료",
        displayPrice: 700_000,
      },
      {
        allocationId: "b",
        influencerId: "j",
        name: "B",
        handle: "@b",
        product: "p",
        stage: "제작중",
        kind: "예정",
        displayPrice: 800_000,
      },
    ],
    "2026-09-03",
  );
  if (
    summary.spent !== 700_000 ||
    summary.scheduled !== 800_000 ||
    summary.committed !== 1_500_000 ||
    summary.remaining !== 8_500_000
  ) {
    throw new Error("summarizeBudgetPerformance failed");
  }
  console.log("company-budget-performance self-check ok");
}
