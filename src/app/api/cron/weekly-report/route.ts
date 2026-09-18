import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyReports } from "@/lib/company-notify-send";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";

/**
 * GET /api/cron/weekly-report
 * 매주 금요일 오후(KST) — vercel.json cron 또는 CRON_SECRET Bearer로 호출.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasServiceRoleKey()) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY가 필요합니다." }, { status: 500 });
  }

  try {
    const supabase = createServiceClient();
    const result = await sendWeeklyReports(supabase);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "주간 리포트 발송 실패" },
      { status: 500 },
    );
  }
}

export const maxDuration = 120;
