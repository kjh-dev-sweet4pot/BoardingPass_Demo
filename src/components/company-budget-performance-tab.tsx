"use client";

import { useEffect, useState } from "react";
import { type BudgetPerformancePayload } from "@/lib/company-budget-performance";

function Bar({
  spentPct,
  scheduledPct,
}: {
  spentPct: number;
  scheduledPct: number;
}) {
  const a = Math.max(0, Math.min(100, spentPct));
  const b = Math.max(0, Math.min(100 - a, scheduledPct));
  return (
    <div className="h-3 overflow-hidden rounded-full bg-[#EDE7DC]">
      <div className="flex h-full w-full">
        <span className="h-full bg-[var(--ink)]" style={{ width: `${a}%` }} />
        <span className="h-full bg-[var(--accent)]/70" style={{ width: `${b}%` }} />
      </div>
    </div>
  );
}

export function CompanyBudgetPerformanceTab({
  companyId,
  onMetaChange,
}: {
  companyId: string;
  onMetaChange?: (meta: {
    asOf: string;
    lastCollected: string | null;
    nextCollectAt: string | null;
  }) => void;
}) {
  const [data, setData] = useState<BudgetPerformancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/com/budget-performance", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "예산 성과를 불러오지 못했습니다.");
        if (!cancelled) {
          setData(body as BudgetPerformancePayload);
          setError(null);
          onMetaChange?.({
            asOf: (body as BudgetPerformancePayload).asOf,
            lastCollected: null,
            nextCollectAt: null,
          });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "예산 성과를 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, onMetaChange]);

  if (loading && !data) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--muted)]">
        불러오는 중…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--danger)]">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const done = data.rows.filter((r) => r.kind === "완료").length;
  const scheduled = data.rows.filter((r) => r.kind === "예정").length;
  const total = data.rows.length || 1;
  const spentPct = Math.round((done / total) * 100);
  const scheduledPct = Math.round((scheduled / total) * 100);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 py-4 lg:px-[28px] lg:py-[26px]">
      <div>
        <h2 className="text-[22px] font-bold leading-tight tracking-[-0.04em] text-[var(--ink)] lg:text-[32px]">
          예산 성과
        </h2>
        <p className="mt-1 text-[13px] text-[var(--muted)]">
          배정 진행 현황 · {data.asOf} 조회 시점 기준
        </p>
      </div>

      <div className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[12px] text-[var(--muted)]">배정</p>
            <p className="text-[22px] font-extrabold tabular-nums text-[var(--ink)]">
              {data.rows.length}건
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-[12.5px]">
            <span className="inline-flex items-center gap-1.5 text-[var(--ink)]">
              <i className="h-2.5 w-2.5 rounded-sm bg-[var(--ink)]" />
              발행완료 {done}건
            </span>
            <span className="inline-flex items-center gap-1.5 text-[var(--accent)]">
              <i className="h-2.5 w-2.5 rounded-sm bg-[var(--accent)] opacity-70" />
              진행중 {scheduled}건
            </span>
          </div>
        </div>
        <Bar spentPct={spentPct} scheduledPct={scheduledPct} />
      </div>

      <div className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h3 className="text-sm font-bold text-[var(--ink)]">배정</h3>
        </div>
        {data.rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[var(--muted)]">
            표시할 배정이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="bg-[var(--surface-hover)] text-[11px] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">인플루언서</th>
                  <th className="px-4 py-2.5 font-medium">상품</th>
                  <th className="px-4 py-2.5 font-medium">단계</th>
                  <th className="px-4 py-2.5 font-medium">구분</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.allocationId}
                    className="border-t border-[var(--line)]"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--ink)]">{row.name}</p>
                      <p className="text-[11.5px] text-[var(--muted)]">
                        {row.handle}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[var(--ink)]">{row.product}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.stage}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          row.kind === "완료"
                            ? "bg-[var(--ink)] text-white"
                            : "bg-[var(--accent-soft)] text-[var(--accent)]"
                        }`}
                      >
                        {row.kind === "완료" ? "실제 진행 완료" : "차감 예정"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
