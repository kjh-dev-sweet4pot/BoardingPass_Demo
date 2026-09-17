import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canEditContractStageIndependently,
  isContractStageSyncedToDeposit,
  isMissingColumnError,
} from "@/lib/company";

/** 슬램월드 회원사 예산 라운드. 금액 단위는 원. 화면 입력은 만원. */

export const MANWON = 10_000;

export const BUDGET_DEPOSIT_STATUSES = [
  "입점 논의중",
  "협의중",
  "입금 지연",
  "입금 완료",
] as const;

export const BUDGET_USAGE_STATUSES = ["기소진", "가용", "협의중"] as const;

export type BudgetDepositStatus = (typeof BUDGET_DEPOSIT_STATUSES)[number];
export type BudgetUsageStatus = (typeof BUDGET_USAGE_STATUSES)[number];
export type BudgetRoundKind = "입금" | "사용";

const DEPOSIT_STATUS_RANK: Record<BudgetDepositStatus, number> = {
  "입점 논의중": 0,
  협의중: 1,
  "입금 지연": 2,
  "입금 완료": 3,
};

export const BUDGET_ROUND_SELECT =
  "id, company_id, company_name, label, period_month, amount_krw, deposit_status, usage_status, usage_period_month, source_deposit_id, kind, created_at, updated_at";

export const BUDGET_ROUND_SELECT_NO_SOURCE =
  "id, company_id, company_name, label, period_month, amount_krw, deposit_status, usage_status, usage_period_month, kind, created_at, updated_at";

export const BUDGET_ROUND_SELECT_NO_USAGE_PERIOD =
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
  /** @deprecated 사용 분할(source_deposit_id)로 이전. 하위호환용. */
  usage_period_month?: string | null;
  /** 사용 분할이 속한 입금 행 id */
  source_deposit_id?: string | null;
  kind?: BudgetRoundKind | null;
  created_at?: string;
  updated_at?: string;
};

export function normalizeDepositStatus(
  raw: string | null | undefined,
): BudgetDepositStatus {
  const v = String(raw || "").trim();
  if (v === "검토 중" || v === "검토중") return "협의중";
  if ((BUDGET_DEPOSIT_STATUSES as readonly string[]).includes(v)) {
    return v as BudgetDepositStatus;
  }
  return "입점 논의중";
}

/**
 * 입금 라운드들의 전체 입금 상태.
 * 하나라도 입금 지연이면 입금 지연. 그다음 가장 앞선 단계.
 */
export function overallDepositStatus(
  statuses: Array<string | null | undefined>,
): BudgetDepositStatus | null {
  const list = statuses.map((s) => normalizeDepositStatus(s));
  if (!list.length) return null;
  if (list.some((s) => s === "입금 지연")) return "입금 지연";
  return list.reduce((a, b) =>
    DEPOSIT_STATUS_RANK[b] > DEPOSIT_STATUS_RANK[a] ? b : a,
  );
}

/**
 * 입금 라운드 상태 → 회원사 계약 단계.
 * 하나라도 입금 지연이면 입금 지연.
 * 전부 입금 완료면 캠페인 진행중. 그 전이면 입금 상태와 동일.
 * 입금 행이 없으면 null.
 */
export function contractStageFromDepositStatuses(
  statuses: Array<string | null | undefined>,
): "입점 논의중" | "협의중" | "입금 지연" | "캠페인 진행중" | null {
  const overall = overallDepositStatus(statuses);
  if (!overall) return null;
  if (overall === "입금 완료") return "캠페인 진행중";
  return overall;
}

export function normalizeUsageStatus(raw: string | null | undefined): BudgetUsageStatus {
  const v = String(raw || "").trim();
  if (v === "기 소진") return "기소진";
  if (v === "사용 예정" || v === "예상" || v === "예산 협의중") return "협의중";
  if ((BUDGET_USAGE_STATUSES as readonly string[]).includes(v)) {
    return v as BudgetUsageStatus;
  }
  return "협의중";
}

export function normalizeBudgetRound<T extends { deposit_status: string; usage_status: string }>(
  round: T,
): T & { deposit_status: BudgetDepositStatus; usage_status: BudgetUsageStatus } {
  return {
    ...round,
    deposit_status: normalizeDepositStatus(round.deposit_status),
    usage_status: normalizeUsageStatus(round.usage_status),
  };
}

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

