"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  NavHoverDropdown,
  NavSubSegment,
  type NavDropdownItem,
} from "@/components/nav-hover-dropdown";

export type AdminSection =
  | "dashboard"
  | "performance"
  | "performanceLookup"
  | "campaigns"
  | "review"
  | "allocations";

const AFTER_PERF: { id: Exclude<AdminSection, "dashboard" | "performance" | "performanceLookup">; label: string }[] = [
  { id: "campaigns", label: "캠페인·섭외" },
  { id: "review", label: "검수" },
  { id: "allocations", label: "배정·매장" },
];

const PERF: NavDropdownItem<"performance" | "performanceLookup">[] = [
  { id: "performance", label: "성과 대시보드", hint: "캠페인 전체 요약" },
  { id: "performanceLookup", label: "성과 조회", hint: "인플루언서별 상세" },
];

const MOBILE: { id: AdminSection; label: string }[] = [
  { id: "dashboard", label: "대시보드" },
  { id: "performance", label: "성과" },
  { id: "campaigns", label: "캠페인·섭외" },
  { id: "review", label: "검수" },
  { id: "allocations", label: "배정·매장" },
];

function isPerf(s: AdminSection) {
  return s === "performance" || s === "performanceLookup";
}

export function AdminConsoleShell({
  section,
  onSectionChange,
  sidebarActions,
  headerFooter,
  children,
}: {
  section: AdminSection;
  onSectionChange: (s: AdminSection) => void;
  sidebarActions?: ReactNode;
  headerFooter?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/owm-logo.webp" alt="O.W.M" className="h-8 w-8 object-contain" draggable={false} />
          </Link>
          <p className="truncate text-base font-semibold text-[var(--ink)]">운영 콘솔</p>
        </div>
        {sidebarActions}
      </div>
      <div className="mb-2 flex shrink-0 flex-col gap-2 px-4 lg:hidden">
        <div
          className="flex w-full gap-0.5 overflow-x-auto rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-0.5"
          role="tablist"
        >
          {MOBILE.map((item) => {
            const active =
              section === item.id || (item.id === "performance" && isPerf(section));
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSectionChange(item.id)}
                className={`shrink-0 rounded-[6px] px-3 py-2 text-xs font-semibold ${
                  active ? "bg-[var(--accent)] !text-white" : "text-[var(--muted)]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        {isPerf(section) ? (
          <NavSubSegment
            items={PERF}
            view={section as "performance" | "performanceLookup"}
            onViewChange={onSectionChange}
          />
        ) : null}
      </div>

      <header className="hidden shrink-0 items-center gap-6 border-b border-[var(--line)] bg-[var(--surface)] px-8 py-3.5 lg:flex">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/owm-logo.webp" alt="O.W.M" className="h-9 w-9 shrink-0 object-contain" draggable={false} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ink)]">
              Boarding Pass
            </p>
            <p className="truncate text-[15px] font-semibold leading-tight text-[var(--ink)]">
              운영 콘솔
            </p>
          </div>
        </Link>

        <nav
          className="flex min-w-0 flex-1 items-center justify-start gap-8"
          role="tablist"
          aria-label="운영 콘솔 메뉴"
        >
          {/* 순서: 대시보드 → 성과 → 나머지 */}
          <button
            type="button"
            role="tab"
            aria-selected={section === "dashboard"}
            onClick={() => onSectionChange("dashboard")}
            className={`text-[15px] tracking-[-0.02em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
              section === "dashboard"
                ? "font-bold text-[var(--ink)]"
                : "font-semibold text-[#cabda7] hover:text-[var(--ink)]"
            }`}
          >
            대시보드
          </button>
          <NavHoverDropdown
            label="성과"
            items={PERF}
            active={isPerf(section)}
            selectedId={
              isPerf(section) ? (section as "performance" | "performanceLookup") : undefined
            }
            onSelect={onSectionChange}
          />
          {AFTER_PERF.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={section === item.id}
              onClick={() => onSectionChange(item.id)}
              className={`text-[15px] tracking-[-0.02em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
                section === item.id
                  ? "font-bold text-[var(--ink)]"
                  : "font-semibold text-[#cabda7] hover:text-[var(--ink)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3">{sidebarActions}</div>
      </header>

      {headerFooter ? (
        <div className="hidden border-b border-[var(--line)] bg-[var(--surface)] px-8 py-2 text-[11px] leading-relaxed text-[var(--muted)] lg:block">
          {headerFooter}
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
