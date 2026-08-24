import { NextRequest, NextResponse } from "next/server";
import { getCompanySessionId } from "@/lib/session";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import {
  collectLinkMetrics,
  loadCollectLink,
  type CollectLinkRow,
} from "@/lib/collect-content-metrics";

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

/** ponytail: Vercel 타임아웃 전에 끝내기 — 한 번에 최근 N건만 */
const MAX_LINKS = 12;

/**
 * POST /api/com/insights/refresh
 * 회원사 소속 발행완료 콘텐츠 지표를 Apify로 재수집.
 */
export async function POST(request: NextRequest) {
  const companyId = await getCompanySessionId();
  if (!companyId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!process.env.APIFY_TOKEN?.trim()) {
    return NextResponse.json(
      { error: "APIFY_TOKEN 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  let productId: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body.product_id === "string" && body.product_id.trim()) {
      productId = body.product_id.trim();
    }
  } catch {
    // optional
  }

  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  let allocQuery = supabase
    .from("allocations")
    .select("id")
    .eq("company_id", companyId);
  if (productId) allocQuery = allocQuery.eq("product_id", productId);

  const { data: allocs, error: allocErr } = await allocQuery;
  if (allocErr) {
    return NextResponse.json({ error: allocErr.message }, { status: 500 });
  }
  const allocIds = (allocs ?? []).map((a) => a.id);
  if (allocIds.length === 0) {
    return NextResponse.json({ total: 0, ok: 0, failed: 0, truncated: false });
  }

  const { data: rawLinks, error: linksErr } = await supabase
    .from("creator_links")
    .select("id")
    .in("allocation_id", allocIds)
    .or(
      "content_status.eq.발행완료,publish_url.not.is.null,and(content_status.is.null,status.eq.approved)",
    )
    .order("updated_at", { ascending: false })
    .limit(MAX_LINKS + 1);

  if (linksErr) {
    return NextResponse.json({ error: linksErr.message }, { status: 500 });
  }

  const allIds = (rawLinks ?? []).map((l) => l.id as string);
  const truncated = allIds.length > MAX_LINKS;
  const linkIds = allIds.slice(0, MAX_LINKS);

  let ok = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const id of linkIds) {
    try {
      const link = (await loadCollectLink(supabase, id)) as CollectLinkRow;
      const { data: job } = await supabase
        .from("collection_jobs")
        .insert({
          creator_link_id: id,
          status: "대기",
          scheduled_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      await collectLinkMetrics(supabase, link, {
        jobId: job?.id as string | undefined,
      });
      ok += 1;
    } catch (e) {
      failed += 1;
      errors.push(e instanceof Error ? e.message : `${id} 실패`);
    }
  }

  return NextResponse.json({
    total: linkIds.length,
    ok,
    failed,
    truncated,
    max: MAX_LINKS,
    errors: errors.slice(0, 5),
  });
}
