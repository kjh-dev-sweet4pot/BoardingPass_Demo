"use client";

import { useEffect, useState } from "react";
import { formatKrw } from "@/lib/creator-pool-mock";

/** 데모 온보딩 게이트: 예산 입금 확인 전 대시보드 잠금. */
export const DEMO_BUDGET_KRW = 30_000_000;

function storageKey(companyId: string) {
  return `bp-com-budget-unlocked:${companyId}`;
}

export function readBudgetUnlocked(companyId: string) {
  try {
    return sessionStorage.getItem(storageKey(companyId)) === "1";
  } catch {
    return false;
  }
}

export function writeBudgetUnlocked(companyId: string, unlocked: boolean) {
  try {
    if (unlocked) sessionStorage.setItem(storageKey(companyId), "1");
    else sessionStorage.removeItem(storageKey(companyId));
  } catch {
    /* ignore */
  }
}

export function CompanyBudgetGate({
  companyName,
  onUnlock,
}: {
  companyName: string;
  onUnlock: (via: "deposit" | "bypass") => void;
}) {
  const [bypass, setBypass] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm">
        <p className="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
          Onboarding
        </p>
        <h2
          className="mt-2 text-3xl text-[var(--ink)]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          예산 입금 후 대시보드가 열립니다
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {companyName} 마케팅 풀 · 배정 · 콘텐츠 현황은 집행 예산이 확정·입금된
          뒤 활성화됩니다.
        </p>

        <dl className="mt-6 grid gap-3 rounded-2xl bg-[var(--accent-soft)]/60 px-4 py-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[var(--muted)]">확정 예산</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-[var(--accent)]">
              {formatKrw(DEMO_BUDGET_KRW)}원
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">입금 상태</dt>
            <dd className="mt-1 font-semibold text-[#8a4b12]">확인 대기</dd>
          </div>
        </dl>

        <ol className="mt-6 space-y-2 text-sm text-[var(--ink)]">
          <li className="flex gap-2">
            <span className="font-semibold text-[var(--accent)]">1.</span>
            집행 예산 확정 ({formatKrw(DEMO_BUDGET_KRW)}원)
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-[var(--accent)]">2.</span>
            입금 확인
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-[var(--accent)]">3.</span>
            사이트 대시보드 오픈
          </li>
        </ol>

        <button
          type="button"
          onClick={() => onUnlock("deposit")}
          className="mt-6 w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold !text-white"
        >
          입금 확인 요청
        </button>
        <p className="mt-2 text-center text-xs text-[var(--muted)]">
          데모에서는 요청 후 바로 활성화됩니다
        </p>

        <div className="mt-6 border-t border-[var(--line)] pt-4">
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
            <span>
              <span className="font-medium text-[var(--ink)]">
                데모 Bypass
              </span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                미팅 시연용 · 입금 없이 대시보드 열기
              </span>
            </span>
            <input
              type="checkbox"
              checked={bypass}
              onChange={(e) => {
                const on = e.target.checked;
                setBypass(on);
                if (on) onUnlock("bypass");
              }}
              className="h-4 w-4 accent-[var(--accent)]"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

/** sessionStorage 하이드레이션용 래퍼. */
export function useBudgetGate(companyId: string) {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUnlocked(readBudgetUnlocked(companyId));
    setReady(true);
  }, [companyId]);

  function unlock() {
    writeBudgetUnlocked(companyId, true);
    setUnlocked(true);
  }

  function lock() {
    writeBudgetUnlocked(companyId, false);
    setUnlocked(false);
  }

  return { ready, unlocked, unlock, lock };
}
