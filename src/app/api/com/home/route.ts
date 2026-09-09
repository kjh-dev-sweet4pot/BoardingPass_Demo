import { NextResponse } from "next/server";
import { isDemoCompany } from "@/lib/company";
import { fetchInsights } from "@/app/api/com/insights/route";
import { buildBudgetPerformanceForCompany } from "@/lib/company-budget-performance";
import {
  buildDerivedNews,
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
} from "@/lib/company-home";
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

  const { data: campaigns, error: campErr } = await supabase
    .from("campaigns")
    .select("id, name, status, budget_amount, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (campErr) {
    return NextResponse.json({ error: campErr.message }, { status: 500 });
  }

  const campaignRows = campaigns || [];
  const totalBudget = campaignRows.reduce((sum, c) => {
    const n = typeof c.budget_amount === "number" ? c.budget_amount : 0;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const budgetTotal = totalBudget > 0 ? totalBudget : null;

  let budget = summarizeBudget(budgetTotal, 0, 0);
  try {
    const bp = await buildBudgetPerformanceForCompany(supabase, company);
    budget = summarizeBudget(bp.budgetTotal, bp.spent, bp.scheduled);
  } catch {
    /* 캠페인 합계만 유지 */
  }

  const { data: allocs } = await supabase
    .from("allocations")
    .select(
      "id, influencer_id, status, rollup_status, target_content_count, visit_date, influencers(id, name, instagram_handle_normalized, instagram_handle, sns_url, followers), products(id, name), stores(id, name)",
    )
    .eq("company_id", companyId);

  const allocMap = new Map((allocs || []).map((a) => [a.id, a]));
  const activeAllocs = (allocs || []).filter(
    (a) => a.status !== "cancelled" && a.rollup_status !== "취소",
  );
  const allocIds = [...allocMap.keys()];

  let posts: CompanyHomeBestPost[] = [];
  const publishedAllocIds = new Set<string>();
  if (allocIds.length > 0) {
    const { data: links, error: linksErr } = await supabase
      .from("creator_links")
      .select(
        "id, url, publish_url, submitted_at, published_at, views, likes, comments, allocation_id",
      )
      .in("allocation_id", allocIds)
      .or(
        "content_status.eq.발행완료,publish_url.not.is.null,and(content_status.is.null,status.eq.approved)",
      );
    if (linksErr) {
      return NextResponse.json({ error: linksErr.message }, { status: 500 });
    }

    posts = (links || []).map((l) => {
      if (l.allocation_id) publishedAllocIds.add(String(l.allocation_id));
      const alloc = allocMap.get(l.allocation_id);
      const inf = Array.isArray(alloc?.influencers)
        ? alloc?.influencers[0]
        : alloc?.influencers;
      const product = Array.isArray(alloc?.products)
        ? alloc?.products[0]
        : alloc?.products;
      const handleRaw =
        inf?.instagram_handle_normalized || inf?.instagram_handle || "";
      const handle = handleRaw
        ? `@${String(handleRaw).replace(/^@+/, "")}`
        : "—";
      return {
        id: l.id,
        influencerId:
          inf?.id ||
          (alloc as { influencer_id?: string } | undefined)?.influencer_id ||
          l.id,
        url: (l.publish_url || l.url || "").trim() || null,
        handle,
        name: inf?.name || "인플루언서",
        product: product?.name || "상품",
        views: Number(l.views) || 0,
        likes: Number(l.likes) || 0,
        comments: Number(l.comments) || 0,
        publishedAt: l.published_at || l.submitted_at || null,
      };
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
    const inf = Array.isArray(a.influencers) ? a.influencers[0] : a.influencers;
    const id = inf?.id || a.influencer_id;
    if (!id || infRows.has(id)) continue;
    const product = Array.isArray(a.products) ? a.products[0] : a.products;
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

  // 성과 탭과 동일 소스: creator_links.views 합 + content_metrics 곡선
  let weekViewTotal = posts.reduce((s, p) => s + (p.views || 0), 0);
  let weekSeries: number[] = Array.from({ length: 7 }, () => 0);
  weekSeries[6] = weekViewTotal;
  let weekWow: number | null = null;
  let weekCurve: { day: number; views: number }[] = [];
  try {
    const insights = await fetchInsights(supabase, companyId, { days: 90 });
    const insightLinks = (insights.links || []) as {
      id: string;
      views?: number | null;
      published_at?: string | null;
    }[];
    const linkTotal = insightLinks.reduce(
      (s, l) => s + (Number(l.views) || 0),
      0,
    );
    if (linkTotal > 0 || insightLinks.length > 0) {
      weekViewTotal = linkTotal;
    }
    const metrics = (insights.metrics || []) as {
      creator_link_id: string;
      collected_at: string;
      views: number | null;
    }[];
    weekCurve = buildViewsCurvePoints(
      insightLinks.map((l) => ({
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
    /* posts 스냅샷 유지 */
  }

  const news = buildDerivedNews({
    asOf,
    visits: activeAllocs.map((a) => {
      const inf = Array.isArray(a.influencers) ? a.influencers[0] : a.influencers;
      const store = Array.isArray(a.stores) ? a.stores[0] : a.stores;
      const product = Array.isArray(a.products) ? a.products[0] : a.products;
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
      const inf = Array.isArray(a.influencers) ? a.influencers[0] : a.influencers;
      const product = Array.isArray(a.products) ? a.products[0] : a.products;
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
  };

  return NextResponse.json(payload);
}
