import { apifyErrorMessage } from "@/lib/apify-errors";
import { regionFromCountryLabel } from "@/lib/region-display";

/** 게시물 지표: patient_discovery (저장·공유·리포스트 포함) */
const POST_ACTOR_ID = "oi5NGnwthRXoqEux1"; // patient_discovery/instagram-reel-analytics-by-url
/** 프로필 + about.country(계정 국가): data-slayer cookieless */
const PROFILE_COUNTRY_ACTOR_ID = "data-slayer~instagram-user-info-scraper-cookieless";
const APIFY_BASE = "https://api.apify.com/v2";

export interface InstagramScraperResult {
  id: string;
  inputUrl?: string;
  url?: string;
  shortCode?: string;
  type?: string;
  displayUrl?: string;
  images?: string[];
  likesCount?: number;
  commentsCount?: number;
  ownerFullName?: string;
  ownerUsername?: string;
  username?: string;
  profilePicUrl?: string;
  profilePicUrlHD?: string;
  followersCount?: number;
  followsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  viewCount?: number;
  playCount?: number;
  /** 저장(북마크). 소스 미제공 시 undefined */
  savesCount?: number | null;
  /** 공유(DM 등). 소스 미제공 시 undefined */
  sharesCount?: number | null;
  /** 리포스트. 소스 미제공 시 undefined */
  repostsCount?: number | null;
}

type PatientDiscoveryItem = {
  id?: string | number;
  code?: string;
  shortcode?: string;
  media_name?: string;
  media_format?: string;
  is_video?: boolean;
  thumbnail_url?: string;
  video_url?: string;
  taken_at_date?: string;
  metrics?: {
    like_count?: number | null;
    comment_count?: number | null;
    play_count?: number | null;
    ig_play_count?: number | null;
    view_count?: number | null;
    share_count?: number | null;
    save_count?: number | null;
    repost_count?: number | null;
  };
  metrics_availability?: {
    share_count?: string;
    save_count?: string;
  };
  user?: {
    username?: string;
    full_name?: string;
    is_verified?: boolean;
  };
  caption?: { text?: string } | string;
  image_versions?: { items?: Array<{ url?: string }> };
};

function getApifyToken(): string {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN 환경변수가 없습니다.");
  return token;
}

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
  return Math.round(v);
}

function availableCount(
  value: number | null | undefined,
  availability?: string,
): number | null {
  if (availability === "unavailable_from_source") return null;
  return numOrNull(value);
}

function mapPatientDiscoveryItem(
  item: PatientDiscoveryItem,
  inputUrl?: string,
): InstagramScraperResult {
  const code = (item.code || item.shortcode || "").trim();
  const metrics = item.metrics || {};
  const avail = item.metrics_availability || {};
  const user = item.user || {};
  const play =
    numOrNull(metrics.ig_play_count) ??
    numOrNull(metrics.play_count) ??
    numOrNull(metrics.view_count);
  const thumb =
    item.thumbnail_url ||
    item.image_versions?.items?.[0]?.url ||
    undefined;
  const url =
    inputUrl ||
    (code ? `https://www.instagram.com/p/${code}/` : undefined);

  return {
    id: String(item.id ?? code),
    inputUrl: inputUrl,
    url,
    shortCode: code || undefined,
    type: item.media_name || item.media_format,
    displayUrl: thumb,
    images: thumb ? [thumb] : undefined,
    likesCount: numOrNull(metrics.like_count) ?? undefined,
    commentsCount: numOrNull(metrics.comment_count) ?? undefined,
    ownerFullName: user.full_name,
    ownerUsername: user.username,
    username: user.username,
    videoPlayCount: play ?? undefined,
    videoViewCount: play ?? undefined,
    playCount: play ?? undefined,
    viewCount: play ?? undefined,
    savesCount: availableCount(metrics.save_count, avail.save_count),
    sharesCount: availableCount(metrics.share_count, avail.share_count),
    repostsCount: numOrNull(metrics.repost_count),
  };
}

const IG_RESERVED_SEGMENTS = /^(?:p|reel|reels|stories|explore|tv|accounts|direct)$/i;

/** instagram.com/{handle}/… → handle (reels·posts 등 하위 경로 무시) */
export function instagramHandleFromUrl(url: string): string | null {
  try {
    const seg = new URL(url.trim()).pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    if (!seg || IG_RESERVED_SEGMENTS.test(seg)) return null;
    return seg;
  } catch {
    return null;
  }
}

export function instagramProfileUrlFromHandle(handle: string) {
  const h = handle.replace(/^@+/, "").trim();
  if (!h) throw new Error("Instagram 핸들이 비어 있습니다.");
  return `https://www.instagram.com/${h}/`;
}

/** 프로필 수집용 — 항상 /{handle}/ 만 사용 (/reels, /p 등 제거) */
export function resolveInstagramProfileUrl(handle: string, snsUrl?: string | null) {
  const raw = (snsUrl || "").trim();
  const fromUrl =
    raw && /^https?:\/\//i.test(raw) && isInstagramUrl(raw)
      ? instagramHandleFromUrl(raw)
      : null;
  const h = (fromUrl || handle).replace(/^@+/, "").trim();
  return instagramProfileUrlFromHandle(h);
}

function normalizeInstagramUrl(url: string) {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/+$/, "").toLowerCase();
  } catch {
    return url.trim().replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
  }
}

