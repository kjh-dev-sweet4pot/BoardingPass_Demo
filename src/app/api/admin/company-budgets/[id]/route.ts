import { NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { isMissingColumnError } from "@/lib/company";
import {
  BUDGET_ROUND_SELECT,
  BUDGET_TABLE_SETUP,
  budgetTableMissing,
  fillCompanyName,
  readRoundBody,
  syncDepositedBudgets,
} from "@/lib/company-budget-rounds";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

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
    .select("id, company_id")
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

  let { data, error } = await supabase
    .from("company_budget_rounds")
    .update({ ...named, updated_at: new Date().toISOString() })
    .eq("id", id)
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
      .update({ ...legacy, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(BUDGET_ROUND_SELECT.replace(", kind", ""))
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
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
  try {
    budgets = await syncDepositedBudgets(supabase, [
      existing.data.company_id,
      named.company_id,
    ]);
  } catch (err) {
    return NextResponse.json({
      round: data,
      warning: err instanceof Error ? err.message : "배정 예산 반영 실패",
    });
  }
  return NextResponse.json({ round: data, budgets });
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
    .select("id, company_id")
    .eq("id", id)
    .maybeSingle();
  if (existing.error) {
    return NextResponse.json({ error: existing.error.message }, { status: 500 });
  }
  if (!existing.data) {
    return NextResponse.json({ error: "예산 라운드를 찾을 수 없습니다." }, { status: 404 });
  }

  const { error } = await supabase.from("company_budget_rounds").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const budgets = await syncDepositedBudgets(supabase, [existing.data.company_id]);
  return NextResponse.json({ ok: true, budgets });
}
