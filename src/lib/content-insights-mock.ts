import { type CreatorPlatform } from "@/lib/creator-link";
import {
  aggregateContentInsights,
  type ContentPeriod,
  type ContentPostInsight,
} from "@/lib/content-insights";
import { hash32, mockInt } from "@/lib/demo-metrics";
import {
  type AllocationWithRelations,
  ymdKst,
} from "@/lib/types";

function captionFor(productName: string, seed: string) {
  const templates = [
    `${productName}、銀座店で受け取って使ってみた`,
    `${productName} 2주 사용 후기`,
    `약사님 추천으로 픽업한 ${productName}`,
    `${productName} unboxing & first impression`,
    `Ginza pickup · ${productName}`,
  ];
  return templates[hash32(seed) % templates.length];
}

function handleOf(item: AllocationWithRelations) {
  const raw =
    item.influencers?.instagram_handle_normalized ||
    item.influencers?.instagram_handle ||
    "";
  const n = raw.replace(/^@+/, "").trim();
  return n ? `@${n}` : "—";
}

function asYmd(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : null;
}

function inPeriod(
  item: AllocationWithRelations,
  period: ContentPeriod,
  monthKey: string,
) {
  if (period === "all") return true;
  const d = asYmd(item.visit_date) || asYmd(item.picked_up_at);
  return Boolean(d && d.startsWith(monthKey));
}

/**
 * 실제 배정·링크를 뼈대로 조회수/좋아요만 목업합니다.
 * Apify 연동 시 이 함수 대신 live snapshot 을 쓰면 됩니다.
 * ponytail: /com UI 는 publish-demo-data 경로. 이 파일은 API·Apify 교체 지점용.
 */
export function buildMockContentInsights(
  items: AllocationWithRelations[],
  period: ContentPeriod,
  opts?: { fabricate?: boolean },
) {
  const fabricate = opts?.fabricate !== false;
  const monthKey = ymdKst(new Date()).slice(0, 7);
  const scoped = items.filter(
    (item) => item.status !== "cancelled" && inPeriod(item, period, monthKey),
  );

  const posts: ContentPostInsight[] = [];
  for (const item of scoped) {
    const links = (item.creator_links || []).filter(
      (link) => link.status !== "rejected",
    );
    const seeds =
      links.length > 0
        ? links.map((link) => ({
            id: link.id,
            url: link.url,
            platform: link.platform as CreatorPlatform,
            linkId: link.id,
            postedAt:
              asYmd(link.submitted_at) ||
              asYmd(item.picked_up_at) ||
              asYmd(item.visit_date),
          }))
        : fabricate &&
            (item.status === "picked_up" || item.status === "visited")
          ? [
              {
                id: `mock-${item.id}`,
                url: `https://instagram.com/p/mock-${item.id.slice(0, 8)}`,
                platform: "instagram" as const,
                linkId: null,
                postedAt: asYmd(item.picked_up_at) || asYmd(item.visit_date),
              },
            ]
          : [];

    for (const seed of seeds) {
      const liveLink =
        seed.linkId != null
          ? links.find((link) => link.id === seed.linkId) || null
          : null;
      const hasLiveMetrics =
        typeof liveLink?.views === "number" &&
        typeof liveLink?.likes === "number" &&
        typeof liveLink?.comments === "number";
      const views = hasLiveMetrics
        ? Math.max(0, Number(liveLink?.views ?? 0))
        : fabricate
          ? mockInt(`${seed.id}:views`, 2400, 186000)
          : 0;
      const likes = hasLiveMetrics
        ? Math.max(0, Number(liveLink?.likes ?? 0))
        : fabricate
          ? Math.round(views * (mockInt(`${seed.id}:er`, 18, 72) / 1000))
          : 0;
      const comments = hasLiveMetrics
        ? Math.max(0, Number(liveLink?.comments ?? 0))
        : fabricate
          ? Math.max(
              4,
              Math.round(likes * (mockInt(`${seed.id}:cmt`, 4, 18) / 100)),
            )
          : 0;
      posts.push({
        id: seed.id,
        url: seed.url,
        platform: seed.platform,
        market: "jp",
        allocationId: item.id,
        linkId: seed.linkId,
        productId: item.product_id,
        productName: item.products?.name || "상품",
        influencerId: item.influencer_id,
        influencerName: item.influencers?.name || handleOf(item),
        influencerHandle: handleOf(item),
        storeName: item.stores?.name || "—",
        caption: captionFor(item.products?.name || "상품", seed.id),
        views,
        likes,
        comments,
        postedAt: seed.postedAt,
        collectedAt: liveLink?.metrics_collected_at || (fabricate ? new Date().toISOString() : null),
        source: hasLiveMetrics || !fabricate ? "apify" : "mock",
      });
    }
  }

  return aggregateContentInsights(
    posts,
    period,
    posts.some((post) => post.source === "apify") ? "apify" : "mock",
  );
}
