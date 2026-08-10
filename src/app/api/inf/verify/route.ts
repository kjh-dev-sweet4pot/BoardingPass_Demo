import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { INF_COOKIE } from "@/lib/session";
import { normalizeHandle } from "@/lib/auth";

const INF_SELECT =
  "id, name, instagram_handle, instagram_handle_normalized, sns_url";

async function readQuery(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      instagram_handle?: string;
      query?: string;
      name?: string;
    } | null;
    return String(
      body?.instagram_handle || body?.query || body?.name || "",
    ).trim();
  }
  const formData = await request.formData();
  return String(
    formData.get("instagram_handle") ||
      formData.get("query") ||
      formData.get("name") ||
      "",
  ).trim();
}

/** ilike 정확 일치용: % _ 이스케이프 */
function escapeIlikeExact(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

async function findInfluencer(supabase: SupabaseClient, query: string) {
  const normalized = normalizeHandle(query);

  if (normalized) {
    const { data, error } = await supabase
      .from("influencers")
      .select(INF_SELECT)
      .eq("instagram_handle_normalized", normalized)
      .maybeSingle();
    if (error) return { error };
    if (data?.id) return { influencer: data };
  }

  const nameKey = query.trim();
  if (!nameKey) return { influencer: null };

  const { data: byName, error: nameError } = await supabase
    .from("influencers")
    .select(INF_SELECT)
    .ilike("name", escapeIlikeExact(nameKey))
    .limit(2);

  if (nameError) return { error: nameError };
  if (!byName || byName.length === 0) return { influencer: null };
  if (byName.length > 1) return { ambiguous: true as const };
  return { influencer: byName[0] };
}

/**
 * 본인확인만 빠르게 수행 (influencers 조회 + 세션 쿠키).
 * SNS 핸들 또는 등록된 이름으로 매칭.
 * pending → visited(오늘 예정만) / 미수령 재방문일 갱신은 /api/inf/bootstrap 에서 처리.
 */
export async function POST(request: Request) {
  const query = await readQuery(request);
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

  if (!query) {
    const msg = "SNS 아이디 또는 이름을 입력하세요.";
    return wantsJson ? jsonError(msg) : redirectError(msg);
  }

  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    const msg = "env err : 환경변수가 설정되지 않았습니다.";
    return wantsJson ? jsonError(msg, 500) : redirectError(msg);
  }

  try {
    const supabase = createClient(url, key);
    const result = await findInfluencer(supabase, query);

    if (result.error) {
      return wantsJson
        ? jsonError(result.error.message, 500)
        : redirectError(result.error.message);
    }

    if (result.ambiguous) {
      const msg =
        "같은 이름이 여러 명 등록되어 있습니다. SNS 아이디로 로그인해 주세요.";
      return wantsJson ? jsonError(msg, 409) : redirectError(msg);
    }

    const influencer = result.influencer;
    if (!influencer?.id) {
      const msg = "등록된 SNS 아이디 또는 이름과 일치하지 않습니다.";
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
