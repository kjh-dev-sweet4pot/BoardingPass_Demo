import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { getCompanySessionId } from "@/lib/session";
import { resolveCreatorPlatform } from "@/lib/creator-link";
import { estimateXiaohongshuViews } from "@/lib/xiaohongshu-views";
import { padMetricsBeforeFirstCollect } from "@/lib/content-metrics-ramp";
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

const ALLOC_PAGE = 1000;
/** PostgREST `.in()` URL 한도. 1000개면 Bad Request */
const IN_CHUNK = 80;

export function chunkIds(ids: string[], size = IN_CHUNK) {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/** 이미 가진 발행 링크의 content_metrics만. allocations/links 재조회 없음. */
export async function fetchMetricsForLinks(
  supabase: SupabaseClient,
  links: {
    id: string;
    published_at: string | null;
    views: number | null;
    likes?: number | null;
    comments?: number | null;
    saves?: number | null;
    shares?: number | null;
    reposts?: number | null;
    link_url?: string | null;
  }[],
  { days = 90 }: { days?: number } = {},
) {
  if (links.length === 0) return [];

  const xhsLinkIds = new Set(
    links
      .filter((l) => resolveCreatorPlatform(l.link_url) === "xiaohongshu")
      .map((l) => l.id),
  );
  const posted = links
    .map((l) => l.published_at)
    .filter((s): s is string => Boolean(s))
    .sort();
  const since =
    posted[0] ||
    new Date(Date.now() - days * 86400 * 1000).toISOString();

  const parts = chunkIds(links.map((l) => l.id));
  const pages = await Promise.all(
    parts.map((part) =>
      supabase
        .from("content_metrics")
        .select(
          "creator_link_id, collected_at, views, likes, comments, saves, shares, reposts",
        )
        .in("creator_link_id", part)
        .gte("collected_at", since)
        .order("collected_at", { ascending: true }),
    ),
  );

  const metrics: {
    creator_link_id: string;
    collected_at: string;
    views: number | null;
    likes: number | null;
    comments: number | null;
    saves: number | null;
    shares: number | null;
    reposts: number | null;
  }[] = [];
  for (const { data, error } of pages) {
    if (error) throw new Error(error.message);
    metrics.push(...(data || []));
  }

  const metricRows = metrics.map((m) => {
    if (!xhsLinkIds.has(m.creator_link_id)) return m;
    return {
      ...m,
      views: estimateXiaohongshuViews({
        views: m.views,
        likes: m.likes,
        comments: m.comments,
        saves: m.saves,
        shares: m.shares,
      }),
    };
  });

  return padMetricsBeforeFirstCollect(links, metricRows);
}

export async function fetchInsights(
  supabase: SupabaseClient,
  companyId: string | null,
  { productId = null, days = 90 }: { productId?: string | null; days?: number } = {},
): Promise<InsightsPayload> {
  // 1단계: allocation ids (companyId null = 전체 회원사)
  const allocSelect =
    "id, company_id, influencer_id, target_content_count, influencers(id, name, instagram_handle_normalized, instagram_handle, region), products(id, name), companies(id, name), allocation_pricing(display_price)";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allocs: any[] = [];
  for (let from = 0; ; from += ALLOC_PAGE) {
    let allocQuery = supabase
      .from("allocations")
      .select(allocSelect)
      .range(from, from + ALLOC_PAGE - 1);
    if (companyId) allocQuery = allocQuery.eq("company_id", companyId);
    if (productId) allocQuery = allocQuery.eq("product_id", productId);
    const { data, error: allocErr } = await allocQuery;
    if (allocErr) throw new Error(allocErr.message);
    allocs.push(...(data || []));
    if (!data || data.length < ALLOC_PAGE) break;
  }
  if (allocs.length === 0)
    return { links: [], metrics: [], collectedAt: null, source: "apify" };

  const allocMap = new Map(allocs.map((a) => [a.id, a]));
  const allocIds = allocs.map((a) => a.id as string);

  const rawLinks: {
    id: string;
    url: string | null;
    publish_url: string | null;
    status: string;
    submitted_at: string | null;
    published_at: string | null;
    views: number | null;
    likes: number | null;
    comments: number | null;
    saves: number | null;
    shares: number | null;
    reposts: number | null;
    metrics_collected_at: string | null;
    allocation_id: string;
  }[] = [];
  for (const part of chunkIds(allocIds)) {
    const { data, error: linksErr } = await supabase
      .from("creator_links")
      .select(
        "id, url, publish_url, status, submitted_at, published_at, views, likes, comments, saves, shares, reposts, metrics_collected_at, allocation_id",
      )
      .in("allocation_id", part)
      .or(
        "content_status.eq.발행완료,publish_url.not.is.null,and(content_status.is.null,status.eq.approved)",
      );
    if (linksErr) throw new Error(linksErr.message);
    rawLinks.push(...(data || []));
  }
  if (!rawLinks || rawLinks.length === 0) return { links: [], metrics: [], collectedAt: null, source: "apify" };

  // 관계 데이터 병합 (노출가만 — 원가·마진 미포함)
  const links = rawLinks.map((l) => {
    const alloc = allocMap.get(l.allocation_id) ?? null;
    const link_url = (l.publish_url || l.url || "").trim() || null;
    const views =
      resolveCreatorPlatform(link_url) === "xiaohongshu"
        ? estimateXiaohongshuViews({
            views: l.views,
            likes: l.likes,
            comments: l.comments,
            saves: l.saves,
            shares: l.shares,
          })
        : l.views;
    return {
      id: l.id,
      link_url,
      status: l.status,
      published_at: l.published_at || l.submitted_at || null,
      views,
      likes: l.likes,
      comments: l.comments,
      saves: l.saves,
      shares: l.shares,
      reposts: l.reposts,
      metrics_collected_at: l.metrics_collected_at,
      allocation_id: l.allocation_id,
      allocations: alloc,
    };
  });
  const xhsLinkIds = new Set(
    links
      .filter((l) => resolveCreatorPlatform(l.link_url) === "xiaohongshu")
      .map((l) => l.id),
  );

  const linkIds = links.map((l) => l.id);
  const posted = rawLinks
    .map((l) => l.published_at)
    .filter((s): s is string => Boolean(s))
    .sort();
  const since =
    posted[0] ||
    new Date(Date.now() - days * 86400 * 1000).toISOString();
  const metrics: {
    creator_link_id: string;
    collected_at: string;
    views: number | null;
    likes: number | null;
    comments: number | null;
    saves: number | null;
    shares: number | null;
    reposts: number | null;
  }[] = [];
  for (const part of chunkIds(linkIds)) {
    const { data, error: metricsErr } = await supabase
      .from("content_metrics")
      .select(
        "creator_link_id, collected_at, views, likes, comments, saves, shares, reposts",
      )
      .in("creator_link_id", part)
      .gte("collected_at", since)
      .order("collected_at", { ascending: true });
    if (metricsErr) throw new Error(metricsErr.message);
    metrics.push(...(data || []));
  }

  const collectedAt =
    metrics && metrics.length > 0 ? metrics[metrics.length - 1].collected_at : null;

  const metricRows = (metrics ?? []).map((m) => {
    if (!xhsLinkIds.has(m.creator_link_id)) return m;
    return {
      ...m,
      views: estimateXiaohongshuViews({
        views: m.views,
        likes: m.likes,
        comments: m.comments,
        saves: m.saves,
        shares: m.shares,
      }),
    };
  });

  return {
    links,
    metrics: padMetricsBeforeFirstCollect(links, metricRows),
    collectedAt,
    source: "apify",
  };
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