/** 옛 kind=사용 행만. */
export function usageHistoryRounds<T extends { kind?: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => roundKind(r) === "사용");
}

export function usagesForDeposit(
  rounds: BudgetRound[],
  depositId: string,
): BudgetRound[] {
  return usageHistoryRounds(rounds)
    .filter((r) => r.source_deposit_id === depositId)
    .sort((a, b) => a.period_month.localeCompare(b.period_month));
}

export function orphanUsageRounds(rounds: BudgetRound[]): BudgetRound[] {
  return usageHistoryRounds(rounds).filter((r) => !r.source_deposit_id);
}

/** 사용 분할 + (자식 없는) 옛 usage_period_month. */
export function usagePlanRounds<
  T extends {
    id?: string;
    kind?: string | null;
    period_month: string;
    usage_period_month?: string | null;
    source_deposit_id?: string | null;
    label: string | null;
    usage_status: string;
    amount_krw: number | null;
    deposit_status: string;
  },
>(rounds: T[]): Array<T & { period_month: string }> {
  const usage = usageHistoryRounds(rounds);
  const linkedDepositIds = new Set(
    usage.map((r) => r.source_deposit_id).filter((id): id is string => Boolean(id)),
  );
  const legacy = rounds
    .filter(
      (r) =>
        roundKind(r) === "입금" &&
        r.usage_period_month &&
        !(r.id && linkedDepositIds.has(r.id)),
    )
    .map((r) => ({ ...r, period_month: String(r.usage_period_month).slice(0, 10) }));
  return [...usage, ...legacy];
}

export function summarizeCashflow<
  T extends {
    id?: string;
    kind?: string | null;
    deposit_status: string;
    usage_status: string;
    amount_krw: number | null;
    period_month: string;
    usage_period_month?: string | null;
    source_deposit_id?: string | null;
    label: string | null;
  },
>(rounds: T[]) {
  const deposits = rounds.filter((r) => roundKind(r) === "입금");
  const usage = usagePlanRounds(rounds);
  const sum = (rows: { amount_krw: number | null }[]) =>
    rows.reduce((total, r) => total + (r.amount_krw || 0), 0);
  const deposited = sum(deposits.filter((r) => r.deposit_status === "입금 완료"));
  const delayed = sum(deposits.filter((r) => r.deposit_status === "입금 지연"));
  const used = sum(usage);
  return { deposits, usage, deposited, delayed, used, balance: deposited - used };
}

/** 전체 시트용: 입금 완료가 없으면 입금 지연 금액을 보여 준다. */
export function displayDepositKrw(summary: { deposited: number; delayed: number }) {
  return summary.deposited > 0 ? summary.deposited : summary.delayed;
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

/** 입금 완료 합을 companies.budget_amount 에 덮어쓴다. 없으면 null.
 * 입금 상태에 맞춰 contract_stage 도 맞춘다 (입금 완료 → 캠페인 진행중, 그 전은 동일).
 */
export async function syncDepositedBudgets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  companyIds: Array<string | null | undefined>,
): Promise<
  {
    company_id: string;
    budget_amount: number | null;
    contract_stage?: string | null;
  }[]
