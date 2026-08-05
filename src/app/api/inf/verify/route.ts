import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { INF_COOKIE } from "@/lib/session";
import { normalizeHandle } from "@/lib/auth";

function todayYmdKst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

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

    const today = todayYmdKst();
    const now = new Date().toISOString();

    // 방문 예정일이 오늘인 pending 배정만 매장 방문 완료(visited)로 변경
    await supabase
      .from("allocations")
      .update({
        status: "visited",
        verified_at: now,
        updated_at: now,
      })
      .eq("influencer_id", influencer.id)
      .eq("status", "pending")
      .eq("visit_date", today);

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
