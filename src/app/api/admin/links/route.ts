import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminSession } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }
  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 없습니다." },
      { status: 500 },
    );
  }
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("creator_links")
    .select(
      "id, allocation_id, influencer_id, url, platform, status, memo, submitted_at, updated_at, thumbnail_status, thumbnail_source_url, tiktok_video_id, views, likes, comments, metrics_collected_at, allocations(id, visit_date, quantity, status, products(name), stores(name), influencers(name, instagram_handle, instagram_handle_normalized), companies(id, name))",
    )
    .in("status", ["submitted", "approved"])
    .order("submitted_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ links: data || [] });
}
