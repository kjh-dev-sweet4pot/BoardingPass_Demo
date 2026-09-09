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
  | "companies"
  | "companiesRegister"
  | "companiesMail"
  | "companiesDocs"
  | "influencersRegister"
  | "influencersReview"
  | "influencersAlloc"
  | "campaigns";

const AFTER_PERF: { id: "campaigns"; label: string }[] = [
  { id: "campaigns", label: "캠페인·섭외" },
];

export const COMPANIES_NAV: NavDropdownItem<
  "companies" | "companiesRegister" | "companiesMail" | "companiesDocs"
>[] = [
  { id: "companies", label: "목록", hint: "회원사 조회" },
  { id: "companiesRegister", label: "등록", hint: "회원사 개설" },
  { id: "companiesDocs", label: "계약·인보이스", hint: "양식 작성·인쇄" },
  { id: "companiesMail", label: "메일 발송", hint: "계약서·견적서·가이드라인" },
];

export const INFLUENCERS_NAV: NavDropdownItem<
  "influencersRegister" | "influencersReview" | "influencersAlloc"
>[] = [
  { id: "influencersRegister", label: "등록", hint: "인플루언서 개설·수정" },
  { id: "influencersReview", label: "검수", hint: "콘텐츠 승인·반려" },
  { id: "influencersAlloc", label: "배정·매장", hint: "방문 배정·지점" },
];

const PERF: NavDropdownItem<"performance" | "performanceLookup">[] = [
  { id: "performance", label: "성과 대시보드", hint: "캠페인 전체 요약" },
  { id: "performanceLookup", label: "성과 조회", hint: "인플루언서별 상세" },
];

const MOBILE: { id: AdminSection; label: string }[] = [
  { id: "dashboard", label: "대시보드" },
  { id: "performance", label: "성과" },
  { id: "companies", label: "회원사" },
  { id: "influencersRegister", label: "인플루언서" },
  { id: "campaigns", label: "캠페인·섭외" },
];

function isPerf(s: AdminSection) {
  return s === "performance" || s === "performanceLookup";
}

function isCompanies(s: AdminSection) {
  return s === "companies" || s === "companiesRegister" || s === "companiesMail" || s === "companiesDocs";
}

function isInfluencers(s: AdminSection) {
  return (
    s === "influencersRegister" ||
    s === "influencersReview" ||
    s === "influencersAlloc"
  );
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
              section === item.id ||
              (item.id === "performance" && isPerf(section)) ||
              (item.id === "companies" && isCompanies(section)) ||
              (item.id === "influencersRegister" && isInfluencers(section));
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
        {isCompanies(section) ? (
          <NavSubSegment
            items={COMPANIES_NAV}
            view={section as "companies" | "companiesRegister" | "companiesMail" | "companiesDocs"}
            onViewChange={onSectionChange}
          />
        ) : null}
        {isInfluencers(section) ? (
          <NavSubSegment
            items={INFLUENCERS_NAV}
            view={
              section as
                | "influencersRegister"
                | "influencersReview"
                | "influencersAlloc"
            }
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
          <NavHoverDropdown
            label="회원사"
            items={COMPANIES_NAV}
            active={isCompanies(section)}
            selectedId={
              isCompanies(section)
                ? (section as "companies" | "companiesRegister" | "companiesMail" | "companiesDocs")
                : undefined
            }
            onSelect={onSectionChange}
          />
          <NavHoverDropdown
            label="인플루언서"
            items={INFLUENCERS_NAV}
            active={isInfluencers(section)}
            selectedId={
              isInfluencers(section)
                ? (section as
                    | "influencersRegister"
                    | "influencersReview"
                    | "influencersAlloc")
                : undefined
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
