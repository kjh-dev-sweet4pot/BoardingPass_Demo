import { NextResponse } from "next/server";
import { buildBudgetPerformanceForCompany } from "@/lib/company-budget-performance";
import { getCompanySessionId } from "@/lib/session";
import {
  createApiClientIfConfigured,
  supabaseConfigError,
} from "@/lib/supabase/api-client";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

/**
 * GET /api/com/budget-performance
 * 노출가 기준 예산 사용·차감 예정. 원가·마진 미포함 (R3)
 */
export async function GET() {
  const companyId = await getCompanySessionId();
  if (!companyId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  let { data: company, error: companyErr } = await supabase
    .from("companies")
    .select("id, name, login_id, budget_amount")
    .eq("id", companyId)
    .maybeSingle();
  if (companyErr?.message?.toLowerCase().includes("budget_amount")) {
    const fallback = await supabase
      .from("companies")
      .select("id, name, login_id")
      .eq("id", companyId)
      .maybeSingle();
    company = fallback.data as typeof company;
    companyErr = fallback.error;
  }
  if (companyErr || !company) {
    return NextResponse.json(
      { error: companyErr?.message || "회원사를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  try {
    const payload = await buildBudgetPerformanceForCompany(supabase, company);
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "예산 성과를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
