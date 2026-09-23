import { NextResponse, after } from "next/server";
import { collectOnPublishUrl } from "@/lib/collect-content-metrics";
import { notifyOnPublish } from "@/lib/company-notify-send";
import { validateCreatorUrl, detectPlatform } from "@/lib/creator-link";
import { propagateSharedVisitCreatorLink } from "@/lib/alloc-dup";
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

/**
 * 인플루언서 시트에서 콘텐츠 URL 등록/수정.
 * 해당 배정에 링크가 없으면 발행완료로 신규 등록 + 회원사 발행 알림 메일, 있으면 URL만 수정(메일 없음).
 */
export async function POST(request: Request) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: { allocation_id?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const allocationId = String(body.allocation_id || "");
  const url = String(body.url || "").trim();
  const urlError = validateCreatorUrl(url);
  if (!allocationId) return NextResponse.json({ error: "배정 정보가 없습니다." }, { status: 400 });
  if (urlError) return NextResponse.json({ error: urlError }, { status: 400 });

  const { data: alloc, error: allocErr } = await supabase
    .from("allocations")
    .select("id, influencer_id")
    .eq("id", allocationId)
    .maybeSingle();
  if (allocErr) return NextResponse.json({ error: allocErr.message }, { status: 500 });
  if (!alloc?.influencer_id) return NextResponse.json({ error: "배정을 찾을 수 없습니다." }, { status: 404 });

  const { data: existing } = await supabase
    .from("creator_links")
    .select("id")
    .eq("allocation_id", allocationId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();
  const platform = detectPlatform(url);
  const fields = { url, publish_url: url, platform, status: "approved", content_status: "발행완료", updated_at: now };
  const { data: link, error } = existing
    ? await supabase.from("creator_links").update(fields).eq("id", existing.id).select("*").single()
    : await supabase
        .from("creator_links")
        .insert({ ...fields, allocation_id: allocationId, influencer_id: alloc.influencer_id, submitted_at: now })
        .select("*")
        .single();
  if (error || !link) return NextResponse.json({ error: error?.message || "저장 실패" }, { status: 500 });

  try {
    await propagateSharedVisitCreatorLink(supabase, allocationId, {
      id: link.id,
      influencer_id: alloc.influencer_id,
      url,
      platform,
      status: "approved",
      content_status: "발행완료",
      publish_url: url,
    });
  } catch {
    // 원본 저장은 유지
  }

  if (process.env.APIFY_TOKEN?.trim()) {
    after(async () => {
      try {
        await collectOnPublishUrl(supabase, link.id);
      } catch {
        // collection_jobs 재시도 큐가 처리
      }
    });
  }
  if (!existing) {
    after(async () => {
      try {
        await notifyOnPublish(supabase, allocationId);
      } catch {
        // 메일 실패해도 등록은 유지 (company_mail_logs에 기록됨)
      }
    });
  }

  return NextResponse.json({ link, notified: !existing });
}
