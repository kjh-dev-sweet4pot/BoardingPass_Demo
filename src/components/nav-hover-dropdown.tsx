"use client";

import { useEffect, useRef, useState } from "react";

export type NavDropdownItem<T extends string> = {
  id: T;
  label: string;
  hint?: string;
};

/** GNB hover flyout — bridge + close delay */
export function NavHoverDropdown<T extends string>({
  label,
  items,
  active,
  selectedId,
  onSelect,
}: {
  label: string;
  items: NavDropdownItem<T>[];
  active: boolean;
  selectedId?: T;
  onSelect: (id: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }
  function hideSoon() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  }
  function hideNow() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPtr = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) hideNow();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hideNow();
    };
    document.addEventListener("mousedown", onPtr);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPtr);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hideSoon}
    >
      <button
        type="button"
        role="tab"
        aria-selected={active}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          onSelect(items[0].id);
          hideNow();
        }}
        className={`inline-flex items-center gap-1 text-[15px] tracking-[-0.02em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
          active
            ? "font-bold text-[var(--ink)]"
            : "font-semibold text-[#cabda7] hover:text-[var(--ink)]"
        }`}
      >
        {label}
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className={`h-3 w-3 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          } ${active ? "text-[var(--ink)]" : "text-[#cabda7]"}`}
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div className="absolute left-1/2 top-full z-30 -translate-x-1/2 pt-2.5">
          <ul
            role="menu"
            className="min-w-[196px] overflow-hidden rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[0_10px_32px_rgba(91,65,48,0.12)]"
          >
            {items.map((item) => {
              const selected = selectedId === item.id;
              return (
                <li key={item.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSelect(item.id);
                      hideNow();
                    }}
                    className={`flex w-full flex-col rounded-[6px] px-3 py-2.5 text-left transition ${
                      selected ? "bg-[var(--accent-soft)]" : "hover:bg-[#faf6f0]"
                    }`}
                  >
                    <span
                      className={`text-[13px] leading-tight ${
                        selected
                          ? "font-semibold text-[var(--accent)]"
                          : "font-medium text-[var(--ink)]"
                      }`}
                    >
                      {item.label}
                    </span>
                    {item.hint ? (
                      <span className="mt-0.5 text-[11px] text-[var(--muted)]">
                        {item.hint}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function NavSubSegment<T extends string>({
  items,
  view,
  onViewChange,
}: {
  items: NavDropdownItem<T>[];
  view: T;
  onViewChange: (v: T) => void;
}) {
  return (
    <div
      className="flex w-full rounded-full border border-[var(--line)] bg-[#f5ede3] p-0.5"
      role="tablist"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={view === item.id}
          onClick={() => onViewChange(item.id)}
          className={`flex-1 rounded-full px-2 py-1.5 text-[11px] font-semibold ${
            view === item.id
              ? "bg-[var(--accent)] !text-white"
              : "text-[var(--muted)]"
          }`}
        >
          {item.label.replace(/^성과 /, "")}
        </button>
      ))}
    </div>
  );
}
