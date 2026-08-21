/**
 * Apify TikTok Scraper (clockworks/tiktok-scraper, actor ID: GdWCkxBtKWOsKjdch)
 *
 * Input:  { postURLs: string[] }
 * Output: TikTokPost[]  (see type below)
 *
 * Docs: https://apify.com/clockworks/tiktok-scraper
 */

import { apifyErrorMessage } from "@/lib/apify-errors";

const ACTOR_ID = "GdWCkxBtKWOsKjdch";
const APIFY_BASE = "https://api.apify.com/v2";

export interface TikTokScraperResult {
  id: string;
  text: string;
  /** 최상위 coverUrl (서명된 CDN URL, 만료될 수 있음) */
  coverUrl?: string;
  /** shouldDownloadCovers=true 시 Apify KV Store에 저장된 안정적인 URL 배열 */
  mediaUrls?: string[];
  avatar?: string;
  originalAvatarUrl?: string;
  profileUrl?: string;
  nickName?: string;
  videoMeta?: {
    coverUrl?: string;
    originalCoverUrl?: string;
  };
  playCount: number;         // views
  diggCount: number;         // likes
  commentCount: number;
  shareCount: number;
  /** 저장(북마크) */
  collectCount?: number;
  webVideoUrl: string;
  authorMeta?: {
    name: string;
    id: string;
    avatar?: string;
    originalAvatarUrl?: string;
    fans?: number;
    followers?: number;
    following?: number;
  };
}

/** 결과에서 가장 안정적인 썸네일 URL 추출 */
export function extractThumbnailUrl(result: TikTokScraperResult): string | null {
  // Apify KV Store URL이 가장 안정적 (shouldDownloadCovers=true 시)
  if (result.videoMeta?.coverUrl) return result.videoMeta.coverUrl;
  // 그 다음 originalCoverUrl (만료될 수 있지만 직접 접근 가능)
  if (result.videoMeta?.originalCoverUrl) return result.videoMeta.originalCoverUrl;
  if (result.mediaUrls && result.mediaUrls.length > 0) return result.mediaUrls[0];
  if (result.coverUrl) return result.coverUrl;
  return null;
}

function getApifyToken(): string {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN 환경변수가 없습니다.");
  return token;
}

const TT_RESERVED = /^(?:foryou|following|live|search|music|tag|explore|upload|login|signup|about|discover|video|photo)$/i;
/** TikTok unique id — 표시명(일본어 등)이 아니라 @username */
const TT_USERNAME = /^[a-zA-Z0-9._]{2,24}$/;

/** tiktok.com/@handle/… → handle (video·photo 하위 경로 무시) */
export function tiktokHandleFromUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (!host.endsWith("tiktok.com")) return null;
    const m = u.pathname.match(/^\/@([^/?#]+)/);
    if (!m) return null;
    const h = decodeURIComponent(m[1]).replace(/^@+/, "").trim();
    if (!h || TT_RESERVED.test(h) || !TT_USERNAME.test(h)) return null;
    return h;
  } catch {
    return null;
  }
}

/** URL·@handle·username → Apify profiles용 username. 표시명이면 null */
export function normalizeTikTokUsername(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return tiktokHandleFromUrl(raw);
  const h = raw.replace(/^@+/, "").trim();
  if (!TT_USERNAME.test(h)) return null;
  return h;
}

/**
 * Apify Actor를 동기 실행(run-sync-get-dataset-items)해서 결과를 바로 반환.
 * 최대 ~60 s 소요. after() 안에서 호출하도록 설계됨.
 */
export async function scrapeTikTokPosts(
  postURLs: string[],
  memoryMbytes = 512,
): Promise<TikTokScraperResult[]> {
  const token = getApifyToken();

  const res = await fetch(
    `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}&memoryMbytes=${memoryMbytes}&timeout=120`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postURLs, shouldDownloadCovers: true }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(await apifyErrorMessage(res.status, text));
  }

  const items = (await res.json()) as TikTokScraperResult[];
  return items;
}

/** @handle·username·프로필 URL → 아바타 URL + 팔로워 */
export async function scrapeTikTokProfile(
  handle: string,
  memoryMbytes = 1024,
): Promise<{ imageUrl: string | null; followers: number | null }> {
  const token = getApifyToken();
  const username = normalizeTikTokUsername(handle);
  if (!username) {
    throw new Error(
      `유효한 TikTok 핸들이 아닙니다: "${handle}". https://www.tiktok.com/@username 형태가 필요합니다.`,
    );
  }

  const res = await fetch(
    `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}&memoryMbytes=${memoryMbytes}&timeout=180`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profiles: [username],
        resultsPerPage: 1,
        shouldDownloadCovers: false,
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(await apifyErrorMessage(res.status, text));
  }

  const items = (await res.json()) as TikTokScraperResult[];
  const item = items[0];
  if (!item) return { imageUrl: null, followers: null };
  const fans = item.authorMeta?.fans ?? item.authorMeta?.followers;
  const followers =
    typeof fans === "number" && Number.isFinite(fans) && fans >= 0
      ? Math.round(fans)
      : null;
  return {
    imageUrl:
      item.originalAvatarUrl ||
      item.avatar ||
      item.authorMeta?.originalAvatarUrl ||
      item.authorMeta?.avatar ||
      null,
    followers,
  };
}

/** postURL 1개에 대응하는 결과를 찾아 반환. */
export function findResultForUrl(
  items: TikTokScraperResult[],
  url: string,
): TikTokScraperResult | undefined {
  const normalise = (u: string) => u.replace(/[/?#].*$/, "").toLowerCase();
  const target = normalise(url);
  return items.find((item) => {
    const candidate = normalise(item.webVideoUrl ?? "");
    return (
      candidate === target ||
      (item.id && url.includes(item.id))
    );
  });
}
