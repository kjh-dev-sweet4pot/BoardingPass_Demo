import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { getCompanySessionId } from "@/lib/session";

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
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

  // 발행완료 creator_links (회원사 소속)
  let linkQuery = supabase
    .from("creator_links")
    .select(`
      id, link_url, status, published_at, views, likes, comments, metrics_collected_at,
      allocations!inner (
        id, company_id, influencer_id, target_content_count,
        influencers (id, name, instagram_handle_normalized, instagram_handle, followers),
        products (id, name)
      )
    `)
    .eq("allocations.company_id", companyId)
    .eq("status", "발행완료");

  if (productId) {
    linkQuery = linkQuery.eq("allocations.products.id", productId);
  }

  const { data: links, error: linksErr } = await linkQuery;
  if (linksErr) return NextResponse.json({ error: linksErr.message }, { status: 500 });

  if (!links || links.length === 0) {
    return NextResponse.json({ links: [], metrics: [], collectedAt: null });
  }

  const linkIds = links.map((l) => l.id);
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();

  const { data: metrics, error: metricsErr } = await supabase
    .from("content_metrics")
    .select("creator_link_id, collected_at, views, likes, comments")
    .in("creator_link_id", linkIds)
    .gte("collected_at", since)
    .order("collected_at", { ascending: true });

  if (metricsErr) return NextResponse.json({ error: metricsErr.message }, { status: 500 });

  const collectedAt = metrics && metrics.length > 0
    ? metrics[metrics.length - 1].collected_at
    : null;

  return NextResponse.json({ links, metrics: metrics ?? [], collectedAt });
}
