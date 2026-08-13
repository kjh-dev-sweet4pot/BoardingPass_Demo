import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getInfluencerSessionId } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const influencerId = await getInfluencerSessionId();
  if (!influencerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
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
  const { data: link, error: fetchError } = await supabase
    .from("creator_links")
    .select("id, influencer_id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!link || link.influencer_id !== influencerId) {
    return NextResponse.json(
      { error: "링크를 찾을 수 없습니다." },
      { status: 404 },
    );
  }
  if (link.status === "approved") {
    return NextResponse.json(
      { error: "승인된 링크는 삭제할 수 없습니다." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("creator_links").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
