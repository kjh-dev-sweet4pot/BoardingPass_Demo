"use client";

export type AdminSection = "dashboard" | "campaigns" | "review" | "allocations";

const SECTIONS: { id: AdminSection; label: string }[] = [
  { id: "dashboard", label: "대시보드" },
  { id: "campaigns", label: "캠페인·섭외" },
  { id: "review", label: "검수" },
  { id: "allocations", label: "배정·매장" },
];

export function AdminSidebarNav({
  section,
  onSectionChange,
}: {
  section: AdminSection;
  onSectionChange: (s: AdminSection) => void;
}) {
  return (
    <nav
      className="flex flex-col gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-sm"
      aria-label="운영 콘솔 메뉴"
    >
      {SECTIONS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSectionChange(item.id)}
          aria-current={section === item.id ? "page" : undefined}
          className={`rounded-xl px-3 py-2.5 text-left text-sm transition ${
            section === item.id
              ? "bg-[var(--accent)] font-semibold text-[var(--surface)]"
              : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
