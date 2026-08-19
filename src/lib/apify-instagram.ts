const ACTOR_ID = "shu8hvrXbJbY3Eb9W";
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
  videoViewCount?: number;
  videoPlayCount?: number;
  viewCount?: number;
  playCount?: number;
}

function getApifyToken(): string {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN 환경변수가 없습니다.");
  return token;
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
  memoryMbytes = 512,
): Promise<InstagramScraperResult[]> {
  const token = getApifyToken();
  const resultsType = getInstagramResultsType(postUrls[0] || "");
  const res = await fetch(
    `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}&memoryMbytes=${memoryMbytes}&timeout=120`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resultsType,
        directUrls: postUrls,
        resultsLimit: postUrls.length,
        addParentData: false,
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify error ${res.status}: ${text.slice(0, 200)}`);
  }

  return (await res.json()) as InstagramScraperResult[];
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
