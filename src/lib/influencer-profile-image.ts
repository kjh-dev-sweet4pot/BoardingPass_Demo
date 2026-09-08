import http from "node:http";
import https from "node:https";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  scrapeInstagramProfile,
  resolveInstagramProfileUrl,
  instagramHandleFromUrl,
} from "@/lib/apify-instagram";
import {
  normalizeTikTokUsername,
  scrapeTikTokProfile,
  tiktokHandleFromUrl,
} from "@/lib/apify-tiktok";
import {
  isXiaohongshuUrl,
  scrapeXiaohongshuProfile,
} from "@/lib/apify-xiaohongshu";
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
    if (isXiaohongshuUrl(raw)) {
      return {
        platform: "xiaohongshu" as const,
        handle: bareHandle(handle),
        url: raw,
      };
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
  if (/^[0-9a-f]{24}$/i.test(h)) {
    return {
      platform: "xiaohongshu" as const,
      handle: h,
      url: `https://www.xiaohongshu.com/user/profile/${h}`,
    };
  }
  return {
    platform: "instagram" as const,
    handle: h,
    url: resolveInstagramProfileUrl(h, null),
  };
}

function cdnReferer(imageUrl: string): string | null {
  try {
    const host = new URL(imageUrl).hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("tiktokcdn") || host.includes("tiktok.com") || host.includes("muscdn")) {
      return "https://www.tiktok.com/";
    }
    if (
      host.includes("cdninstagram.com") ||
      host.includes("instagram.com") ||
      host.includes("fbcdn.net")
    ) {
      return "https://www.instagram.com/";
    }
    if (host.includes("xhscdn.com") || host.includes("xiaohongshu.com")) {
      return "https://www.xiaohongshu.com/";
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Meta/TikTok CDN — undici fetch 가 IPv6 로 붙다 타임아웃하는 경우가 있어
 * https.request + family:4 로 받는다. (Referer 필수)
 */
function downloadImageBytes(imageUrl: string, redirects = 0): Promise<{
  bytes: Buffer;
  contentType: string;
}> {
  if (redirects > 5) {
    return Promise.reject(new Error("프로필 이미지 리다이렉트가 너무 많습니다."));
  }
  const referer = cdnReferer(imageUrl);
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  };
  if (referer) {
    headers.Referer = referer;
    headers.Origin = new URL(referer).origin;
  }

  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      reject(new Error("프로필 이미지 URL이 올바르지 않습니다."));
      return;
    }
    const lib = parsed.protocol === "http:" ? http : https;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: `${parsed.pathname}${parsed.search}`,
        method: "GET",
        family: 4,
        headers,
        timeout: 25_000,
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, imageUrl).toString();
          resolve(downloadImageBytes(next, redirects + 1));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          if (status < 200 || status >= 300) {
            reject(new Error(`프로필 이미지 다운로드 실패 (${status})`));
            return;
          }
          const bytes = Buffer.concat(chunks);
          if (bytes.length < 500) {
            reject(new Error("프로필 이미지가 너무 작습니다."));
            return;
          }
          const rawType = res.headers["content-type"] || "image/jpeg";
          const contentType = Array.isArray(rawType) ? rawType[0]! : rawType;
          if (
            contentType &&
            !contentType.startsWith("image/") &&
            !contentType.includes("octet-stream")
          ) {
            reject(new Error(`프로필 이미지 형식이 아닙니다 (${contentType})`));
            return;
          }
          resolve({
            bytes,
            contentType: contentType.startsWith("image/")
              ? contentType
              : "image/jpeg",
          });
        });
        res.on("error", reject);
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("프로필 이미지 다운로드 시간 초과"));
    });
    req.on("error", reject);
    req.end();
  });
}

export async function scrapeProfileDetails(
  handle: string,
  snsUrl?: string | null,
): Promise<{
  imageUrl: string | null;
  followers: number | null;
  region: string | null;
}> {
  const target = profileTarget(handle, snsUrl);
  if (!target) return { imageUrl: null, followers: null, region: null };
  if (target.platform === "tiktok") {
    return scrapeTikTokProfile(target.handle);
  }
  if (target.platform === "xiaohongshu") {
    return scrapeXiaohongshuProfile(target.url);
  }
  return scrapeInstagramProfile(target.url);
}

/** @deprecated scrapeProfileDetails 사용 */
export async function scrapeProfileImageUrl(handle: string, snsUrl?: string | null) {
  const r = await scrapeProfileDetails(handle, snsUrl);
  return r.imageUrl;
}

export type FetchStoreProfileResult = {
  path: string | null;
  followers: number | null;
  region: string | null;
  /** CDN 다운로드/업로드 실패 메시지 (팔로워는 저장됐을 수 있음) */
  imageError?: string;
};

/** Apify → Storage 아바타 + influencers.followers + influencers.region */
export async function fetchAndStoreInfluencerProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  influencerId: string,
  input: { handle: string; snsUrl?: string | null },
): Promise<FetchStoreProfileResult | null> {
  if (!process.env.APIFY_TOKEN?.trim()) return null;

  const profile = await scrapeProfileDetails(input.handle, input.snsUrl);
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (profile.followers != null) {
    patch.followers = profile.followers;
  }
  if (profile.region) {
    patch.region = profile.region;
  }

  let path: string | null = null;
  let imageError: string | undefined;
  if (profile.imageUrl) {
    try {
      const { bytes, contentType } = await downloadImageBytes(profile.imageUrl);
      path = influencerAvatarObjectPath(influencerId);
      const { error: uploadErr } = await supabase.storage
        .from(INFLUENCER_AVATARS_BUCKET)
        .upload(path, bytes, { contentType, upsert: true });
      if (uploadErr) throw new Error(uploadErr.message);
      patch.profile_image_path = path;
    } catch (err) {
      imageError =
        err instanceof Error ? err.message : "프로필 이미지 저장 실패";
      console.warn(
        `[avatar] ${influencerId} image download failed:`,
        imageError,
      );
    }
  }

  if (Object.keys(patch).length <= 1) {
    return imageError
      ? { path: null, followers: null, region: null, imageError }
      : null;
  }

  const { error: updateErr } = await supabase
    .from("influencers")
    .update(patch)
    .eq("id", influencerId);
  if (updateErr) throw new Error(updateErr.message);

  return {
    path,
    followers: profile.followers,
    region: profile.region,
    imageError,
  };
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
      if (!result) {
        onComplete?.({ ok: false, error: "프로필·팔로워를 찾지 못했습니다." });
        return;
      }
      // 사진은 Apify가 URL을 줬는데 CDN 저장 실패 → 재수집 대상
      if (result.imageError && !result.path) {
        onComplete?.({
          ok: false,
          error: `프로필 사진 저장 실패: ${result.imageError}`,
        });
        return;
      }
      if (result.path || result.followers != null || result.region) {
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
