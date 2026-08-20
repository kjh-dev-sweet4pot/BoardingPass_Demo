import { NextResponse } from "next/server";
import { isDemoCompany } from "@/lib/company";
import { buildMockContentInsights } from "@/lib/content-insights-mock";
import { getCompanySessionId } from "@/lib/session";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { type AllocationWithRelations } from "@/lib/types";

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

/**
 * 회원사 콘텐츠 성과 스냅샷.
 * login_id=company 만 지표를 목업하고, 그 외는 배정·링크에 있는 값만 쓴다.
 */
export async function GET(request: Request) {
  const companyId = await getCompanySessionId();
  if (!companyId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const period =
    new URL(request.url).searchParams.get("period") === "all" ? "all" : "month";

  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("login_id")
    .eq("id", companyId)
    .maybeSingle();
  if (companyError) {
    return NextResponse.json({ error: companyError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("allocations")
    .select(
      "*, products(*), stores(*), influencers(id, name, instagram_handle, instagram_handle_normalized, sns_url), creator_links(*)",
    )
    .eq("company_id", companyId)
    .order("visit_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const snapshot = buildMockContentInsights(
    (data as AllocationWithRelations[]) || [],
    period,
    { fabricate: isDemoCompany(company ?? {}) },
  );
  return NextResponse.json({ insights: snapshot });
}
