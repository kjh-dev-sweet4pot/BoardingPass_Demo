import { polishDemoMetrics } from "@/lib/demo-metrics";
import { buildCreatorPool } from "@/lib/creator-pool-mock";
import { creatorPlatformLabelOf, extractSnsHandle } from "@/lib/creator-link";
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
  hasFile: boolean;
  fileKind: "video" | "image" | "other";
  platform: string;
  submitted_at: string | null;
  /** 반려 시 운영자 사유 (creator_links.memo) */
  reviewMemo: string | null;
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
  /** SNS 프로필 URL (없으면 프로필 링크 숨김) */
  profileUrl: string | null;
  publishedCount: number;
  targetCount: number;
  updatedAt: string;
  visitDates: string[];
  links: ProgressLink[];
  submittedLinks: ProgressLink[];
  approvedLinks: ProgressLink[];
  rejectedLinks: ProgressLink[];
  publishedLinks: ProgressLink[];
};

const creators = new Map(buildCreatorPool().map((c) => [c.id, c]));

function isPublishedLink(link: CreatorLink) {
  return link.content_status === "발행완료";
}

function isSubmittedLink(link: CreatorLink) {
  return (
    link.content_status === "제출" ||
    link.content_status === "승인" ||
    (link.content_status == null && link.status === "submitted")
  );
}

function rollupStatus(item: AllocationWithRelations, links: CreatorLink[]): KanbanColumn {
  const target = item.target_content_count ?? 1;
  const published = links.filter(isPublishedLink).length;
  const submitted = links.filter(
    (l) => isSubmittedLink(l) || l.content_status === "승인" || l.content_status === "발행완료",
  ).length;

  if (published >= target) return "발행완료";
  if (submitted > 0) return "검수중";
  if (item.status === "picked_up" || item.picked_up_at) return "제작중";
  if (item.status === "visited" || item.status === "ready") return "수령완료";
  return "대기";
}

function fileKindFromPath(path: string | null | undefined): ProgressLink["fileKind"] {
  const p = (path || "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|heic)$/.test(p)) return "image";
  if (/\.(mp4|webm|mov|m4v)$/.test(p)) return "video";
  return "other";
}

function toProgressLink(
  link: CreatorLink,
  influencerId: string,
  opts: { demoMetrics: boolean },
): ProgressLink {
  const { demoMetrics } = opts;

  const normalized = (v: number | null | undefined): number | null => {
    if (typeof v !== "number") return null;
    if (!Number.isFinite(v)) return null;
    // live 데이터에서 -1 같은 센티널 값이 섞일 수 있어 방어
    if (v < 0) return null;
    return v;
  };

  if (!demoMetrics) {
    // ponytail: 진행현황은 live 수치가 있으면 그대로 표시
    // - 폴백(creator-pool-mock) 없이 빈 값(null)으로 유지
    return {
      id: link.id,
      status: link.content_status || link.status,
      url: creatorLinkHref(link) || null,
      hasFile: Boolean(link.submitted_file_path),
      fileKind: fileKindFromPath(link.submitted_file_path),
      platform: creatorPlatformLabelOf(
        creatorLinkHref(link) || link.url,
        link.platform,
      ),
      submitted_at: link.submitted_at || null,
      reviewMemo: link.memo?.trim() || null,
      views: normalized(link.views),
      likes: normalized(link.likes),
      comments: normalized(link.comments),
    };
  }

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
    hasFile: Boolean(link.submitted_file_path),
    fileKind: fileKindFromPath(link.submitted_file_path),
    platform: creatorPlatformLabelOf(
      creatorLinkHref(link) || link.url,
      link.platform,
    ),
    submitted_at: link.submitted_at || null,
    reviewMemo: link.memo?.trim() || null,
    views: polished.views,
    likes: polished.likes,
    comments: polished.comments,
  };
}

function handleOf(item: AllocationWithRelations) {
  const n =
    extractSnsHandle(item.influencers?.instagram_handle_normalized) ||
    extractSnsHandle(item.influencers?.instagram_handle) ||
    extractSnsHandle(item.influencers?.sns_url);
  return n ? `@${n}` : "—";
}

