import { type NextRequest, NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/access";
import { ADMIN_LINK_REVIEW_SELECT } from "@/lib/creator-link";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

const QUEUES = ["reviewPending", "publishStale", "collectResults"] as const;
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
  const queueNorm =
    raw === "verifyFailed" || raw === "collectFailed" ? "collectResults" : raw;
  const queue: LinkQueue = QUEUES.includes(queueNorm as LinkQueue)
    ? (queueNorm as LinkQueue)
    : "reviewPending";

  if (queue === "collectResults") {
    const failedIds = await collectFailedLinkIds(supabase);
    const { data: verifyRows, error: verifyErr } = await supabase
      .from("creator_links")
      .select(ADMIN_LINK_REVIEW_SELECT)
      .eq("verification_failed", true);
    if (verifyErr) return NextResponse.json({ error: verifyErr.message }, { status: 500 });

    let collectRows: typeof verifyRows = [];
    if (failedIds.length > 0) {
      const { data, error: collectErr } = await supabase
        .from("creator_links")
        .select(ADMIN_LINK_REVIEW_SELECT)
        .in("id", failedIds);
      if (collectErr) return NextResponse.json({ error: collectErr.message }, { status: 500 });
      collectRows = data ?? [];
    }

    const byId = new Map<string, NonNullable<typeof verifyRows>[number]>();
    for (const row of [...(verifyRows ?? []), ...collectRows]) byId.set(row.id, row);
    const items = [...byId.values()].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    return NextResponse.json({ items, queue });
  }

  let query = supabase.from("creator_links").select(ADMIN_LINK_REVIEW_SELECT);

  if (queue === "reviewPending") {
    query = query.eq("content_status", "제출").order("submitted_at", { ascending: true });
  } else if (queue === "publishStale") {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    query = query
      .eq("status", "approved")
      .is("publish_url", null)
      .lt("updated_at", threeDaysAgo)
      .order("updated_at", { ascending: true });
  } else {
    return NextResponse.json({ items: [], queue });
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [], queue });
}
