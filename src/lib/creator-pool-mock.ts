/** 브랜드사 마케팅 풀 — JP 시딩 실데이터 (주소·전화 제외). */

import { formatMd } from "@/lib/types";
import jpPool from "./data/jp-creator-pool.json";
import avatarManifest from "./data/jp-creator-avatar-manifest.json";

export { formatMd };

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
  const rows = (jpPool as PoolCreator[]).map(ensureProfile);
  const has = avatarManifest as Record<string, string>;
  // 실사진 있는 인원을 앞에 (미팅 스크롤 첫 화면)
  return rows.sort((a, b) => Number(!!has[b.id]) - Number(!!has[a.id]));
}

let poolById: Map<string, PoolCreator> | null = null;
let poolByHandle: Map<string, PoolCreator> | null = null;

function normalizeHandle(raw: string) {
  return raw.replace(/^@+/, "").trim().toLowerCase();
}

function ensurePoolIndexes() {
  if (!poolById) {
    poolById = new Map(buildCreatorPool().map((c) => [c.id, c]));
  }
  if (!poolByHandle) {
    poolByHandle = new Map();
    for (const c of poolById.values()) {
      poolByHandle.set(normalizeHandle(c.handle), c);
      if (c.profileUrl) {
        const h = extractHandleFromUrl(c.profileUrl, c.channel);
        if (h) poolByHandle.set(h.toLowerCase(), c);
      }
    }
  }
}

export function getPoolCreator(id: string): PoolCreator | undefined {
  ensurePoolIndexes();
  return poolById!.get(id);
}

/** DB UUID 등 id 불일치 시 핸들·이름으로 JP 풀 크리에이터 매칭 */
export function findPoolCreator(opts: {
  id?: string | null;
  handle?: string | null;
  name?: string | null;
}): PoolCreator | undefined {
  ensurePoolIndexes();
  if (opts.id) {
    const byId = poolById!.get(opts.id);
    if (byId) return byId;
  }
  const handle = normalizeHandle(opts.handle || "");
  if (handle && handle !== "—") {
    const byHandle = poolByHandle!.get(handle);
    if (byHandle) return byHandle;
  }
  const name = (opts.name || "").trim();
  if (name) {
    for (const c of poolById!.values()) {
      if (c.name === name) return c;
    }
  }
  return undefined;
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
  if (
    ["reels", "reel", "p", "stories", "status", "video", "photo"].includes(
      h.toLowerCase(),
    )
  ) {
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

/** 실제 SNS만: 1) 프로필 사진 2) 없으면 게시물 사진. 로컬 캐시 우선. */
export function creatorAvatarCandidates(creator: PoolCreator): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (url: string | null | undefined) => {
    const u = (url || "").trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };

  // manifest 여부와 무관하게 로컬 캐시 먼저 (public/creator-avatars)
  push(`/creator-avatars/${creator.id}.jpg`);

  const handle = bestHandle(creator);
  if (handle) {
    push(
      `https://unavatar.io/${avatarProvider(creator.channel)}/${encodeURIComponent(handle)}?fallback=false`,
    );
  }

  for (const post of creator.posts) {
    const igCode = post.url.match(
      /instagram\.com\/(?:reel|reels|p)\/([^\/\?#]+)/i,
    )?.[1];
    if (igCode) {
      push(`https://www.instagram.com/p/${igCode}/media/?size=l`);
    }
    // TikTok/X 등: 게시물 OG 이미지 (실제 SNS 미디어)
    push(
      `https://api.microlink.io/?url=${encodeURIComponent(post.url)}&embed=image.url`,
    );
  }

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
  visitWindow: string;
  contentWindow: string;
  mode: "visit" | "seeding";
};

export const CREATOR_VISIT_WINDOW = "신청 후 10일 내";
export const CREATOR_CONTENT_WINDOW = "수령 후 7일 내";
export const VISIT_CONTENT_GUIDE_URL =
  "https://slam-pick-three.vercel.app/";

export function getCreatorBrief(creator: PoolCreator): CreatorSchedule {
  const guide = GUIDE_BY_MARKET[creator.market];
  const formatsFromPosts = [
    ...new Set(
      creator.posts.map(
        (p) => POST_PLATFORM_LABEL[p.platform] || p.platform,
      ),
    ),
  ];
  return {
    formats:
      formatsFromPosts.length > 0
        ? formatsFromPosts
        : FORMATS_BY_CHANNEL[creator.channel],
    guideTitle: guide.title,
    guideBullets: guide.bullets,
    visitWindow: CREATOR_VISIT_WINDOW,
    contentWindow: CREATOR_CONTENT_WINDOW,
    mode: "seeding",
  };
}
