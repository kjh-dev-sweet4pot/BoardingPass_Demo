import { NextResponse } from "next/server";
import { detectPlatform, validateCreatorUrl } from "@/lib/creator-link";
import {
  extractInstagramProfileName,
  extractInstagramThumbnailUrl,
  findInstagramResultForUrl,
  scrapeInstagramPosts,
} from "@/lib/apify-instagram";
import { findResultForUrl, scrapeTikTokPosts, extractThumbnailUrl } from "@/lib/apify-tiktok";
import { fetchTikTokOEmbed } from "@/lib/tiktok-oembed";
import { getInfluencerSessionId } from "@/lib/session";

export async function POST(request: Request) {
  const influencerId = await getInfluencerSessionId();
  if (!influencerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const url = String(body.url || "").trim();
  const urlError = validateCreatorUrl(url);
  if (urlError) {
    return NextResponse.json({ error: urlError }, { status: 400 });
  }

  const platform = detectPlatform(url);
  if (platform !== "tiktok" && platform !== "instagram") {
    return NextResponse.json({
      preview: {
        platform,
        profileName: null,
        thumbnailUrl: null,
        unsupported: true,
      },
    });
  }

  if (platform === "instagram") {
    try {
      const items = await scrapeInstagramPosts([url]).catch(
        () => [] as Awaited<ReturnType<typeof scrapeInstagramPosts>>,
      );
      const result = findInstagramResultForUrl(items, url);

      return NextResponse.json({
        preview: {
          platform,
          profileName: extractInstagramProfileName(result),
          thumbnailUrl: extractInstagramThumbnailUrl(result),
          unsupported: false,
        },
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "미리보기 정보를 불러오지 못했습니다.",
        },
        { status: 500 },
      );
    }
  }

  try {
    // 썸네일: oEmbed (서버에서 직접 접근 가능)
    // metrics/프로필명: Apify (병렬 실행)
    const [oembed, items] = await Promise.all([
      fetchTikTokOEmbed(url).catch(() => null),
      scrapeTikTokPosts([url]).catch(() => [] as Awaited<ReturnType<typeof scrapeTikTokPosts>>),
    ]);

    const result = findResultForUrl(items, url);
    const profileName =
      result?.authorMeta?.name ||
      result?.authorMeta?.id ||
      oembed?.author_name ||
      null;

    // oEmbed thumbnail_url은 서버에서 직접 fetch 가능 → 프록시 경유
    const thumbnailUrl = oembed?.thumbnail_url || extractThumbnailUrl(result ?? ({} as typeof result & object)) || null;

    return NextResponse.json({
      preview: {
        platform,
        profileName,
        thumbnailUrl,
        unsupported: false,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "미리보기 정보를 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
