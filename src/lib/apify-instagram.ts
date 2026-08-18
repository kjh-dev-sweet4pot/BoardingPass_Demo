const ACTOR_ID = "apify/instagram-scraper";
const APIFY_BASE = "https://api.apify.com/v2";

export interface InstagramScraperResult {
  id: string;
  inputUrl?: string;
  url?: string;
  type?: string;
  displayUrl?: string;
  images?: string[];
  likesCount?: number;
  commentsCount?: number;
  ownerFullName?: string;
  ownerUsername?: string;
  videoViewCount?: number;
  videoPlayCount?: number;
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
    return path.includes("/reel/") || path.includes("/reels/") ? "reels" : "posts";
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
  return items.find((item) => {
    const candidate = normalizeInstagramUrl(item.url || item.inputUrl || "");
    return candidate === target || Boolean(item.id && target.includes(item.id));
  });
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
  return result.videoViewCount ?? result.videoPlayCount ?? null;
}
