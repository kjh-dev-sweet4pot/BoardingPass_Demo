import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getInfluencerSessionId } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const influencerId = await getInfluencerSessionId();
  const { url, key, configured } = getSupabaseEnv();

  if (!configured) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  if (!influencerId) {
    return NextResponse.json(
      { error: "본인확인이 필요합니다." },
      { status: 401 },
    );
  }

  if (!id) {
    return NextResponse.json({ error: "배정 ID가 필요합니다." }, { status: 400 });
  }

  const supabase = createClient(url, key);

  const { data: existing, error: fetchError } = await supabase
    .from("allocations")
    .select("id, influencer_id, status, picked_up_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json(
      { error: "배정을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (existing.influencer_id !== influencerId) {
    return NextResponse.json(
      { error: "본인 배정만 확인할 수 있습니다." },
      { status: 403 },
    );
  }

  if (existing.status === "cancelled") {
    return NextResponse.json(
      { error: "취소된 배정은 수령 확인할 수 없습니다." },
      { status: 400 },
    );
  }

  if (existing.status === "picked_up" && existing.picked_up_at) {
    const { data: allocation } = await supabase
      .from("allocations")
      .select("*, products(*), stores(*)")
      .eq("id", id)
      .single();

    return NextResponse.json({
      allocation: allocation || existing,
      alreadyPickedUp: true,
    });
  }

  const now = new Date().toISOString();
  const { data: allocation, error } = await supabase
    .from("allocations")
    .update({
      status: "picked_up",
      picked_up_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .eq("influencer_id", influencerId)
    .select("*, products(*), stores(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ allocation, alreadyPickedUp: false });
}
