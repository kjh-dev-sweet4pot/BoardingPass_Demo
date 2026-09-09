import { extractSnsHandle, resolveCreatorPlatform } from "@/lib/creator-link";
import { estimateXiaohongshuViews } from "@/lib/xiaohongshu-views";
import type { CreatorChannel, CreatorMarket, PoolCreator } from "@/lib/creator-pool-mock";

type InfRow = {
  id: string;
  name: string | null;
  instagram_handle?: string | null;
  instagram_handle_normalized?: string | null;
  sns_url?: string | null;
  followers?: number | null;
  region?: string | null;
};

export type ProfileAvgMetrics = {
  views: number;
  likes: number;
  comments: number | null;
  saves: number | null;
  count: number;
  viewsEstimated?: boolean;
  posts?: { platform: string; url: string }[];
};

export type PoolLinkRow = {
  url?: string | null;
  publish_url?: string | null;
  platform?: string | null;
  status?: string | null;
  content_status?: string | null;
  submitted_at?: string | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  saves?: number | null;
};

function bareHandle(raw: string) {
  return raw.replace(/^@+/, "").trim().toLowerCase();
}

function channelFromUrl(url: string | null | undefined): CreatorChannel {
  const u = (url || "").toLowerCase();
  if (u.includes("douyin")) return "douyin";
  if (/(^|\/\/)(x|twitter)\.com\//.test(u)) return "x";
  const p = resolveCreatorPlatform(url);
  if (p === "tiktok") return "tiktok";
  if (p === "xiaohongshu") return "xiaohongshu";
  if (p === "youtube") return "youtube";
  if (p === "instagram") return "instagram";
  return "instagram";
}

function marketDefault(): CreatorMarket {
  return "jp";
}

function tierFromFollowers(n: number): PoolCreator["tier"] {
  return n > 100000 ? "middle" : "micro";
}

function num(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function isPublishedLink(l: PoolLinkRow) {
  if (l.content_status === "발행완료") return true;
  if (l.content_status) return false;
  return l.status === "approved";
}

export function averageRecentPosts(links: PoolLinkRow[], take = 3) {
  const ranked = links
    .filter((l) => isPublishedLink(l) && (l.url || l.publish_url))
    .map((l) => {
      const href = (l.publish_url || l.url || "").trim();
      const platform = resolveCreatorPlatform(href, l.platform);
      const likes = num(l.likes) ?? 0;
      const comments = num(l.comments) ?? 0;
      const saves = num(l.saves) ?? 0;
      const views =
        platform === "xiaohongshu"
          ? estimateXiaohongshuViews({
              views: num(l.views),
              likes,
              comments,
              saves,
            })
          : num(l.views) ?? 0;
      return {
        href,
        platform,
        at: (l.submitted_at || "").slice(0, 19),
        views,
        likes,
        comments,
        saves,
        estimated: platform === "xiaohongshu",
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, take);

  const mean = (pick: (p: (typeof ranked)[number]) => number) => {
    if (!ranked.length) return null;
    return Math.round(ranked.reduce((s, p) => s + pick(p), 0) / ranked.length);
  };

  return {
    count: ranked.length,
    views: mean((p) => p.views),
    likes: mean((p) => p.likes),
    comments: mean((p) => p.comments),
    saves: mean((p) => p.saves),
    viewsEstimated: ranked.some((p) => p.estimated),
    posts: ranked.map((p) => ({ platform: p.platform, url: p.href })),
  };
}

/** CSV·배정으로 들어온 인플루언서 → 크리에이터 풀 카드용 */
export function poolCreatorFromInfluencer(
  inf: InfRow,
  opts?: {
    productName?: string | null;
    visitYmd?: string | null;
    links?: PoolLinkRow[];
    profileAvg?: ProfileAvgMetrics | null;
  },
): PoolCreator {
  const sns =
    (inf.sns_url || "").trim() ||
    (/^https?:\/\//i.test(inf.instagram_handle || "")
      ? (inf.instagram_handle || "").trim()
      : "") ||
    (/^https?:\/\//i.test(inf.instagram_handle_normalized || "")
      ? (inf.instagram_handle_normalized || "").trim()
      : "");
  const handle =
    extractSnsHandle(inf.instagram_handle_normalized) ||
    extractSnsHandle(inf.instagram_handle) ||
    extractSnsHandle(sns) ||
    bareHandle(inf.id);
  const followers = Number(inf.followers) || 0;
  const channel = channelFromUrl(sns);
  const campaign = averageRecentPosts(opts?.links || []);
  const fromProfile = campaign.count === 0 ? opts?.profileAvg : null;
  const avg = fromProfile
    ? {
        count: fromProfile.count,
        views: fromProfile.views,
        likes: fromProfile.likes,
        comments: fromProfile.comments,
        saves: fromProfile.saves,
        viewsEstimated: Boolean(fromProfile.viewsEstimated),
        posts: fromProfile.posts || [],
      }
    : campaign;
  return {
    id: inf.id,
    name: (inf.name || "").trim() || handle,
    handle: handle ? `@${handle}` : "@",
    market: marketDefault(),
    region: inf.region ?? null,
    channel,
    profileUrl: sns || null,
    priceKrw: 0,
    followers,
    overlap: null,
    tier: tierFromFollowers(followers),
    product: opts?.productName ?? null,
    posts: avg.posts,
    uploadYmd: null,
    visitYmd: opts?.visitYmd ?? null,
    metrics: {
      views: avg.views,
      likes: avg.likes,
      comments: avg.comments,
      saves: avg.saves,
      shares: null,
    },
    avgPostCount: avg.count,
    avgFromProfile: Boolean(fromProfile),
    viewsEstimated: avg.viewsEstimated,
    category: null,
  };
}

if (process.env.RUN_COM_CREATOR_POOL_SELF_CHECK === "1") {
  const avg = averageRecentPosts(
    [
      { url: "https://x.com/a", submitted_at: "2026-09-01", views: 100, likes: 10, comments: 1, status: "approved", content_status: "발행완료" },
      { url: "https://x.com/b", submitted_at: "2026-09-03", views: 300, likes: 30, comments: 3, status: "approved", content_status: "발행완료" },
      { url: "https://x.com/c", submitted_at: "2026-09-02", views: 200, likes: 20, comments: 2, status: "approved", content_status: "발행완료" },
      { url: "https://x.com/d", submitted_at: "2026-08-01", views: 9, likes: 9, comments: 9, status: "approved", content_status: "발행완료" },
    ],
    3,
  );
  if (avg.count !== 3 || avg.views !== 200 || avg.likes !== 20) {
    throw new Error(`averageRecentPosts ${JSON.stringify(avg)}`);
  }
  const fallback = poolCreatorFromInfluencer(
    { id: "x", name: "x", sns_url: "https://www.xiaohongshu.com/user/profile/abc" },
    {
      profileAvg: {
        views: 9000,
        likes: 120,
        comments: 3,
        saves: 10,
        count: 3,
        viewsEstimated: true,
      },
    },
  );
  if (
    fallback.metrics.views !== 9000 ||
    fallback.metrics.likes !== 120 ||
    !fallback.avgFromProfile
  ) {
    throw new Error("profileAvg fallback failed");
  }
  console.log("com-creator-pool self-check ok");
}

