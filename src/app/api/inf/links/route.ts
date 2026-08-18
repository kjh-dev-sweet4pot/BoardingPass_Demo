import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  CREATOR_LINK_PUBLIC_COLUMNS,
  collectTikTokLinkThumbnail,
} from "@/lib/collect-link-thumbnail";
import { getInfluencerSessionId } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { detectPlatform, validateCreatorUrl } from "@/lib/creator-link";

const LINKS_ON_ALLOCATION = `creator_links(${CREATOR_LINK_PUBLIC_COLUMNS})`;

export async function GET() {
  const influencerId = await getInfluencerSessionId();
  if (!influencerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  const supabase = createClient(url, key);
  const { data: allocations, error } = await supabase
    .from("allocations")
    .select(
      `*, products(id, name, sku, description), stores(id, name, address), ${LINKS_ON_ALLOCATION}`,
    )
    .eq("influencer_id", influencerId)
    .eq("status", "picked_up")
    .order("picked_up_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ allocations: allocations || [] });
}

export async function POST(request: Request) {
  const influencerId = await getInfluencerSessionId();
  if (!influencerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  let body: { allocation_id?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const allocationId = String(body.allocation_id || "").trim();
  const linkUrl = String(body.url || "").trim();
  const urlError = validateCreatorUrl(linkUrl);
  if (urlError) {
    return NextResponse.json({ error: urlError }, { status: 400 });
  }
  if (!allocationId) {
    return NextResponse.json({ error: "배정이 필요합니다." }, { status: 400 });
  }

  const supabase = createClient(url, key);
  const { data: allocation, error: allocError } = await supabase
    .from("allocations")
    .select("id, influencer_id, status")
    .eq("id", allocationId)
    .maybeSingle();

  if (allocError) {
    return NextResponse.json({ error: allocError.message }, { status: 500 });
  }
  if (!allocation) {
    return NextResponse.json({ error: "배정을 찾을 수 없습니다." }, { status: 404 });
  }
  if (allocation.influencer_id !== influencerId) {
    return NextResponse.json(
      { error: "본인 배정만 등록할 수 있습니다." },
      { status: 403 },
    );
  }
  if (allocation.status !== "picked_up") {
    return NextResponse.json(
      { error: "수령 완료 후 등록할 수 있습니다." },
      { status: 400 },
    );
  }

  const { data: dup } = await supabase
    .from("creator_links")
    .select("id")
    .eq("allocation_id", allocationId)
    .eq("url", linkUrl)
    .maybeSingle();
  if (dup?.id) {
    return NextResponse.json(
      { error: "이미 등록된 링크입니다." },
      { status: 409 },
    );
  }

  const { data: created, error } = await supabase
    .from("creator_links")
    .insert({
      allocation_id: allocationId,
      influencer_id: influencerId,
      url: linkUrl,
      platform: detectPlatform(linkUrl),
      status: "submitted",
      thumbnail_status: "pending",
    })
    .select(CREATOR_LINK_PUBLIC_COLUMNS)
    .single();

  if (error || !created) {
    return NextResponse.json(
      { error: error?.message || "등록에 실패했습니다." },
      { status: 500 },
    );
  }

  if (created.platform === "tiktok") {
    after(async () => {
      await collectTikTokLinkThumbnail(supabase, created.id, linkUrl);
    });
  }

  return NextResponse.json({ link: created });
}
