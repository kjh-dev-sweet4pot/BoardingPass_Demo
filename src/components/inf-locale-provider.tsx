"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  INF_LOCALE_LABEL,
  INF_LOCALE_STORAGE_KEY,
  INF_LOCALES,
  INF_MESSAGES,
  isInfLocale,
  type InfLocale,
  type InfMessages,
} from "@/lib/inf-i18n";

type InfLocaleContextValue = {
  locale: InfLocale;
  setLocale: (locale: InfLocale) => void;
  t: InfMessages;
};

const InfLocaleContext = createContext<InfLocaleContextValue | null>(null);

function readStoredLocale(): InfLocale {
  if (typeof window === "undefined") return "ko";
  try {
    const raw = window.localStorage.getItem(INF_LOCALE_STORAGE_KEY);
    if (isInfLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "ko";
}

export function InfLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<InfLocale>("ko");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLocaleState(readStoredLocale());
    setHydrated(true);
  }, []);

  const setLocale = useCallback((next: InfLocale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(INF_LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: INF_MESSAGES[locale],
    }),
    [locale, setLocale],
  );

  return (
    <InfLocaleContext.Provider value={value}>
      <div lang={hydrated ? locale : undefined} className="contents">
        {children}
      </div>
    </InfLocaleContext.Provider>
  );
}

export function useInfLocale() {
  const ctx = useContext(InfLocaleContext);
  if (!ctx) {
    throw new Error("useInfLocale must be used within InfLocaleProvider");
  }
  return ctx;
}

export function InfLanguageToggle({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { locale, setLocale } = useInfLocale();

  return (
    <div
      className={`flex items-center gap-0.5 rounded-full border border-[#E8D5BE] bg-white/90 p-0.5 shadow-sm backdrop-blur-sm ${className}`}
      role="group"
      aria-label="Language"
    >
      {INF_LOCALES.map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            onClick={() => setLocale(code)}
            className={`rounded-full font-semibold tracking-wide transition ${
              compact
                ? "px-2 py-1 text-[10px]"
                : "px-2.5 py-1.5 text-[11px]"
            } ${
              active
                ? "bg-[#6B3B1F] text-white"
                : "text-[#A07050] hover:bg-[#F5EDE3]"
            }`}
          >
            {INF_LOCALE_LABEL[code]}
          </button>
        );
      })}
    </div>
  );
}
