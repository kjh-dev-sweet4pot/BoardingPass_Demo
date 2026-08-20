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

function TabButton({
  active,
  label,
  onClick,
  className = "",
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-[14px] px-[13px] py-[11px] text-left text-[13.5px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
        active
          ? "bg-[var(--accent)] font-semibold !text-[var(--surface)]"
          : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
      } ${className}`}
    >
      {label}
    </button>
  );
}

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
  /** 로그아웃 등 — 사이드바 상단 헤더 대체 */
  sidebarActions?: ReactNode;
  mobileActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:grid lg:h-full lg:grid-cols-[216px_minmax(0,1fr)] lg:overflow-hidden">
      {/* 모바일/태블릿: pill 탭 + 액션 */}
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3 lg:hidden">
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
          <p
            className="truncate text-base font-semibold text-[var(--ink)]"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {companyName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sidebarActions}
          {mobileActions}
        </div>
      </div>
      <div className="mb-3 flex shrink-0 px-4 lg:hidden">
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

      {/* 데스크톱: 좌측 사이드바 = 앱 헤더 */}
      <aside className="hidden min-h-0 flex-col border-[var(--line)] bg-[var(--surface)] lg:flex lg:h-full lg:border-r lg:px-[18px] lg:py-[22px]">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/owm-logo.webp"
            alt="O.W.M"
            className="h-[34px] w-[34px] shrink-0 object-contain"
            draggable={false}
          />
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Boarding Pass
            </p>
            <p
              className="mt-1 truncate text-[17px] font-semibold leading-tight text-[var(--ink)]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              {companyName}
            </p>
          </div>
        </Link>

        <nav className="mt-[26px] flex flex-col gap-1" role="tablist">
          {TABS.map((tab) => (
            <TabButton
              key={tab.id}
              active={view === tab.id}
              label={tab.label}
              onClick={() => onViewChange(tab.id)}
            />
          ))}
        </nav>

        {sidebarExtra ? <div className="mt-[26px]">{sidebarExtra}</div> : null}

        <div className="mt-auto border-t border-[var(--line)] pt-4">
          {sidebarFooter ? (
            <div className="text-[11.5px] leading-[1.65] text-[var(--muted)]">
              {sidebarFooter}
            </div>
          ) : null}
          {sidebarActions ? (
            <div className={`flex justify-end ${sidebarFooter ? "mt-3" : ""}`}>
              {sidebarActions}
            </div>
          ) : null}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
