import { NextResponse } from "next/server";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { getInfluencerSessionId } from "@/lib/session";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const influencerId = await getInfluencerSessionId();
  if (!influencerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await context.params;
  const supabase = await createApiClientIfConfigured();
  if (!supabase) return supabaseConfigError();

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
