import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getInfluencerSessionId } from "@/lib/session";
import { applyInfluencerStoreVisit } from "@/lib/inf-visit";

/**
 * 세션 확인 후 방문 반영(pending→visited / 미수령 재방문일 갱신) + 배정 로드.
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

    await applyInfluencerStoreVisit(supabase, influencerId);

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
        .select(
          "id, influencer_id, product_id, store_id, quantity, status, visit_code, visit_date, verified_at, picked_up_at, created_at, updated_at, products(id, name, sku, description), stores(id, name, address)",
        )
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
