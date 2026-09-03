"use client";

import type { ReactNode } from "react";
import {
  NavHoverDropdown,
  NavSubSegment,
  type NavDropdownItem,
} from "@/components/nav-hover-dropdown";

export type CompanyConsoleView =
  | "home"
  | "pool"
  | "publish"
  | "alloc"
  | "content"
  | "contentLookup"
  | "budgetPerformance";

type PerformanceView = "content" | "contentLookup" | "budgetPerformance";

const MAIN_TABS: {
  id: Exclude<CompanyConsoleView, PerformanceView>;
  label: string;
}[] = [
  { id: "home", label: "홈" },
  { id: "pool", label: "크리에이터" },
  { id: "publish", label: "진행 현황" },
  { id: "alloc", label: "배정 현황" },
];

const PERFORMANCE_ITEMS: NavDropdownItem<PerformanceView>[] = [
  { id: "content", label: "성과 대시보드", hint: "캠페인 전체 요약" },
  { id: "contentLookup", label: "성과 조회", hint: "인플루언서별 상세" },
  { id: "budgetPerformance", label: "예산 성과", hint: "노출가 사용·차감 예정" },
];

const MOBILE_TABS: { id: CompanyConsoleView; label: string }[] = [
  { id: "home", label: "홈" },
  { id: "pool", label: "크리에이터" },
  { id: "publish", label: "진행 현황" },
  { id: "alloc", label: "배정 현황" },
  { id: "content", label: "성과" },
];

function isPerformanceView(v: CompanyConsoleView): v is PerformanceView {
  return (
    v === "content" || v === "contentLookup" || v === "budgetPerformance"
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
  sidebarActions?: ReactNode;
  mobileActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => onViewChange("home")}
          className="flex min-w-0 items-center gap-2.5 text-left"
          aria-label="요약 홈"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/owm-logo.webp"
            alt=""
            className="h-8 w-8 object-contain"
            draggable={false}
          />
          <p className="truncate text-base font-semibold text-[var(--ink)]">
            {companyName}
          </p>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {sidebarActions}
          {mobileActions}
        </div>
      </div>
      <div className="mb-2 flex shrink-0 flex-col gap-2 px-4 lg:hidden">
        <div
          className="flex w-full rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5"
          role="tablist"
        >
          {MOBILE_TABS.map((tab) => {
            const active =
              tab.id === view ||
              (tab.id === "content" && isPerformanceView(view));
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onViewChange(tab.id)}
                className={`flex-1 rounded-full px-2 py-2 text-xs font-semibold ${
                  active
                    ? "bg-[var(--accent)] !text-white"
                    : "text-[var(--muted)]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {isPerformanceView(view) ? (
          <NavSubSegment
            items={PERFORMANCE_ITEMS}
            view={view}
            onViewChange={onViewChange}
          />
        ) : null}
      </div>

      <header className="hidden shrink-0 items-center gap-6 border-b border-[var(--line)] bg-[var(--surface)] px-8 py-3.5 lg:flex">
        <button
          type="button"
          onClick={() => onViewChange("home")}
          className="flex min-w-0 shrink-0 items-center gap-2.5 text-left"
          aria-label="요약 홈"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/owm-logo.webp"
            alt=""
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
        </button>

        <nav
          className="flex min-w-0 flex-1 items-center justify-start gap-8"
          role="tablist"
        >
          {MAIN_TABS.map((tab) => {
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

          <NavHoverDropdown
            label="성과"
            items={PERFORMANCE_ITEMS}
            active={isPerformanceView(view)}
            selectedId={isPerformanceView(view) ? view : undefined}
            onSelect={onViewChange}
          />
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          {sidebarExtra}
          {sidebarActions}
        </div>
      </header>

      {sidebarFooter ? (
        <div className="hidden border-b border-[var(--line)] bg-[var(--surface)] px-8 py-2 text-[11px] text-[var(--muted)] lg:block">
          {sidebarFooter}
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
