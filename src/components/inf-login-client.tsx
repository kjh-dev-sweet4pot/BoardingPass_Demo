"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { InfAppHeader } from "@/components/inf-app-header";
import {
  InfLanguageToggle,
  useInfLocale,
} from "@/components/inf-locale-provider";
import { translateInfApiError } from "@/lib/inf-i18n";
import {
  type AllocationWithRelations,
  type Influencer,
} from "@/lib/types";

/** 로그인 화면에서는 목록 번들을 미리 안 받아 첫 페인트 빠르게 */
const InfAllocationList = dynamic(
  () =>
    import("@/components/inf-allocation-list").then((m) => m.InfAllocationList),
  {
    ssr: false,
    loading: () => <ListPreparing />,
  },
);

function ListPreparing() {
  const { t } = useInfLocale();
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <p className="text-sm text-[#B09070]">{t.listPreparing}</p>
    </div>
  );
}

type Phase = "form" | "welcome" | "ready";

const WELCOME_MIN_MS = 1600;
const WELCOME_EXIT_MS = 480;

function displayName(
  inf: Pick<Influencer, "name" | "instagram_handle">,
  guest: string,
) {
  const name = (inf.name || "").trim();
  if (name) return name;
  const handle = (inf.instagram_handle || "").replace(/^@+/, "").trim();
  return handle || guest;
}

