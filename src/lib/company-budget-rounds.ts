import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumnError } from "@/lib/company";

/** 슬램월드 회원사 예산 라운드. 금액 단위는 원. 화면 입력은 만원. */

export const MANWON = 10_000;

export const BUDGET_DEPOSIT_STATUSES = [
  "입금 완료",
  "입금 지연",
  "검토 중",
  "협의중",
] as const;

export const BUDGET_USAGE_STATUSES = [
  "기 소진",
  "가용",
  "사용 예정",
  "예상",
  "예산 협의중",
] as const;

export type BudgetDepositStatus = (typeof BUDGET_DEPOSIT_STATUSES)[number];
export type BudgetUsageStatus = (typeof BUDGET_USAGE_STATUSES)[number];
export type BudgetRoundKind = "입금" | "사용";

export const BUDGET_ROUND_SELECT =
  "id, company_id, company_name, label, period_month, amount_krw, deposit_status, usage_status, kind, created_at, updated_at";

export type BudgetRound = {
  id: string;
  company_id: string | null;
  company_name: string;
  label: string | null;
  period_month: string;
  amount_krw: number | null;
  deposit_status: BudgetDepositStatus;
  usage_status: BudgetUsageStatus;
  kind?: BudgetRoundKind | null;
  created_at?: string;
  updated_at?: string;
};

export function isBudgetDepositStatus(v: string): v is BudgetDepositStatus {
  return (BUDGET_DEPOSIT_STATUSES as readonly string[]).includes(v);
}

export function isBudgetUsageStatus(v: string): v is BudgetUsageStatus {
  return (BUDGET_USAGE_STATUSES as readonly string[]).includes(v);
}

/** 만원 → 원. 빈 값 null. 형식 오류 NaN. */
export function parseManwon(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/,/g, "").replace(/만원/g, "").replace(/\s+/g, "");
  if (!s || s === "—" || s === "-") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return Number.NaN;
  return Math.round(n * MANWON);
}

export function krwToManwon(krw: number | null | undefined): number | null {
  if (krw == null || !Number.isFinite(krw)) return null;
  return krw / MANWON;
}

export function formatManwon(krw: number | null | undefined) {
  const n = krwToManwon(krw);
  if (n == null) return "—";
  return `${new Intl.NumberFormat("ko-KR").format(n)}만원`;
}

