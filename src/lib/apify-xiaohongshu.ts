/**
 * Xiaohongshu (RedNote) via Apify
 * - note metrics: atomus~xiaohongshu-scraper (note-detail)
 *   → scrapesage는 빈 결과 반환 문제로 atomus로 교체
 * - profile(팔로워): funny_ground/xiaohongshu-profile-scraper
 * 조회·좋아요·댓글·저장·공유. 리포스트는 소스 미제공 → null
 */
import { apifyErrorMessage } from "@/lib/apify-errors";
import { detectPlatform } from "@/lib/creator-link";
import { parsePostedAtIso } from "@/lib/metrics-schedule";
import { estimateXiaohongshuViews } from "@/lib/xiaohongshu-views";

const ACTOR_ID = "atomus~xiaohongshu-scraper";
const PROFILE_ACTOR_ID = "funny_ground~xiaohongshu-profile-scraper";
const APIFY_BASE = "https://api.apify.com/v2";
const NOTE_ID_RE = /[0-9a-f]{24}/i;

export type XiaohongshuScraperResult = {
  id: string | null;
  url: string;
  inputUrl?: string;
  views: number | null;
  likes: number;
  comments: number;
  saves: number | null;
  shares: number | null;
  coverUrl: string | null;
  authorHandle: string | null;
  postedAt: string | null;
};

function getApifyToken(): string {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN 환경변수가 없습니다.");
  return token;
}

export function isXiaohongshuUrl(url: string) {
  return detectPlatform(url) === "xiaohongshu";
}

/** explore / discovery/item / 24자리 note id */
export function extractXiaohongshuNoteId(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const path = u.pathname;
    const m =
      path.match(/\/(?:explore|discovery\/item|item)\/([0-9a-f]{24})/i) ||
      path.match(/\/([0-9a-f]{24})\/?$/i);
    if (m) return m[1]!.toLowerCase();
  } catch {
    if (NOTE_ID_RE.test(raw) && raw.replace(/[^0-9a-f]/gi, "").length === 24) {
      return raw.replace(/[^0-9a-f]/gi, "").toLowerCase();
    }
  }
  return null;
}

function asCount(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/,/g, "");
  if (!s) return null;
  const wan = s.match(/^([\d.]+)\s*만$/i) || s.match(/^([\d.]+)만$/);
  if (wan) {
    const n = Number(wan[1]);
    return Number.isFinite(n) ? Math.round(n * 10_000) : null;
  }
  const yi = s.match(/^([\d.]+)\s*万$/);
  if (yi) {
    const n = Number(yi[1]);
    return Number.isFinite(n) ? Math.round(n * 10_000) : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

function pickCount(...vals: unknown[]) {
  for (const v of vals) {
    const n = asCount(v);
    if (n != null) return n;
  }
  return null;
}

/** atomus 액터 응답 구조 */
type AtomicNote = {
  id?: string;
  url?: string;
  liked_count?: unknown;
  comments_count?: unknown;
  collected_count?: unknown;
  shared_count?: unknown;
  view_count?: unknown;
  cover?: string;
  user?: { red_id?: string; nickname?: string };
  timestamp?: number;
};

function mapAtomicNote(item: AtomicNote, inputUrl?: string): XiaohongshuScraperResult {
  const likes = pickCount(item.liked_count) ?? 0;
  const comments = pickCount(item.comments_count) ?? 0;
  const saves = pickCount(item.collected_count);
  const shares = pickCount(item.shared_count);
  const viewRaw = pickCount(item.view_count);
  const id = (item.id || "").toLowerCase() || null;
  return {
    id,
    url: item.url || inputUrl || "",
    inputUrl,
    views: viewRaw ?? estimateXiaohongshuViews({ views: null, likes, comments, saves, shares }),
    likes,
    comments,
    saves,
    shares,
    coverUrl: item.cover || null,
    authorHandle: item.user?.red_id || item.user?.nickname || null,
    postedAt: item.timestamp ? parsePostedAtIso(item.timestamp) : null,
  };
}

export async function scrapeXiaohongshuPosts(
  noteUrls: string[],
  memoryMbytes = 1024,
): Promise<XiaohongshuScraperResult[]> {
  const token = getApifyToken();
  const urls = noteUrls.map((u) => u.trim()).filter(Boolean);
  if (urls.length === 0) return [];

  const res = await fetch(
    `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}&memoryMbytes=${memoryMbytes}&timeout=180`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: urls.map((url) => ({ url })),
        resultsType: "posts",
        proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(await apifyErrorMessage(res.status, text));
  }

  const raw = (await res.json()) as AtomicNote[];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item.id || item.url)
    .map((item, i) => mapAtomicNote(item, urls[i]));
}

