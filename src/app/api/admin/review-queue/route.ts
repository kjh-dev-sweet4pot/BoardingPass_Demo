import { type NextRequest, NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

const QUEUE_SELECT = `
  id, allocation_id, influencer_id, url, platform, status, content_status,
  publish_url, submitted_file_path, memo, submitted_at, updated_at,
  thumbnail_source_url, verification_failed,
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

const QUEUES = ["reviewPending", "verifyFailed", "collectFailed", "publishStale"] as const;
type LinkQueue = (typeof QUEUES)[number];

async function collectFailedLinkIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (t: string) => any },
) {
  const { data } = await supabase
    .from("collection_jobs")
    .select("creator_link_id, status")
    .order("created_at", { ascending: false })
    .limit(500);
  const statusesByLink = new Map<string, string[]>();
  for (const job of data ?? []) {
    const list = statusesByLink.get(job.creator_link_id) ?? [];
    if (list.length < 3) list.push(job.status);
    statusesByLink.set(job.creator_link_id, list);
  }
  const ids: string[] = [];
  for (const [id, statuses] of statusesByLink) {
    if (statuses.length >= 3 && statuses.every((s) => s === "실패")) ids.push(id);
  }
  return ids;
}

export async function GET(request: NextRequest) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const raw = request.nextUrl.searchParams.get("queue") || "reviewPending";
  const queue: LinkQueue = QUEUES.includes(raw as LinkQueue)
    ? (raw as LinkQueue)
    : "reviewPending";

  let query = supabase.from("creator_links").select(QUEUE_SELECT);

  if (queue === "reviewPending") {
    query = query.eq("content_status", "제출").order("submitted_at", { ascending: true });
  } else if (queue === "verifyFailed") {
    query = query.eq("verification_failed", true).order("updated_at", { ascending: false });
  } else if (queue === "publishStale") {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    query = query
      .eq("status", "approved")
      .is("publish_url", null)
      .lt("updated_at", threeDaysAgo)
      .order("updated_at", { ascending: true });
  } else {
    const ids = await collectFailedLinkIds(supabase);
    if (ids.length === 0) return NextResponse.json({ items: [], queue });
    query = query.in("id", ids).order("updated_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [], queue });
}
