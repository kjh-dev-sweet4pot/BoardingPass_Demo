/** 배정·콘텐츠 탭용: 발행(JP 시딩) 리스트를 Allocation/Insights 형태로 변환. */

import { type CreatorPlatform, detectPlatform } from "@/lib/creator-link";
import {
  aggregateContentInsights,
  type ContentPeriod,
  type ContentPostInsight,
} from "@/lib/content-insights";
import {
  buildCreatorPool,
  type PoolCreator,
} from "@/lib/creator-pool-mock";
import { polishDemoMetrics, hash32 } from "@/lib/demo-metrics";
import { buildPublishFeed } from "@/lib/publish-feed-mock";
import {
  addDaysYmd,
  type AllocationWithRelations,
  type CreatorLink,
  ymdKst,
} from "@/lib/types";

const PROGRESS_KANBAN = [
  "대기",
  "수령완료",
  "제작중",
  "검수중",
  "발행완료",
] as const;

type ProgressKanbanCol = (typeof PROGRESS_KANBAN)[number];

/** 5열 합=n, 열마다 서로 다른 건수 (비율 17:19:21:22:21) */
function unevenColumnQuotas(n: number): number[] {
  const weights = [17, 19, 21, 22, 21];
  const counts = weights.map((w) => Math.floor((n * w) / 100));
  let rem = n - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; rem > 0; i += 1) {
    counts[i % 5] += 1;
    rem -= 1;
  }
  return counts;
}

function bareHandle(handle: string) {
  return handle.replace(/^@+/, "").trim();
}

function linksForKanbanColumn(
  item: AllocationWithRelations,
  creator: PoolCreator,
  column: ProgressKanbanCol,
): CreatorLink[] {
  if (!creator.posts.length) return [];

  const now = new Date().toISOString();
  const postedAt = creator.uploadYmd
    ? `${creator.uploadYmd}T12:00:00+09:00`
    : now;

  if (column === "발행완료") {
    return creator.posts.map((post, i) => ({
      id: `prog-${creator.id}-pub-${i}`,
      allocation_id: item.id,
      influencer_id: creator.id,
      url: post.url,
      publish_url: post.url,
      platform: detectPlatform(post.url),
      status: "approved" as const,
      content_status: "발행완료" as const,
      memo: null,
      submitted_at: postedAt,
      updated_at: postedAt,
    }));
  }

  if (column === "검수중") {
    const post = creator.posts[0]!;
    return [
      {
        id: `prog-${creator.id}-sub`,
        allocation_id: item.id,
        influencer_id: creator.id,
        url: post.url,
        publish_url: post.url,
        platform: detectPlatform(post.url),
        status: "submitted" as const,
        content_status: "제출" as const,
        memo: null,
        submitted_at: postedAt,
        updated_at: postedAt,
      },
    ];
  }

  return [];
}

function allocationForPoolCreator(
  creator: PoolCreator,
  column: ProgressKanbanCol,
): AllocationWithRelations {
  const now = new Date().toISOString();
  const id = `prog-${creator.id}`;
  const visitYmd = creator.uploadYmd
    ? addDaysYmd(creator.uploadYmd, -7)
    : "2026-06-01";
  const handle = bareHandle(creator.handle);
  const links = linksForKanbanColumn(
    { id, influencer_id: creator.id } as AllocationWithRelations,
    creator,
    column,
  );
  const target = Math.max(1, creator.posts.length || 1);

  const base = {
    id,
    influencer_id: creator.id,
    product_id: `prod-${creator.id}`,
    store_id: "store-jp-seeding",
    company_id: null,
    quantity: 1,
    target_content_count: target,
    rollup_status: column,
    visit_code: null,
    visit_confirmed_by: null,
    created_at: now,
    updated_at: now,
    products: {
      id: `prod-${creator.id}`,
      name: creator.product || "시딩 상품",
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
      id: creator.id,
      name: creator.name,
      instagram_handle: handle,
      instagram_handle_normalized: handle.toLowerCase(),
      sns_url: creator.profileUrl,
      profile_image_path: null,
      notes: creator.tier,
      created_at: now,
      updated_at: now,
    },
    creator_links: links,
  };

  switch (column) {
    case "대기":
      return {
        ...base,
        status: "pending",
        visit_date: null,
        verified_at: null,
        last_visited_at: null,
        picked_up_at: null,
        visit_source: null,
      };
    case "수령완료":
      return {
        ...base,
        status: "visited",
        visit_date: visitYmd,
        verified_at: `${visitYmd}T10:00:00+09:00`,
        last_visited_at: `${visitYmd}T10:00:00+09:00`,
        picked_up_at: null,
        visit_source: "auto",
      };
    case "제작중":
      return {
        ...base,
        status: "picked_up",
        visit_date: visitYmd,
        verified_at: `${visitYmd}T10:00:00+09:00`,
        last_visited_at: `${visitYmd}T10:00:00+09:00`,
        picked_up_at: `${visitYmd}T11:00:00+09:00`,
        visit_source: "auto",
      };
    default:
      return {
        ...base,
        status: "picked_up",
        visit_date: visitYmd,
        verified_at: `${visitYmd}T10:00:00+09:00`,
        last_visited_at: `${visitYmd}T10:00:00+09:00`,
        picked_up_at: `${visitYmd}T11:00:00+09:00`,
        visit_source: "auto",
      };
  }
}

