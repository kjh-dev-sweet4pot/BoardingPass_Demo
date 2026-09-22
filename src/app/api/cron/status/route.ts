import { NextResponse } from "next/server";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";

/** GET /api/cron/status?job=collect-metrics — 크론이 실제로 기록한 마지막/다음 실행 시각 */
export async function GET(request: Request) {
  const job = new URL(request.url).searchParams.get("job") || "collect-metrics";
  const supabase = await createApiClientIfConfigured();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("cron_run_status")
    .select("job_name, last_run_at, next_run_at, last_status")
    .eq("job_name", job)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ status: data || null });
}
