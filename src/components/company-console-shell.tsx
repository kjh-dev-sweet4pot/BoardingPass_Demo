"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type CompanyConsoleView = "pool" | "content" | "publish" | "alloc";

const TABS: { id: CompanyConsoleView; label: string }[] = [
  { id: "pool", label: "크리에이터" },
  { id: "publish", label: "진행 현황" },
  { id: "alloc", label: "배정 현황" },
  { id: "content", label: "성과" },
];

export function CompanyConsoleShell({
  companyName,
  view,
  onViewChange,
  sidebarExtra,
  sidebarFooter,
  sidebarActions,
  mobileActions,
  children,
}: {
  companyName: string;
  view: CompanyConsoleView;
  onViewChange: (v: CompanyConsoleView) => void;
  sidebarExtra?: ReactNode;
  sidebarFooter?: ReactNode;
  /** 로그아웃 등 */
  sidebarActions?: ReactNode;
  mobileActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* 모바일: 브랜드 + 액션 */}
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/owm-logo.webp"
              alt="O.W.M"
              className="h-8 w-8 object-contain"
              draggable={false}
            />
          </Link>
          <p className="truncate text-base font-semibold text-[var(--ink)]">
            {companyName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sidebarActions}
          {mobileActions}
        </div>
      </div>
      <div className="mb-2 flex shrink-0 px-4 lg:hidden">
        <div
          className="flex w-full rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5"
          role="tablist"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={view === tab.id}
              onClick={() => onViewChange(tab.id)}
              className={`flex-1 rounded-full px-2 py-2 text-xs font-semibold ${
                view === tab.id
                  ? "bg-[var(--accent)] !text-white"
                  : "text-[var(--muted)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 데스크톱: 상단 GNB (Figma 1차 UX) */}
      <header className="hidden shrink-0 items-center gap-6 border-b border-[var(--line)] bg-[var(--surface)] px-8 py-3.5 lg:flex">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/owm-logo.webp"
            alt="O.W.M"
            className="h-9 w-9 shrink-0 object-contain"
            draggable={false}
          />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ink)]">
              Boarding Pass
            </p>
            <p className="truncate text-[15px] font-semibold leading-tight text-[var(--ink)]">
              {companyName}
            </p>
          </div>
        </Link>

        <nav
          className="flex min-w-0 flex-1 items-center justify-start gap-8"
          role="tablist"
        >
          {TABS.map((tab) => {
            const active = view === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onViewChange(tab.id)}
                className={`text-[15px] tracking-[-0.02em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
                  active
                    ? "font-bold text-[var(--ink)]"
                    : "font-semibold text-[#cabda7] hover:text-[var(--ink)]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          {sidebarExtra}
          {sidebarActions}
        </div>
      </header>

      {sidebarFooter ? (
        <p className="hidden border-b border-[var(--line)] bg-[var(--surface)] px-8 py-2 text-[11px] text-[var(--muted)] lg:block">
          {sidebarFooter}
        </p>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
