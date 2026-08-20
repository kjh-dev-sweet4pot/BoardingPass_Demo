"use client";

import { useEffect, useMemo, useState } from "react";
import { type Company } from "@/lib/types";

type Queues = {
  reviewPending: number;
  verifyFailed: number;
  collectFailed: number;
  publishStale: number;
  castingStale: number;
};

type Performance = {
  posts: number;
  views: number;
  likes: number;
  comments: number;
  er: number;
};

type Budget = {
  exposureFee: number;
  costFee?: number;
  margin?: number;
};

type DashboardData = {
  queues: Queues;
  performance: Performance;
  budget: Budget;
};

function fmt(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  return n.toLocaleString("ko-KR");
}

function fmtKrw(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}만`;
  return n.toLocaleString("ko-KR");
}

// ── 큐 카드 ──────────────────────────────────────────────────────────────
function QueueCard({
  label,
  count,
  warn,
}: {
  label: string;
  count: number;
  warn?: boolean;
}) {
  const isEmpty = count === 0;
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        isEmpty
          ? "border-[var(--line)] bg-white"
          : warn
            ? "border-red-200 bg-red-50"
            : "border-amber-200 bg-amber-50"
      }`}
    >
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          isEmpty ? "text-[var(--muted)]" : warn ? "text-red-600" : "text-amber-700"
        }`}
      >
        {isEmpty ? "—" : count}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
        {isEmpty ? "처리 대기 없음" : "건"}
      </p>
    </div>
  );
}

// ── KPI 카드 ──────────────────────────────────────────────────────────────
function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-[var(--ink)]">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

// ── 메인 ──────────────────────────────────────────────────────────────────
export function AdminDashboard({ companies }: { companies: Company[] }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (companyId) qs.set("company_id", companyId);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    fetch(`/api/admin/dashboard${qs.size ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId, from, to]);

  const queues = data?.queues;
  const perf = data?.performance;
  const budget = data?.budget;
  const hasMargin = budget && "margin" in budget;

  return (
    <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      <div className="px-5 py-4 border-b border-[var(--line)]">
        <h2
          className="text-lg text-[var(--ink)]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          대시보드
        </h2>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* 처리 대기 큐 */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            처리 대기
          </p>
          {loading ? (
            <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <QueueCard label="검수 대기" count={queues?.reviewPending ?? 0} />
              <QueueCard label="검증 실패" count={queues?.verifyFailed ?? 0} warn />
              <QueueCard label="수집 실패" count={queues?.collectFailed ?? 0} warn />
              <QueueCard label="발행 미이행" count={queues?.publishStale ?? 0} />
              <QueueCard label="섭외 정체" count={queues?.castingStale ?? 0} />
            </div>
          )}
        </div>

        {/* 필터 */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            성과 조회
          </p>
          <div className="flex flex-wrap gap-2">
            <select
              className="h-9 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">회원사 전체</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              type="date"
              className="h-9 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
              value={from}
              max={to || today}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span className="self-center text-xs text-[var(--muted)]">~</span>
            <input
              type="date"
              className="h-9 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
            />
            {(companyId || from || to) && (
              <button
                type="button"
                className="h-9 rounded-xl border border-[var(--line)] bg-white px-3 text-xs text-[var(--muted)] hover:bg-[var(--surface)]"
                onClick={() => { setCompanyId(""); setFrom(""); setTo(""); }}
              >
                초기화
              </button>
            )}
          </div>
        </div>

        {/* 성과 KPI */}
        {loading ? (
          <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
        ) : perf && perf.posts > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label="발행 콘텐츠" value={`${perf.posts}건`} />
            <Kpi label="조회수" value={fmt(perf.views)} />
            <Kpi label="좋아요" value={fmt(perf.likes)} />
            <Kpi label="댓글" value={fmt(perf.comments)} />
            <Kpi label="참여율 (ER)" value={`${perf.er.toFixed(2)}%`} />
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            {perf ? "해당 기간에 발행된 콘텐츠가 없습니다." : "—"}
          </p>
        )}

        {/* 예산 */}
        {budget && (budget.exposureFee > 0 || hasMargin) && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              예산 (섭외 확정일 기준)
            </p>
            <div className={`grid gap-2 ${hasMargin ? "grid-cols-3" : "grid-cols-1"}`}>
              <Kpi label="노출가 합계" value={`${fmtKrw(budget.exposureFee)}원`} />
              {hasMargin && (
                <>
                  <Kpi label="원가 합계" value={`${fmtKrw(budget.costFee ?? 0)}원`} />
                  <Kpi
                    label="마진"
                    value={`${fmtKrw(budget.margin ?? 0)}원`}
                    sub={budget.exposureFee > 0 ? `${(((budget.margin ?? 0) / budget.exposureFee) * 100).toFixed(1)}%` : undefined}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
