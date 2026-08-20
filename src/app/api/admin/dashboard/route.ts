import { type NextRequest, NextResponse } from "next/server";
import { requireAnyAdmin, canViewCostAmount } from "@/lib/access";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";

/**
 * GET /api/admin/dashboard?company_id=&from=&to=
 * 처리 대기 큐 5종 + 성과·예산 집계
 * 운영자 이상만 접근 가능
 */
export async function GET(request: NextRequest) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createApiClientIfConfigured();
  if (!supabase) return supabaseConfigError();

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id") || null;
  const from = searchParams.get("from") || null;
  const to = searchParams.get("to") || null;

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

  // ── 큐 1: 검수 대기 (status = '제출') ──────────────────────────────────
  const [
    { count: reviewPending },
    { count: verifyFailed },
    { count: collectFailed },
    { count: publishStale },
    { count: castingStale },
  ] = await Promise.all([
    supabase
      .from("creator_links")
      .select("*", { count: "exact", head: true })
      .eq("status", "제출"),

    // ── 큐 2: 검증 실패 ──────────────────────────────────────────────────
    supabase
      .from("creator_links")
      .select("*", { count: "exact", head: true })
      .eq("verification_failed", true),

    // ── 큐 3: 수집 실패 ──────────────────────────────────────────────────
    supabase
      .from("collection_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "실패"),

    // ── 큐 4: 발행 미이행 (승인 후 3일 경과, 미발행) ────────────────────
    supabase
      .from("creator_links")
      .select("*", { count: "exact", head: true })
      .eq("status", "승인")
      .lt("updated_at", threeDaysAgo),

    // ── 큐 5: 섭외 정체 (Pending 7일 이상) ──────────────────────────────
    supabase
      .from("castings")
      .select("*", { count: "exact", head: true })
      .eq("status", "Pending")
      .lt("created_at", sevenDaysAgo),
  ]);

  // ── 성과·예산 집계 ──────────────────────────────────────────────────────
  // 발행완료 creator_links (기간 필터 적용)
  let linkQuery = supabase
    .from("creator_links")
    .select(`
      id, views, likes, comments, status, submitted_at,
      allocations!inner (
        id, company_id,
        campaigns ( id, exposure_fee )
      )
    `)
    .eq("status", "발행완료");

  if (companyId) linkQuery = linkQuery.eq("allocations.company_id", companyId);
  if (from) linkQuery = linkQuery.gte("submitted_at", from);
  if (to) linkQuery = linkQuery.lte("submitted_at", `${to}T23:59:59`);

  const { data: links } = await linkQuery;

  // 원시값 합산
  let totalViews = 0, totalLikes = 0, totalComments = 0, totalPosts = 0;
  for (const l of links ?? []) {
    totalViews += l.views ?? 0;
    totalLikes += l.likes ?? 0;
    totalComments += l.comments ?? 0;
    totalPosts += 1;
  }

  // 예산: 섭외 Accept 확정일 기준 — castings.accepted_at 기준 노출가·원가 합산
  // (운영관리자만 원가·마진 접근 가능, 운영담당자는 노출가만)
  const isManager = await canViewCostAmount();

  let budgetQuery = supabase
    .from("castings")
    .select(`
      id, accepted_at, exposure_fee, cost_fee,
      campaign_id,
      campaigns!inner ( company_id )
    `)
    .eq("status", "Accept");

  if (companyId) budgetQuery = budgetQuery.eq("campaigns.company_id", companyId);
  if (from) budgetQuery = budgetQuery.gte("accepted_at", from);
  if (to) budgetQuery = budgetQuery.lte("accepted_at", `${to}T23:59:59`);

  const { data: castings } = await budgetQuery;

  let exposureFeeTotal = 0, costFeeTotal = 0;
  for (const c of castings ?? []) {
    exposureFeeTotal += c.exposure_fee ?? 0;
    costFeeTotal += c.cost_fee ?? 0;
  }

  const budget = isManager
    ? {
        exposureFee: exposureFeeTotal,
        costFee: costFeeTotal,
        margin: exposureFeeTotal - costFeeTotal,
      }
    : { exposureFee: exposureFeeTotal };

  return NextResponse.json({
    queues: {
      reviewPending: reviewPending ?? 0,
      verifyFailed: verifyFailed ?? 0,
      collectFailed: collectFailed ?? 0,
      publishStale: publishStale ?? 0,
      castingStale: castingStale ?? 0,
    },
    performance: {
      posts: totalPosts,
      views: totalViews,
      likes: totalLikes,
      comments: totalComments,
      er: totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0,
    },
    budget,
  });
}
