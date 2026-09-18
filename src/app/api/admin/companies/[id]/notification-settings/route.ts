import { NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/lib/company-notifications";

/** GET /api/admin/companies/[id]/notification-settings — 회원사가 켠 자동 알림 설정 조회(관리자용). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { id } = await context.params;
  const { data, error } = await supabase
    .from("company_notification_settings")
    .select("weekly_report, on_publish, high_engagement")
    .eq("company_id", id)
    .maybeSingle();
  if (error) {
    if (error.message.toLowerCase().includes("schema cache") || error.message.includes("company_notification_settings")) {
      return NextResponse.json({ settings: DEFAULT_NOTIFICATION_SETTINGS });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: { ...DEFAULT_NOTIFICATION_SETTINGS, ...(data || {}) } });
}
