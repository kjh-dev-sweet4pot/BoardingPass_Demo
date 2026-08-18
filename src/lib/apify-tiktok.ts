/**
 * Apify TikTok Scraper (clockworks/tiktok-scraper, actor ID: GdWCkxBtKWOsKjdch)
 *
 * Input:  { postURLs: string[] }
 * Output: TikTokPost[]  (see type below)
 *
 * Docs: https://apify.com/clockworks/tiktok-scraper
 */

const ACTOR_ID = "GdWCkxBtKWOsKjdch";
const APIFY_BASE = "https://api.apify.com/v2";

export interface TikTokScraperResult {
  id: string;
  text: string;
  /** 최상위 coverUrl (서명된 CDN URL, 만료될 수 있음) */
  coverUrl?: string;
  /** shouldDownloadCovers=true 시 Apify KV Store에 저장된 안정적인 URL 배열 */
  mediaUrls?: string[];
  videoMeta?: {
    coverUrl?: string;
    originalCoverUrl?: string;
  };
  playCount: number;         // views
  diggCount: number;         // likes
  commentCount: number;
  shareCount: number;
  webVideoUrl: string;
  authorMeta?: { name: string; id: string };
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
    throw new Error(`Apify error ${res.status}: ${text.slice(0, 200)}`);
  }

  const items = (await res.json()) as TikTokScraperResult[];
  return items;
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
