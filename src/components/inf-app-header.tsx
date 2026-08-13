"use client";

import {
  InfLanguageToggle,
  InfLocaleEnsure,
  useInfLocale,
} from "@/components/inf-locale-provider";

export function InfAppHeader({
  showLanguage = true,
}: {
  showLanguage?: boolean;
}) {
  return (
    <InfLocaleEnsure>
      <InfAppHeaderInner showLanguage={showLanguage} />
    </InfLocaleEnsure>
  );
}

function InfAppHeaderInner({ showLanguage }: { showLanguage: boolean }) {
  const { t } = useInfLocale();

  return (
    <header className="flex items-center justify-between gap-3 px-5 pt-10 pb-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/owm-logo.webp"
        alt="O.W.M"
        className="w-20 shrink-0"
        draggable={false}
      />
      <div className="flex items-center gap-2">
        {showLanguage ? <InfLanguageToggle size="mini" /> : null}
        <form action="/api/inf/clear" method="post">
          <button
            type="submit"
            className="rounded-full px-3 py-1.5 text-xs font-medium text-[#A07050] transition hover:bg-[#F0E6D8] active:bg-[#E8D8C8]"
          >
            {t.logout}
          </button>
        </form>
      </div>
    </header>
  );
}