/** ponytail: 진행현황 칸반 표시 상한 (풀 전원 X) */
export const PROGRESS_POOL_LIMIT = 100;

/**
 * 진행현황 — 크리에이터 풀 인원, 5열에 건수 다르게 분배, 링크=posts(업로드 콘텐츠).
 */
export function buildProgressPoolAllocations(): AllocationWithRelations[] {
  const pool = [...buildCreatorPool()]
    .sort((a, b) => hash32(a.id) - hash32(b.id))
    .slice(0, PROGRESS_POOL_LIMIT);
  const quotas = unevenColumnQuotas(pool.length);
  const withPost = pool.filter((c) => c.posts.length > 0);
  const noPost = pool.filter((c) => c.posts.length === 0);

  const buckets: PoolCreator[][] = PROGRESS_KANBAN.map(() => []);
  let wi = 0;
  let ni = 0;
  const nextWithPost = () => (wi < withPost.length ? withPost[wi++] : null);
  const nextNoPost = () => (ni < noPost.length ? noPost[ni++] : null);

  for (const col of [3, 4] as const) {
    while (buckets[col].length < quotas[col]!) {
      const c = nextWithPost() ?? nextNoPost();
      if (!c) break;
      buckets[col].push(c);
    }
  }
  for (const col of [0, 1, 2] as const) {
    while (buckets[col].length < quotas[col]!) {
      const c = nextNoPost() ?? nextWithPost();
      if (!c) break;
      buckets[col].push(c);
    }
  }

  const out: AllocationWithRelations[] = [];
  for (let col = 0; col < PROGRESS_KANBAN.length; col += 1) {
    const column = PROGRESS_KANBAN[col]!;
    for (const creator of buckets[col]!) {
      out.push(allocationForPoolCreator(creator, column));
    }
  }
  return out;
}

function asPlatform(p: string): CreatorPlatform {
  if (p === "tiktok") return "tiktok";
  if (p === "youtube") return "youtube";
  if (p === "x" || p === "twitter" || p === "lips") return "etc";
  return "instagram";
}

/** creator_links.url · publish_url · API link_url 통합 */
export function creatorLinkHref(
  link: Pick<CreatorLink, "url" | "publish_url"> & { link_url?: string | null },
): string {
  return (link.publish_url || link.url || link.link_url || "").trim();
}

export function isRealSnsPostUrl(raw: string | null | undefined): boolean {
  const u = (raw || "").trim();
  return /instagram\.com|tiktok\.com|youtube\.com|youtu\.be|x\.com|twitter\.com/i.test(
    u,
  );
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
          publish_url: item.url,
          platform: asPlatform(item.platform),
          status: "approved",
          content_status: "발행완료",
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
      target_content_count: 1,
      rollup_status: hasUpload ? "발행완료" : "대기",
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
        profile_image_path: null,
        notes: creator?.tier || null,
        created_at: now,
        updated_at: now,
      },
      creator_links: link ? [link] : [],
    };
  });
}

/** @deprecated buildProgressPoolAllocations 사용 */
export function allocationsForProgressView(
  _dbItems: AllocationWithRelations[],
): AllocationWithRelations[] {
  return buildProgressPoolAllocations();
}

