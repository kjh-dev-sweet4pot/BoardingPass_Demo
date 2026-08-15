/** 발행 피드 — JP 실업로드, 카드용 150건. */

import { buildCreatorPool } from "@/lib/creator-pool-mock";
import publishThumbManifest from "./data/jp-publish-thumb-manifest.json";

export type PublishKind = "carousel" | "visit" | "seeding";

export type PublishItem = {
  id: string;
  creatorId: string;
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

/** ponytail: 미팅용 150건. */
export const PUBLISH_FEED_LIMIT = 150;

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

function igMediaThumb(url: string) {
  const m = url.match(/instagram\.com\/(?:reel|reels|p)\/([^\/\?#]+)/i);
  return m ? `https://www.instagram.com/p/${m[1]}/media/?size=l` : null;
}

/** 게시물 썸네일 후보: 로컬 캐시 → IG media → microlink OG */
export function publishThumbCandidates(item: PublishItem): string[] {
  const out: string[] = [];
  const push = (u: string | null | undefined) => {
    const v = (u || "").trim();
    if (v && !out.includes(v)) out.push(v);
  };
  const cached = (publishThumbManifest as Record<string, string>)[item.id];
  if (cached) push(`/publish-thumbs/${item.id}.jpg`);
  push(igMediaThumb(item.url));
  push(
    `https://api.microlink.io/?url=${encodeURIComponent(item.url)}&embed=image.url`,
  );
  // 크리에이터 카드용으로 받아둔 실사진도 후보
  push(`/creator-avatars/${item.creatorId}.jpg`);
  return out;
}

function rankPost(url: string, platform: string) {
  // IG 미디어 썸네일 추출이 가장 확실
  if (igMediaThumb(url)) return 0;
  if (platform === "tiktok" || platform === "youtube") return 1;
  return 2;
}

export function buildPublishFeed(
  limit = PUBLISH_FEED_LIMIT,
): PublishItem[] {
  const rows: PublishItem[] = [];
  let i = 0;
  for (const c of buildCreatorPool()) {
    if (!c.posts.length) continue;
    for (const post of c.posts) {
      i += 1;
      rows.push({
        id: `pub-${String(i).padStart(3, "0")}`,
        creatorId: c.id,
        kind: kindFromUrl(post.url, post.platform),
        title: c.product
          ? `${c.product}`
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

  return rows
    .sort((a, b) => {
      const ra = rankPost(a.url, a.platform);
      const rb = rankPost(b.url, b.platform);
      if (ra !== rb) return ra - rb;
      return b.publishedYmd.localeCompare(a.publishedYmd);
    })
    .slice(0, limit)
    .map((row, idx) => ({
      ...row,
      id: `pub-${String(idx + 1).padStart(3, "0")}`,
    }));
}

export const PUBLISH_FEED_SIZE = PUBLISH_FEED_LIMIT;
