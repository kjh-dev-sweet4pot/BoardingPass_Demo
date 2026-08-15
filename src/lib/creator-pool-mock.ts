/** 브랜드사 마케팅 풀 — JP 시딩 실데이터 (주소·전화 제외). */

import jpPool from "./data/jp-creator-pool.json";

export type CreatorMarket = "cn" | "us" | "jp" | "kr";
export type CreatorChannel =
  | "xiaohongshu"
  | "douyin"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x";

export type CreatorPost = {
  platform: string;
  url: string;
};

export type PoolCreator = {
  id: string;
  name: string;
  handle: string;
  market: CreatorMarket;
  channel: CreatorChannel;
  profileUrl: string | null;
  /** 집행 단가 (원) — 팔로워 구간 추정 */
  priceKrw: number;
  followers: number;
  overlap: null | "channel" | "distributor";
  tier: "middle" | "micro";
  product: string | null;
  posts: CreatorPost[];
  uploadYmd: string | null;
  metrics: {
    views: number | null;
    likes: number | null;
    comments: number | null;
    saves: number | null;
    shares: number | null;
  };
  category: string | null;
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
  x: "X",
};

export const OVERLAP_LABEL: Record<"channel" | "distributor", string> = {
  channel: "타채널 중복",
  distributor: "총판 중복",
};

export const TIER_LABEL: Record<PoolCreator["tier"], string> = {
  middle: "미들",
  micro: "마이크로",
};

export const POST_PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  lips: "LIPS",
  youtube: "YouTube",
};

/** ponytail: 엑셀 임포트 실인원. 갱신 시 scripts/import-jp-creator-pool.mjs */
export const POOL_SIZE = (jpPool as PoolCreator[]).length;
export const POOL_PAGE = 40;

function bareHandle(handle: string) {
  return handle.replace(/^@+/, "").trim();
}

function profileUrlFor(channel: CreatorChannel, handle: string) {
  const h = bareHandle(handle);
  if (!h) return null;
  if (channel === "tiktok") return `https://www.tiktok.com/@${h}`;
  if (channel === "x") return `https://x.com/${h}`;
  return `https://www.instagram.com/${h}/`;
}

function ensureProfile(c: PoolCreator): PoolCreator {
  if (c.profileUrl) return c;
  return { ...c, profileUrl: profileUrlFor(c.channel, c.handle) };
}

export function buildCreatorPool(): PoolCreator[] {
  return (jpPool as PoolCreator[]).map(ensureProfile);
}

/** 전원 프로필 이미지가 보이도록: SNS 아바타 → 실패 시 시드 얼굴 사진. */
export function creatorFaceFallback(creator: PoolCreator) {
  // ponytail: 미팅용 보장 이미지. SNS 아바타 실패해도 항상 얼굴이 나옴.
  return `https://i.pravatar.cc/400?u=${encodeURIComponent(creator.id)}`;
}

function extractHandleFromUrl(url: string, channel: string) {
  const u = url.trim();
  if (!u) return "";
  const m =
    channel === "tiktok"
      ? u.match(/tiktok\.com\/@([^\/\?#]+)/i)
      : channel === "x" || channel === "twitter"
        ? u.match(/(?:x|twitter)\.com\/([^\/\?#]+)/i)
        : u.match(/instagram\.com\/([^\/\?#]+)/i);
  if (!m) return "";
  const h = decodeURIComponent(m[1]).replace(/^@/, "");
  if (["reels", "reel", "p", "stories", "status", "video", "photo"].includes(h.toLowerCase())) {
    return "";
  }
  return h;
}

function bestHandle(creator: PoolCreator) {
  const fromProfile = creator.profileUrl
    ? extractHandleFromUrl(creator.profileUrl, creator.channel)
    : "";
  if (fromProfile && /^[\w.]+$/.test(fromProfile)) return fromProfile;
  const fromField = bareHandle(creator.handle);
  if (fromField && /^[\w.]+$/.test(fromField)) return fromField;
  for (const post of creator.posts) {
    const h = extractHandleFromUrl(post.url, post.platform);
    if (h && /^[\w.]+$/.test(h)) return h;
  }
  return "";
}

function avatarProvider(channel: string) {
  if (channel === "tiktok") return "tiktok";
  if (channel === "x" || channel === "twitter") return "twitter";
  if (channel === "youtube") return "youtube";
  return "instagram";
}

/** 프로필 사진 후보. 마지막은 항상 로드되는 얼굴 사진. */
export function creatorAvatarCandidates(creator: PoolCreator): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (url: string | null | undefined) => {
    const u = (url || "").trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };

  const face = creatorFaceFallback(creator);
  const handle = bestHandle(creator);

  if (handle) {
    // 한 요청으로 SNS 프로필 → 실패 시 얼굴 사진 보장
    push(
      `https://unavatar.io/${avatarProvider(creator.channel)}/${encodeURIComponent(handle)}?fallback=${encodeURIComponent(face)}`,
    );
  }

  // 핸들 없거나 unavatar 장애여도 전원 얼굴 사진
  push(face);
  push(
    `https://api.dicebear.com/9.x/notionists/png?seed=${encodeURIComponent(creator.id)}&size=400`,
  );
  return out;
}

export function formatKrw(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n);
}

export function formatFollowers(n: number) {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function formatMetric(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

const FORMATS_BY_CHANNEL: Record<CreatorChannel, string[]> = {
  xiaohongshu: ["노트 캐러셀", "숏클립", "방문 후기"],
  douyin: ["숏폼", "라이브 클립", "시딩 언박싱"],
  instagram: ["릴스", "캐러셀", "스토리"],
  tiktok: ["숏폼", "시딩 리뷰", "방문 브이로그"],
  youtube: ["숏츠", "리뷰 본편", "방문 브이로그"],
  x: ["포스트", "시딩 인증", "후기 스레드"],
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
      "시딩 수령·사용 장면을 자연스럽게 포함",
      "일본어 자막 또는 내레이션",
      "지정 제품명·해시태그 고지",
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
  visitYmd: string;
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

function hash32(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 실업로드일이 있으면 그 기준으로, 없으면 데모 일정. */
export function getCreatorBrief(creator: PoolCreator): CreatorSchedule {
  const guide = GUIDE_BY_MARKET[creator.market];
  const formatsFromPosts = [
    ...new Set(
      creator.posts.map(
        (p) => POST_PLATFORM_LABEL[p.platform] || p.platform,
      ),
    ),
  ];
  if (creator.uploadYmd) {
    return {
      formats:
        formatsFromPosts.length > 0
          ? formatsFromPosts
          : FORMATS_BY_CHANNEL[creator.channel],
      guideTitle: guide.title,
      guideBullets: guide.bullets,
      visitYmd: addDaysYmd(creator.uploadYmd, -7),
      dueYmd: creator.uploadYmd,
      mode: "seeding",
    };
  }
  const today = todayYmdKst();
  const visitOffset = 3 + (hash32(`${creator.id}:v`) % 18);
  const dueOffset = 7 + (hash32(`${creator.id}:d`) % 10);
  const visitYmd = addDaysYmd(today, visitOffset);
  return {
    formats: FORMATS_BY_CHANNEL[creator.channel],
    guideTitle: guide.title,
    guideBullets: guide.bullets,
    visitYmd,
    dueYmd: addDaysYmd(visitYmd, dueOffset),
    mode: "seeding",
  };
}
