import { NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

export async function GET() {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("creator_links")
    .select(
      "id, allocation_id, influencer_id, url, platform, status, content_status, publish_url, submitted_file_path, memo, submitted_at, updated_at, thumbnail_status, thumbnail_source_url, tiktok_video_id, views, likes, comments, saves, shares, reposts, metrics_collected_at, verification_failed, allocations(id, visit_date, quantity, status, rollup_status, products(name), stores(name), influencers(name, instagram_handle, instagram_handle_normalized), companies(id, name))",
    )
    .in("status", ["submitted", "approved"])
    .order("submitted_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ links: data || [] });
}
