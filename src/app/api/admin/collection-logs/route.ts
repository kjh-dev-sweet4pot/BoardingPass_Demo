import { type NextRequest, NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

const LOG_SELECT = `
  id, creator_link_id, status, scheduled_at, started_at, finished_at,
  error_message, created_at,
  creator_links (
    id, platform, url, publish_url,
    allocations (
      companies ( id, name ),
      influencers ( name, instagram_handle ),
      products ( name )
    )
  )
`;

/**
 * GET /api/admin/collection-logs?limit=50
 * Apify 성과 수집(collection_jobs) 전체 이력 — 언제·어느 회원사
 */
export async function GET(request: NextRequest) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const limit = Math.min(
    Math.max(1, Number(request.nextUrl.searchParams.get("limit") || "50") || 50),
    200,
  );

  const { data, error } = await supabase
    .from("collection_jobs")
    .select(LOG_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}
