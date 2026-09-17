import { NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/access";
import { publishedPostKey } from "@/lib/published-post";
import { refreshLinkMetricsNow } from "@/lib/run-metrics-scheduler";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

/** ponytail: 한 명 클릭에 Apify를 무한정 돌리지 않는다. 최신 게시물만. */
const MAX_POSTS = 8;

/**
 * POST /api/admin/influencers/:id/refresh-metrics
 * 이 인플루언서의 발행 콘텐츠를 다시 수집한다.
 * 같은 게시물이 다른 회원사에 있으면 그쪽 링크도 같이 갱신된다.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  if (!process.env.APIFY_TOKEN?.trim()) {
    return NextResponse.json({ error: "APIFY_TOKEN 환경변수가 없습니다." }, { status: 500 });
  }

  const { id } = await context.params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("creator_links")
    .select("id, url, publish_url, updated_at")
    .eq("influencer_id", id)
    .or("content_status.eq.발행완료,publish_url.not.is.null")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const row of data ?? []) {
    const url = (row.publish_url || row.url || "").trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const key = publishedPostKey(url) || url;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row.id as string);
  }

  const truncated = unique.length > MAX_POSTS;
  const linkIds = unique.slice(0, MAX_POSTS);
  let ok = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const linkId of linkIds) {
    try {
      await refreshLinkMetricsNow(supabase, linkId);
      ok += 1;
    } catch (err) {
      failed += 1;
      errors.push(err instanceof Error ? err.message : "수집 실패");
    }
  }

  return NextResponse.json({
    ok,
    failed,
    truncated,
    max: MAX_POSTS,
    errors: errors.slice(0, 3),
  });
}