/** 배정 목록 → 칸반 카드 (JP 발행 목업·DB 배정 공통) */
export function buildKanbanFromAllocations(
  items: AllocationWithRelations[],
  productFilter?: string,
  opts?: { demoMetrics?: boolean },
): ProgressKanbanCard[] {
  const demoMetrics = opts?.demoMetrics ?? false;
  const cards: ProgressKanbanCard[] = [];

  for (const item of items) {
    if (item.status === "cancelled") continue;
    const productName = item.products?.name || "상품";
    if (productFilter && productName !== productFilter) continue;

    const rawLinks = item.creator_links ?? [];
    const links = rawLinks.map((l) =>
      toProgressLink(l, item.influencer_id, { demoMetrics }),
    );
    const publishedLinks = links.filter((_, i) => isPublishedLink(rawLinks[i]!));
    const submittedLinks = links.filter((_, i) => rawLinks[i]!.content_status === "제출");
    const approvedLinks = links.filter((_, i) => rawLinks[i]!.content_status === "승인");
    const rejectedLinks = links.filter((_, i) => rawLinks[i]!.content_status === "반려");
    const status = rollupStatus(item, rawLinks);
    const target = item.target_content_count ?? Math.max(1, rawLinks.length || 1);
    const publishedCount = publishedLinks.length;

    const visitDate = item.visit_date?.slice(0, 10) || "";
    const visitDates = /^\d{4}-\d{2}-\d{2}$/.test(visitDate) ? [visitDate] : [];
    const updatedAt =
      visitDates[0] ||
      rawLinks[0]?.submitted_at?.slice(0, 10) ||
      item.picked_up_at?.slice(0, 10) ||
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
      profileUrl: (item.influencers?.sns_url || "").trim() || null,
      publishedCount,
      targetCount: target,
      updatedAt,
      visitDates,
      links,
      submittedLinks,
      approvedLinks,
      rejectedLinks,
      publishedLinks,
    });
  }

  return mergeKanbanByInfluencer(cards);
}

function uniqJoin(parts: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.join(", ");
}

function formatVisitDates(dates: string[]) {
  if (dates.length === 0) return "—";
  if (dates.length === 1) return dates[0]!;
  return `${dates[0]} 외 ${dates.length - 1}`;
}

/** 같은 칸·같은 인플루언서는 1장. 방문일·상품만 합친다. */
export function mergeKanbanByInfluencer(cards: ProgressKanbanCard[]) {
  const map = new Map<string, ProgressKanbanCard>();
  for (const card of cards) {
    const key = `${card.status}:${card.influencerId}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        ...card,
        links: [...card.links],
        submittedLinks: [...card.submittedLinks],
        approvedLinks: [...card.approvedLinks],
        rejectedLinks: [...card.rejectedLinks],
        publishedLinks: [...card.publishedLinks],
        visitDates: [...card.visitDates],
      });
      continue;
    }
    prev.publishedCount += card.publishedCount;
    prev.targetCount += card.targetCount;
    prev.productName = uniqJoin([prev.productName, card.productName]);
    prev.campaignName = uniqJoin([prev.campaignName, card.campaignName]);
    prev.links.push(...card.links);
    prev.submittedLinks.push(...card.submittedLinks);
    prev.approvedLinks.push(...card.approvedLinks);
    prev.rejectedLinks.push(...card.rejectedLinks);
    prev.publishedLinks.push(...card.publishedLinks);
    prev.visitDates = [...new Set([...prev.visitDates, ...card.visitDates])].sort();
    if (prev.visitDates.length) {
      prev.updatedAt = formatVisitDates(prev.visitDates);
    }
    if (!prev.profileUrl && card.profileUrl) prev.profileUrl = card.profileUrl;
  }
  return [...map.values()];
}

if (process.env.RUN_KANBAN_SELF_CHECK === "1") {
  const merged = mergeKanbanByInfluencer([
    {
      id: "1",
      campaignName: "s1",
      productName: "p1",
      status: "대기",
      influencerId: "inf",
      name: "A",
      handle: "@a",
      profileUrl: null,
      publishedCount: 0,
      targetCount: 1,
      updatedAt: "2026-09-13",
      visitDates: ["2026-09-13"],
      links: [],
      submittedLinks: [],
      approvedLinks: [],
      rejectedLinks: [],
      publishedLinks: [],
    },
    {
      id: "2",
      campaignName: "s2",
      productName: "p2",
      status: "대기",
      influencerId: "inf",
      name: "A",
      handle: "@a",
      profileUrl: null,
      publishedCount: 0,
      targetCount: 1,
      updatedAt: "2026-09-14",
      visitDates: ["2026-09-14"],
      links: [],
      submittedLinks: [],
      approvedLinks: [],
      rejectedLinks: [],
      publishedLinks: [],
    },
  ]);
  if (
    merged.length !== 1 ||
    merged[0]!.targetCount !== 2 ||
    merged[0]!.productName !== "p1, p2" ||
    merged[0]!.updatedAt !== "2026-09-13 외 1"
  ) {
    throw new Error("mergeKanbanByInfluencer failed");
  }
  console.log("com-progress-kanban self-check ok");
}

export function productOptionsFromAllocations(items: AllocationWithRelations[]) {
  const set = new Set<string>();
  for (const item of items) {
    if (item.products?.name) set.add(item.products.name);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ko"));
}
