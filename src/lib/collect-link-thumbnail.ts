import type { SupabaseClient } from "@supabase/supabase-js";
import { isTikTokUrl } from "@/lib/tiktok-oembed";
import { findResultForUrl, scrapeTikTokPosts, extractThumbnailUrl } from "@/lib/apify-tiktok";

type ThumbStatus = "pending" | "ok" | "failed";

/**
 * 링크 제출 후 Apify TikTok Scraper로 썸네일 + 지표(조회·좋아요·댓글) 수집.
 * after() 안에서 호출되므로 실패해도 응답에 영향 없음.
 */
export async function collectTikTokLinkThumbnail(
  supabase: SupabaseClient,
  linkId: string,
  pageUrl: string,
) {
  if (!isTikTokUrl(pageUrl)) return;

  const now = new Date().toISOString();

  try {
    const items = await scrapeTikTokPosts([pageUrl]);
    const result = findResultForUrl(items, pageUrl);

    if (!result) throw new Error("Apify returned no matching result");

    const { error } = await supabase
      .from("creator_links")
      .update({
        thumbnail_status: "ok" satisfies ThumbStatus,
        thumbnail_source_url: extractThumbnailUrl(result),
        thumbnail_fetched_at: now,
        tiktok_video_id: result.id ?? null,
        views: result.playCount ?? null,
        likes: result.diggCount ?? null,
        comments: result.commentCount ?? null,
        metrics_collected_at: now,
        updated_at: now,
      })
      .eq("id", linkId);

    if (error) throw new Error(error.message);
  } catch {    await supabase
      .from("creator_links")
      .update({
        thumbnail_status: "failed" satisfies ThumbStatus,
        thumbnail_fetched_at: now,
        updated_at: now,
      })
      .eq("id", linkId);
  }
}

/** API 응답용 — thumbnail_bytes 제외 */
export const CREATOR_LINK_PUBLIC_COLUMNS =
  "id, allocation_id, influencer_id, url, platform, status, memo, submitted_at, updated_at, thumbnail_status, thumbnail_source_url, thumbnail_fetched_at, tiktok_video_id, views, likes, comments, metrics_collected_at";