/** YYYY-MM 또는 YYYY-MM-DD → 그달 1일. 실패면 null. */
export function parsePeriodMonth(raw: unknown): string | null {
  const s = String(raw || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}-01`;
}

export function monthLabel(periodMonth: string) {
  const [y, m] = periodMonth.slice(0, 7).split("-");
  const label = `${Number(m)}월`;
  return y === "2026" ? label : `${y}년 ${label}`;
}

export function shiftMonth(periodMonth: string, delta: number) {
  const [y, m] = periodMonth.slice(0, 7).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function roundKind(round: { kind?: string | null }): BudgetRoundKind {
  return round.kind === "사용" ? "사용" : "입금";
}

/** 사용 계획. 같은 월·구분의 입금 행은 이미 사용 행이 있으면 빼서 중복 표시하지 않는다. */
export function usageHistoryRounds<
  T extends { kind?: string | null; period_month: string; label: string | null },
>(rows: T[]): T[] {
  const usage = rows.filter((r) => roundKind(r) === "사용");
  const covered = new Set(usage.map((r) => `${r.period_month}|${r.label || ""}`));
  const legacy = rows.filter(
    (r) => roundKind(r) === "입금" && !covered.has(`${r.period_month}|${r.label || ""}`),
  );
  return [...usage, ...legacy];
}

export function summarizeCashflow<
  T extends {
    kind?: string | null;
    deposit_status: string;
    usage_status: string;
    amount_krw: number | null;
    period_month: string;
    label: string | null;
  },
>(rounds: T[]) {
  const deposits = rounds.filter((r) => roundKind(r) === "입금");
  const usage = usageHistoryRounds(rounds);
  const sum = (rows: T[]) => rows.reduce((total, r) => total + (r.amount_krw || 0), 0);
  const deposited = sum(deposits.filter((r) => r.deposit_status === "입금 완료"));
  const used = sum(usage);
  return { deposits, usage, deposited, used, balance: deposited - used };
}

/** 입금 완료만. 사용 계획은 합산하지 않는다. 없으면 null (배정 예산을 비움). */
export function rollupDepositedBudgetKrw(
  rounds: { kind?: string | null; deposit_status: string; amount_krw: number | null }[],
): number | null {
  const deposited = rounds.filter(
    (r) =>
      roundKind(r) === "입금" &&
      r.deposit_status === "입금 완료" &&
      r.amount_krw != null &&
      r.amount_krw > 0,
  );
  if (!deposited.length) return null;
  return deposited.reduce((sum, r) => sum + (r.amount_krw || 0), 0);
}

/** 입금 완료 합을 companies.budget_amount 에 덮어쓴다. 없으면 null. */
export async function syncDepositedBudgets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  companyIds: Array<string | null | undefined>,
): Promise<{ company_id: string; budget_amount: number | null }[]> {
  const ids = [...new Set(companyIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return [];
  let { data, error } = await supabase
    .from("company_budget_rounds")
    .select("company_id, kind, deposit_status, amount_krw")
    .in("company_id", ids);
  if (error && isMissingColumnError(error.message, "kind")) {
    const fallback = await supabase
      .from("company_budget_rounds")
      .select("company_id, deposit_status, amount_krw")
      .in("company_id", ids);
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw new Error(error.message);
  const patches = ids.map((id) => ({
    company_id: id,
    budget_amount: rollupDepositedBudgetKrw(
      (data || []).filter((r) => r.company_id === id),
    ),
  }));
  const updated_at = new Date().toISOString();
  for (const p of patches) {
    const { error: upErr } = await supabase
      .from("companies")
      .update({ budget_amount: p.budget_amount, updated_at })
      .eq("id", p.company_id);
    if (upErr) throw new Error(upErr.message);
  }
  return patches;
}

export function budgetTableMissing(message: string) {
  return (
    /company_budget_rounds/i.test(message) &&
    /does not exist|schema cache|relation/i.test(message)
  );
}

export const BUDGET_TABLE_SETUP =
  "예산 테이블이 없습니다. scripts/sql/company-budget-rounds.sql 을 Supabase SQL editor에서 실행하세요.";

export function readRoundBody(body: Record<string, unknown>) {
  const companyId = String(body.company_id || "").trim() || null;
  const companyName = String(body.company_name || "").trim();
  const label = String(body.label || "").trim() || null;
  const period = parsePeriodMonth(body.period_month);
  const kind: BudgetRoundKind = body.kind === "사용" ? "사용" : "입금";
  const depositRaw = String(body.deposit_status || "").trim();
  const usageRaw = String(body.usage_status || "").trim();
  const deposit = depositRaw || (kind === "사용" ? "협의중" : "");
  const usage = usageRaw || (kind === "입금" ? "사용 예정" : "");
  const amount = parseManwon(body.amount_manwon ?? body.amount_krw);

  if (!period) return { error: "월을 선택하세요." as const };
  if (!isBudgetDepositStatus(deposit)) return { error: "입금 상태를 선택하세요." as const };
  if (!isBudgetUsageStatus(usage)) return { error: "사용 상태를 선택하세요." as const };
  if (Number.isNaN(amount as number)) return { error: "금액은 만원 단위 숫자입니다." as const };
  if (!companyId && !companyName) {
    return { error: "회원사를 선택하거나 이름을 입력하세요." as const };
  }

  return {
    row: {
      company_id: companyId,
      company_name: companyName,
      label,
      period_month: period,
      amount_krw: amount,
      deposit_status: deposit,
      usage_status: usage,
      kind,
    },
  };
}

export async function fillCompanyName<T extends { company_id: string | null; company_name: string }>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  row: T,
) {
  if (!row.company_id) return row;
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", row.company_id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "회원사를 찾을 수 없습니다." };
  return { ...row, company_name: row.company_name || data.name };
}

if (parseManwon("4,000") !== 40_000_000 || parseManwon("—") !== null) {
  throw new Error("parseManwon failed");
}
if (parsePeriodMonth("2026-09") !== "2026-09-01") {
  throw new Error("parsePeriodMonth failed");
}
if (
  rollupDepositedBudgetKrw([
    { kind: "입금", deposit_status: "입금 완료", amount_krw: 40_000_000 },
    { kind: "사용", deposit_status: "입금 완료", amount_krw: 65_000_000 },
    { deposit_status: "입금 지연", amount_krw: 65_000_000 },
    { deposit_status: "협의중", amount_krw: null },
  ]) !== 40_000_000
) {
  throw new Error("rollupDepositedBudgetKrw should count 입금 완료 only");
}
if (shiftMonth("2026-09", 1) !== "2026-10" || shiftMonth("2026-12", 1) !== "2027-01") {
  throw new Error("shiftMonth failed");
}
if (
  usageHistoryRounds([
    { kind: "입금", period_month: "2026-09-01", label: "" },
    { kind: "사용", period_month: "2026-09-01", label: "" },
    { kind: "입금", period_month: "2026-10-01", label: "1차" },
  ]).length !== 2
) {
  throw new Error("usageHistoryRounds should drop a deposit once a usage row covers it");
}
if (rollupDepositedBudgetKrw([{ deposit_status: "협의중", amount_krw: null }]) !== null) {
  throw new Error("rollupDepositedBudgetKrw empty should be null");
}
{
  const flow = summarizeCashflow([
    {
      kind: "입금",
      deposit_status: "입금 완료",
      usage_status: "가용",
      amount_krw: 40_000_000,
      period_month: "2026-09-01",
      label: "",
    },
    {
      kind: "사용",
      deposit_status: "협의중",
      usage_status: "가용",
      amount_krw: 20_000_000,
      period_month: "2026-09-01",
      label: "",
    },
  ]);
  if (flow.deposited !== 40_000_000 || flow.used !== 20_000_000 || flow.balance !== 20_000_000) {
    throw new Error("summarizeCashflow failed");
  }
}
