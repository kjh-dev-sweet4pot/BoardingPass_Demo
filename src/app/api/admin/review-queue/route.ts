import { NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/access";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";

const QUEUE_SELECT = `
  id, allocation_id, influencer_id, url, platform, status, content_status,
  publish_url, submitted_file_path, memo, submitted_at, updated_at,
  verification_failed,
  content_feedback ( id, body, created_at ),
  allocations (
    id, visit_date, rollup_status, campaign_id,
    products ( name ),
    stores ( name ),
    influencers ( name, instagram_handle, instagram_handle_normalized ),
    companies ( id, name ),
    campaigns (
      id, name, status,
      guidelines ( id, title, body, file_path )
    )
  )
`;

/** 콘텐츠 `제출` 전건 — 제출 일시 오름차순 */
export async function GET() {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createApiClientIfConfigured();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("creator_links")
    .select(QUEUE_SELECT)
    .eq("content_status", "제출")
    .order("submitted_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
