import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { INF_COOKIE } from "@/lib/session";
import { normalizeHandle } from "@/lib/auth";

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
    const normalized = normalizeHandle(handle);

    const { data: influencer, error } = await supabase
      .from("influencers")
      .select("id")
      .eq("instagram_handle_normalized", normalized)
      .maybeSingle();

    if (error) {
      return redirectTo(`/inf?error=${encodeURIComponent(error.message)}`);
    }

    if (!influencer?.id) {
      return redirectTo(
        `/inf?error=${encodeURIComponent("등록된 인스타그램 핸들과 일치하지 않습니다.")}`,
      );
    }

    const now = new Date().toISOString();

    // 로그인 시 pending → visited (당일·지각·조기 방문)
    // 실제 방문일은 verified_at 으로 기록·표시 (예정일과 다르면 콘솔에 표시)
    await supabase
      .from("allocations")
      .update({
        status: "visited",
        verified_at: now,
        updated_at: now,
      })
      .eq("influencer_id", influencer.id)
      .eq("status", "pending");

    const response = redirectTo("/inf");
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
    return redirectTo(`/inf?error=${encodeURIComponent(message)}`);
  }
}
