import { NextResponse } from "next/server";
import { isDemoCompany } from "@/lib/company";
import {
  chunkIds,
  fetchMetricsForLinks,
} from "@/app/api/com/insights/route";
import { isPublishedComplete } from "@/lib/company-budget-performance";
import { resolveCreatorPlatform } from "@/lib/creator-link";
import {
  buildDerivedNews,
  buildHomeForecast,
  buildViewsCurvePoints,
  cumulativeViewsSeriesFromMetrics,
  rankBestPosts,
  rankInfluencers,
  splitHomeVisits,
  summarizeBudget,
  windowStartIso,
  wowPct,
  ymdKstNow,
  type CompanyHomeBestPost,
  type CompanyHomeInfluencerRow,
  type CompanyHomePayload,
  type HomeForecastAvg,
  type HomeInsightLink,
} from "@/lib/company-home";
import profileMetrics from "@/lib/data/pool-profile-metrics.json";
import { estimateXiaohongshuViews } from "@/lib/xiaohongshu-views";
import { getCompanySessionId } from "@/lib/session";
import {
  createApiClientIfConfigured,
  supabaseConfigError,
} from "@/lib/supabase/api-client";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

function one<T>(v: T | T[] | null | undefined): T | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

const PUBLISHED_OR =
  "content_status.eq.발행완료,publish_url.not.is.null,and(content_status.is.null,status.eq.approved)";

/**
 * GET /api/com/home
 * 회원사 요약 랜딩: 예산·베스트 게시물·뉴스. 원가·마진 미포함 (R3)
 */
