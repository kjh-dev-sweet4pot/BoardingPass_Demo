import { NextResponse } from "next/server";
import { requireAdminManager, requireAnyAdmin } from "@/lib/access";
import { isMissingColumnError } from "@/lib/company";
import {
  BUDGET_ROUND_SELECT,
  BUDGET_ROUND_SELECT_NO_SOURCE,
  BUDGET_ROUND_SELECT_NO_USAGE_PERIOD,
  BUDGET_TABLE_SETUP,
  budgetTableMissing,
  fillCompanyName,
  isBudgetStatusCheckError,
  normalizeBudgetRound,
  readRoundBody,
  stripBudgetOptionalColumns,
  syncDepositedBudgets,
  withLegacyBudgetStatuses,
  type BudgetRound,
} from "@/lib/company-budget-rounds";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

function selectFallback(message: string) {
  if (isMissingColumnError(message, "source_deposit_id")) return BUDGET_ROUND_SELECT_NO_SOURCE;
  if (isMissingColumnError(message, "usage_period_month")) return BUDGET_ROUND_SELECT_NO_USAGE_PERIOD;
  if (isMissingColumnError(message, "kind")) {
    return "id, company_id, company_name, label, period_month, amount_krw, deposit_status, usage_status, created_at, updated_at";
  }
  return null;
}

function stripMissingColumns<T extends Record<string, unknown>>(row: T, message: string): T {
  const cols: string[] = [];
  if (isMissingColumnError(message, "source_deposit_id")) cols.push("source_deposit_id");
  if (isMissingColumnError(message, "usage_period_month")) cols.push("usage_period_month");
  if (isMissingColumnError(message, "kind")) cols.push("kind");
  return stripBudgetOptionalColumns(row, cols);
}

export async function GET() {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let { data, error } = await supabase
    .from("company_budget_rounds")
    .select(BUDGET_ROUND_SELECT)
    .order("period_month", { ascending: true })
    .order("company_name", { ascending: true });

  for (let i = 0; i < 3 && error; i++) {
    const select = selectFallback(error.message);
    if (!select) break;
    const fallback = await supabase
      .from("company_budget_rounds")
      .select(select)
      .order("period_month", { ascending: true })
      .order("company_name", { ascending: true });
    data = fallback.data as unknown as typeof data;
    error = fallback.error;
  }

  if (error) {
    if (budgetTableMissing(error.message)) {
      return NextResponse.json({ error: BUDGET_TABLE_SETUP }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    rounds: ((data || []) as BudgetRound[]).map(normalizeBudgetRound),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = await readRoundBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const named = await fillCompanyName(supabase, parsed.row);
  if ("error" in named) {
    return NextResponse.json({ error: named.error }, { status: 400 });
  }

  let payload: Record<string, unknown> & { deposit_status: string; usage_status: string } = {
    ...named,
    updated_at: new Date().toISOString(),
  };
  let select = BUDGET_ROUND_SELECT;
  let { data, error } = await supabase
    .from("company_budget_rounds")
    .insert(payload)
    .select(select)
    .maybeSingle();

  if (error && isMissingColumnError(error.message, "source_deposit_id") && named.kind === "사용") {
    return NextResponse.json(
      { error: "사용 분할을 쓰려면 SQL을 실행하세요. " + BUDGET_TABLE_SETUP },
      { status: 500 },
    );
  }

  for (
    let i = 0;
    i < 3 &&
    error &&
    (isMissingColumnError(error.message, "source_deposit_id") ||
      isMissingColumnError(error.message, "usage_period_month") ||
      isMissingColumnError(error.message, "kind"));
    i++
  ) {
    if (isMissingColumnError(error.message, "kind") && named.kind === "사용") {
      return NextResponse.json({ error: BUDGET_TABLE_SETUP }, { status: 500 });
    }
    payload = stripMissingColumns(payload, error.message);
    select = selectFallback(error.message) || select;
    const fallback = await supabase
      .from("company_budget_rounds")
      .insert(payload)
      .select(select)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }
  if (error && isBudgetStatusCheckError(error.message)) {
    const retry = await supabase
      .from("company_budget_rounds")
      .insert({ ...withLegacyBudgetStatuses(payload), updated_at: new Date().toISOString() })
      .select(select)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }
  if (error) {
    if (budgetTableMissing(error.message)) {
      return NextResponse.json({ error: BUDGET_TABLE_SETUP }, { status: 500 });
    }
    const status = error.message.toLowerCase().includes("unique") ? 409 : 500;
    return NextResponse.json(
      {
        error:
          status === 409 ? "같은 회원사·월·구분이 이미 있습니다." : error.message,
      },
      { status },
    );
  }

  let budgets: { company_id: string; budget_amount: number | null }[] = [];
  try {
    budgets = await syncDepositedBudgets(supabase, [named.company_id]);
  } catch (err) {
    return NextResponse.json(
      {
        round: data ? normalizeBudgetRound(data as unknown as BudgetRound) : data,
        warning: err instanceof Error ? err.message : "배정 예산 반영 실패",
      },
      { status: 200 },
    );
  }
  return NextResponse.json({
    round: data ? normalizeBudgetRound(data as unknown as BudgetRound) : data,
    budgets,
  });
}
