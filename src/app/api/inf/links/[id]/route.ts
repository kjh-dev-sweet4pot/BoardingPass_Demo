import { NextResponse, after } from "next/server";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { collectOnPublishUrl } from "@/lib/collect-content-metrics";
import { validateCreatorUrl, detectPlatform } from "@/lib/creator-link";
import { getInfluencerSessionId } from "@/lib/session";
import { hasServiceRoleKey, createServiceClient } from "@/lib/supabase/service";

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

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

/** 발행 URL 등록 → content_metrics 1회 수집 + 핸들 대조 (T6) */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const influencerId = await getInfluencerSessionId();
  if (!influencerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  let body: { publish_url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const publishUrl = String(body.publish_url || "").trim();
  const urlError = validateCreatorUrl(publishUrl);
  if (urlError) {
    return NextResponse.json({ error: urlError }, { status: 400 });
  }

  const { data: link, error: fetchError } = await supabase
    .from("creator_links")
    .select("id, influencer_id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!link || link.influencer_id !== influencerId) {
    return NextResponse.json({ error: "링크를 찾을 수 없습니다." }, { status: 404 });
  }
  if (link.status !== "approved") {
    return NextResponse.json(
      { error: "승인된 콘텐츠만 발행 URL을 등록할 수 있습니다." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("creator_links")
    .update({
      publish_url: publishUrl,
      url: publishUrl,
      platform: detectPlatform(publishUrl),
      content_status: "발행완료",
      updated_at: now,
    })
    .eq("id", id)
    .select("id, publish_url, content_status, verification_failed")
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message || "발행 URL 저장 실패" },
      { status: 500 },
    );
  }

  if (process.env.APIFY_TOKEN?.trim()) {
    after(async () => {
      try {
        await collectOnPublishUrl(supabase, id);
      } catch {
        // 실패해도 등록 응답은 유지, collection_jobs 재시도 큐가 처리
      }
    });
  }

  return NextResponse.json({ link: updated });
}
