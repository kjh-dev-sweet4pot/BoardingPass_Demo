import type { CreatorChannel, CreatorMarket, PoolCreator } from "@/lib/creator-pool-mock";

type InfRow = {
  id: string;
  name: string | null;
  instagram_handle?: string | null;
  instagram_handle_normalized?: string | null;
  sns_url?: string | null;
  followers?: number | null;
};

function bareHandle(raw: string) {
  return raw.replace(/^@+/, "").trim().toLowerCase();
}

function channelFromUrl(url: string | null | undefined): CreatorChannel {
  const u = (url || "").toLowerCase();
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("xiaohongshu") || u.includes("xhslink")) return "xiaohongshu";
  if (u.includes("douyin")) return "douyin";
  if (/(^|\/\/)(x|twitter)\.com\//.test(u)) return "x";
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
  opts?: { productName?: string | null },
): PoolCreator {
  const handle =
    bareHandle(inf.instagram_handle_normalized || "") ||
    bareHandle(inf.instagram_handle || "") ||
    bareHandle(inf.id);
  const followers = Number(inf.followers) || 0;
  const channel = channelFromUrl(inf.sns_url);
  return {
    id: inf.id,
    name: (inf.name || "").trim() || handle,
    handle: handle ? `@${handle}` : "@",
    market: marketDefault(),
    channel,
    profileUrl: (inf.sns_url || "").trim() || null,
    priceKrw: 0,
    followers,
    overlap: null,
    tier: tierFromFollowers(followers),
    product: opts?.productName ?? null,
    posts: [],
    uploadYmd: null,
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
