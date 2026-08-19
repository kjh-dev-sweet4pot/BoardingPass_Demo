import { NextResponse } from "next/server";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { getInfluencerSessionId } from "@/lib/session";

/** creator_links.thumbnail_source_url → 302 리다이렉트 (본인 링크만) */
export async function GET(
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

  const { data, error } = await supabase
    .from("creator_links")
    .select("influencer_id, thumbnail_source_url, thumbnail_status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.influencer_id !== influencerId) {
    return NextResponse.json({ error: "링크를 찾을 수 없습니다." }, { status: 404 });
  }
  if (data.thumbnail_status !== "ok" || !data.thumbnail_source_url) {
    return NextResponse.json({ error: "썸네일이 없습니다." }, { status: 404 });
  }

  return NextResponse.redirect(data.thumbnail_source_url, { status: 302 });
}
