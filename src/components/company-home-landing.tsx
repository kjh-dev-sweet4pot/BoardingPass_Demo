"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CreatorPhoto } from "@/components/creator-photo";
import {
  formatHomeViews,
  newsKindTone,
  type CompanyHomeBestPost,
  type CompanyHomeNewsItem,
  type CompanyHomePayload,
} from "@/lib/company-home";
import {
  findPoolCreator,
  formatKrw,
  type PoolCreator,
} from "@/lib/creator-pool-mock";

function bestPostPhotoCreator(row: CompanyHomeBestPost): PoolCreator {
  const fromPool = findPoolCreator({
    id: row.influencerId,
    handle: row.handle,
    name: row.name,
  });
  if (fromPool) return fromPool;
  const channel = /tiktok/i.test(row.url || "")
    ? ("tiktok" as const)
    : ("instagram" as const);
  return {
    id: row.influencerId || row.id,
    name: row.name,
    handle: row.handle,
    market: "jp",
    channel,
    profileUrl: null,
    priceKrw: 0,
    followers: 0,
    overlap: null,
    tier: "micro",
    product: row.product,
    posts: row.url
      ? [{ platform: channel, url: row.url }]
      : [],
    uploadYmd: null,
    metrics: {
      views: row.views,
      likes: row.likes,
      comments: row.comments,
      saves: null,
      shares: null,
    },
    category: null,
  };
}

/** 한 명 정지 → 다음으로 한 칸 (ms). 화면에는 약 4명 노출 */
const BEST_STEP_PAUSE_MS = 2800;
const BEST_ROW_PX = 64;
const BEST_VISIBLE = 4;

