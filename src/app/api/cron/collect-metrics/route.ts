import { NextRequest, NextResponse } from "next/server";
import { runMetricsScheduler } from "@/lib/run-metrics-scheduler";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";

/**
 * GET /api/cron/collect-metrics
 * Vercel Cron 또는 CRON_SECRET Bearer 로 호출.
 * 발행 후 72h: 6h 간격, 이후 1일 1회. 캠페인 `결과`·`취소` 시 중단.
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

  const maxJobs = Math.min(
    parseInt(new URL(request.url).searchParams.get("limit") || "5", 10),
    20,
  );

  try {
    const supabase = createServiceClient();
    const result = await runMetricsScheduler(supabase, { maxJobs });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "스케줄러 실패" },
      { status: 500 },
    );
  }
}

export const maxDuration = 120;
