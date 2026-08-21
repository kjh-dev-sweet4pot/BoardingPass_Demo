import { NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/access";
import { refreshLinkMetricsNow } from "@/lib/run-metrics-scheduler";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  if (!process.env.APIFY_TOKEN?.trim()) {
    return NextResponse.json(
      { error: "APIFY_TOKEN 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  try {
    const result = await refreshLinkMetricsNow(supabase, id);
    return NextResponse.json({
      metrics: {
        views: result.metrics.views,
        likes: result.metrics.likes,
        comments: result.metrics.comments,
        saves: result.metrics.saves,
        shares: result.metrics.shares,
        reposts: result.metrics.reposts,
        collected_at: result.collectedAt,
      },
      verificationFailed: result.verificationFailed ?? false,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "지표 조회 실패" },
      { status: 500 },
    );
  }
}
