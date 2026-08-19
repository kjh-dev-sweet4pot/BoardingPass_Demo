import { NextResponse } from "next/server";
import { getInfluencerSessionId } from "@/lib/session";

const APIFY_KV_HOST = "api.apify.com";

function resolveReferer(hostname: string) {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  if (host.includes("tiktokcdn") || host.includes("tiktok.com")) {
    return "https://www.tiktok.com/";
  }
  if (
    host.includes("cdninstagram.com") ||
    host.includes("instagram.com") ||
    host.includes("fbcdn.net")
  ) {
    return "https://www.instagram.com/";
  }
  return null;
}

/**
 * 외부 이미지 URL을 서버에서 프록시.
 * - Apify KV Store URL → APIFY_TOKEN 쿼리 파라미터 추가
 * - 기타 외부 URL → 브라우저 헤더 모사
 */
export async function GET(request: Request) {
  const influencerId = await getInfluencerSessionId();
  if (!influencerId) {
    return new NextResponse(null, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const imgUrl = searchParams.get("url");
  if (!imgUrl || !/^https?:\/\//i.test(imgUrl)) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    let fetchUrl = imgUrl;

    // Apify KV Store URL이면 토큰 추가
    const parsed = new URL(imgUrl);
    if (parsed.hostname === APIFY_KV_HOST) {
      const token = process.env.APIFY_TOKEN;
      if (token) {
        parsed.searchParams.set("token", token);
        fetchUrl = parsed.toString();
      }
    }

    const refererOrigin =
      resolveReferer(parsed.hostname) ||
      `${parsed.protocol}//${parsed.hostname}/`;
    const upstream = await fetch(fetchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: refererOrigin,
      },
    });

    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status });
    }

    const buffer = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return new NextResponse(null, { status: 502 });
    }

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
