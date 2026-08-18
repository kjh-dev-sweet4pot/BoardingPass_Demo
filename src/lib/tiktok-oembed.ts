/** TikTok 공식 oEmbed — 썸네일·메타 (조회/좋아요/댓글 없음). */

const OEMBED = "https://www.tiktok.com/oembed";
const FETCH_TIMEOUT_MS = 15000;
const MAX_THUMB_BYTES = 5 * 1024 * 1024;

export type TikTokOEmbed = {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
};

export function parseTikTokVideoId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (!host.includes("tiktok.com")) return null;

    const videoMatch = u.pathname.match(/\/video\/(\d+)/);
    if (videoMatch) return videoMatch[1];

    const photoMatch = u.pathname.match(/\/photo\/(\d+)/);
    if (photoMatch) return photoMatch[1];

    return null;
  } catch {
    return null;
  }
}

export function isTikTokUrl(url: string) {
  try {
    const host = new URL(url.trim()).hostname.replace(/^www\./, "").toLowerCase();
    return host === "tiktok.com" || host === "vm.tiktok.com" || host === "vt.tiktok.com";
  } catch {
    return false;
  }
}

export async function fetchTikTokOEmbed(pageUrl: string): Promise<TikTokOEmbed> {
  const endpoint = `${OEMBED}?url=${encodeURIComponent(pageUrl.trim())}`;
  const res = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "User-Agent": "BoardingPass/1.0 (+https://boardingpass)",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`TikTok oEmbed ${res.status}`);
  }
  return (await res.json()) as TikTokOEmbed;
}

export async function downloadThumbnailBytes(thumbnailUrl: string) {
  const res = await fetch(thumbnailUrl, {
    headers: { "User-Agent": "BoardingPass/1.0" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`thumbnail download ${res.status}`);
  }
  const mime =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  if (!mime.startsWith("image/")) {
    throw new Error(`unexpected content-type ${mime}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0) throw new Error("empty thumbnail");
  if (bytes.length > MAX_THUMB_BYTES) {
    throw new Error(`thumbnail too large (${bytes.length} bytes)`);
  }
  return { bytes, mime };
}

/** ponytail: self-check — parse only, 네트워크 없음 */
export function assertTikTokParse() {
  const id = parseTikTokVideoId(
    "https://www.tiktok.com/@scout2015/video/6718335390845095173",
  );
  if (id !== "6718335390845095173") {
    throw new Error(`tiktok parse failed: ${id}`);
  }
}

if (process.env.RUN_TIKTOK_SELF_CHECK === "1") {
  assertTikTokParse();
  console.log("tiktok-oembed self-check ok");
}
