/** 발행 피드 — JP 크리에이터 실업로드 링크 기반. */

import { buildCreatorPool } from "@/lib/creator-pool-mock";

export type PublishKind = "carousel" | "visit" | "seeding";

export type PublishItem = {
  id: string;
  kind: PublishKind;
  title: string;
  creatorName: string;
  handle: string;
  url: string;
  platform: string;
  publishedYmd: string;
  productName: string;
};

export const PUBLISH_KIND_LABEL: Record<PublishKind, string> = {
  carousel: "캐러셀",
  visit: "방문",
  seeding: "시딩 리뷰",
};

export const PUBLISH_PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  lips: "LIPS",
  youtube: "YouTube",
};

export function formatPublishMd(ymd: string) {
  const [, m, d] = ymd.split("-").map(Number);
  if (!m || !d) return ymd;
  return `${m}월 ${d}일`;
}

function kindFromUrl(url: string, platform: string): PublishKind {
  if (/\/p\//i.test(url) && platform === "instagram") return "carousel";
  if (/visit|ginza|店舗|방문/i.test(url)) return "visit";
  return "seeding";
}

/** ponytail: 실포스트 URL이 있는 크리에이터만. */
export function buildPublishFeed(): PublishItem[] {
  const rows: PublishItem[] = [];
  let i = 0;
  for (const c of buildCreatorPool()) {
    if (!c.posts.length) continue;
    for (const post of c.posts) {
      i += 1;
      rows.push({
        id: `pub-${String(i).padStart(3, "0")}`,
        kind: kindFromUrl(post.url, post.platform),
        title: c.product
          ? `${c.product} · ${PUBLISH_PLATFORM_LABEL[post.platform] || post.platform}`
          : `${c.name} 업로드`,
        creatorName: c.name,
        handle: c.handle,
        url: post.url,
        platform: post.platform,
        publishedYmd: c.uploadYmd || "2026-05-01",
        productName: c.product || "—",
      });
    }
  }
  return rows.sort((a, b) => b.publishedYmd.localeCompare(a.publishedYmd));
}

export const PUBLISH_FEED_SIZE = (() => {
  let n = 0;
  for (const c of buildCreatorPool()) n += c.posts.length;
  return n;
})();
