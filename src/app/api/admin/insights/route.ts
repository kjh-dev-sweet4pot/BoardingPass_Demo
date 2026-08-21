import { NextRequest, NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { fetchInsights } from "@/app/api/com/insights/route";

/**
 * GET /api/admin/insights?company_id=&days=90
 * 전체 또는 회원사별 발행 콘텐츠 성과 (원가·마진 미포함)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id") || null;
  const days = Math.min(parseInt(searchParams.get("days") || "90", 10) || 90, 365);

  try {
    const payload = await fetchInsights(supabase, companyId, { days });
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
