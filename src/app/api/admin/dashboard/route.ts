import { type NextRequest, NextResponse } from "next/server";
import { requireAnyAdmin, canViewCostAmount } from "@/lib/access";
import { parseExcludeCompanyIds } from "@/lib/company";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

function notInList(ids: string[]) {
  return `(${ids.join(",")})`;
}

/**
 * GET /api/admin/dashboard?company_id=&from=&to=
 * 발행완료 현황 + 처리 대기 큐 5종 + 성과·예산 집계
 * 운영자 이상만 접근 가능
 */
export async function GET(request: NextRequest) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id") || null;
  const excludeIds = companyId
    ? []
    : parseExcludeCompanyIds(searchParams.get("exclude_company_ids"));
  const from = searchParams.get("from") || null;
  const to = searchParams.get("to") || null;

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

  // ── 큐 3: 수집 3회 연속 실패 (운영자 알림 대상) ─────────────────────────
  const { data: recentCollectJobs } = await supabase
    .from("collection_jobs")
    .select("creator_link_id, status")
    .order("created_at", { ascending: false })
    .limit(500);

  const statusesByLink = new Map<string, string[]>();
  for (const job of recentCollectJobs ?? []) {
    const list = statusesByLink.get(job.creator_link_id) ?? [];
    if (list.length < 3) list.push(job.status);
    statusesByLink.set(job.creator_link_id, list);
  }
  const failedLinkIds: string[] = [];
  for (const [linkId, statuses] of statusesByLink) {
    if (statuses.length >= 3 && statuses.every((s) => s === "실패")) {
      failedLinkIds.push(linkId);
    }
  }
  let collectFailed = failedLinkIds.length;
  if (excludeIds.length && failedLinkIds.length) {
    const { data: failedLinks } = await supabase
      .from("creator_links")
      .select("id, allocations!inner(company_id)")
      .in("id", failedLinkIds);
    const excluded = new Set(
      (failedLinks ?? [])
        .filter((row) => {
          const alloc = row.allocations as { company_id?: string } | { company_id?: string }[] | null;
          const companyIdOnLink = Array.isArray(alloc) ? alloc[0]?.company_id : alloc?.company_id;
          return companyIdOnLink ? excludeIds.includes(companyIdOnLink) : false;
        })
        .map((row) => row.id),
    );
    collectFailed = failedLinkIds.filter((id) => !excluded.has(id)).length;
  }

  let publishedQuery = supabase
    .from("creator_links")
    .select("id, allocations!inner(company_id)", { count: "exact", head: true })
    .eq("content_status", "발행완료");
  if (companyId) publishedQuery = publishedQuery.eq("allocations.company_id", companyId);
  else if (excludeIds.length) {
    publishedQuery = publishedQuery.not("allocations.company_id", "in", notInList(excludeIds));
  }

  const [
    { count: reviewPending },
    { count: verifyFailed },
    { count: publishStale },
    { count: castingStale },
    { count: publishedCount },
  ] = await Promise.all([
    (() => {
      let q = supabase
        .from("creator_links")
        .select(excludeIds.length ? "id, allocations!inner(company_id)" : "*", {
          count: "exact",
          head: true,
        })
        .eq("content_status", "제출");
      if (excludeIds.length) q = q.not("allocations.company_id", "in", notInList(excludeIds));
      return q;
    })(),

    (() => {
      let q = supabase
        .from("creator_links")
        .select(excludeIds.length ? "id, allocations!inner(company_id)" : "*", {
          count: "exact",
          head: true,
        })
        .eq("verification_failed", true);
      if (excludeIds.length) q = q.not("allocations.company_id", "in", notInList(excludeIds));
      return q;
    })(),

    (() => {
      let q = supabase
        .from("creator_links")
        .select(excludeIds.length ? "id, allocations!inner(company_id)" : "*", {
          count: "exact",
          head: true,
        })
        .eq("status", "approved")
        .is("publish_url", null)
        .lt("updated_at", threeDaysAgo);
      if (excludeIds.length) q = q.not("allocations.company_id", "in", notInList(excludeIds));
      return q;
    })(),

    (() => {
      let q = supabase
        .from("castings")
        .select("*", { count: "exact", head: true })
        .eq("status", "Pending")
        .lt("created_at", sevenDaysAgo);
      if (excludeIds.length) q = q.not("company_id", "in", notInList(excludeIds));
      return q;
    })(),

    publishedQuery,
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
    .eq("content_status", "발행완료");

  if (companyId) linkQuery = linkQuery.eq("allocations.company_id", companyId);
  else if (excludeIds.length) {
    linkQuery = linkQuery.not("allocations.company_id", "in", notInList(excludeIds));
  }
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
  else if (excludeIds.length) {
    budgetQuery = budgetQuery.not("campaigns.company_id", "in", notInList(excludeIds));
  }
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
    publishedCount: publishedCount ?? 0,
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
