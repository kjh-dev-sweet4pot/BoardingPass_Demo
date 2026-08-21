import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { getCompanySessionId } from "@/lib/session";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InsightsPayload = {
  links: unknown[];
  metrics: unknown[];
  collectedAt: string | null;
  source: "apify";
};

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

export async function fetchInsights(
  supabase: SupabaseClient,
  companyId: string,
  { productId = null, days = 90 }: { productId?: string | null; days?: number } = {},
): Promise<InsightsPayload> {
  // 1단계: 회원사 소속 allocation ids
  let allocQuery = supabase
    .from("allocations")
    .select("id, influencer_id, target_content_count, influencers(id, name, instagram_handle_normalized, instagram_handle), products(id, name)")
    .eq("company_id", companyId);

  if (productId) allocQuery = allocQuery.eq("product_id", productId);

  const { data: allocs, error: allocErr } = await allocQuery;
  if (allocErr) throw new Error(allocErr.message);
  if (!allocs || allocs.length === 0) return { links: [], metrics: [], collectedAt: null, source: "apify" };

  const allocMap = new Map(allocs.map((a) => [a.id, a]));
  const allocIds = allocs.map((a) => a.id);

  // 2단계: 발행완료 creator_links
  // legacy: T3 이전 데이터는 status=approved, content_status=null 인 공개 게시물 URL만 남아있다.
  // published_at 컬럼은 스키마에 없음 — 타임라인 앵커는 submitted_at만 사용 (updated_at 금지)
  const { data: rawLinks, error: linksErr } = await supabase
    .from("creator_links")
    .select(
      "id, url, publish_url, status, submitted_at, views, likes, comments, saves, shares, reposts, metrics_collected_at, allocation_id",
    )
    .in("allocation_id", allocIds)
    .or("content_status.eq.발행완료,publish_url.not.is.null,and(content_status.is.null,status.eq.approved)");

  if (linksErr) throw new Error(linksErr.message);
  if (!rawLinks || rawLinks.length === 0) return { links: [], metrics: [], collectedAt: null, source: "apify" };

  // 관계 데이터 병합
  const links = rawLinks.map((l) => ({
    id: l.id,
    link_url: (l.publish_url || l.url || "").trim() || null,
    status: l.status,
    published_at: l.submitted_at || null,
    views: l.views,
    likes: l.likes,
    comments: l.comments,
    saves: l.saves,
    shares: l.shares,
    reposts: l.reposts,
    metrics_collected_at: l.metrics_collected_at,
    allocation_id: l.allocation_id,
    allocations: allocMap.get(l.allocation_id) ?? null,
  }));

  const linkIds = links.map((l) => l.id);
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();

  const { data: metrics, error: metricsErr } = await supabase
    .from("content_metrics")
    .select("creator_link_id, collected_at, views, likes, comments, saves, shares, reposts")
    .in("creator_link_id", linkIds)
    .gte("collected_at", since)
    .order("collected_at", { ascending: true });

  if (metricsErr) throw new Error(metricsErr.message);

  const collectedAt =
    metrics && metrics.length > 0 ? metrics[metrics.length - 1].collected_at : null;

  return { links, metrics: metrics ?? [], collectedAt, source: "apify" };
}

/**
 * GET /api/com/insights?product_id=&days=30
 * 회원사 소속 발행완료 콘텐츠의 content_metrics 시계열 반환
 * 원가·마진 미포함 (R3)
 */
export async function GET(request: NextRequest) {
  const companyId = await getCompanySessionId();
  if (!companyId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("product_id") || null;
  const days = Math.min(parseInt(searchParams.get("days") || "90", 10), 365);

  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  try {
    const payload = await fetchInsights(supabase, companyId, { productId, days });
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