export function findXiaohongshuResultForUrl(
  items: XiaohongshuScraperResult[],
  url: string,
): XiaohongshuScraperResult | undefined {
  const noteId = extractXiaohongshuNoteId(url);
  if (noteId) {
    const hit = items.find((item) => item.id === noteId || item.url.toLowerCase().includes(noteId));
    if (hit) return hit;
  }
  const target = url.trim().toLowerCase();
  const exact = items.find(
    (item) =>
      item.inputUrl?.trim().toLowerCase() === target ||
      item.url.trim().toLowerCase() === target,
  );
  if (exact) return exact;
  if (items.length === 1) return items[0];
  return undefined;
}

export function extractXiaohongshuThumbnailUrl(
  result: XiaohongshuScraperResult,
): string | null {
  return result.coverUrl;
}

export function extractXiaohongshuUserId(url: string): string | null {
  try {
    const path = new URL(url.trim()).pathname;
    const m = path.match(/\/user\/profile\/([0-9a-f]{24})/i);
    return m?.[1]?.toLowerCase() || null;
  } catch {
    const raw = url.trim();
    return NOTE_ID_RE.test(raw) && raw.replace(/[^0-9a-f]/gi, "").length === 24
      ? raw.replace(/[^0-9a-f]/gi, "").toLowerCase()
      : null;
  }
}

export async function scrapeXiaohongshuProfile(
  profileUrlOrUserId: string,
  memoryMbytes = 512,
): Promise<{
  imageUrl: string | null;
  followers: number | null;
  region: string | null;
}> {
  const token = getApifyToken();
  const target = profileUrlOrUserId.trim();
  if (!target) throw new Error("샤오홍슈 프로필 URL이 없습니다.");

  const res = await fetch(
    `${APIFY_BASE}/acts/${PROFILE_ACTOR_ID}/run-sync-get-dataset-items?token=${token}&memoryMbytes=${memoryMbytes}&timeout=180`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileUrls: [target] }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(await apifyErrorMessage(res.status, text));
  }
  const items = (await res.json()) as Array<{
    success?: boolean;
    avatarUrl?: string;
    // 공개 표시가 "1.7만"처럼 축약이면 이 숫자는 하한값(예: 17000)이다. followersIsExact로 정확도 구분.
    followersLowerBound?: number;
    ipLocation?: string;
  }>;
  const item = items[0];
  if (!item?.success) return { imageUrl: null, followers: null, region: null };
  return {
    imageUrl: item.avatarUrl && /^https?:\/\//i.test(item.avatarUrl) ? item.avatarUrl : null,
    followers:
      typeof item.followersLowerBound === "number" && Number.isFinite(item.followersLowerBound)
        ? Math.round(item.followersLowerBound)
        : null,
    region: item.ipLocation || null,
  };
}

type XhsProfilePost = {
  url?: string;
  timestamp?: number;
  liked_count?: unknown;
  comments_count?: unknown;
  collected_count?: unknown;
  shared_count?: unknown;
  view_count?: unknown;
};

export async function scrapeXiaohongshuRecentNotes(
  profileUrl: string,
  take = 3,
): Promise<
  {
    url: string;
    views: number;
    likes: number;
    comments: number;
    saves: number;
    viewsEstimated: boolean;
  }[]
> {
  const token = getApifyToken();
  const target = profileUrl.trim();
  if (!target) throw new Error("샤오홍슈 프로필 URL이 없습니다.");
  const res = await fetch(
    `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}&memoryMbytes=512&timeout=180`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchType: "profile",
        userUrls: [target],
        includePosts: true,
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(await apifyErrorMessage(res.status, text));
  }
  const items = (await res.json()) as Array<{ posts?: XhsProfilePost[] }>;
  const posts = [...(items[0]?.posts || [])].sort(
    (a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0),
  );
  // 피드 상단 고정글 회피: 최신 3건 건너뛰고 그다음 3건
  return posts.slice(3, 3 + take).map((p) => {
    const likes = pickCount(p.liked_count) ?? 0;
    const comments = pickCount(p.comments_count) ?? 0;
    const saves = pickCount(p.collected_count);
    const shares = pickCount(p.shared_count);
    const measured = pickCount(p.view_count);
    const views = estimateXiaohongshuViews({
      views: measured,
      likes,
      comments,
      saves,
      shares,
    });
    return {
      url: typeof p.url === "string" ? p.url : "",
      views,
      likes,
      comments,
      saves: saves ?? 0,
      viewsEstimated: !(measured != null && measured > 0 && views === measured),
    };
  });
}

if (process.env.RUN_XHS_SELF_CHECK === "1") {
  const id = extractXiaohongshuNoteId(
    "https://www.xiaohongshu.com/discovery/item/6a431f47000000001503e1af?source=webshare",
  );
  if (id !== "6a431f47000000001503e1af") {
    throw new Error(`extractXiaohongshuNoteId failed: ${id}`);
  }
  if (!isXiaohongshuUrl("http://xhslink.com/o/1PMSLXJ4uOK")) {
    throw new Error("isXiaohongshuUrl xhslink failed");
  }
  console.log("apify-xiaohongshu self-check ok");
}
