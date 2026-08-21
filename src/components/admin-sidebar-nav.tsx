"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type AdminSection =
  | "dashboard"
  | "performance"
  | "campaigns"
  | "review"
  | "allocations";

const SECTIONS: { id: AdminSection; label: string }[] = [
  { id: "dashboard", label: "대시보드" },
  { id: "performance", label: "성과" },
  { id: "campaigns", label: "캠페인·섭외" },
  { id: "review", label: "검수" },
  { id: "allocations", label: "배정·매장" },
];

function NavButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`rounded-[14px] px-[13px] py-[11px] text-left text-[13.5px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
        active
          ? "bg-[var(--accent)] font-semibold !text-[var(--surface)]"
          : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
      }`}
    >
      {label}
    </button>
  );
}

export function AdminConsoleShell({
  section,
  onSectionChange,
  sidebarActions,
  children,
}: {
  section: AdminSection;
  onSectionChange: (s: AdminSection) => void;
  sidebarActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:grid lg:h-full lg:grid-cols-[216px_minmax(0,1fr)] lg:overflow-hidden">
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
            운영 콘솔
          </p>
        </div>
        {sidebarActions}
      </div>
      <div className="mb-3 flex shrink-0 px-4 lg:hidden">
        <div className="flex w-full gap-0.5 overflow-x-auto rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${
                section === item.id
                  ? "bg-[var(--accent)] !text-white"
                  : "text-[var(--muted)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

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
              운영 콘솔
            </p>
          </div>
        </Link>

        <nav className="mt-[26px] flex flex-col gap-1" aria-label="운영 콘솔 메뉴">
          {SECTIONS.map((item) => (
            <NavButton
              key={item.id}
              active={section === item.id}
              label={item.label}
              onClick={() => onSectionChange(item.id)}
            />
          ))}
        </nav>

        <div className="mt-auto border-t border-[var(--line)] pt-4">
          {sidebarActions ? (
            <div className="flex justify-end">{sidebarActions}</div>
          ) : null}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
