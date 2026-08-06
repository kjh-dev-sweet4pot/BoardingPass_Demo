import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStoreSessionId } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const storeId = await getStoreSessionId();
  if (!storeId) {
    return NextResponse.json(
      { error: "지점 로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const { url, key, configured } = getSupabaseEnv();

  if (!configured) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  const supabase = createClient(url, key);

  const [
    { data: influencer, error: infError },
    { data: allocations, error: allocError },
  ] = await Promise.all([
    supabase.from("influencers").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("allocations")
      .select("*, products(*), stores(*)")
      .eq("influencer_id", id)
      .eq("store_id", storeId)
      .order("created_at", { ascending: false }),
  ]);

  if (infError || !influencer) {
    return NextResponse.json(
      { error: infError?.message || "인플루언서를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (allocError) {
    return NextResponse.json({ error: allocError.message }, { status: 500 });
  }

  const storeAllocations = allocations || [];
  if (storeAllocations.length === 0) {
    return NextResponse.json(
      { error: "이 지점에 해당 인플루언서 배정이 없습니다." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    influencer,
    allocations: storeAllocations,
  });
}
