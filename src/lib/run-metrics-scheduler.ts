import type { SupabaseClient } from "@supabase/supabase-js";
import {
  collectLinkMetrics,
  loadCollectLink,
  runCollectionJob,
} from "@/lib/collect-content-metrics";
import {
  canCollectPostedAt,
  isCampaignCollectActive,
  isCollectionDue,
  publishAnchorIso,
} from "@/lib/metrics-schedule";

type SchedulerResult = {
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
};

async function hasActiveJob(supabase: SupabaseClient, linkId: string) {
  const { count } = await supabase
    .from("collection_jobs")
    .select("*", { count: "exact", head: true })
    .eq("creator_link_id", linkId)
    .in("status", ["대기", "실행중"]);
  return (count ?? 0) > 0;
}

async function enqueueScheduledCollect(
  supabase: SupabaseClient,
  linkId: string,
) {
  const { data, error } = await supabase
    .from("collection_jobs")
    .insert({
      creator_link_id: linkId,
      status: "대기",
      scheduled_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "job enqueue failed");
  return data.id as string;
}

/**
 * collection_jobs 대기 큐 + 발행 콘텐츠 주기 수집.
 * ponytail: run당 maxJobs건 — Vercel 함수 타임아웃 회피
 */
export async function runMetricsScheduler(
  supabase: SupabaseClient,
  { maxJobs = 5 }: { maxJobs?: number } = {},
): Promise<SchedulerResult> {
  const result: SchedulerResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  const nowIso = new Date().toISOString();

  const { data: dueJobs } = await supabase
    .from("collection_jobs")
    .select("id, creator_link_id")
    .eq("status", "대기")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(maxJobs);

  const jobQueue = dueJobs ?? [];

  if (jobQueue.length < maxJobs) {
    const { data: links } = await supabase
      .from("creator_links")
      .select(`
        id, url, publish_url, platform, content_status,
        published_at, updated_at, submitted_at, metrics_collected_at,
        allocations (
          campaigns ( status ),
          companies ( auto_collect_enabled )
        )
      `)
      .or("content_status.eq.발행완료,publish_url.not.is.null,and(content_status.is.null,status.eq.approved)")
      .order("metrics_collected_at", { ascending: true, nullsFirst: true });

    for (const row of links ?? []) {
      if (jobQueue.length >= maxJobs) break;

      const allocRaw = row.allocations as
        | {
            campaigns?: { status?: string } | null;
            companies?: { auto_collect_enabled?: boolean | null } | null;
          }
        | {
            campaigns?: { status?: string } | null;
            companies?: { auto_collect_enabled?: boolean | null } | null;
          }[]
        | null;
      const alloc = Array.isArray(allocRaw) ? allocRaw[0] : allocRaw;
      const campaignStatus = alloc?.campaigns?.status;
      if (!isCampaignCollectActive(campaignStatus)) continue;
      if (alloc?.companies?.auto_collect_enabled === false) continue;

      const url = (row.publish_url || row.url || "").trim();
      const needsPostedAt =
        !row.published_at && canCollectPostedAt(url, row.platform);
      const anchor = publishAnchorIso(row);
      if (!needsPostedAt) {
        if (!anchor) continue;
        if (!isCollectionDue(anchor, row.metrics_collected_at)) continue;
      }
      if (await hasActiveJob(supabase, row.id)) continue;

      try {
        const jobId = await enqueueScheduledCollect(supabase, row.id);
        jobQueue.push({ id: jobId, creator_link_id: row.id });
      } catch (e) {
        result.errors.push(
          e instanceof Error ? e.message : `enqueue ${row.id} failed`,
        );
      }
    }
  }

  // ponytail: 순차 실행이면 건당 ~6-8초 × maxJobs가 그대로 누적돼 60초 타임아웃에 걸린다.
  // 서로 다른 링크의 독립적인 Apify 호출이라 병렬로 돌려도 안전 — 같은 예산으로 더 많이 처리한다.
  const outcomes = await Promise.allSettled(
    jobQueue.map((job) => runCollectionJob(supabase, job.id, job.creator_link_id)),
  );
  for (const [i, outcome] of outcomes.entries()) {
    result.processed += 1;
    if (outcome.status === "fulfilled") {
      result.succeeded += 1;
    } else {
      result.failed += 1;
      const e = outcome.reason;
      result.errors.push(
        e instanceof Error ? e.message : `job ${jobQueue[i].id} failed`,
      );
    }
  }

  return result;
}

/** 관리자 수동 1건 — content_metrics 포함 */
export async function refreshLinkMetricsNow(
  supabase: SupabaseClient,
  linkId: string,
) {
  const link = await loadCollectLink(supabase, linkId);
  const { data: job, error } = await supabase
    .from("collection_jobs")
    .insert({
      creator_link_id: linkId,
      status: "대기",
      scheduled_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !job) throw new Error(error?.message || "job create failed");
  return collectLinkMetrics(supabase, link, { jobId: job.id });
}
