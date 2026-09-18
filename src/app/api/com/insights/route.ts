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
  {
    productId = null,
    days = 90,
    excludeCompanyIds = [],
  }: { productId?: string | null; days?: number; excludeCompanyIds?: string[] } = {},
): Promise<InsightsPayload> {
  // 발행된 콘텐츠(creator_links)에서 시작해 allocations를 조인한다 — 예전엔
  // 회사 전체 allocations를 먼저 다 긁어온 뒤 그 id로 creator_links를 다시
  // 청크 조회했는데(admin "전체" 뷰는 사실상 풀스캔), 실제로 필요한 건
  // "발행된 것"뿐이라 그걸 기준으로 좁혀서 한 번에 조인 조회한다.
  const allocEmbed =
    "id, company_id, influencer_id, target_content_count, influencers(id, name, instagram_handle_normalized, instagram_handle, region), products(id, name), companies(id, name), allocation_pricing(display_price)";

  function baseLinksQuery() {
    let q = supabase
      .from("creator_links")
      .select(
        `id, url, publish_url, status, submitted_at, published_at, views, likes, comments, saves, shares, reposts, metrics_collected_at, allocation_id,
         allocations!inner ( ${allocEmbed} )`,
      )
      .or(
        "content_status.eq.발행완료,publish_url.not.is.null,and(content_status.is.null,status.eq.approved)",
      )
      .order("id", { ascending: true });
    if (companyId) q = q.eq("allocations.company_id", companyId);
    else if (excludeCompanyIds.length) {
      q = q.not("allocations.company_id", "in", `(${excludeCompanyIds.join(",")})`);
    }
    if (productId) q = q.eq("allocations.product_id", productId);
    return q;
  }

  let countQuery = supabase
    .from("creator_links")
    .select("id, allocations!inner(company_id, product_id)", { count: "exact", head: true })
    .or(
      "content_status.eq.발행완료,publish_url.not.is.null,and(content_status.is.null,status.eq.approved)",
    );
  if (companyId) countQuery = countQuery.eq("allocations.company_id", companyId);
  else if (excludeCompanyIds.length) {
    countQuery = countQuery.not("allocations.company_id", "in", `(${excludeCompanyIds.join(",")})`);
  }
  if (productId) countQuery = countQuery.eq("allocations.product_id", productId);
  const { count: linkCount, error: countErr } = await countQuery;
  if (countErr) throw new Error(countErr.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawLinks: any[] = [];
  if (linkCount && linkCount > 0) {
    const pageStarts: number[] = [];
    for (let from = 0; from < linkCount; from += ALLOC_PAGE) pageStarts.push(from);
    const pages = await Promise.all(
      pageStarts.map((from) => baseLinksQuery().range(from, from + ALLOC_PAGE - 1)),
    );
    for (const { data, error: linksErr } of pages) {
      if (linksErr) throw new Error(linksErr.message);
      rawLinks.push(...(data || []));
    }
  }
  if (rawLinks.length === 0) return { links: [], metrics: [], collectedAt: null, source: "apify" };

  // 관계 데이터 병합 (노출가만 — 원가·마진 미포함)
  const links = rawLinks.map((l) => {
    const alloc = Array.isArray(l.allocations) ? l.allocations[0] : l.allocations;
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
  const metricPages = await Promise.all(
    chunkIds(linkIds).map((part) =>
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
  for (const { data, error: metricsErr } of metricPages) {
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
