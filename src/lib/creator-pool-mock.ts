/** 브랜드사 마케팅 풀 데모용 목업. DB 연동 전까지 로컬 생성. */

export type CreatorMarket = "cn" | "us" | "jp" | "kr";
export type CreatorChannel =
  | "xiaohongshu"
  | "douyin"
  | "instagram"
  | "tiktok"
  | "youtube";

export type PoolCreator = {
  id: string;
  name: string;
  handle: string;
  market: CreatorMarket;
  channel: CreatorChannel;
  /** 집행 단가 (원) */
  priceKrw: number;
  followers: number;
};

export const MARKET_LABEL: Record<CreatorMarket, string> = {
  cn: "중국",
  us: "미국/영어권",
  jp: "일본",
  kr: "한국",
};

export const CHANNEL_LABEL: Record<CreatorChannel, string> = {
  xiaohongshu: "샤오홍슈",
  douyin: "더우인",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const MARKETS: CreatorMarket[] = ["cn", "cn", "cn", "us", "us", "jp", "kr"];
const CHANNELS_BY_MARKET: Record<CreatorMarket, CreatorChannel[]> = {
  cn: ["xiaohongshu", "douyin", "tiktok"],
  us: ["instagram", "tiktok", "youtube"],
  jp: ["instagram", "tiktok", "youtube"],
  kr: ["instagram", "tiktok", "youtube"],
};

const FIRST = [
  "Amy",
  "Lina",
  "Maya",
  "Sora",
  "Yuki",
  "Nina",
  "Chloe",
  "Jia",
  "Hana",
  "Elena",
  "Mina",
  "Rina",
  "Zoe",
  "Ava",
  "Mei",
];
const LAST = [
  "Chen",
  "Wang",
  "Kim",
  "Park",
  "Lee",
  "Sato",
  "Tanaka",
  "Nguyen",
  "Garcia",
  "Brown",
  "Lopez",
  "Zhang",
  "Choi",
  "Suzuki",
  "Miller",
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

function priceFor(market: CreatorMarket, channel: CreatorChannel, seed: string) {
  const base =
    market === "cn"
      ? 180_000
      : market === "us"
        ? 420_000
        : market === "jp"
          ? 280_000
          : 220_000;
  const channelBoost =
    channel === "youtube" ? 1.6 : channel === "douyin" ? 1.35 : 1;
  const jitter = 0.7 + (hash32(`${seed}:p`) % 80) / 100;
  return Math.round((base * channelBoost * jitter) / 10_000) * 10_000;
}

/** ponytail: 고정 320명. 실데이터 붙이면 API 페이징으로 교체. */
export const POOL_SIZE = 320;
export const POOL_PAGE = 40;

export function buildCreatorPool(count = POOL_SIZE): PoolCreator[] {
  const rows: PoolCreator[] = [];
  for (let i = 0; i < count; i += 1) {
    const seed = `pool:${i}`;
    const market = pick(`${seed}:m`, MARKETS);
    const channel = pick(`${seed}:c`, CHANNELS_BY_MARKET[market]);
    const first = pick(`${seed}:f`, FIRST);
    const last = pick(`${seed}:l`, LAST);
    const name = `${first} ${last}`;
    const handle = `@${first.toLowerCase()}_${last.toLowerCase()}${i % 97}`;
    rows.push({
      id: `cr-${String(i + 1).padStart(3, "0")}`,
      name,
      handle,
      market,
      channel,
      priceKrw: priceFor(market, channel, seed),
      followers: 8_000 + (hash32(`${seed}:fl`) % 920_000),
    });
  }
  return rows;
}

export function formatKrw(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n);
}

export function formatFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

const FORMATS_BY_CHANNEL: Record<CreatorChannel, string[]> = {
  xiaohongshu: ["노트 캐러셀", "숏클립", "방문 후기"],
  douyin: ["숏폼", "라이브 클립", "시딩 언박싱"],
  instagram: ["릴스", "캐러셀", "스토리"],
  tiktok: ["숏폼", "시딩 리뷰", "방문 브이로그"],
  youtube: ["숏츠", "리뷰 본편", "방문 브이로그"],
};

const GUIDE_BY_MARKET: Record<
  CreatorMarket,
  { title: string; bullets: string[] }
> = {
  cn: {
    title: "중국 가이드 샘플",
    bullets: [
      "제품명·성분 과장 없이 표기, 의료 효능 표현 금지",
      "샤오홍슈/더우인: 첫 3초 훅 + 매장/시딩 장면 포함",
      "해시태그 3~5개, 브랜드 공식 멘션 1회",
      "중국어 자막 필수 · 한국어/영어 병기 권장",
    ],
  },
  us: {
    title: "미국/영어권 가이드 샘플",
    bullets: [
      "FTC: #ad / paid partnership 명시",
      "Before–after 과장·의료 클레임 금지",
      "릴스/틱톡 15~30초, CTA는 프로필 링크",
      "영어 내레이션 또는 명확한 영문 자막",
    ],
  },
  jp: {
    title: "일본 가이드 샘플",
    bullets: [
      "景表法에 맞는 표현, 효과 단정 금지",
      "긴자 방문·수령 장면을 자연스럽게 포함",
      "일본어 자막 또는 내레이션",
    ],
  },
  kr: {
    title: "한국 가이드 샘플",
    bullets: [
      "표시광고법: 경제적 이해관계 고지",
      "방문/시딩 인증 컷 1장 이상",
      "브랜드 지정 해시태그 사용",
    ],
  },
};

export type CreatorSchedule = {
  formats: string[];
  guideTitle: string;
  guideBullets: string[];
  /** 방문 또는 시딩 예정일 YYYY-MM-DD */
  visitYmd: string;
  /** 콘텐츠 마감일 YYYY-MM-DD */
  dueYmd: string;
  mode: "visit" | "seeding";
};

function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function todayYmdKst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formatMd(ymd: string) {
  const [, m, d] = ymd.split("-").map(Number);
  if (!m || !d) return ymd;
  return `${m}월 ${d}일`;
}

/** 크리에이터별 집행 포맷·국가 가이드·방문/제작 일정 (데모 목업). */
export function getCreatorBrief(creator: PoolCreator): CreatorSchedule {
  const guide = GUIDE_BY_MARKET[creator.market];
  const today = todayYmdKst();
  const visitOffset = 3 + (hash32(`${creator.id}:v`) % 18);
  const dueOffset = 7 + (hash32(`${creator.id}:d`) % 10);
  const visitYmd = addDaysYmd(today, visitOffset);
  const mode: "visit" | "seeding" =
    hash32(`${creator.id}:mode`) % 3 === 0 ? "seeding" : "visit";
  return {
    formats: FORMATS_BY_CHANNEL[creator.channel],
    guideTitle: guide.title,
    guideBullets: guide.bullets,
    visitYmd,
    dueYmd: addDaysYmd(visitYmd, dueOffset),
    mode,
  };
}