function fmtNewsWhen(iso: string) {
  const d = new Date(iso);
  const md = d.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  });
  const hm = d.toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${md} ${hm}`;
}

function BestRow({
  row,
  rank,
}: {
  row: CompanyHomeBestPost;
  rank: number;
}) {
  const creator = useMemo(() => bestPostPhotoCreator(row), [row]);
  const inner = (
    <>
      <span className="w-5 shrink-0 text-[11px] font-semibold tabular-nums text-[var(--muted)]">
        {rank}
      </span>
      <CreatorPhoto creator={creator} size="thumb" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-[var(--ink)]">
          {row.handle}
        </span>
        <span className="block truncate text-[11px] text-[var(--muted)]">
          {row.name} · {row.product}
        </span>
      </span>
      <span className="shrink-0 text-right text-[12px] font-semibold tabular-nums text-[var(--accent)]">
        {formatHomeViews(row.views)}
        <span className="mt-0.5 block text-[10px] font-medium text-[var(--muted)]">
          조회
        </span>
      </span>
    </>
  );
  if (row.url) {
    return (
      <a
        href={row.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-full items-center gap-3 px-4 transition hover:bg-[var(--surface-hover)]"
      >
        {inner}
      </a>
    );
  }
  return (
    <div className="flex h-full items-center gap-3 px-4">{inner}</div>
  );
}

function BestList({
  title,
  items,
}: {
  title: string;
  items: CompanyHomeBestPost[];
}) {
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);
  const maxIndex = Math.max(0, items.length - BEST_VISIBLE);
  const step = maxIndex > 0;
  const viewportH = BEST_ROW_PX * Math.min(BEST_VISIBLE, items.length || BEST_VISIBLE);

  useEffect(() => {
    setIndex(0);
  }, [items]);

  useEffect(() => {
    if (!step) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      setIndex((i) => (i >= maxIndex ? 0 : i + 1));
    }, BEST_STEP_PAUSE_MS);
    return () => window.clearInterval(id);
  }, [step, maxIndex]);

  return (
    <div className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)]">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
        <p className="mt-0.5 text-[11px] text-[var(--muted)]">
          조회수 TOP 10
          {step ? (
            <span className="ml-1.5 tabular-nums text-[var(--accent)]">
              {index + 1}–{Math.min(index + BEST_VISIBLE, items.length)}/{items.length}
            </span>
          ) : null}
        </p>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-5 text-sm text-[var(--muted)]">아직 게시물이 없습니다.</p>
      ) : (
        <div
          className="relative overflow-hidden"
          style={{ height: viewportH }}
          onMouseEnter={() => {
            pausedRef.current = true;
          }}
          onMouseLeave={() => {
            pausedRef.current = false;
          }}
        >
          <ol
            className="divide-y divide-[#f4ece2] transition-transform duration-500 ease-out"
            style={{
              transform: step
                ? `translateY(-${index * BEST_ROW_PX}px)`
                : undefined,
            }}
          >
            {items.map((row, i) => (
              <li key={row.id} style={{ height: BEST_ROW_PX }}>
                <BestRow row={row} rank={i + 1} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function NewsTimeline({ items }: { items: CompanyHomeNewsItem[] }) {
  return (
    <section className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7cb87c] opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#5a9e5a]" />
        </span>
        <h2 className="text-sm font-semibold text-[var(--ink)]">
          Live 뉴스
          <span className="ml-2 text-[11px] font-medium text-[var(--muted)]">
            브랜드 · 예산 · 일정
          </span>
        </h2>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">등록된 뉴스가 없습니다.</p>
      ) : (
        <ol className="relative space-y-0 border-l border-[#e8dfd2] pl-5">
          {items.map((item) => (
            <li key={item.id} className="relative pb-5 last:pb-0">
              <span className="absolute -left-[23px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--accent)] shadow-sm" />
              <p className="text-[11px] tabular-nums text-[var(--muted)]">
                {fmtNewsWhen(item.at)}
                <span className={`ml-2 font-semibold ${newsKindTone(item.kind)}`}>
                  {item.kind}
                </span>
              </p>
              <p className="mt-0.5 text-[14px] font-semibold leading-snug text-[var(--ink)]">
                {item.title}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function CompanyHomeLanding({
  companyName,
  onOpenPerformance,
}: {
  companyName: string;
  onOpenPerformance?: () => void;
}) {
  const [data, setData] = useState<CompanyHomePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/com/home", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "요약을 불러오지 못했습니다.");
        if (!cancelled) setData(body as CompanyHomePayload);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "요약을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const budget = data?.budget;
  const pct = budget?.pct;
  const barWidth =
    pct == null ? 0 : Math.max(0, Math.min(100, pct));

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="px-4 pb-8 pt-5 sm:px-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Home
            </p>
            <h1 className="mt-1 text-[28px] font-semibold leading-tight text-[var(--ink)] sm:text-[30px]">
              {companyName} 요약
            </h1>
            <p className="mt-1 text-[12.5px] text-[var(--muted)]">
              {data?.asOf
                ? `${data.asOf} 조회 시점 기준 · 예산은 섭외 Accept 노출가 합산`
                : "예산 · 베스트 게시물 · 운영 뉴스"}
            </p>
          </div>
          {onOpenPerformance ? (
            <button
              type="button"
              onClick={onOpenPerformance}
              className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
            >
              성과 대시보드 →
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
        ) : null}
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        {data ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <section className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-[var(--ink)]">예산</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] text-[var(--muted)]">전체 예산</p>
                    <p className="mt-1 text-[22px] font-bold tabular-nums text-[var(--ink)]">
                      {budget?.total != null
                        ? `${formatKrw(budget.total)}원`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[var(--muted)]">사용</p>
                    <p className="mt-1 text-[22px] font-bold tabular-nums text-[var(--accent)]">
                      {formatKrw(budget?.spent ?? 0)}원
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[var(--muted)]">잔여</p>
                    <p className="mt-1 text-[22px] font-bold tabular-nums text-[var(--ink)]">
                      {budget?.remaining != null
                        ? `${formatKrw(budget.remaining)}원`
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-[11px] text-[var(--muted)]">
                    <span>집행률</span>
                    <span className="tabular-nums font-semibold text-[var(--ink)]">
                      {pct != null ? `${pct}%` : "—"}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#f0e8dc]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              </section>

              <div>
                <h2 className="mb-3 text-sm font-semibold text-[var(--ink)]">
                  베스트 게시물
                </h2>
                <div className="grid gap-3 lg:grid-cols-3">
                  <BestList title="주간" items={data.best.week} />
                  <BestList title="월간" items={data.best.month} />
                  <BestList title="전체" items={data.best.all} />
                </div>
              </div>
            </div>

            <NewsTimeline items={data.news} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
