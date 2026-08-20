import { polishDemoMetrics } from "@/lib/demo-metrics";
import { buildCreatorPool } from "@/lib/creator-pool-mock";
import { CREATOR_PLATFORM_LABEL } from "@/lib/creator-link";
import { creatorLinkHref } from "@/lib/publish-demo-data";
import type { AllocationWithRelations, CreatorLink } from "@/lib/types";

export const KANBAN_COLUMNS = [
  "대기",
  "수령완료",
  "제작중",
  "검수중",
  "발행완료",
] as const;

export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

export type ProgressLink = {
  id: string;
  status: string;
  url: string | null;
  platform: string;
  submitted_at: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
};

export type ProgressKanbanCard = {
  id: string;
  campaignName: string;
  productName: string;
  status: KanbanColumn;
  influencerId: string;
  name: string;
  handle: string;
  publishedCount: number;
  targetCount: number;
  updatedAt: string;
  links: ProgressLink[];
  submittedLinks: ProgressLink[];
  publishedLinks: ProgressLink[];
};

const creators = new Map(buildCreatorPool().map((c) => [c.id, c]));

function isKanbanColumn(v: string): v is KanbanColumn {
  return (KANBAN_COLUMNS as readonly string[]).includes(v);
}

function isPublishedLink(link: CreatorLink) {
  return link.content_status === "발행완료" || link.status === "approved";
}

function isSubmittedLink(link: CreatorLink) {
  return link.content_status === "제출" || link.status === "submitted";
}

function rollupStatus(item: AllocationWithRelations, links: CreatorLink[]): KanbanColumn {
  if (item.rollup_status && isKanbanColumn(item.rollup_status)) {
    return item.rollup_status;
  }

  const target = item.target_content_count ?? 1;
  const published = links.filter(isPublishedLink).length;
  const submitted = links.filter(
    (l) => isSubmittedLink(l) || l.content_status === "승인",
  ).length;

  if (published >= target) return "발행완료";
  if (submitted > 0) return "검수중";
  if (item.status === "picked_up" || item.picked_up_at) return "제작중";
  if (item.status === "visited" || item.status === "ready") return "수령완료";
  if (item.status === "pending") return "대기";
  return "대기";
}

function toProgressLink(link: CreatorLink, influencerId: string): ProgressLink {
  const creator = creators.get(influencerId);
  const polished = polishDemoMetrics({
    views: link.views ?? creator?.metrics.views,
    likes: link.likes ?? creator?.metrics.likes,
    comments: link.comments ?? creator?.metrics.comments,
    followers: creator?.followers,
    seed: link.id,
  });
  return {
    id: link.id,
    status: link.content_status || link.status,
    url: creatorLinkHref(link) || null,
    platform: CREATOR_PLATFORM_LABEL[link.platform] || link.platform,
    submitted_at: link.submitted_at || null,
    views: polished.views,
    likes: polished.likes,
    comments: polished.comments,
  };
}

function handleOf(item: AllocationWithRelations) {
  const raw =
    item.influencers?.instagram_handle_normalized ||
    item.influencers?.instagram_handle ||
    "";
  const n = raw.replace(/^@+/, "").trim();
  return n ? `@${n}` : "—";
}

/** 배정 목록 → 칸반 카드 (JP 발행 목업·DB 배정 공통) */
export function buildKanbanFromAllocations(
  items: AllocationWithRelations[],
  productFilter?: string,
): ProgressKanbanCard[] {
  const cards: ProgressKanbanCard[] = [];

  for (const item of items) {
    if (item.status === "cancelled") continue;
    const productName = item.products?.name || "상품";
    if (productFilter && productName !== productFilter) continue;

    const rawLinks = item.creator_links ?? [];
    const links = rawLinks.map((l) => toProgressLink(l, item.influencer_id));
    const publishedLinks = links.filter((_, i) => isPublishedLink(rawLinks[i]!));
    const submittedLinks = links.filter((_, i) => isSubmittedLink(rawLinks[i]!));
    const status = rollupStatus(item, rawLinks);
    const target = item.target_content_count ?? Math.max(1, rawLinks.length || 1);
    const publishedCount = publishedLinks.length;

    const updatedAt =
      rawLinks[0]?.submitted_at?.slice(0, 10) ||
      item.picked_up_at?.slice(0, 10) ||
      item.visit_date?.slice(0, 10) ||
      item.updated_at?.slice(0, 10) ||
      "—";

    cards.push({
      id: item.id,
      campaignName: item.stores?.name || "캠페인",
      productName,
      status,
      influencerId: item.influencer_id,
      name: item.influencers?.name || handleOf(item),
      handle: handleOf(item),
      publishedCount,
      targetCount: target,
      updatedAt,
      links,
      submittedLinks,
      publishedLinks,
    });
  }

  return cards;
}

export function productOptionsFromAllocations(items: AllocationWithRelations[]) {
  const set = new Set<string>();
  for (const item of items) {
    if (item.products?.name) set.add(item.products.name);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ko"));
}
