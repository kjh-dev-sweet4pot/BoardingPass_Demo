import { NextRequest, NextResponse } from "next/server";
import { runMetricsScheduler } from "@/lib/run-metrics-scheduler";
import { checkHighEngagementAndNotify } from "@/lib/company-notify-send";
import { CRON_TICK_MS } from "@/lib/metrics-schedule";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";

const JOB_NAME = "collect-metrics";

async function recordCronRun(
  supabase: ReturnType<typeof createServiceClient>,
  status: "ok" | "error",
  error?: string,
  counts?: { processed: number; succeeded: number; failed: number },
) {
  const now = Date.now();
  await Promise.all([
    supabase.from("cron_run_status").upsert({
      job_name: JOB_NAME,
      last_run_at: new Date(now).toISOString(),
      next_run_at: new Date(Math.ceil((now + 1) / CRON_TICK_MS) * CRON_TICK_MS).toISOString(),
      last_status: status,
      last_error: error || null,
    }),
    supabase.from("cron_run_log").insert({
      job_name: JOB_NAME,
      ran_at: new Date(now).toISOString(),
      status,
      error: error || null,
      processed: counts?.processed ?? null,
      succeeded: counts?.succeeded ?? null,
      failed: counts?.failed ?? null,
    }),
  ]);
}

/**
 * GET /api/cron/collect-metrics
 * Vercel Cron 또는 CRON_SECRET Bearer 로 호출.
 * 발행 후 72h: 1h 간격, 이후 1일 1회. 캠페인 `결과`·`취소` 시 중단.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY가 필요합니다." },
      { status: 500 },
    );
  }
  if (!process.env.APIFY_TOKEN?.trim()) {
    return NextResponse.json(
      { error: "APIFY_TOKEN이 없습니다." },
      { status: 500 },
    );
  }

  // 기본: 상한 없이 due한 것 전부 — 28개씩(Apify 동시 한도) 배치로 나눠 순차 처리한다.
  // 중간에 시간 초과로 죽어도 좀비 job은 10분 후 자동 재시도 대상이 되므로 안전하다.
  const limitParam = new URL(request.url).searchParams.get("limit");
  const maxJobs = limitParam ? parseInt(limitParam, 10) : Number.MAX_SAFE_INTEGER;

  const supabase = createServiceClient();
  try {
    const result = await runMetricsScheduler(supabase, { maxJobs });
    const engagement = await checkHighEngagementAndNotify(supabase).catch(() => null);
    await recordCronRun(supabase, "ok", undefined, result).catch(() => {});
    return NextResponse.json({ ok: true, ...result, engagement });
  } catch (err) {
    const message = err instanceof Error ? err.message : "스케줄러 실패";
    await recordCronRun(supabase, "error", message).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const maxDuration = 300;
