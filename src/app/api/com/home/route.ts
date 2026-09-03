import { NextResponse } from "next/server";
import { isDemoCompany } from "@/lib/company";
import {
  buildDemoCompanyNews,
  buildDerivedNews,
  rankBestPosts,
  summarizeBudget,
  windowStartIso,
  ymdKstNow,
  type CompanyHomeBestPost,
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

  const { data: company, error: companyErr } = await supabase
    .from("companies")
    .select("id, name, login_id")
    .eq("id", companyId)
    .maybeSingle();
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
  const budgetTotal =
    totalBudget > 0
      ? totalBudget
      : isDemoCompany(company)
        ? 90_000_000
        : null;

  const { data: castings } = await supabase
    .from("castings")
    .select(
      "id, status, campaign_id, allocations ( allocation_pricing ( display_price ) )",
    )
    .eq("company_id", companyId)
    .eq("status", "Accept");

  let spent = 0;
  for (const row of castings || []) {
    const alloc = Array.isArray(row.allocations)
      ? row.allocations[0]
      : row.allocations;
    const pricing = alloc?.allocation_pricing;
    const priceRow = Array.isArray(pricing) ? pricing[0] : pricing;
    const price = Number(priceRow?.display_price ?? 0);
    if (Number.isFinite(price)) spent += price;
  }
  if (isDemoCompany(company) && spent <= 0) {
    spent = 40_000_000;
  }

  const { data: allocs } = await supabase
    .from("allocations")
    .select(
      "id, influencer_id, influencers(id, name, instagram_handle_normalized, instagram_handle), products(id, name)",
    )
    .eq("company_id", companyId);

  const allocMap = new Map((allocs || []).map((a) => [a.id, a]));
  const allocIds = [...allocMap.keys()];

  let posts: CompanyHomeBestPost[] = [];
  if (allocIds.length > 0) {
    const { data: links } = await supabase
      .from("creator_links")
      .select(
        "id, url, publish_url, submitted_at, views, likes, comments, allocation_id",
      )
      .in("allocation_id", allocIds)
      .or(
        "content_status.eq.발행완료,publish_url.not.is.null,and(content_status.is.null,status.eq.approved)",
      );

    posts = (links || []).map((l) => {
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
        publishedAt: l.submitted_at || null,
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

  const news = isDemoCompany(company)
    ? buildDemoCompanyNews(company.name)
    : buildDerivedNews({
        companyName: company.name,
        campaigns: campaignRows,
        acceptCount: (castings || []).length,
        publishedCount: posts.length,
      });

  const payload: CompanyHomePayload = {
    asOf,
    budget: summarizeBudget(budgetTotal, spent),
    best: {
      week: rankBestPosts(posts, weekSince),
      month: rankBestPosts(posts, monthSince),
      all: rankBestPosts(posts, null),
    },
    news,
  };

  return NextResponse.json(payload);
}
