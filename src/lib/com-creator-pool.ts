import { extractSnsHandle, resolveCreatorPlatform } from "@/lib/creator-link";
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

/** CSV·배정으로 들어온 인플루언서 → 크리에이터 풀 카드용 */
export function poolCreatorFromInfluencer(
  inf: InfRow,
  opts?: { productName?: string | null; visitYmd?: string | null },
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
    posts: [],
    uploadYmd: null,
    visitYmd: opts?.visitYmd ?? null,
    metrics: {
      views: null,
      likes: null,
      comments: null,
      saves: null,
      shares: null,
    },
    category: null,
  };
}
