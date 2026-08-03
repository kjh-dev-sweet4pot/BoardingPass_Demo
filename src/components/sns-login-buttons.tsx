"use client";

import { createClient } from "@/lib/supabase/client";
import { oauthProviderForPlatform } from "@/lib/auth-client";
import type { SnsPlatform } from "@/lib/types";
import { SNS_PLATFORM_LABEL } from "@/lib/types";

const PROVIDERS: SnsPlatform[] = ["instagram", "xiaohongshu", "facebook"];

export function SnsLoginButtons({ next = "/inf" }: { next?: string }) {
  async function signIn(platform: SnsPlatform) {
    const provider = oauthProviderForPlatform(platform);
    if (!provider) {
      alert(
        `${SNS_PLATFORM_LABEL[platform]} OAuth가 아직 설정되지 않았습니다. Supabase Dashboard에서 Custom Provider를 연결하거나, 핸들 본인확인을 이용하세요.`,
      );
      return;
    }

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    // Custom providers use identifiers like "custom:instagram"
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as "facebook",
      options: { redirectTo },
    });

    if (error) {
      alert(error.message);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {PROVIDERS.map((platform) => {
        const configured = Boolean(oauthProviderForPlatform(platform));
        return (
          <button
            key={platform}
            type="button"
            onClick={() => signIn(platform)}
            className="flex h-12 w-full items-center justify-center gap-2 border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-medium tracking-wide transition hover:bg-[var(--surface-hover)]"
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background:
                  platform === "instagram"
                    ? "#E1306C"
                    : platform === "xiaohongshu"
                      ? "#FF2442"
                      : "#1877F2",
              }}
            />
            {SNS_PLATFORM_LABEL[platform]}로 계속
            {!configured && (
              <span className="text-xs text-[var(--muted)]">(설정 필요)</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
