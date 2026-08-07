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
  size = "full",
}: {
  className?: string;
  /** full: 로그인용 전체 토글 / mini: 로그인 후 현재 언어만 작게 */
  size?: "full" | "mini";
}) {
  const { locale, setLocale } = useInfLocale();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-inf-lang-mini]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (size === "mini") {
    return (
      <div className={`relative ${className}`} data-inf-lang-mini>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="Language"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-[#E8D5BE] bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#A07050] transition hover:bg-[#F5EDE3]"
        >
          {INF_LOCALE_LABEL[locale]}
        </button>
        {open ? (
          <ul
            role="listbox"
            className="absolute right-0 top-full z-20 mt-1 min-w-[5.5rem] overflow-hidden rounded-xl border border-[#E8D5BE] bg-white py-1 shadow-lg"
          >
            {INF_LOCALES.map((code) => {
              const active = locale === code;
              return (
                <li key={code} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => {
                      setLocale(code);
                      setOpen(false);
                    }}
                    className={`block w-full px-3 py-1.5 text-left text-[11px] font-semibold ${
                      active
                        ? "bg-[#F5EDE3] text-[#6B3B1F]"
                        : "text-[#A07050] hover:bg-[#Faf6f1]"
                    }`}
                  >
                    {INF_LOCALE_LABEL[code]}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    );
  }

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
            className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold tracking-wide transition ${
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
