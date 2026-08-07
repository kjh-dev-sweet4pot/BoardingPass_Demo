import type { ReactNode } from "react";
import { InfLocaleProvider } from "@/components/inf-locale-provider";

/** Inf 경로 전용: 로고 우선 로드로 첫 화면 체감 속도 개선 */
export default function InfLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link
        rel="preload"
        href="/owm-logo.webp"
        as="image"
        type="image/webp"
        fetchPriority="high"
      />
      <InfLocaleProvider>{children}</InfLocaleProvider>
    </>
  );
}
