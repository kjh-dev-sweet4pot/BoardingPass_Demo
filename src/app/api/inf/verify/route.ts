import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { INF_COOKIE } from "@/lib/session";
import { normalizeHandle } from "@/lib/auth";

async function readHandle(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      instagram_handle?: string;
    } | null;
    return String(body?.instagram_handle || "").trim();
  }
  const formData = await request.formData();
  return String(formData.get("instagram_handle") || "").trim();
}

/**
 * 본인확인만 빠르게 수행 (influencers 조회 + 세션 쿠키).
 * pending → visited(오늘 예정만) / 미수령 재방문일 갱신은 /api/inf/bootstrap 에서 처리.
 */
export async function POST(request: Request) {
  const handle = await readHandle(request);
  const wantsJson =
    request.headers.get("accept")?.includes("application/json") ||
    (request.headers.get("content-type") || "").includes("application/json");

  function redirectError(message: string) {
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(
      new URL(`/inf?error=${encodeURIComponent(message)}`, origin),
      303,
    );
  }

  function jsonError(message: string, status = 400) {
    return NextResponse.json({ error: message }, { status });
  }

  if (!handle) {
    const msg = "인스타그램 핸들을 입력하세요.";
    return wantsJson ? jsonError(msg) : redirectError(msg);
  }

  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    const msg = "env err : 환경변수가 설정되지 않았습니다.";
    return wantsJson ? jsonError(msg, 500) : redirectError(msg);
  }

  try {
    const supabase = createClient(url, key);
    const normalized = normalizeHandle(handle);

    const { data: influencer, error } = await supabase
      .from("influencers")
      .select("id, name, instagram_handle, instagram_handle_normalized, sns_url")
      .eq("instagram_handle_normalized", normalized)
      .maybeSingle();

    if (error) {
      return wantsJson ? jsonError(error.message, 500) : redirectError(error.message);
    }

    if (!influencer?.id) {
      const msg = "등록된 SNS 아이디와 일치하지 않습니다.";
      return wantsJson ? jsonError(msg, 404) : redirectError(msg);
    }

    if (!wantsJson) {
      const origin = new URL(request.url).origin;
      const response = NextResponse.redirect(new URL("/inf", origin), 303);
      response.cookies.set(INF_COOKIE, influencer.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 12,
      });
      return response;
    }

    const response = NextResponse.json({ influencer });
    response.cookies.set(INF_COOKIE, influencer.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "본인확인 중 오류가 발생했습니다.";
    return wantsJson ? jsonError(message, 500) : redirectError(message);
  }
}
