import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractInstagramViews,
  findInstagramResultForUrl,
  scrapeInstagramPosts,
} from "@/lib/apify-instagram";
import { findResultForUrl, scrapeTikTokPosts } from "@/lib/apify-tiktok";
import { nextRetryAt } from "@/lib/metrics-schedule";

export type ScrapedMetrics = {
  views: number;
  likes: number;
  comments: number;
  authorHandle: string | null;
};

export type CollectLinkRow = {
  id: string;
  url: string;
  publish_url?: string | null;
  platform: string;
  content_status?: string | null;
  verification_failed?: boolean;
  metrics_collected_at?: string | null;
  influencer_id: string;
  influencers?: {
    instagram_handle?: string | null;
    instagram_handle_normalized?: string | null;
  } | null;
  allocations?: {
    campaign_id?: string | null;
    campaigns?: { status?: string | null } | null;
  } | null;
};

function metricUrl(link: Pick<CollectLinkRow, "url" | "publish_url">) {
  return (link.publish_url || link.url || "").trim();
}

export async function scrapeLinkMetrics(
  url: string,
  platform: string,
): Promise<ScrapedMetrics> {
  if (platform === "tiktok") {
    const items = await scrapeTikTokPosts([url]);
    const result = findResultForUrl(items, url);
    if (!result) throw new Error("Apify에서 TikTok 결과를 찾지 못했습니다.");
    const authorHandle =
      result.authorMeta?.name?.replace(/^@+/, "").trim() ||
      result.authorMeta?.id?.replace(/^@+/, "").trim() ||
      null;
    return {
      views: result.playCount ?? 0,
      likes: result.diggCount ?? 0,
      comments: result.commentCount ?? 0,
      authorHandle,
    };
  }

  if (platform === "instagram") {
    const items = await scrapeInstagramPosts([url]);
    const result = findInstagramResultForUrl(items, url);
    if (!result) throw new Error("Apify에서 Instagram 결과를 찾지 못했습니다.");
    return {
      views: extractInstagramViews(result) ?? 0,
      likes: result.likesCount ?? 0,
      comments: result.commentsCount ?? 0,
      authorHandle: result.ownerUsername?.replace(/^@+/, "").trim() || null,
    };
  }

  throw new Error("TikTok/Instagram 링크만 지표 수집을 지원합니다.");
}

async function markJob(
  supabase: SupabaseClient,
  jobId: string,
  patch: Record<string, unknown>,
) {
  await supabase.from("collection_jobs").update(patch).eq("id", jobId);
}

async function scheduleRetry(
  supabase: SupabaseClient,
  creatorLinkId: string,
  errorMessage: string,
) {
  await supabase.from("collection_jobs").insert({
    creator_link_id: creatorLinkId,
    status: "대기",
    scheduled_at: nextRetryAt(),
    error_message: errorMessage.slice(0, 500),
  });
}

/** 연속 실패 N회 — 운영자 알림 대상 */
export async function countConsecutiveCollectFailures(
  supabase: SupabaseClient,
  creatorLinkId: string,
  limit = 3,
) {
  const { data } = await supabase
    .from("collection_jobs")
    .select("status")
    .eq("creator_link_id", creatorLinkId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!data || data.length < limit) return 0;
  if (data.every((row) => row.status === "실패")) return limit;
  return 0;
}

/**
 * Apify 수집 1회 실행 → content_metrics 누적, creator_links 스냅샷 갱신.
 * 실패 시 job만 실패 처리하고 링크 지표는 유지한다.
 */
export async function collectLinkMetrics(
  supabase: SupabaseClient,
  link: CollectLinkRow,
  options: { jobId?: string } = {},
) {
  const url = metricUrl(link);
  if (!url) throw new Error("수집할 URL이 없습니다.");

  const now = new Date().toISOString();
  if (options.jobId) {
    await markJob(supabase, options.jobId, {
      status: "실행중",
      started_at: now,
    });
  }

  try {
    const metrics = await scrapeLinkMetrics(url, link.platform);
    const collectedAt = new Date().toISOString();

    const { error: metricErr } = await supabase.from("content_metrics").upsert(
      {
        creator_link_id: link.id,
        collected_at: collectedAt,
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
      },
      { onConflict: "creator_link_id,collected_at" },
    );
    if (metricErr) throw new Error(metricErr.message);

    const { error: linkErr } = await supabase
      .from("creator_links")
      .update({
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        metrics_collected_at: collectedAt,
        verification_failed: false,
        updated_at: collectedAt,
      })
      .eq("id", link.id);
    if (linkErr) throw new Error(linkErr.message);

    if (options.jobId) {
      await markJob(supabase, options.jobId, {
        status: "성공",
        finished_at: collectedAt,
        error_message: null,
      });
    }

    return {
      metrics,
      verificationFailed: false,
      collectedAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "수집 실패";
    if (options.jobId) {
      await markJob(supabase, options.jobId, {
        status: "실패",
        finished_at: new Date().toISOString(),
        error_message: message.slice(0, 500),
      });
    }
    await scheduleRetry(supabase, link.id, message);
    throw err;
  }
}

const LINK_SELECT = `
  id, url, publish_url, platform, content_status, verification_failed,
  metrics_collected_at, influencer_id,
  influencers ( instagram_handle, instagram_handle_normalized ),
  allocations (
    campaign_id,
    campaigns ( status )
  )
`;

export async function loadCollectLink(
  supabase: SupabaseClient,
  linkId: string,
) {
  const { data, error } = await supabase
    .from("creator_links")
    .select(LINK_SELECT)
    .eq("id", linkId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("링크를 찾을 수 없습니다.");
  return data as CollectLinkRow;
}

/** 발행 URL 등록 직후 1회 수집 */
export async function collectOnPublishUrl(
  supabase: SupabaseClient,
  linkId: string,
) {
  const link = await loadCollectLink(supabase, linkId);
  const { data: job, error: jobErr } = await supabase
    .from("collection_jobs")
    .insert({
      creator_link_id: linkId,
      status: "대기",
      scheduled_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (jobErr || !job) throw new Error(jobErr?.message || "collection_jobs 생성 실패");

  return collectLinkMetrics(supabase, link, { jobId: job.id });
}

export async function runCollectionJob(
  supabase: SupabaseClient,
  jobId: string,
  creatorLinkId: string,
) {
  const link = await loadCollectLink(supabase, creatorLinkId);
  return collectLinkMetrics(supabase, link, { jobId });
}