export async function GET() {
  const companyId = await getCompanySessionId();
  if (!companyId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  let { data: company, error: companyErr } = await supabase
    .from("companies")
    .select("id, name, login_id, budget_amount")
    .eq("id", companyId)
    .maybeSingle();
  if (companyErr?.message?.toLowerCase().includes("budget_amount")) {
    const fallback = await supabase
      .from("companies")
      .select("id, name, login_id")
      .eq("id", companyId)
      .maybeSingle();
    company = fallback.data as typeof company;
    companyErr = fallback.error;
  }
  if (companyErr || !company) {
    return NextResponse.json(
      { error: companyErr?.message || "회원사를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const companyBudget = Number(company.budget_amount);
  const hasCompanyBudget =
    Number.isFinite(companyBudget) && companyBudget > 0;

  const allocPromise = supabase
    .from("allocations")
    .select(
      "id, influencer_id, status, rollup_status, target_content_count, visit_date, influencers(id, name, instagram_handle_normalized, instagram_handle, sns_url, followers, region), products(id, name), stores(id, name), allocation_pricing(display_price)",
    )
    .eq("company_id", companyId);

  const campPromise = hasCompanyBudget
    ? Promise.resolve({ sum: 0, error: null as string | null })
    : supabase
        .from("campaigns")
        .select("budget_amount")
        .eq("company_id", companyId)
        .then((r) => {
          if (r.error) return { sum: 0, error: r.error.message };
          let sum = 0;
          for (const c of r.data || []) {
            const n = Number(c.budget_amount);
            if (Number.isFinite(n)) sum += n;
          }
          return { sum, error: null as string | null };
        });

  const [allocRes, camp] = await Promise.all([allocPromise, campPromise]);

  if (camp.error) {
    return NextResponse.json({ error: camp.error }, { status: 500 });
  }
  if (allocRes.error) {
    return NextResponse.json({ error: allocRes.error.message }, { status: 500 });
  }

  const campaignBudgetSum = camp.sum;
  const budgetTotal = hasCompanyBudget
    ? companyBudget
    : campaignBudgetSum > 0
      ? campaignBudgetSum
      : null;

  const allocs = allocRes.data || [];
  const allocMap = new Map(allocs.map((a) => [a.id, a]));
  const activeAllocs = allocs.filter(
    (a) => a.status !== "cancelled" && a.rollup_status !== "취소",
  );
  const allocIds = allocs.map((a) => a.id);

  type LinkRow = {
    id: string;
    url: string | null;
    publish_url: string | null;
    submitted_at: string | null;
    published_at: string | null;
    views: number | null;
    likes: number | null;
    comments: number | null;
    saves: number | null;
    shares: number | null;
    allocation_id: string;
  };
  const rawLinks: LinkRow[] = [];
  if (allocIds.length > 0) {
    const pages = await Promise.all(
      chunkIds(allocIds).map((part) =>
        supabase
          .from("creator_links")
          .select(
            "id, url, publish_url, submitted_at, published_at, views, likes, comments, saves, shares, allocation_id",
          )
          .in("allocation_id", part)
          .or(PUBLISHED_OR),
      ),
    );
    for (const { data, error } of pages) {
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      rawLinks.push(...((data || []) as LinkRow[]));
    }
  }

  const publishedByAlloc = new Map<string, LinkRow[]>();
  for (const l of rawLinks) {
    const list = publishedByAlloc.get(l.allocation_id) || [];
    list.push(l);
    publishedByAlloc.set(l.allocation_id, list);
  }

  let spent = 0;
  let scheduled = 0;
  for (const a of activeAllocs) {
    const complete = isPublishedComplete({
      rollupStatus: a.rollup_status,
      targetContentCount: a.target_content_count,
      links: (publishedByAlloc.get(a.id) || []).map((l) => ({
        content_status: "발행완료",
        publish_url: l.publish_url,
      })),
    });
    const pricing = one(a.allocation_pricing);
    const parsed = Number(pricing?.display_price);
    const price = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    if (complete) spent += price;
    else scheduled += price;
  }
  const budget = summarizeBudget(budgetTotal, spent, scheduled);

  const publishedAllocIds = new Set(publishedByAlloc.keys());

  let posts: CompanyHomeBestPost[] = [];
  let homeLinks: HomeInsightLink[] = [];

  for (const l of rawLinks) {
    const alloc = allocMap.get(l.allocation_id);
    const inf = one(alloc?.influencers);
    const product = one(alloc?.products);
    const handleRaw =
      inf?.instagram_handle_normalized || inf?.instagram_handle || "";
    const handle = handleRaw
      ? `@${String(handleRaw).replace(/^@+/, "")}`
      : "—";
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
        : Number(l.views) || 0;
    const influencerId =
      inf?.id ||
      (alloc as { influencer_id?: string } | undefined)?.influencer_id ||
      l.id;
    posts.push({
      id: l.id,
      influencerId,
      url: link_url,
      handle,
      name: inf?.name || "인플루언서",
      product: product?.name || "상품",
      views,
      likes: Number(l.likes) || 0,
      comments: Number(l.comments) || 0,
      publishedAt: l.published_at || l.submitted_at || null,
    });
    homeLinks.push({
      id: l.id,
      link_url,
      published_at: l.published_at || l.submitted_at || null,
      views,
      likes: l.likes,
      saves: l.saves,
      allocations: {
        influencer_id: alloc?.influencer_id,
        influencers: inf
          ? {
              id: inf.id,
              name: inf.name || "인플루언서",
              instagram_handle_normalized: inf.instagram_handle_normalized,
              instagram_handle: inf.instagram_handle,
              region: inf.region,
            }
          : null,
        products: product ? { id: product.id, name: product.name } : null,
        allocation_pricing: one(alloc?.allocation_pricing) ?? null,
      },
    });
  }

  if (isDemoCompany(company) && posts.length === 0) {
    const { buildPublishDemoPerformance } = await import(
      "@/lib/publish-demo-data"
    );
    const demo = buildPublishDemoPerformance();
    posts = (demo.links || []).map((l) => {
      const handleRaw =
        l.allocations?.influencers?.instagram_handle_normalized || "";
      const handle = handleRaw
        ? `@${String(handleRaw).replace(/^@+/, "")}`
        : "—";
      return {
        id: l.id,
        influencerId:
          l.allocations?.influencer_id ||
          l.allocations?.influencers?.id ||
          l.id,
        url: l.link_url,
        handle,
        name: l.allocations?.influencers?.name || "인플루언서",
        product: l.allocations?.products?.name || "상품",
        views: Number(l.views) || 0,
        likes: Number(l.likes) || 0,
        comments: Number(l.comments) || 0,
        publishedAt: l.published_at || null,
      };
    });
    homeLinks = (demo.links || []).map((l) => ({
      id: l.id,
      link_url: l.link_url,
      published_at: l.published_at || null,
      views: l.views,
      likes: l.likes,
      saves: l.saves,
      allocations: l.allocations
        ? {
            influencer_id: l.allocations.influencer_id,
            influencers: l.allocations.influencers,
            products: l.allocations.products,
          }
        : null,
    }));
  }

  const asOf = ymdKstNow();
  const weekSince = windowStartIso(7, asOf);
  const monthSince = windowStartIso(30, asOf);

  const published = activeAllocs.filter((a) =>
    publishedAllocIds.has(a.id),
  ).length;
  const targetSum = activeAllocs.length;

  const viewsByInf = new Map<string, number>();
  for (const p of posts) {
    viewsByInf.set(p.influencerId, (viewsByInf.get(p.influencerId) || 0) + p.views);
  }

  const infRows = new Map<string, CompanyHomeInfluencerRow>();
  for (const a of activeAllocs) {
    const inf = one(a.influencers);
    const id = inf?.id || a.influencer_id;
    if (!id || infRows.has(id)) continue;
    const product = one(a.products);
    const handleRaw =
      inf?.instagram_handle_normalized || inf?.instagram_handle || "";
    infRows.set(id, {
      id,
      name: inf?.name || "인플루언서",
      handle: handleRaw ? `@${String(handleRaw).replace(/^@+/, "")}` : "—",
      product: product?.name || "상품",
      followers: Number(inf?.followers) || 0,
      views: viewsByInf.get(id) || 0,
    });
  }
  for (const p of posts) {
    if (infRows.has(p.influencerId)) continue;
    infRows.set(p.influencerId, {
      id: p.influencerId,
      name: p.name,
      handle: p.handle,
      product: p.product,
      followers: 0,
      views: p.views,
    });
  }

  const ranking = rankInfluencers([...infRows.values()]);

  let weekViewTotal = homeLinks.reduce((s, l) => s + (Number(l.views) || 0), 0);
  let weekSeries: number[] = Array.from({ length: 7 }, () => 0);
  weekSeries[6] = weekViewTotal;
  let weekWow: number | null = null;
  let weekCurve: { day: number; views: number }[] = [];
  try {
    const metrics = await fetchMetricsForLinks(supabase, homeLinks, {
      days: 90,
    });
    weekCurve = buildViewsCurvePoints(
      homeLinks.map((l) => ({
        id: l.id,
        published_at: l.published_at ?? null,
      })),
      metrics,
    );
    if (metrics.length > 0) {
      const series = cumulativeViewsSeriesFromMetrics(metrics, asOf, 7);
      if (weekViewTotal > 0 && (series.every((v) => v === 0) || series[6] === 0)) {
        series[6] = weekViewTotal;
      }
      weekSeries = series;
      weekWow = wowPct(weekSeries[6] || 0, weekSeries[0] || 0);
    } else {
      weekSeries = Array.from({ length: 7 }, () => weekViewTotal);
    }
  } catch {
    weekSeries = Array.from({ length: 7 }, () => weekViewTotal);
  }

  const news = buildDerivedNews({
    asOf,
    visits: activeAllocs.map((a) => {
      const inf = one(a.influencers);
      const store = one(a.stores);
      const product = one(a.products);
      const handleRaw =
        inf?.instagram_handle_normalized || inf?.instagram_handle || "";
      return {
        id: a.id,
        influencerId: inf?.id || a.influencer_id || a.id,
        name: inf?.name || "인플루언서",
        store: store?.name || "",
        visitDate: a.visit_date ? String(a.visit_date).slice(0, 10) : "",
        handle: handleRaw ? `@${String(handleRaw).replace(/^@+/, "")}` : "",
        snsUrl: inf?.sns_url ? String(inf.sns_url) : null,
        product: product?.name || "",
        followers: Number(inf?.followers) || 0,
        published: publishedAllocIds.has(a.id),
      };
    }),
    uploads: posts.map((p) => ({
      id: p.id,
      influencerId: p.influencerId,
      name: p.name,
      handle: p.handle,
      at: p.publishedAt || "",
      url: p.url,
      product: p.product,
    })),
  });

  const visits = splitHomeVisits(
    activeAllocs.map((a) => {
      const inf = one(a.influencers);
      const product = one(a.products);
      const handleRaw =
        inf?.instagram_handle_normalized || inf?.instagram_handle || "";
      return {
        id: inf?.id || a.influencer_id,
        name: inf?.name || "인플루언서",
        handle: handleRaw ? `@${String(handleRaw).replace(/^@+/, "")}` : "—",
        visitDate: a.visit_date ? String(a.visit_date).slice(0, 10) : null,
        product: product?.name || "",
        snsUrl: inf?.sns_url ? String(inf.sns_url) : null,
      };
    }),
    asOf,
  );

  const publishedInf = new Set(posts.map((p) => p.influencerId));
  for (const l of homeLinks) {
    const id = l.allocations?.influencers?.id || l.allocations?.influencer_id;
    if (id) publishedInf.add(id);
  }
  const avgById = profileMetrics as Record<string, HomeForecastAvg | undefined>;
  const forecast = buildHomeForecast(
    [...infRows.values()]
      .filter((r) => !publishedInf.has(r.id))
      .map((r) => ({ id: r.id, name: r.name, handle: r.handle })),
    avgById,
  );

  const payload: CompanyHomePayload = {
    asOf,
    budget,
    content: {
      published,
      target: targetSum > 0 ? targetSum : null,
    },
    influencers: {
      contracted: infRows.size,
      withPerformance: [...infRows.values()].filter((r) => r.views > 0).length,
      ranking,
    },
    weekViews: {
      total: weekViewTotal,
      wowPct: weekWow,
      series: weekSeries,
      curve: weekCurve,
    },
    best: {
      week: rankBestPosts(posts, weekSince),
      month: rankBestPosts(posts, monthSince),
      all: rankBestPosts(posts, null),
    },
    news,
    visits,
    links: homeLinks,
    forecast,
  };

  return NextResponse.json(payload);
}
