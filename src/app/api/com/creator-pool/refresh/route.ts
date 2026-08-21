import { NextResponse } from "next/server";
import { getCompanySessionId } from "@/lib/session";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { scheduleInfluencerProfileFetch } from "@/lib/influencer-profile-image";

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

/** ponytail: Apify 타임아웃 — 한 번에 최근 미수집 N명만 */
const MAX_REFRESH = 8;

/**
 * POST /api/com/creator-pool/refresh
 * 팔로워·아바타 미수집 인플루언서 프로필 재수집 큐잉
 */
export async function POST() {
  const companyId = await getCompanySessionId();
  if (!companyId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!process.env.APIFY_TOKEN?.trim()) {
    return NextResponse.json(
      { error: "APIFY_TOKEN 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  const { data: allocs, error } = await supabase
    .from("allocations")
    .select(
      "influencers(id, instagram_handle, instagram_handle_normalized, sns_url, followers, profile_image_path)",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const seen = new Set<string>();
  const targets: Array<{
    id: string;
    handle: string;
    snsUrl: string | null;
  }> = [];

  for (const row of allocs ?? []) {
    const infRaw = row.influencers;
    const inf = Array.isArray(infRaw) ? infRaw[0] : infRaw;
    if (!inf?.id || seen.has(inf.id)) continue;
    seen.add(inf.id);
    if (inf.followers != null && inf.profile_image_path) continue;
    const handle =
      (inf.instagram_handle_normalized || inf.instagram_handle || "").replace(
        /^@+/,
        "",
      ) || "";
    if (!handle && !inf.sns_url) continue;
    targets.push({
      id: inf.id,
      handle: handle || String(inf.sns_url || ""),
      snsUrl: inf.sns_url ?? null,
    });
    if (targets.length >= MAX_REFRESH) break;
  }

  for (const t of targets) {
    scheduleInfluencerProfileFetch(supabase, t.id, {
      handle: t.handle,
      snsUrl: t.snsUrl,
    });
  }

  return NextResponse.json({
    queued: targets.length,
    max: MAX_REFRESH,
  });
}
