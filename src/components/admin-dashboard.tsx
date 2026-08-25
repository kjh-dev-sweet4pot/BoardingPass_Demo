"use client";

import { useEffect, useState } from "react";
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
  publishedCount: number;
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

export type AdminQueueKey =
  | "reviewPending"
  | "verifyFailed"
  | "collectFailed"
  | "publishStale"
  | "castingStale"
  | "published";

function QueueCard({
  label,
  count,
  warn,
  onOpen,
}: {
  label: string;
  count: number;
  warn?: boolean;
  onOpen: () => void;
}) {
  const isEmpty = count === 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`rounded-[6px] border px-4 py-3 text-left transition hover:brightness-[0.98] ${
        isEmpty
          ? "border-[var(--line)] bg-[var(--surface)]"
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
        {isEmpty ? "처리 대기 없음" : "건 · 열기"}
      </p>
    </button>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-[var(--ink)]">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

export function AdminDashboard({
  companies,
  onOpenQueue,
}: {
  companies: Company[];
  onOpenQueue: (queue: AdminQueueKey) => void;
}) {
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
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [companyId, from, to]);

  const queues = data?.queues;
  const publishedCount = data?.publishedCount ?? 0;
  const perf = data?.performance;
  const budget = data?.budget;
  const hasMargin = budget && "margin" in budget;

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          현황 · 처리 대기
        </p>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <QueueCard
              label="검수 대기"
              count={queues?.reviewPending ?? 0}
              onOpen={() => onOpenQueue("reviewPending")}
            />
            <QueueCard
              label="검증 실패"
              count={queues?.verifyFailed ?? 0}
              warn
              onOpen={() => onOpenQueue("verifyFailed")}
            />
            <QueueCard
              label="수집 연속 실패"
              count={queues?.collectFailed ?? 0}
              warn
              onOpen={() => onOpenQueue("collectFailed")}
            />
            <QueueCard
              label="발행 미이행"
              count={queues?.publishStale ?? 0}
              onOpen={() => onOpenQueue("publishStale")}
            />
            <QueueCard
              label="섭외 정체"
              count={queues?.castingStale ?? 0}
              onOpen={() => onOpenQueue("castingStale")}
            />
            <button
              type="button"
              onClick={() => onOpenQueue("published")}
              className="rounded-[6px] border border-[var(--badge-ok-fg)]/25 bg-[var(--badge-ok-bg)] px-4 py-3 text-left transition hover:brightness-[0.98]"
            >
              <p className="text-xs text-[var(--badge-ok-fg)]">발행 완료</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--badge-ok-fg)]">
                {publishedCount.toLocaleString("ko-KR")}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--badge-ok-fg)]/70">건 · 열기</p>
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          성과 조회
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-9 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">회원사 전체</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="h-9 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
            value={from}
            max={to || today}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="self-center text-xs text-[var(--muted)]">~</span>
          <input
            type="date"
            className="h-9 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
            value={to}
            min={from}
            max={today}
            onChange={(e) => setTo(e.target.value)}
          />
          {(companyId || from || to) && (
            <button
              type="button"
              className="h-9 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 text-xs text-[var(--muted)] hover:bg-[var(--surface-hover)]"
              onClick={() => {
                setCompanyId("");
                setFrom("");
                setTo("");
              }}
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
      ) : perf ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi
            label="발행 콘텐츠"
            value={`${perf.posts}건`}
            sub={from || to ? "선택 기간" : "전체 기간"}
          />
          <Kpi label="조회수" value={fmt(perf.views)} />
          <Kpi label="좋아요" value={fmt(perf.likes)} />
          <Kpi label="댓글" value={fmt(perf.comments)} />
          <Kpi label="참여율 (ER)" value={`${perf.er.toFixed(2)}%`} />
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">—</p>
      )}

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
                  sub={
                    budget.exposureFee > 0
                      ? `${(((budget.margin ?? 0) / budget.exposureFee) * 100).toFixed(1)}%`
                      : undefined
                  }
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