> {
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
    data = fallback.data as unknown as typeof data;
    error = fallback.error;
  }
  if (error) throw new Error(error.message);

  const { data: companies, error: coErr } = await supabase
    .from("companies")
    .select("id, contract_stage")
    .in("id", ids);
  if (coErr) throw new Error(coErr.message);
  const stageById = new Map(
    (companies || []).map((c) => [c.id as string, (c.contract_stage as string | null) || null]),
  );

  const updated_at = new Date().toISOString();
  const patches: {
    company_id: string;
    budget_amount: number | null;
    contract_stage?: string | null;
  }[] = [];

  for (const id of ids) {
    const rows = (data || []).filter((r) => r.company_id === id);
    const budget_amount = rollupDepositedBudgetKrw(rows);
    const deposits = rows.filter((r) => roundKind(r) === "입금");
    const derived = contractStageFromDepositStatuses(
      deposits.map((r) => r.deposit_status),
    );
    const current = stageById.get(id) ?? null;
    let contract_stage: string | null | undefined;
    if (derived === "캠페인 진행중") {
      // 입금 완료: 입금 연동 단계(또는 비어 있음)만 캠페인 진행중으로 올린다.
      if (!current || isContractStageSyncedToDeposit(current)) {
        contract_stage = "캠페인 진행중";
      }
    } else if (derived) {
      contract_stage = derived;
    }

    const patch: Record<string, unknown> = { budget_amount, updated_at };
    if (contract_stage !== undefined) patch.contract_stage = contract_stage;
    const { error: upErr } = await supabase.from("companies").update(patch).eq("id", id);
    if (upErr) throw new Error(upErr.message);
    patches.push({
      company_id: id,
      budget_amount,
      ...(contract_stage !== undefined ? { contract_stage } : {}),
    });
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
  "예산 테이블이 없습니다. scripts/sql/company-budget-rounds.sql 과 scripts/sql/company-budget-usage-splits.sql 을 Supabase SQL editor에서 실행하세요.";

/** 옛 CHECK 제약용. 새 라벨 저장이 막히면 이 값으로 한 번 더 넣는다. */
export function withLegacyBudgetStatuses<
  T extends { deposit_status: string; usage_status: string },
>(row: T): T {
  return {
    ...row,
    deposit_status:
      row.deposit_status === "입점 논의중" ? "협의중" : row.deposit_status,
    usage_status:
      row.usage_status === "기소진"
        ? "기 소진"
        : row.usage_status === "협의중"
          ? "예산 협의중"
          : row.usage_status,
  };
}

export function isBudgetStatusCheckError(message: string) {
  return /check constraint|company_budget_rounds_(deposit|usage)_check/i.test(message);
}

export function readRoundBody(body: Record<string, unknown>) {
  const companyId = String(body.company_id || "").trim() || null;
  const companyName = String(body.company_name || "").trim();
  const label = String(body.label || "").trim() || null;
  const period = parsePeriodMonth(body.period_month);
  const usagePeriodRaw = String(body.usage_period_month || "").trim();
  const usagePeriod = usagePeriodRaw ? parsePeriodMonth(usagePeriodRaw) : null;
  const sourceDepositId = String(body.source_deposit_id || "").trim() || null;
  const kind: BudgetRoundKind = body.kind === "사용" ? "사용" : "입금";
  const depositRaw = String(body.deposit_status || "").trim();
  const usageRaw = String(body.usage_status || "").trim();
  const deposit = normalizeDepositStatus(depositRaw || (kind === "사용" ? "협의중" : "입점 논의중"));
  const usage = normalizeUsageStatus(usageRaw || "협의중");
  const amount = parseManwon(body.amount_manwon ?? body.amount_krw);

  if (!period) {
    const message: "사용 월을 선택하세요." | "입금 월을 선택하세요." =
      kind === "사용" ? "사용 월을 선택하세요." : "입금 월을 선택하세요.";
    return { error: message };
  }
  if (usagePeriodRaw && !usagePeriod) return { error: "사용 월 형식이 올바르지 않습니다." as const };
  if (kind === "사용" && !sourceDepositId) {
    return { error: "사용 분할은 입금 행에 연결해야 합니다." as const };
  }
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
      usage_period_month: kind === "입금" ? usagePeriod : null,
      source_deposit_id: kind === "사용" ? sourceDepositId : null,
      amount_krw: amount,
      deposit_status: deposit,
      usage_status: usage,
      kind,
    },
  };
}

/** 선택 컬럼이 없으면 payload에서 뺀다. */
export function stripBudgetOptionalColumns<T extends Record<string, unknown>>(
  row: T,
  columns: string[],
): T {
  const next = { ...row };
  for (const col of columns) delete next[col];
  return next;
}

