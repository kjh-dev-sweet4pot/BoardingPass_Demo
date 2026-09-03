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
  /** 노출가 */
  displayPrice: number;
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

/** 50만~100만 노출가 (원 단위 정수) */
export function randomDisplayPrice() {
  return 500_000 + Math.floor(Math.random() * 500_001);
}

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
    if (r.kind === "완료") spent += r.displayPrice;
    else scheduled += r.displayPrice;
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

/**
 * 홈·예산 성과 탭 공통.
 * 노출가만. 없으면 50~100만 시드. (R3)
 */
export async function buildBudgetPerformanceForCompany(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  company: { id: string; login_id?: string | null },
): Promise<BudgetPerformancePayload> {
  const companyId = company.id;
  const { data: campaigns, error: campErr } = await supabase
    .from("campaigns")
    .select("budget_amount")
    .eq("company_id", companyId);
  if (campErr) throw new Error(campErr.message);

  const totalBudget = (campaigns || []).reduce((sum, c) => {
    const n = Number(c.budget_amount);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const budgetTotal =
    totalBudget > 0
      ? totalBudget
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
    let displayPrice = Number(priceRow?.display_price);
    if (!Number.isFinite(displayPrice) || displayPrice <= 0) {
      displayPrice = randomDisplayPrice();
      // ponytail: 시드는 서버 service_role. 천장 — 운영자 확정가가 덮어씀.
      const { error: priceErr } = await supabase
        .from("allocation_pricing")
        .upsert(
          {
            allocation_id: raw.id,
            company_id: companyId,
            display_price: displayPrice,
            accepted_at: new Date().toISOString(),
          },
          { onConflict: "allocation_id" },
        );
      if (priceErr) {
        console.warn("[budget-performance] price seed failed", priceErr.message);
      }
    }

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
    return b.displayPrice - a.displayPrice;
  });

  return summarizeBudgetPerformance(budgetTotal, rows, ymdKstNow());
}

if (process.env.RUN_BUDGET_PERF_SELF_CHECK === "1") {
  const p = randomDisplayPrice();
  if (p < 500_000 || p > 1_000_000) throw new Error("randomDisplayPrice range");
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
