"use client";

import { useEffect, useRef, useState } from "react";
import { InfAllocationList } from "@/components/inf-allocation-list";
import {
  type AllocationWithRelations,
  type Influencer,
} from "@/lib/types";

type Phase = "form" | "welcome" | "ready";

const WELCOME_MIN_MS = 1600;
const WELCOME_EXIT_MS = 480;

function displayName(inf: Pick<Influencer, "name" | "instagram_handle">) {
  const name = (inf.name || "").trim();
  if (name) return name;
  const handle = (inf.instagram_handle || "").replace(/^@+/, "").trim();
  return handle || "게스트";
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
          {name}님 환영합니다
        </h1>
        <p className="mt-2 text-sm tracking-wide text-[#B09070]">
          {exiting
            ? "상품 목록으로 이동 중…"
            : loading
              ? "방문 정보를 불러오는 중…"
              : "열심히 불러오고 있어요!"}
        </p>
      </div>
    </div>
  );
}

export function InfLoginClient({ initialError }: { initialError?: string }) {
  const [phase, setPhase] = useState<Phase>("form");
  const [handle, setHandle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(initialError);
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
    return () => {
      if (welcomeTimer.current) window.clearTimeout(welcomeTimer.current);
      if (exitTimer.current) window.clearTimeout(exitTimer.current);
    };
  }, []);

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
        throw new Error(body.error || "배정 정보를 불러오지 못했습니다.");
      }
      if (body.influencer) {
        setInfluencer(body.influencer as Influencer);
      }
      setAllocations((body.allocations as AllocationWithRelations[]) || []);
      setDataReady(true);
    } catch (err) {
      setBootstrapError(
        err instanceof Error ? err.message : "배정 정보를 불러오지 못했습니다.",
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
        throw new Error(body.error || "본인확인에 실패했습니다.");
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
        err instanceof Error ? err.message : "본인확인 중 오류가 발생했습니다.",
      );
      setPhase("form");
    } finally {
      setPending(false);
    }
  }

  if (phase === "ready" && influencer) {
    return (
      <div className="inf-content-enter flex min-h-screen flex-col bg-white">
        <header className="flex items-center justify-between px-5 pt-10 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/owm-logo.webp"
            alt="O.W.M"
            className="w-20"
            draggable={false}
          />
          <form action="/api/inf/clear" method="post">
            <button
              type="submit"
              className="rounded-full px-3 py-1.5 text-xs font-medium text-[#A07050] transition hover:bg-[#F0E6D8] active:bg-[#E8D8C8]"
            >
              로그아웃
            </button>
          </form>
        </header>
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
      <div className="flex min-h-screen flex-col bg-white">
        <WelcomeScreen
          name={displayName(influencer)}
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
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex flex-1 flex-col items-center justify-center px-8">
        <div className="owm-login-logo mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/owm-logo.webp"
            alt="O.W.M 옵티마 웰니스 뮤지엄 약국"
            className="w-52"
            draggable={false}
          />
        </div>

        <div className="owm-login-divider mb-10 h-px w-10 bg-[#C4956A]" />

        <div className="owm-login-title mb-8 text-center">
          <h1 className="text-[1.15rem] font-semibold tracking-wide text-[#3D1F0A]">
            SNS 아이디를 입력해주세요
          </h1>
          <p className="mt-2 text-sm tracking-wide text-[#B09070]">
            샤오홍슈 · 인스타그램 · 틱톡
          </p>
        </div>

        {error ? (
          <div className="mb-5 w-full max-w-[320px] rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm text-red-400">
            {error}
          </div>
        ) : null}

        <form
          onSubmit={onSubmit}
          className="owm-login-form w-full max-w-[320px] space-y-3"
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
            {pending ? "확인 중…" : "확인"}
          </button>
        </form>
      </div>

      <div className="pb-10 text-center">
        <p className="text-[0.58rem] tracking-[0.2em] text-[#C4956A] uppercase">
          Optima Wellness Museum Pharmacy
        </p>
      </div>
    </div>
  );
}
