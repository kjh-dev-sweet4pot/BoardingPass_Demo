import { NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
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
  syncCampaignBudgetFromRounds,
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();
  const { id } = await context.params;

  const existing = await supabase
    .from("company_budget_rounds")
    .select("id, company_id, campaign_id")
    .eq("id", id)
    .maybeSingle();
  if (existing.error) {
    if (budgetTableMissing(existing.error.message)) {
      return NextResponse.json({ error: BUDGET_TABLE_SETUP }, { status: 500 });
    }
    return NextResponse.json({ error: existing.error.message }, { status: 500 });
  }
  if (!existing.data) {
    return NextResponse.json({ error: "예산 라운드를 찾을 수 없습니다." }, { status: 404 });
  }

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
    .update(payload)
    .eq("id", id)
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
      .update(payload)
      .eq("id", id)
      .select(select)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }
  if (error && isBudgetStatusCheckError(error.message)) {
    const retry = await supabase
      .from("company_budget_rounds")
      .update({ ...withLegacyBudgetStatuses(payload), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(select)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }
  if (error) {
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
  let warning: string | undefined;
  try {
    budgets = await syncDepositedBudgets(supabase, [
      existing.data.company_id,
      named.company_id,
    ]);
  } catch (err) {
    warning = err instanceof Error ? err.message : "배정 예산 반영 실패";
  }
  if (existing.data.campaign_id) {
    try {
      await syncCampaignBudgetFromRounds(supabase, existing.data.campaign_id);
    } catch (err) {
      warning = warning || (err instanceof Error ? err.message : "캠페인 예산 반영 실패");
    }
  }
  return NextResponse.json({
    round: data ? normalizeBudgetRound(data as unknown as BudgetRound) : data,
    budgets,
    warning,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();
  const { id } = await context.params;

  const existing = await supabase
    .from("company_budget_rounds")
    .select("id, company_id, campaign_id")
    .eq("id", id)
    .maybeSingle();
  if (existing.error) {
    return NextResponse.json({ error: existing.error.message }, { status: 500 });
  }
  if (!existing.data) {
    return NextResponse.json({ error: "예산 라운드를 찾을 수 없습니다." }, { status: 404 });
  }

  // cascade 없을 때 사용 분할 먼저 삭제
  await supabase.from("company_budget_rounds").delete().eq("source_deposit_id", id);

  const { error } = await supabase.from("company_budget_rounds").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let warning: string | undefined;
  let budgets: { company_id: string; budget_amount: number | null }[] = [];
  try {
    budgets = await syncDepositedBudgets(supabase, [existing.data.company_id]);
  } catch (err) {
    warning = err instanceof Error ? err.message : "배정 예산 반영 실패";
  }
  if (existing.data.campaign_id) {
    try {
      await syncCampaignBudgetFromRounds(supabase, existing.data.campaign_id);
    } catch (err) {
      warning = warning || (err instanceof Error ? err.message : "캠페인 예산 반영 실패");
    }
  }
  return NextResponse.json({ ok: true, budgets, warning });
}
