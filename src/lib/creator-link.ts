export type CreatorPlatform =
  | "instagram"
  | "tiktok"
  | "xiaohongshu"
  | "youtube"
  | "naver_blog"
  | "etc";

export type CreatorLinkStatus = "submitted" | "approved" | "rejected";

const XHS_HREF = /xiaohongshu|xhslink|rednote\.com|小红书/i;

export function detectPlatform(url: string): CreatorPlatform {
  const raw = (url || "").trim();
  if (!raw) return "etc";
  // 호스트 파싱 전 문자열 — xhslink.cn / rednote / 단축링크가 인스타로 떨어지지 않게
  if (XHS_HREF.test(raw)) return "xiaohongshu";
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("instagram.com") || host === "instagr.am") {
      return "instagram";
    }
    if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
    if (host.includes("blog.naver.com") || host.includes("naver.blog")) {
      return "naver_blog";
    }
    return "etc";
  } catch {
    if (/tiktok/i.test(raw)) return "tiktok";
    if (/instagram|instagr\.am/i.test(raw)) return "instagram";
    return "etc";
  }
}

/** DB platform이 etc여도 URL이 샤오홍슈면 샤오홍슈 */
export function resolveCreatorPlatform(
  url?: string | null,
  stored?: string | null,
): CreatorPlatform {
  const fromUrl = detectPlatform(url || "");
  if (fromUrl !== "etc") return fromUrl;
  if (
    stored === "xiaohongshu" ||
    stored === "tiktok" ||
    stored === "instagram" ||
    stored === "youtube" ||
    stored === "naver_blog"
  ) {
    return stored;
  }
  return "etc";
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
  xiaohongshu: "샤오홍슈",
  youtube: "YouTube",
  naver_blog: "네이버 블로그",
  etc: "기타",
};

export function creatorPlatformLabelOf(
  url?: string | null,
  stored?: string | null,
) {
  return CREATOR_PLATFORM_LABEL[resolveCreatorPlatform(url, stored)];
}

/** 풀·사진용. URL이 샤오홍슈면 인스타로 떨어지지 않음 */
export function creatorSnsChannelOf(
  url?: string | null,
  stored?: string | null,
): "instagram" | "tiktok" | "xiaohongshu" | "youtube" {
  const p = resolveCreatorPlatform(url, stored);
  if (p === "tiktok" || p === "xiaohongshu" || p === "youtube") return p;
  return "instagram";
}

/** 핸들 칸에 URL이 들어온 경우 아이디만 남긴다 */
export function extractSnsHandle(raw?: string | null): string {
  const s = (raw || "").replace(/^@+/, "").trim();
  if (!s) return "";
  const href = /^https?:\/\//i.test(s)
    ? s
    : /xiaohongshu|xhslink|rednote|instagram\.com|tiktok\.com|youtu/i.test(s)
      ? `https://${s}`
      : "";
  if (!href) return s;
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname;
    if (
      host.includes("xiaohongshu") ||
      host.includes("rednote") ||
      host.includes("xhslink")
    ) {
      return path.match(/\/user\/profile\/([^/?#]+)/i)?.[1] || "";
    }
    if (host.includes("tiktok.com")) {
      return decodeURIComponent(
        path.match(/\/@([^/]+)/)?.[1] || "",
      ).replace(/^@/, "");
    }
    if (host.includes("instagram.com") || host === "instagr.am") {
      const h = decodeURIComponent(path.match(/^\/([^/]+)/)?.[1] || "");
      if (["p", "reel", "reels", "stories"].includes(h.toLowerCase())) return "";
      return h.replace(/^@/, "");
    }
  } catch {
    /* ignore */
  }
  return "";
}

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

/** admin 검수 큐·링크 상세 Supabase select (한 곳) */
export const ADMIN_LINK_REVIEW_SELECT = `
  id, allocation_id, influencer_id, url, platform, status, content_status,
  publish_url, submitted_file_path, memo, submitted_at, updated_at,
  thumbnail_source_url, verification_failed,
  content_feedback ( id, body, created_at ),
  allocations (
    id, visit_date, rollup_status, campaign_id,
    products ( name ),
    stores ( name ),
    influencers ( name, instagram_handle, instagram_handle_normalized ),
    companies ( id, name ),
    campaigns (
      id, name, status,
      guidelines ( id, title, body, file_path )
    )
  )
`;
