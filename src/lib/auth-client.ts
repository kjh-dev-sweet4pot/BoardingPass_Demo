import type { SnsPlatform } from "@/lib/types";

export function oauthProviderForPlatform(platform: SnsPlatform): string | null {
  if (platform === "facebook") {
    // Facebook is a built-in Supabase provider; enable in Dashboard.
    return process.env.NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED === "true"
      ? "facebook"
      : null;
  }
  if (platform === "instagram") {
    return process.env.NEXT_PUBLIC_OAUTH_INSTAGRAM_PROVIDER || null;
  }
  if (platform === "xiaohongshu") {
    return process.env.NEXT_PUBLIC_OAUTH_XIAOHONGSHU_PROVIDER || null;
  }
  return null;
}