function WelcomeScreen({
  name,
  loading,
  exiting,
}: {
  name: string;
  loading: boolean;
  exiting?: boolean;
}) {
  const { t } = useInfLocale();

  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center px-8 text-center ${
        exiting ? "inf-welcome-exit" : ""
      }`}
    >
      <div className="inf-check-wrap relative mb-6 flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[#6B3B1F]/10" />
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle
            className="inf-check-ring"
            cx="20"
            cy="20"
            r="16"
            stroke="#6B3B1F"
            strokeWidth="2"
            strokeOpacity=".45"
            fill="none"
          />
          <path
            className="inf-check-mark"
            d="M13 20l5.5 5.5 9.5-10"
            stroke="#6B3B1F"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>

      <div className="inf-greet-text">
        <p className="text-[0.62rem] font-medium tracking-[0.28em] text-[#C4956A] uppercase">
          Welcome
        </p>
        <h1 className="mt-3 text-[1.35rem] font-semibold tracking-wide text-[#3D1F0A]">
          {t.welcomeName(name)}
        </h1>
        <p className="mt-2 text-sm tracking-wide text-[#B09070]">
          {exiting
            ? t.movingToList
            : loading
              ? t.loadingVisitInfo
              : t.loadingHard}
        </p>
      </div>
    </div>
  );
}

export function InfLoginClient({ initialError }: { initialError?: string }) {
  const { t } = useInfLocale();
  const [phase, setPhase] = useState<Phase>("form");
  const [handle, setHandle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [influencer, setInfluencer] = useState<Influencer | null>(null);
  const [allocations, setAllocations] = useState<AllocationWithRelations[]>(
    [],
  );
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [welcomeExiting, setWelcomeExiting] = useState(false);
  const welcomeTimer = useRef<number | null>(null);
  const exitTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!initialError) {
      setError(undefined);
      return;
    }
    setError(translateInfApiError(initialError, t));
  }, [initialError, t]);

  useEffect(() => {
    return () => {
      if (welcomeTimer.current) window.clearTimeout(welcomeTimer.current);
      if (exitTimer.current) window.clearTimeout(exitTimer.current);
    };
  }, []);

  /** 환영 화면 동안 목록 청크를 미리 받아 전환 지연 제거 */
  useEffect(() => {
    if (phase !== "welcome") return;
    void import("@/components/inf-allocation-list");
  }, [phase]);

  useEffect(() => {
    if (
      phase !== "welcome" ||
      !welcomeDone ||
      !dataReady ||
      !influencer ||
      welcomeExiting
    ) {
      return;
    }

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      setPhase("ready");
      return;
    }

    setWelcomeExiting(true);
    exitTimer.current = window.setTimeout(() => {
      setPhase("ready");
      setWelcomeExiting(false);
    }, WELCOME_EXIT_MS);
  }, [phase, welcomeDone, dataReady, influencer, welcomeExiting]);

  async function runBootstrap() {
    setBootstrapLoading(true);
    setBootstrapError(null);
    try {
      const res = await fetch("/api/inf/bootstrap", {
        method: "POST",
        credentials: "same-origin",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || t.bootstrapFailed);
      }
      if (body.influencer) {
        setInfluencer(body.influencer as Influencer);
      }
      setAllocations((body.allocations as AllocationWithRelations[]) || []);
      setDataReady(true);
    } catch (err) {
      setBootstrapError(
        translateInfApiError(
          err instanceof Error ? err.message : t.bootstrapFailed,
          t,
        ),
      );
      setDataReady(true);
    } finally {
      setBootstrapLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(undefined);
    setBootstrapError(null);

    try {
      const res = await fetch("/api/inf/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ instagram_handle: handle }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || t.verifyFailed);
      }

      const inf = body.influencer as Influencer;
      setInfluencer(inf);
      setPhase("welcome");
      setWelcomeDone(false);
      setDataReady(false);
      setWelcomeExiting(false);

      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      welcomeTimer.current = window.setTimeout(
        () => setWelcomeDone(true),
        reduceMotion ? 0 : WELCOME_MIN_MS,
      );

      void runBootstrap();
    } catch (err) {
      setError(
        translateInfApiError(
          err instanceof Error ? err.message : t.verifyError,
          t,
        ),
      );
      setPhase("form");
    } finally {
      setPending(false);
    }
  }

  if (phase === "ready" && influencer) {
    return (
      <div className="inf-content-enter flex min-h-screen flex-col bg-white">
        <InfAppHeader />
        <main className="flex flex-1 flex-col">
          {bootstrapError ? (
            <p className="mx-6 mb-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm text-red-400">
              {bootstrapError}
            </p>
          ) : null}
          <InfAllocationList
            influencer={influencer}
            initialAllocations={allocations}
            fromWelcome
          />
        </main>
      </div>
    );
  }

  if (phase === "welcome" && influencer) {
    return (
      <div className="relative flex min-h-screen flex-col bg-white">
        <div className="absolute top-5 right-4 z-10">
          <InfLanguageToggle compact />
        </div>
        <WelcomeScreen
          name={displayName(influencer, t.guest)}
          loading={bootstrapLoading || !dataReady}
          exiting={welcomeExiting}
        />
        <div className="pb-10 text-center">
          <p className="text-[0.58rem] tracking-[0.2em] text-[#C4956A] uppercase">
            Optima Wellness Museum Pharmacy
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-white">
      <div className="absolute top-5 right-4 z-10">
        <InfLanguageToggle />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-8">
        <div className="inf-entry-logo mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/owm-logo.webp"
            alt="O.W.M"
            className="w-52"
            width={208}
            height={208}
            decoding="async"
            fetchPriority="high"
            draggable={false}
          />
        </div>

        <div className="inf-entry-reveal mb-10 h-px w-10 bg-[#C4956A]" />

        <div className="inf-entry-reveal mb-8 text-center">
          <h1 className="text-[1.15rem] font-semibold tracking-wide text-[#3D1F0A]">
            {t.enterSnsId}
          </h1>
          <p className="mt-2 text-sm tracking-wide text-[#B09070]">
            {t.snsPlatforms}
          </p>
        </div>

        {error ? (
          <div className="inf-entry-reveal mb-5 w-full max-w-[320px] rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm text-red-400">
            {error}
          </div>
        ) : null}

        <form
          onSubmit={onSubmit}
          className="inf-entry-reveal-late w-full max-w-[320px] space-y-3"
        >
          <input
            name="instagram_handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@your_id"
            required
            autoComplete="off"
            disabled={pending}
            className="w-full rounded-2xl border border-[#E8D5BE] bg-white px-5 py-4 text-sm text-[#3D1F0A] outline-none transition placeholder:text-[#C9AA88] focus:border-[#6B3B1F] focus:ring-2 focus:ring-[#6B3B1F]/10 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-[#6B3B1F] py-4 text-sm font-semibold tracking-wide text-white transition hover:bg-[#7D4726] active:brightness-90 disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? t.confirming : t.confirm}
          </button>
        </form>
      </div>

      <div className="inf-entry-reveal-late pb-10 text-center">
        <p className="text-[0.58rem] tracking-[0.2em] text-[#C4956A] uppercase">
          Optima Wellness Museum Pharmacy
        </p>
      </div>
    </div>
  );
}
