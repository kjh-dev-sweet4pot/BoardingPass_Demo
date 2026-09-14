import { NextResponse } from "next/server";
import { requireAdminManager, requireAnyAdmin } from "@/lib/access";
import { isMissingColumnError } from "@/lib/company";
import {
  BUDGET_ROUND_SELECT,
  BUDGET_TABLE_SETUP,
  budgetTableMissing,
  fillCompanyName,
  readRoundBody,
  syncDepositedBudgets,
  type BudgetRound,
} from "@/lib/company-budget-rounds";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

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

  if (error && isMissingColumnError(error.message, "kind")) {
    const fallback = await supabase
      .from("company_budget_rounds")
      .select(BUDGET_ROUND_SELECT.replace(", kind", ""))
      .order("period_month", { ascending: true })
      .order("company_name", { ascending: true });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    if (budgetTableMissing(error.message)) {
      return NextResponse.json({ error: BUDGET_TABLE_SETUP }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rounds: (data || []) as BudgetRound[] });
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

  let { data, error } = await supabase
    .from("company_budget_rounds")
    .insert({ ...named, updated_at: new Date().toISOString() })
    .select(BUDGET_ROUND_SELECT)
    .maybeSingle();
  if (error && isMissingColumnError(error.message, "kind")) {
    if (named.kind === "사용") {
      return NextResponse.json(
        { error: "입금과 사용 계획을 나누려면 SQL을 다시 실행하세요. " + BUDGET_TABLE_SETUP },
        { status: 500 },
      );
    }
    const { kind: _kind, ...legacy } = named;
    const fallback = await supabase
      .from("company_budget_rounds")
      .insert({ ...legacy, updated_at: new Date().toISOString() })
      .select(BUDGET_ROUND_SELECT.replace(", kind", ""))
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
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
      { round: data, warning: err instanceof Error ? err.message : "배정 예산 반영 실패" },
      { status: 200 },
    );
  }
  return NextResponse.json({ round: data, budgets });
}
