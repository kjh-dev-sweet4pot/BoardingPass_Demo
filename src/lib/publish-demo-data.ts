/** 배정·콘텐츠 탭용: 발행(JP 시딩) 리스트를 Allocation/Insights 형태로 변환. */

import { type CreatorPlatform } from "@/lib/creator-link";
import {
  aggregateContentInsights,
  type ContentPeriod,
  type ContentPostInsight,
} from "@/lib/content-insights";
import { buildCreatorPool, type PoolCreator } from "@/lib/creator-pool-mock";
import { buildPublishFeed, type PublishItem } from "@/lib/publish-feed-mock";
import { type AllocationWithRelations, type CreatorLink } from "@/lib/types";

function asPlatform(p: string): CreatorPlatform {
  if (p === "tiktok") return "tiktok";
  if (p === "youtube") return "youtube";
  if (p === "x" || p === "twitter") return "etc";
  if (p === "lips") return "etc";
  return "instagram";
}

function hash32(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mockInt(seed: string, min: number, max: number) {
  return min + (hash32(seed) % (max - min + 1));
}

function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function creatorById() {
  const map = new Map<string, PoolCreator>();
  for (const c of buildCreatorPool()) map.set(c.id, c);
  return map;
}

/**
 * 발행 150건 → 배정 현황 행.
 * 업로드 있음 = 수령+링크 승인, 없으면 시딩 대기/방문 흐름으로 표시.
 */
export function buildPublishDemoAllocations(): AllocationWithRelations[] {
  const creators = creatorById();
  const feed = buildPublishFeed();
  const now = new Date().toISOString();

  return feed.map((item) => {
    const creator = creators.get(item.creatorId);
    const hasUpload = Boolean(item.url);
    const visitYmd = item.publishedYmd
      ? addDaysYmd(item.publishedYmd, -7)
      : null;
    const postedAt = item.publishedYmd
      ? `${item.publishedYmd}T12:00:00+09:00`
      : null;

    const link: CreatorLink | null = hasUpload
      ? {
          id: `link-${item.id}`,
          allocation_id: item.id,
          influencer_id: item.creatorId,
          url: item.url,
          platform: asPlatform(item.platform),
          status: "approved",
          memo: null,
          submitted_at: postedAt || now,
          updated_at: postedAt || now,
        }
      : null;

    return {
      id: item.id,
      influencer_id: item.creatorId,
      product_id: `prod-${item.id}`,
      store_id: "store-jp-seeding",
      company_id: null,
      quantity: 1,
      status: hasUpload ? "picked_up" : "pending",
      visit_code: null,
      visit_date: visitYmd,
      verified_at: hasUpload && visitYmd ? `${visitYmd}T10:00:00+09:00` : null,
      last_visited_at:
        hasUpload && visitYmd ? `${visitYmd}T10:00:00+09:00` : null,
      picked_up_at: hasUpload && visitYmd ? `${visitYmd}T11:00:00+09:00` : null,
      visit_source: hasUpload ? "auto" : null,
      visit_confirmed_by: null,
      created_at: postedAt || now,
      updated_at: postedAt || now,
      products: {
        id: `prod-${item.id}`,
        name: item.productName || item.title || "시딩 상품",
        sku: null,
        description: null,
        created_at: now,
      },
      stores: {
        id: "store-jp-seeding",
        name: "JP 시딩",
        address: "Japan",
        created_at: now,
      },
      influencers: {
        id: item.creatorId,
        name: item.creatorName,
        instagram_handle: item.handle.replace(/^@/, ""),
        instagram_handle_normalized: item.handle.replace(/^@/, "").toLowerCase(),
        sns_url: creator?.profileUrl || null,
        notes: creator?.tier || null,
        created_at: now,
        updated_at: now,
      },
      creator_links: link ? [link] : [],
    };
  });
}

/** 발행 리스트 → 콘텐츠 성과 스냅샷 (실측 지표 우선, 없으면 추정). */
export function buildPublishDemoInsights(
  period: ContentPeriod,
): ReturnType<typeof aggregateContentInsights> {
  const creators = creatorById();
  const feed = buildPublishFeed();
  const monthKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);

  const posts: ContentPostInsight[] = [];
  for (const item of feed) {
    if (period === "month" && !item.publishedYmd.startsWith(monthKey)) {
      continue;
    }
    const creator = creators.get(item.creatorId);
    const seed = item.id;
    const views =
      creator?.metrics.views ?? mockInt(`${seed}:v`, 800, 120_000);
    const likes =
      creator?.metrics.likes ??
      Math.round(views * (mockInt(`${seed}:er`, 15, 60) / 1000));
    const comments =
      creator?.metrics.comments ??
      Math.max(2, Math.round(likes * (mockInt(`${seed}:c`, 4, 20) / 100)));

    posts.push({
      id: item.id,
      url: item.url,
      platform: asPlatform(item.platform),
      allocationId: item.id,
      linkId: `link-${item.id}`,
      productId: `prod-${item.id}`,
      productName: item.productName || item.title,
      influencerId: item.creatorId,
      influencerName: item.creatorName,
      influencerHandle: item.handle,
      storeName: "JP 시딩",
      caption: `${item.creatorName} · ${item.productName}`,
      views,
      likes,
      comments,
      postedAt: item.publishedYmd,
      collectedAt: new Date().toISOString(),
      source: "mock",
    });
  }

  return aggregateContentInsights(posts, period, "mock");
}

/** @deprecated keep type export for callers */
export type { PublishItem };
