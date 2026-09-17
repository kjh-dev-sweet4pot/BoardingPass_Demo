"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui";
import { formatManwon } from "@/lib/company-budget-rounds";
import { MARGIN_STATE_COLOR, type Company } from "@/lib/types";

type MarginRow = {
  campaign_id: string;
  campaign_name: string | null;
  campaign_status: string;
  company_id: string;
  company_name: string | null;
  revenue: number | null;
  committed_margin_rate: number | null;
  realized_margin_rate: number | null;
  burn_rate: number | null;
  spend_pct: number | null;
  target_publish_count: number | null;
  published_count: number;
  margin_state: "over" | "ok" | "caution" | "risk" | "unknown";
};

const MARGIN_STATE_LABEL: Record<MarginRow["margin_state"], string> = {
  over: "과다 마진",
  ok: "정상",
  caution: "주의",
  risk: "위험",
  unknown: "산정 불가",
};

function rateText(v: number | null) {
  return v === null ? "—" : `${v}%`;
}

export function AdminMarginOverviewPanel({
  companies,
  onSelectCampaign,
}: {
  companies: Company[];
  onSelectCampaign: (campaignId: string) => void;
}) {
  const [rows, setRows] = useState<MarginRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [companyId, setCompanyId] = useState("");
  const [marginStateFilter, setMarginStateFilter] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (companyId) params.set("company_id", companyId);
    if (marginStateFilter) params.set("margin_state", marginStateFilter);
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/admin/margin/overview?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        setRows(data.rows || []);
        setTotal(data.total || 0);
        setError(null);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, companyId, marginStateFilter, q]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-10 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"
          value={companyId}
          onChange={(e) => {
            setPage(1);
            setCompanyId(e.target.value);
          }}
        >
          <option value="">전체 회원사</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"
          value={marginStateFilter}
          onChange={(e) => {
            setPage(1);
            setMarginStateFilter(e.target.value);
          }}
        >
          <option value="">전체 상태</option>
          {(["over", "ok", "caution", "risk", "unknown"] as const).map((s) => (
            <option key={s} value={s}>
              {MARGIN_STATE_LABEL[s]}
            </option>
          ))}
        </select>
        <input
          className="h-10 flex-1 min-w-[160px] rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
          placeholder="캠페인명 검색"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-[8px] border border-[var(--line)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[var(--surface)] text-[var(--muted)]">
            <tr className="border-b border-[var(--line)] text-left">
              <th className="px-3 py-2">캠페인</th>
              <th className="px-3 py-2">회원사</th>
              <th className="px-3 py-2 text-right">예산</th>
              <th className="px-3 py-2 text-right">집행 기준 마진</th>
              <th className="px-3 py-2 text-right">완료 기준 마진</th>
              <th className="px-3 py-2 text-right">소진율</th>
              <th className="px-3 py-2">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.campaign_id}
                className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-hover)]"
                onClick={() => onSelectCampaign(r.campaign_id)}
              >
                <td className="px-3 py-2">{r.campaign_name || "(제목 없음)"}</td>
                <td className="px-3 py-2">{r.company_name || "—"}</td>
                <td className="px-3 py-2 text-right">{formatManwon(r.revenue)}</td>
                <td className="px-3 py-2 text-right">{rateText(r.committed_margin_rate)}</td>
                <td className="px-3 py-2 text-right">{rateText(r.realized_margin_rate)}</td>
                <td className="px-3 py-2 text-right">{rateText(r.burn_rate)}</td>
                <td className="px-3 py-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: MARGIN_STATE_COLOR[r.margin_state] }}
                  >
                    {MARGIN_STATE_LABEL[r.margin_state]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 ? (
          <EmptyState title="조건에 맞는 캠페인이 없습니다." positive />
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 text-sm text-[var(--muted)]">
        <button
          type="button"
          disabled={page <= 1}
          className="disabled:opacity-40"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          이전
        </button>
        <span>
          {page} / {Math.max(1, Math.ceil(total / 20))}
        </span>
        <button
          type="button"
          disabled={page * 20 >= total}
          className="disabled:opacity-40"
          onClick={() => setPage((p) => p + 1)}
        >
          다음
        </button>
      </div>
    </div>
  );
}
