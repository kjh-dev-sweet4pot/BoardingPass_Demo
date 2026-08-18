import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  extractInstagramViews,
  findInstagramResultForUrl,
  scrapeInstagramPosts,
} from "@/lib/apify-instagram";
import { isAdminSession } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { findResultForUrl, scrapeTikTokPosts } from "@/lib/apify-tiktok";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  const supabase = createClient(url, key);
  const { data: link, error: fetchErr } = await supabase
    .from("creator_links")
    .select("id, url, platform")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !link) {
    return NextResponse.json({ error: "링크를 찾을 수 없습니다." }, { status: 404 });
  }
  try {
    const now = new Date().toISOString();
    let payload: {
      views: number | null;
      likes: number | null;
      comments: number | null;
      metrics_collected_at: string;
      updated_at: string;
    } | null = null;

    if (link.platform === "tiktok") {
      const items = await scrapeTikTokPosts([link.url]);
      const result = findResultForUrl(items, link.url);
      if (!result) {
        return NextResponse.json(
          { error: "Apify에서 결과를 찾지 못했습니다." },
          { status: 404 },
        );
      }
      payload = {
        views: result.playCount ?? null,
        likes: result.diggCount ?? null,
        comments: result.commentCount ?? null,
        metrics_collected_at: now,
        updated_at: now,
      };
    } else if (link.platform === "instagram") {
      const items = await scrapeInstagramPosts([link.url]);
      const result = findInstagramResultForUrl(items, link.url);
      if (!result) {
        return NextResponse.json(
          { error: "Apify에서 결과를 찾지 못했습니다." },
          { status: 404 },
        );
      }
      payload = {
        views: extractInstagramViews(result),
        likes: result.likesCount ?? null,
        comments: result.commentsCount ?? null,
        metrics_collected_at: now,
        updated_at: now,
      };
    } else {
      return NextResponse.json(
        { error: "현재 TikTok/Instagram 링크만 지표 새로고침을 지원합니다." },
        { status: 400 },
      );
    }

    const { data: updated, error: updateErr } = await supabase
      .from("creator_links")
      .update(payload)
      .eq("id", id)
      .select("id, views, likes, comments, metrics_collected_at")
      .maybeSingle();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ metrics: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "지표 조회 실패" },
      { status: 500 },
    );
  }
}
