import { NextResponse } from "next/server";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { getCompanySessionId } from "@/lib/session";

export async function GET() {
  const companyId = await getCompanySessionId();
  if (!companyId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = await createApiClientIfConfigured();
  if (!supabase) return supabaseConfigError();
  const { data, error } = await supabase
    .from("allocations")
    .select(
      "*, products(*), stores(*), influencers(id, name, instagram_handle, instagram_handle_normalized, sns_url), creator_links(*)",
    )
    .eq("company_id", companyId)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ allocations: data || [] });
}
