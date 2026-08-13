export type CreatorPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "naver_blog"
  | "etc";

export type CreatorLinkStatus = "submitted" | "approved" | "rejected";

export function detectPlatform(url: string): CreatorPlatform {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("instagram.com") || host === "instagr.am") {
      return "instagram";
    }
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
    if (host.includes("blog.naver.com") || host.includes("naver.blog")) {
      return "naver_blog";
    }
    return "etc";
  } catch {
    return "etc";
  }
}

export function validateCreatorUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return "링크를 입력해 주세요.";
  if (url.length > 2000) return "링크가 너무 깁니다.";
  if (!/^https?:\/\//i.test(url)) return "올바른 링크 형식이 아닙니다.";
  try {
    new URL(url);
  } catch {
    return "올바른 링크 형식이 아닙니다.";
  }
  return null;
}

export const CREATOR_PLATFORM_LABEL: Record<CreatorPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  naver_blog: "네이버 블로그",
  etc: "기타",
};

export const CREATOR_LINK_STATUS_LABEL: Record<CreatorLinkStatus, string> = {
  submitted: "검수중",
  approved: "승인",
  rejected: "반려",
};

export type AllocationLinkSummary = "none" | "reviewing" | "approved" | "rejected";

export function summarizeAllocationLinks(
  links: { status: CreatorLinkStatus }[],
): AllocationLinkSummary {
  if (links.length === 0) return "none";
  if (links.some((l) => l.status === "approved")) return "approved";
  if (links.some((l) => l.status === "submitted")) return "reviewing";
  return "rejected";
}

export const ALLOCATION_LINK_LABEL: Record<AllocationLinkSummary, string> = {
  none: "미제출",
  reviewing: "검수중",
  approved: "제출 완료",
  rejected: "반려",
};

export const ALLOCATION_LINK_LABEL_ADMIN: Record<AllocationLinkSummary, string> =
  {
    none: "미제출",
    reviewing: "검수중",
    approved: "승인",
    rejected: "반려",
  };
