import { NextResponse } from "next/server";
import { fetchMetricsForLinks } from "@/app/api/com/insights/route";
import { getCompanySessionId } from "@/lib/session";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { buildViewsCurvePoints } from "@/lib/company-home";

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

/**
 * GET /api/com/creator-pool/[id]/views-curve
 * 크리에이터 상세 보기 — 이 회원사 배정에 발행된 콘텐츠의 조회수 증가 추이(D+n).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const companyId = await getCompanySessionId();
  if (!companyId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id: influencerId } = await params;

  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  const { data: allocs, error: allocErr } = await supabase
    .from("allocations")
    .select("id")
    .eq("company_id", companyId)
    .eq("influencer_id", influencerId);
  if (allocErr) return NextResponse.json({ error: allocErr.message }, { status: 500 });

  const allocIds = (allocs ?? []).map((a) => a.id);
  if (allocIds.length === 0) return NextResponse.json({ points: [] });

  const { data: links, error: linkErr } = await supabase
    .from("creator_links")
    .select("id, url, publish_url, published_at, submitted_at, views, likes, comments, saves, shares, reposts")
    .in("allocation_id", allocIds)
    .or("content_status.eq.발행완료,publish_url.not.is.null");
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

  const homeLinks = (links ?? []).map((l) => ({
    id: l.id as string,
    published_at: (l.published_at as string | null) || (l.submitted_at as string | null),
    views: l.views as number | null,
    likes: l.likes as number | null,
    comments: l.comments as number | null,
    saves: l.saves as number | null,
    shares: l.shares as number | null,
    reposts: l.reposts as number | null,
    link_url: (l.publish_url as string | null) || (l.url as string | null),
  }));

  const metrics = await fetchMetricsForLinks(supabase, homeLinks, { days: 90 });
  const points = buildViewsCurvePoints(
    homeLinks.map((l) => ({ id: l.id, published_at: l.published_at })),
    metrics,
  );

  return NextResponse.json({ points });
}
