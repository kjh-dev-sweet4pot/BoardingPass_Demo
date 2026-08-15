/** 브랜드별 발행 완료 콘텐츠 피드 목업 (데모 볼륨용). */

export type PublishKind = "carousel" | "visit" | "seeding";

export type PublishItem = {
  id: string;
  kind: PublishKind;
  title: string;
  creatorName: string;
  handle: string;
  url: string;
  platform: "instagram" | "tiktok" | "xiaohongshu" | "youtube";
  publishedYmd: string;
  productName: string;
};

export const PUBLISH_KIND_LABEL: Record<PublishKind, string> = {
  carousel: "캐러셀",
  visit: "방문",
  seeding: "시딩 리뷰",
};

export const PUBLISH_PLATFORM_LABEL: Record<PublishItem["platform"], string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  xiaohongshu: "샤오홍슈",
  youtube: "YouTube",
};

const KINDS: PublishKind[] = [
  "carousel",
  "carousel",
  "visit",
  "seeding",
  "seeding",
];
const PLATFORMS: PublishItem["platform"][] = [
  "instagram",
  "tiktok",
  "xiaohongshu",
  "youtube",
];
const PRODUCTS = [
  "앰플 세럼",
  "선크림 SPF50",
  "클렌징 폼",
  "아이크림",
  "토너 패드",
  "립밤",
];
const NAMES = [
  "Amy Chen",
  "Lina Wang",
  "Maya Kim",
  "Sora Park",
  "Yuki Sato",
  "Nina Lee",
  "Chloe Brown",
  "Jia Zhang",
  "Hana Choi",
  "Elena Miller",
];

function hash32(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(seed: string, arr: readonly T[]): T {
  return arr[hash32(seed) % arr.length];
}

function todayYmdKst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function formatPublishMd(ymd: string) {
  const [, m, d] = ymd.split("-").map(Number);
  if (!m || !d) return ymd;
  return `${m}월 ${d}일`;
}

/** ponytail: 고정 80건. 실데이터면 creator_links 조회로 교체. */
export const PUBLISH_FEED_SIZE = 80;

export function buildPublishFeed(count = PUBLISH_FEED_SIZE): PublishItem[] {
  const today = todayYmdKst();
  const rows: PublishItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const seed = `pub:${i}`;
    const kind = pick(`${seed}:k`, KINDS);
    const platform = pick(`${seed}:p`, PLATFORMS);
    const name = pick(`${seed}:n`, NAMES);
    const product = pick(`${seed}:pr`, PRODUCTS);
    const handle = `@${name.split(" ")[0].toLowerCase()}_pub${i % 61}`;
    const title =
      kind === "carousel"
        ? `${product} 사용컷 캐러셀`
        : kind === "visit"
          ? `매장 방문 · ${product}`
          : `${product} 시딩 후기`;
    const daysAgo = 1 + (hash32(`${seed}:d`) % 45);
    rows.push({
      id: `pub-${String(i + 1).padStart(3, "0")}`,
      kind,
      title,
      creatorName: name,
      handle,
      url: `https://example.com/p/${platform}/${i + 1}`,
      platform,
      publishedYmd: addDaysYmd(today, -daysAgo),
      productName: product,
    });
  }
  return rows.sort((a, b) => b.publishedYmd.localeCompare(a.publishedYmd));
}
