import { NextResponse } from "next/server";
import { getInfluencerSessionId } from "@/lib/session";

const APIFY_KV_HOST = "api.apify.com";

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

    const upstream = await fetch(fetchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BoardingPass/1.0)",
        Referer: "https://www.tiktok.com/",
      },
    });

    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status });
    }

    const buffer = await upstream.arrayBuffer();
    const contentType =
      upstream.headers.get("content-type") || "image/jpeg";

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