/** 발행 리스트 → 콘텐츠 성과 스냅샷 (실측 지표 우선, 없으면 추정). */
export function buildPublishDemoInsights(period: ContentPeriod) {
  const creators = creatorById();
  const feed = buildPublishFeed();
  const monthKey = ymdKst(new Date()).slice(0, 7);

  const posts: ContentPostInsight[] = [];
  for (const item of feed) {
    if (period === "month" && !item.publishedYmd.startsWith(monthKey)) {
      continue;
    }
    const creator = creators.get(item.creatorId);
    const polished = polishDemoMetrics({
      views: creator?.metrics.views,
      likes: creator?.metrics.likes,
      comments: creator?.metrics.comments,
      followers: creator?.followers,
      seed: item.id,
    });

    posts.push({
      id: item.id,
      url: item.url,
      platform: asPlatform(item.platform),
      market: creator?.market || "jp",
      allocationId: item.id,
      linkId: `link-${item.id}`,
      productId: `prod-${item.id}`,
      productName: item.productName || item.title,
      influencerId: item.creatorId,
      influencerName: item.creatorName,
      influencerHandle: item.handle,
      storeName: "JP 시딩",
      caption: `${item.creatorName} · ${item.productName}`,
      views: polished.views,
      likes: polished.likes,
      comments: polished.comments,
      postedAt: item.publishedYmd,
      collectedAt: new Date().toISOString(),
      source: "mock",
    });
  }

  return aggregateContentInsights(posts, period, "mock");
}

/** 성과 탭 1a — JP 발행 피드 + 수집 시각·갱신 예정 */
export function buildPublishDemoPerformance() {
  const creators = creatorById();
  const feed = buildPublishFeed();
  const today = ymdKst(new Date());
  const collectedAt = `${today}T04:00:00+09:00`;
  const nextCollectAt = `${addDaysYmd(today, 1)}T00:00:00+09:00`;

  const links: Array<{
    id: string;
    link_url: string | null;
    status: string;
    published_at: string | null;
    views: number | null;
    likes: number | null;
    comments: number | null;
    metrics_collected_at: string | null;
    allocations: {
      id: string;
      company_id: string;
      influencer_id: string;
      influencers: {
        id: string;
        name: string;
        instagram_handle_normalized: string;
        followers?: number;
      } | null;
      products: { id: string; name: string } | null;
    };
  }> = [];

  const metrics: Array<{
    creator_link_id: string;
    collected_at: string;
    views: number;
    likes: number;
    comments: number;
  }> = [];

  for (const item of feed) {
    const creator = creators.get(item.creatorId);
    const polished = polishDemoMetrics({
      views: creator?.metrics.views,
      likes: creator?.metrics.likes,
      comments: creator?.metrics.comments,
      followers: creator?.followers,
      seed: item.id,
    });
    const publishedAt = `${item.publishedYmd}T12:00:00+09:00`;
    const handle = item.handle.replace(/^@+/, "").toLowerCase();

    links.push({
      id: item.id,
      link_url: item.url,
      status: "발행완료",
      published_at: publishedAt,
      views: polished.views,
      likes: polished.likes,
      comments: polished.comments,
      metrics_collected_at: collectedAt,
      allocations: {
        id: item.id,
        company_id: "demo",
        influencer_id: item.creatorId,
        influencers: {
          id: item.creatorId,
          name: item.creatorName,
          instagram_handle_normalized: handle,
          followers: creator?.followers,
        },
        products: {
          id: `prod-${item.id}`,
          name: item.productName || item.title,
        },
      },
    });

    const pub = new Date(publishedAt).getTime();
    const curve = [0, 3, 7, 14];
    const ratios = [0.18, 0.45, 0.72, 1];
    for (let i = 0; i < curve.length; i++) {
      metrics.push({
        creator_link_id: item.id,
        collected_at: new Date(pub + curve[i]! * 86400000).toISOString(),
        views: Math.round(polished.views * ratios[i]!),
        likes: Math.round(polished.likes * ratios[i]!),
        comments: Math.round(polished.comments * ratios[i]!),
      });
    }
  }

  return {
    links,
    metrics,
    collectedAt,
    nextCollectAt,
    source: "mock" as const,
  };
}
