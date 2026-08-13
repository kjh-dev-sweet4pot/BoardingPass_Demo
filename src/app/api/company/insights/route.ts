import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildMockContentInsights } from "@/lib/content-insights-mock";
import { getCompanySessionId } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { type AllocationWithRelations } from "@/lib/types";

/**
 * 회원사 콘텐츠 성과 스냅샷.
 * 현재는 mock. Apify 수집분이 생기면 이 핸들러만 live 조회로 교체하면
 * /com 대시보드가 그대로 따라갑니다.
 */
export async function GET(request: Request) {
  const companyId = await getCompanySessionId();
  if (!companyId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const period =
    new URL(request.url).searchParams.get("period") === "all" ? "all" : "month";

  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  const supabase = createClient(url, key);
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

  // TODO(apify): content_metrics 테이블이 있으면 source:"apify" 스냅샷으로 교체
  const snapshot = buildMockContentInsights(
    (data as AllocationWithRelations[]) || [],
    period,
  );

  return NextResponse.json({ insights: snapshot });
}