export function stripUsagePeriodMonth<T extends Record<string, unknown>>(row: T): T {
  return stripBudgetOptionalColumns(row, ["usage_period_month"]);
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
  ]).length !== 1
) {
  throw new Error("usageHistoryRounds should ignore 입금 rows");
}
if (rollupDepositedBudgetKrw([{ deposit_status: "협의중", amount_krw: null }]) !== null) {
  throw new Error("rollupDepositedBudgetKrw empty should be null");
}
{
  const flow = summarizeCashflow([
    {
      id: "d1",
      kind: "입금",
      deposit_status: "입금 완료",
      usage_status: "가용",
      amount_krw: 40_000_000,
      period_month: "2026-09-01",
      usage_period_month: "2026-10-01",
      label: "",
    },
    {
      id: "u1",
      kind: "사용",
      deposit_status: "협의중",
      usage_status: "가용",
      amount_krw: 20_000_000,
      period_month: "2026-09-01",
      source_deposit_id: "d1",
      label: "",
    },
  ]);
  // linked usage wins; legacy usage_period_month ignored when children exist
  if (flow.deposited !== 40_000_000 || flow.used !== 20_000_000 || flow.balance !== 20_000_000) {
    throw new Error("summarizeCashflow failed");
  }
  const depositOnly = summarizeCashflow([
    {
      kind: "입금",
      deposit_status: "입금 완료",
      usage_status: "협의중",
      amount_krw: 40_000_000,
      period_month: "2026-08-01",
      label: "",
    },
  ]);
  if (depositOnly.used !== 0 || depositOnly.usage.length !== 0) {
    throw new Error("summarizeCashflow should not treat a deposit as usage");
  }
  const delayedOnly = summarizeCashflow([
    {
      kind: "입금",
      deposit_status: "입금 지연",
      usage_status: "협의중",
      amount_krw: 30_000_000,
      period_month: "2026-09-01",
      label: "",
    },
  ]);
  if (
    delayedOnly.deposited !== 0 ||
    delayedOnly.delayed !== 30_000_000 ||
    displayDepositKrw(delayedOnly) !== 30_000_000
  ) {
    throw new Error("displayDepositKrw should show delayed when nothing deposited");
  }
  const planned = usagePlanRounds([
    {
      kind: "입금" as const,
      deposit_status: "입금 완료",
      usage_status: "가용",
      amount_krw: 10,
      period_month: "2026-07-01",
      usage_period_month: "2026-08-01",
      label: "1차",
    },
  ]);
  if (planned.length !== 1 || planned[0].period_month !== "2026-08-01") {
    throw new Error("usagePlanRounds should use usage_period_month");
  }
  const splits = usagePlanRounds([
    {
      id: "d2",
      kind: "입금" as const,
      deposit_status: "입금 완료",
      usage_status: "협의중",
      amount_krw: 50,
      period_month: "2026-07-01",
      label: "1차",
    },
    {
      id: "u2",
      kind: "사용" as const,
      deposit_status: "협의중",
      usage_status: "기소진",
      amount_krw: 20,
      period_month: "2026-07-01",
      source_deposit_id: "d2",
      label: "1차",
    },
    {
      id: "u3",
      kind: "사용" as const,
      deposit_status: "협의중",
      usage_status: "가용",
      amount_krw: 30,
      period_month: "2026-08-01",
      source_deposit_id: "d2",
      label: "1차",
    },
  ]);
  if (splits.length !== 2 || splits.reduce((s, r) => s + (r.amount_krw || 0), 0) !== 50) {
    throw new Error("usagePlanRounds should allow multiple splits per deposit");
  }
}
if (
  normalizeDepositStatus("검토 중") !== "협의중" ||
  normalizeUsageStatus("기 소진") !== "기소진" ||
  normalizeUsageStatus("사용 예정") !== "협의중"
) {
  throw new Error("budget status normalize failed");
}
if (
  contractStageFromDepositStatuses(["협의중", "입점 논의중"]) !== "협의중" ||
  contractStageFromDepositStatuses(["입금 지연"]) !== "입금 지연" ||
  contractStageFromDepositStatuses(["입금 지연", "입금 완료"]) !== "입금 지연" ||
  contractStageFromDepositStatuses(["입금 완료", "입금 완료"]) !== "캠페인 진행중" ||
  overallDepositStatus(["입점 논의중", "입금 완료"]) !== "입금 완료" ||
  contractStageFromDepositStatuses([]) !== null
) {
  throw new Error("contractStageFromDepositStatuses failed");
}
if (canEditContractStageIndependently("캠페인 진행중") !== true) {
  throw new Error("canEditContractStageIndependently");
}