function extractInstagramShortCode(url: string): string | null {
  try {
    const path = new URL(url.trim()).pathname;
    const match = path.match(/\/(?:p|reel|reels)\/([^/]+)/i);
    return match?.[1]?.toLowerCase() || null;
  } catch {
    const match = url.match(/\/(?:p|reel|reels)\/([^/?#]+)/i);
    return match?.[1]?.toLowerCase() || null;
  }
}

export function isInstagramUrl(url: string) {
  try {
    const host = new URL(url.trim()).hostname.replace(/^www\./, "").toLowerCase();
    return host === "instagram.com" || host === "instagr.am";
  } catch {
    return false;
  }
}

export function getInstagramResultsType(url: string): "posts" | "reels" {
  try {
    const path = new URL(url.trim()).pathname.toLowerCase();
    if (/^\/(?:p|reel|reels)\/[^/]+\/?$/.test(path)) {
      return "posts";
    }
    return path.endsWith("/reels/") ? "reels" : "posts";
  } catch {
    return "posts";
  }
}

export async function scrapeInstagramPosts(
  postUrls: string[],
  memoryMbytes = 1024,
): Promise<InstagramScraperResult[]> {
  const token = getApifyToken();
  const urls = postUrls.map((u) => u.trim()).filter(Boolean);
  if (urls.length === 0) return [];

  const res = await fetch(
    `${APIFY_BASE}/acts/${POST_ACTOR_ID}/run-sync-get-dataset-items?token=${token}&memoryMbytes=${memoryMbytes}&timeout=180`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postUrls: urls }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(await apifyErrorMessage(res.status, text));
  }

  const raw = (await res.json()) as PatientDiscoveryItem[];
  if (!Array.isArray(raw)) return [];

  // Actor가 예시/중복 항목을 섞을 수 있어 shortcode 기준 매칭
  const byCode = new Map<string, InstagramScraperResult>();
  for (const item of raw) {
    const mapped = mapPatientDiscoveryItem(item);
    const code = mapped.shortCode?.toLowerCase();
    if (code && !byCode.has(code)) byCode.set(code, mapped);
  }

  const results: InstagramScraperResult[] = [];
  for (const url of urls) {
    const code = extractInstagramShortCode(url);
    const hit = code ? byCode.get(code) : undefined;
    if (hit) {
      results.push({ ...hit, inputUrl: url, url: hit.url || url });
      continue;
    }
    // 단일 URL 요청이면 shortcode 불일치여도 유일한 결과를 매칭
    if (urls.length === 1 && byCode.size === 1) {
      const only = [...byCode.values()][0]!;
      results.push({ ...only, inputUrl: url, url: only.url || url });
    }
  }
  return results;
}

/** 프로필 URL·핸들 → 아바타·팔로워·region(about.country) */
export async function scrapeInstagramProfile(
  profileUrlOrHandle: string,
  memoryMbytes = 1024,
): Promise<{
  imageUrl: string | null;
  followers: number | null;
  region: string | null;
}> {
  const token = getApifyToken();
  const profileUrl = profileUrlOrHandle.includes("instagram.com")
    ? profileUrlOrHandle
    : instagramProfileUrlFromHandle(profileUrlOrHandle);
  const handle =
    instagramHandleFromUrl(profileUrl) ||
    bareHandleFromInput(profileUrlOrHandle);
  if (!handle) {
    throw new Error(`유효한 Instagram 핸들이 아닙니다: "${profileUrlOrHandle}"`);
  }

  const res = await fetch(
    `${APIFY_BASE}/acts/${PROFILE_COUNTRY_ACTOR_ID}/run-sync-get-dataset-items?token=${token}&memoryMbytes=${memoryMbytes}&timeout=180`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [handle] }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(await apifyErrorMessage(res.status, text));
  }
  const items = (await res.json()) as Array<{
    error?: string;
    username?: string;
    follower_count?: number;
    profile_pic_url_hd?: string;
    profile_pic_url?: string;
    hd_profile_pic_url_info?: { url?: string };
    about?: { country?: string | null };
  }>;
  const item = items[0];
  if (!item) return { imageUrl: null, followers: null, region: null };
  if (item.error) {
    throw new Error(`Instagram 프로필 수집 실패 (@${handle}): ${item.error}`);
  }
  const followers = numOrNull(item.follower_count);
  const imageUrl =
    item.profile_pic_url_hd ||
    item.hd_profile_pic_url_info?.url ||
    item.profile_pic_url ||
    null;
  return {
    imageUrl,
    followers,
    region: regionFromCountryLabel(item.about?.country),
  };
}

function bareHandleFromInput(raw: string) {
  return raw.replace(/^@+/, "").trim().split(/[/?#]/)[0] || "";
}

export function findInstagramResultForUrl(
  items: InstagramScraperResult[],
  url: string,
): InstagramScraperResult | undefined {
  const target = normalizeInstagramUrl(url);
  const shortCode = extractInstagramShortCode(url);
  return (
    items.find((item) => {
      const candidate = normalizeInstagramUrl(item.url || item.inputUrl || "");
      return candidate === target || Boolean(item.id && target.includes(item.id));
    }) ??
    items.find((item) => item.shortCode?.toLowerCase() === shortCode) ??
    (items.length === 1 ? items[0] : undefined)
  );
}

export function extractInstagramThumbnailUrl(
  result: InstagramScraperResult | null | undefined,
): string | null {
  if (!result) return null;
  if (result.displayUrl) return result.displayUrl;
  if (result.images?.length) return result.images[0];
  return null;
}

export function extractInstagramProfileName(
  result: InstagramScraperResult | null | undefined,
): string | null {
  if (!result) return null;
  return result.ownerFullName || result.ownerUsername || null;
}

export function extractInstagramViews(
  result: InstagramScraperResult | null | undefined,
): number | null {
  if (!result) return null;
  const dynamic = result as InstagramScraperResult & {
    video_view_count?: number;
    video_play_count?: number;
  };
  return (
    result.videoViewCount ??
    result.videoPlayCount ??
    result.viewCount ??
    result.playCount ??
    dynamic.video_view_count ??
    dynamic.video_play_count ??
    null
  );
}
