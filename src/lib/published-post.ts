import { extractXiaohongshuNoteId } from "@/lib/apify-xiaohongshu";
import { parseTikTokVideoId } from "@/lib/tiktok-oembed";

/** 같은 게시물을 가리키는 URL이면 같은 키. 쿼리스트링은 무시한다. */
export function publishedPostKey(url: string | null | undefined): string | null {
  const raw = (url || "").trim();
  if (!raw) return null;
  const note = extractXiaohongshuNoteId(raw);
  if (note) return `xhs:${note}`;
  const video = parseTikTokVideoId(raw);
  if (video) return `tt:${video}`;
  const ig = raw.match(/\/(?:p|reel|reels|tv)\/([^/?#]+)/i)?.[1]?.toLowerCase();
  if (ig && ig.length >= 8 && /instagram\.com|instagr\.am/i.test(raw)) return `ig:${ig}`;
  return null;
}

export function publishedPostToken(url: string | null | undefined): string | null {
  const key = publishedPostKey(url);
  if (!key) return null;
  return key.slice(key.indexOf(":") + 1);
}

if (process.env.RUN_PUBLISHED_POST_SELF_CHECK === "1") {
  const a =
    "https://www.xiaohongshu.com/discovery/item/6aa27ff1000000002b026e69?source=webshare&xhsshare=CopyLink";
  const b = "https://www.xiaohongshu.com/discovery/item/6aa27ff1000000002b026e69";
  if (publishedPostKey(a) !== publishedPostKey(b) || publishedPostKey(a) !== "xhs:6aa27ff1000000002b026e69") {
    throw new Error("publishedPostKey xhs");
  }
  if (publishedPostKey("https://www.instagram.com/reel/AbC123defgH/") !== "ig:abc123defgh") {
    throw new Error("publishedPostKey ig");
  }
  if (publishedPostKey("https://www.tiktok.com/@x/video/7123456789012345678") !== "tt:7123456789012345678") {
    throw new Error("publishedPostKey tt");
  }
}
