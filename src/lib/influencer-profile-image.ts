import type { SupabaseClient } from "@supabase/supabase-js";
import { scrapeInstagramProfile, resolveInstagramProfileUrl, instagramHandleFromUrl } from "@/lib/apify-instagram";
import { normalizeTikTokUsername, scrapeTikTokProfile, tiktokHandleFromUrl } from "@/lib/apify-tiktok";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";

export const INFLUENCER_AVATARS_BUCKET = "influencer-avatars";

function bareHandle(handle: string) {
  return handle.replace(/^@+/, "").trim();
}

export function influencerAvatarObjectPath(influencerId: string) {
  return `${influencerId}.jpg`;
}

/** DB·Storage 경로 불일치 방지 (버킷 prefix 제거) */
export function normalizeAvatarObjectPath(objectPath: string) {
  return objectPath.replace(/^influencer-avatars\//, "").replace(/^\/+/, "");
}

export function storageClientForAvatars(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fallback: SupabaseClient<any>,
) {
  if (hasServiceRoleKey()) return createServiceClient();
  return fallback;
}

/** img 태그용 — Storage에서 직접 바이트 반환 (302 redirect 회피) */
export async function downloadInfluencerAvatarBytes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  objectPath: string,
) {
  const path = normalizeAvatarObjectPath(objectPath);
  const { data, error } = await supabase.storage
    .from(INFLUENCER_AVATARS_BUCKET)
    .download(path);
  if (error || !data) {
    throw new Error(error?.message || "Storage에서 프로필 이미지를 찾을 수 없습니다.");
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length < 100) {
    throw new Error("Storage 프로필 이미지가 비어 있습니다.");
  }
  return {
    bytes,
    contentType: data.type || "image/jpeg",
  };
}

function isTikTokUrl(url: string) {
  return /tiktok\.com/i.test(url);
}

function profileTarget(handle: string, snsUrl?: string | null) {
  const raw = (snsUrl || "").trim();
  if (raw && /^https?:\/\//i.test(raw)) {
    if (isTikTokUrl(raw)) {
      // SNS URL의 @username 우선 — DB handle은 표시명(예: 山口奈々美)인 경우가 많음
      const h =
        tiktokHandleFromUrl(raw) ||
        normalizeTikTokUsername(handle) ||
        bareHandle(handle);
      return { platform: "tiktok" as const, handle: h, url: raw };
    }
    const igHandle = bareHandle(instagramHandleFromUrl(raw) || handle);
    return {
      platform: "instagram" as const,
      handle: igHandle,
      url: resolveInstagramProfileUrl(igHandle, raw),
    };
  }
  const h = bareHandle(handle);
  if (!h) return null;
  return {
    platform: "instagram" as const,
    handle: h,
    url: resolveInstagramProfileUrl(h, null),
  };
}

async function downloadImageBytes(imageUrl: string) {
  const res = await fetch(imageUrl, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`프로필 이미지 다운로드 실패 (${res.status})`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 500) throw new Error("프로필 이미지가 너무 작습니다.");
  return { bytes, contentType };
}

export async function scrapeProfileDetails(
  handle: string,
  snsUrl?: string | null,
): Promise<{ imageUrl: string | null; followers: number | null }> {
  const target = profileTarget(handle, snsUrl);
  if (!target) return { imageUrl: null, followers: null };
  if (target.platform === "tiktok") {
    return scrapeTikTokProfile(target.handle);
  }
  return scrapeInstagramProfile(target.url);
}

/** @deprecated scrapeProfileDetails 사용 */
export async function scrapeProfileImageUrl(handle: string, snsUrl?: string | null) {
  const r = await scrapeProfileDetails(handle, snsUrl);
  return r.imageUrl;
}

/** Apify → Storage 아바타 + influencers.followers */
export async function fetchAndStoreInfluencerProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  influencerId: string,
  input: { handle: string; snsUrl?: string | null },
) {
  if (!process.env.APIFY_TOKEN?.trim()) return null;

  const profile = await scrapeProfileDetails(input.handle, input.snsUrl);
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (profile.followers != null) {
    patch.followers = profile.followers;
  }

  let path: string | null = null;
  if (profile.imageUrl) {
    const { bytes, contentType } = await downloadImageBytes(profile.imageUrl);
    path = influencerAvatarObjectPath(influencerId);
    const { error: uploadErr } = await supabase.storage
      .from(INFLUENCER_AVATARS_BUCKET)
      .upload(path, bytes, { contentType, upsert: true });
    if (uploadErr) throw new Error(uploadErr.message);
    patch.profile_image_path = path;
  }

  if (Object.keys(patch).length <= 1) return null;

  const { error: updateErr } = await supabase
    .from("influencers")
    .update(patch)
    .eq("id", influencerId);
  if (updateErr) throw new Error(updateErr.message);

  return { path, followers: profile.followers };
}

/** 등록 직후 백그라운드 수집 — 실패해도 본 흐름은 유지 */
export function scheduleInfluencerProfileFetch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  influencerId: string,
  input: { handle: string; snsUrl?: string | null },
  onComplete?: (result: { ok: boolean; error?: string }) => void,
) {
  if (!process.env.APIFY_TOKEN?.trim()) {
    onComplete?.({ ok: false, error: "APIFY_TOKEN 없음" });
    return;
  }
  void fetchAndStoreInfluencerProfile(supabase, influencerId, input)
    .then((result) => {
      if (result && (result.path || result.followers != null)) {
        onComplete?.({ ok: true });
      } else {
        onComplete?.({ ok: false, error: "프로필·팔로워를 찾지 못했습니다." });
      }
    })
    .catch((err: unknown) => {
      onComplete?.({
        ok: false,
        error: err instanceof Error ? err.message : "프로필 수집 실패",
      });
    });
}

export async function signedInfluencerAvatarUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  objectPath: string,
  expiresInSec = 60 * 60,
) {
  const { data, error } = await supabase.storage
    .from(INFLUENCER_AVATARS_BUCKET)
    .createSignedUrl(objectPath, expiresInSec);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Presigned URL 생성 실패");
  }
  return data.signedUrl;
}
