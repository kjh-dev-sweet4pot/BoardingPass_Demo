import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getInfluencerSessionId } from "@/lib/session";

/**
 * 세션 확인 후 pending→visited 반영 + 배정/인플루언서 상세 로드.
 * 로그인 UI에서 환영 애니메이션과 병렬로 호출.
 */
export async function POST() {
  const influencerId = await getInfluencerSessionId();
  if (!influencerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const supabase = createClient(url, key);
    const now = new Date().toISOString();

    // 상태 갱신 후 상세 조회 (환영 애니와는 클라이언트가 병렬)
    await supabase
      .from("allocations")
      .update({
        status: "visited",
        verified_at: now,
        updated_at: now,
      })
      .eq("influencer_id", influencerId)
      .eq("status", "pending");

    const [infResult, allocResult] = await Promise.all([
      supabase
        .from("influencers")
        .select(
          "id, name, instagram_handle, instagram_handle_normalized, sns_url, notes, created_at, updated_at",
        )
        .eq("id", influencerId)
        .maybeSingle(),
      supabase
        .from("allocations")
        .select("*, products(*), stores(*)")
        .eq("influencer_id", influencerId)
        .order("created_at", { ascending: false }),
    ]);

    if (infResult.error || !infResult.data) {
      return NextResponse.json(
        { error: infResult.error?.message || "인플루언서를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (allocResult.error) {
      return NextResponse.json(
        { error: allocResult.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      influencer: infResult.data,
      allocations: allocResult.data || [],
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "배정 정보를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
