"use client";

import { useEffect, useMemo, useState } from "react";
import type { Company } from "@/lib/types";

export function AdminCompanyAutoCollectPanel({
  companies,
  isManager,
  onChanged,
}: {
  companies: Company[];
  isManager: boolean;
  onChanged?: (companies: Company[]) => void;
}) {
  const [list, setList] = useState(companies);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setList(companies), [companies]);

  const visible = useMemo(
    () => [...list].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [list],
  );

  async function toggle(company: Company) {
    if (!isManager) return;
    const next = !(company.auto_collect_enabled ?? true);
    setSavingId(company.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_collect_enabled: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "저장 실패");
      const updated = list.map((c) =>
        c.id === company.id ? { ...c, auto_collect_enabled: next } : c,
      );
      setList(updated);
      onChanged?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted)]">
        켜진 회사만 매시 정각에 자동으로 지표가 수집됩니다. 꺼두면 그 회사 콘텐츠는 자동
        수집·고인게이지 알림에서 제외됩니다.
      </p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="max-w-sm overflow-hidden rounded-[8px] border border-[var(--line)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-hover)] px-4 py-2.5 text-[13px] text-[var(--muted)]">
          <span className="font-medium">회원사</span>
          <span className="font-medium">자동 수집</span>
        </div>
        {visible.map((c) => {
          const enabled = c.auto_collect_enabled ?? true;
          return (
            <div
              key={c.id}
              className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5 text-[13px] last:border-0"
            >
              <span className="font-medium text-[var(--ink)]">{c.name}</span>
              <button
                type="button"
                disabled={!isManager || savingId === c.id}
                onClick={() => toggle(c)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                  enabled ? "bg-[var(--accent)]" : "bg-[var(--line)]"
                } ${!isManager ? "opacity-50" : ""}`}
                aria-pressed={enabled}
                aria-label={`${c.name} 자동 수집 ${enabled ? "끄기" : "켜기"}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    enabled ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          );
        })}
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-[var(--muted)]">
            회원사가 없습니다.
          </p>
        ) : null}
      </div>
    </div>
  );
}
