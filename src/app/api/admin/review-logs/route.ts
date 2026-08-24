import { type NextRequest, NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/access";
import { contentReviewLogsClient } from "@/lib/content-review-log";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

const LOG_SELECT = `
  id, creator_link_id, decision, memo, operator_label, operator_id, created_at,
  creator_links (
    allocations (
      influencers ( name ),
      products ( name )
    )
  )
`;

export async function GET(request: NextRequest) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const linkId = request.nextUrl.searchParams.get("creator_link_id")?.trim();
  const limit = Math.min(
    Math.max(1, Number(request.nextUrl.searchParams.get("limit") || "30") || 30),
    100,
  );

  let query = contentReviewLogsClient(supabase)
    .from("content_review_logs")
    .select(LOG_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (linkId) query = query.eq("creator_link_id", linkId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}
