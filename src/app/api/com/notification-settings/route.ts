import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { getCompanySessionId } from "@/lib/session";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from "@/lib/company-notifications";

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

export async function GET() {
  const companyId = await getCompanySessionId();
  if (!companyId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("company_notification_settings")
    .select("weekly_report, on_publish, high_engagement")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    settings: (data as NotificationSettings | null) || DEFAULT_NOTIFICATION_SETTINGS,
  });
}

export async function PATCH(request: NextRequest) {
  const companyId = await getCompanySessionId();
  if (!companyId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  let body: Partial<NotificationSettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("company_notification_settings")
    .select("weekly_report, on_publish, high_engagement")
    .eq("company_id", companyId)
    .maybeSingle();
  const merged: NotificationSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(existing as NotificationSettings | null),
    ...body,
  };

  const { error } = await supabase
    .from("company_notification_settings")
    .upsert({ company_id: companyId, ...merged, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ settings: merged });
}
