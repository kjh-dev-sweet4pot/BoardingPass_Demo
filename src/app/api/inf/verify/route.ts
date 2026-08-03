import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { INF_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  const formData = await request.formData();
  const handle = String(formData.get("instagram_handle") || "").trim();
  const origin = new URL(request.url).origin;

  function redirectTo(path: string) {
    return NextResponse.redirect(new URL(path, origin), 303);
  }

  if (!handle) {
    return redirectTo(`/inf?error=${encodeURIComponent("인스타그램 핸들을 입력하세요.")}`);
  }

  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    return redirectTo(
      `/inf?error=${encodeURIComponent("Supabase 환경변수가 설정되지 않았습니다.")}`,
    );
  }

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase.rpc("verify_influencer_by_handle", {
      p_instagram_handle: handle,
    });

    if (error) {
      return redirectTo(`/inf?error=${encodeURIComponent(error.message)}`);
    }

    const payload = typeof data === "string" ? JSON.parse(data) : data;
    const influencerId = payload?.influencer?.id as string | undefined;

    if (!influencerId) {
      return redirectTo(
        `/inf?error=${encodeURIComponent("등록된 인스타그램 핸들과 일치하지 않습니다.")}`,
      );
    }

    const response = redirectTo(
      `/inf?message=${encodeURIComponent("본인확인이 완료되었습니다.")}`,
    );
    response.cookies.set(INF_COOKIE, influencerId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "본인확인 중 오류가 발생했습니다.";
    return redirectTo(`/inf?error=${encodeURIComponent(message)}`);
  }
}
