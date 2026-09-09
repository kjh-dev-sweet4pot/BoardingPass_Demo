"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { CreatorPhoto } from "@/components/creator-photo";
import {
  CompanyHomePerformanceBoard,
  CompanyHomeShareDonuts,
  CompanyHomeVisitBoard,
} from "@/components/company-home-performance-board";
import {
  displayHandle,
  formatHomeViews,
  newsKindTone,
  type CompanyHomeBestPost,
  type CompanyHomeInfluencerRow,
  type CompanyHomeNewsItem,
  type CompanyHomePayload,
  type HomeInsightLink,
} from "@/lib/company-home";
import { resolvePoolCreator } from "@/lib/creator-pool-mock";

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

function isNewsFresh(iso: string) {
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

function donutPct(pct: number | null) {
  if (pct == null || !Number.isFinite(pct)) {
    return { fill: 0, label: null as number | null };
  }
  return { fill: Math.min(100, Math.max(0, pct)), label: Math.round(pct) };
}

function KpiHoverTip({
  title,
  rows,
  note,
  children,
}: {
  title: string;
  rows: { label: string; value: string }[];
  note?: string;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function show(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const tipW = 248;
    const pad = 12;
    setPos({
      top: r.bottom + 8,
      left: Math.max(
        pad + tipW / 2,
        Math.min(r.left + r.width / 2, window.innerWidth - pad - tipW / 2),
      ),
    });
  }

  return (
    <div
      className="relative min-w-0 w-full"
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setPos(null)}
      onFocus={(e) => show(e.currentTarget)}
      onBlur={() => setPos(null)}
    >
      {children}
      {mounted && pos
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[200] w-[248px] -translate-x-1/2 rounded-[6px] border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-white shadow-lg"
              style={{ top: pos.top, left: pos.left }}
            >
              <p className="mb-1.5 text-[10px] font-medium tracking-wide text-white/60">
                {title}
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
                {rows.map((row) => (
                  <Fragment key={row.label}>
                    <dt className="text-white/65">{row.label}</dt>
                    <dd className="text-right font-semibold tabular-nums">
                      {row.value}
                    </dd>
                  </Fragment>
                ))}
              </dl>
              {note ? (
                <p className="mt-2 text-[10.5px] leading-relaxed text-white/55">
                  {note}
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function DonutCell({
  pct,
  color,
  label,
  caption,
  onClick,
}: {
  pct: number | null;
  color: string;
  label: string;
  caption: string;
  onClick?: () => void;
}) {
  const { fill, label: n } = donutPct(pct);
  const size = 100;
  const sw = 12;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - fill / 100);
  const inner = (
    <>
      <div className="relative h-[56px] w-[56px] shrink-0">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-full w-full"
          role="img"
          aria-label={n == null ? label : `${label} ${n}%`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#EAE3D6"
            strokeWidth={sw}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={c.toFixed(2)}
            strokeDashoffset={off.toFixed(2)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[13px] font-extrabold tabular-nums text-[var(--ink)]">
          {n == null ? "—" : `${n}%`}
        </span>
      </div>
      <div className="min-w-0 flex-1 text-left">
        <span className="block text-[11px] text-[var(--muted)]">{label}</span>
        <span className="mt-0.5 block text-[14px] font-extrabold leading-snug tabular-nums text-[var(--ink)]">
          {caption}
        </span>
      </div>
    </>
  );
  const cls =
    "flex h-[88px] w-full items-center gap-3 overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} cursor-pointer`}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function StripPlain({
  label,
  value,
  hint,
  extra,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  extra?: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1 text-left">
        <div className="text-[11px] text-[var(--muted)]">{label}</div>
        <div className="mt-0.5 text-[18px] font-extrabold tabular-nums tracking-tight text-[var(--ink)]">
          {value}
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--muted)]">{hint}</div>
      </div>
      {extra ? <div className="w-[42%] shrink-0">{extra}</div> : null}
    </>
  );
  const cls =
    "flex h-[88px] w-full items-center gap-3 overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} cursor-pointer`}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function formatCurveAxis(day: number, useHours: boolean) {
  if (useHours) {
    const h = Math.max(0, Math.round(day * 24));
    return `${h}시간`;
  }
  return `D+${Math.max(0, Math.floor(day))}`;
}

function HomeViewsCurve({ points }: { points: { day: number; views: number }[] }) {
  if (points.length < 2) {
    return (
      <p className="text-[10px] leading-snug text-[var(--muted)]">
        수집 2회↑ 시 곡선
      </p>
    );
  }
  const maxViews = Math.max(...points.map((p) => p.views), 1);
  const maxDay = Math.max(points[points.length - 1]?.day ?? 0, 1e-9);
  const useHours = maxDay < 1;
  const W = 200;
  const H = 56;
  const pad = { l: 2, r: 2, t: 4, b: 12 };
  const pts = points.map((p) => ({
    x: pad.l + (p.day / maxDay) * (W - pad.l - pad.r),
    y: pad.t + (1 - p.views / maxViews) * (H - pad.t - pad.b),
  }));
  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const last = pts[pts.length - 1]!;
  const first = pts[0]!;
  const area = `${line} L${last.x.toFixed(1)},${H - pad.b} L${first.x.toFixed(1)},${H - pad.b} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[52px] w-full" aria-hidden>
      <path d={area} fill="var(--accent)" opacity={0.1} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={1.8} />
      <circle cx={last.x} cy={last.y} r={2.2} fill="var(--accent)" />
      <text x={pad.l} y={H - 1} fill="var(--muted)" fontSize={8}>
        {formatCurveAxis(0, useHours)}
      </text>
      <text x={W - 28} y={H - 1} fill="var(--muted)" fontSize={8}>
        {formatCurveAxis(maxDay, useHours)}
      </text>
    </svg>
  );
}

function ViewsCell({
  total,
  wowPct,
  curve,
  onClick,
}: {
  total: number;
  wowPct: number | null;
  curve: { day: number; views: number }[];
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="min-w-0 shrink-0 text-left">
        <div className="text-[11px] text-[var(--muted)]">누적 조회</div>
        <div className="mt-0.5 text-[18px] font-extrabold tabular-nums tracking-tight text-[var(--ink)]">
          {formatHomeViews(total)}
        </div>
        <div className="mt-0.5 text-[10px] text-[var(--muted)]">
          {wowPct == null
            ? "성과와 동일"
            : `${wowPct > 0 ? "+" : ""}${wowPct}% · 7일`}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <HomeViewsCurve points={curve} />
      </div>
    </>
  );
  const cls =
    "flex h-[88px] w-full items-center gap-2 overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} cursor-pointer`}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function EfficiencyPlaceholder() {
  const pills = ["ER", "좋아요", "조회수", "저장수", "Repost"];
  return (
    <section className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <h3 className="text-sm font-bold text-[var(--ink)]">가성비 리스트</h3>
      <p className="mb-3 mt-0.5 text-[11.5px] text-[var(--muted)]">
        노출가 대비 성과 · 지표 산식 준비 중
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {pills.map((p, i) => (
          <span
            key={p}
            className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${
              i < 3
                ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"
            }`}
            aria-hidden
          >
            {p}
          </span>
        ))}
      </div>
      <div className="divide-y divide-[var(--line)]">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex h-[60px] items-center gap-2.5">
            <span className="w-[18px] text-right text-[12px] tabular-nums text-[var(--muted)]">
              {i + 1}
            </span>
            <span className="h-11 w-11 shrink-0 rounded-[6px] bg-[var(--surface-hover)]" />
            <span className="min-w-0 flex-1 space-y-1.5">
              <span className="block h-2.5 w-[42%] rounded bg-[var(--surface-hover)]" />
              <span className="block h-2 w-[58%] rounded bg-[var(--surface-hover)]" />
            </span>
            <span className="h-2.5 w-10 shrink-0 rounded bg-[var(--surface-hover)]" />
          </div>
        ))}
      </div>
    </section>
  );
}

const RANK_VISIBLE = 4;
const RANK_ROW_PX = 60;
const RANK_TICK_MS = 3000;

function RankPostRow({
  row,
  rank,
}: {
  row: CompanyHomeBestPost;
  rank: number;
}) {
  const creator = useMemo(
    () =>
      resolvePoolCreator({
        id: row.influencerId || row.id,
        name: row.name,
        handle: row.handle,
        url: row.url,
        product: row.product,
        views: row.views,
        likes: row.likes,
        comments: row.comments,
      }),
    [row],
  );
  const inner = (
    <>
      <span className="w-[18px] shrink-0 text-right text-[12px] tabular-nums text-[var(--muted)]">
        {rank}
      </span>
      <CreatorPhoto creator={creator} size="thumb" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold text-[var(--ink)]">
          {row.handle}
        </span>
        <span className="block truncate text-[11px] text-[var(--muted)]">
          {row.name} · {row.product}
        </span>
      </span>
      <span className="shrink-0 text-right text-[12.5px] font-bold tabular-nums text-[var(--ink)]">
        {formatHomeViews(row.views)}
        <span className="block text-[10.5px] font-medium text-[var(--muted)]">조회</span>
      </span>
    </>
  );
  const cls =
    "flex h-[60px] items-center gap-2.5 border-b border-[var(--line)] px-0";
  if (row.url) {
    return (
      <a
        href={row.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${cls} hover:bg-[var(--surface-hover)]`}
      >
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function RankInfRow({
  row,
  rank,
  onOpen,
}: {
  row: CompanyHomeInfluencerRow;
  rank: number;
  onOpen?: () => void;
}) {
  const creator = useMemo(
    () =>
      resolvePoolCreator({
        id: row.id,
        name: row.name,
        handle: row.handle,
        product: row.product,
        views: row.views,
      }),
    [row],
  );
  const hasPerf = row.views > 0;
  const inner = (
    <>
      <span className="w-[18px] shrink-0 text-right text-[12px] tabular-nums text-[var(--muted)]">
        {rank}
      </span>
      <CreatorPhoto creator={creator} size="thumb" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold text-[var(--ink)]">
          {row.handle}
        </span>
        <span className="block truncate text-[11px] text-[var(--muted)]">
          {row.name} · {row.product}
        </span>
      </span>
      <span className="shrink-0 text-right text-[12.5px] font-bold tabular-nums text-[var(--ink)]">
        {formatHomeViews(hasPerf ? row.views : row.followers)}
        <span className="block text-[10.5px] font-medium text-[var(--muted)]">
          {hasPerf ? "조회" : "팔로워"}
        </span>
      </span>
    </>
  );
  const cls =
    "flex h-[60px] w-full items-center gap-2.5 border-b border-[var(--line)] text-left";
  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`${cls} hover:bg-[var(--surface-hover)]`}
      >
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/** 4줄 고정 뷰포트 · 3초마다 한 줄씩 위로 밀기 */
function AutoScrollRankRows({
  rows,
  reduceMotion,
}: {
  rows: ReactNode[];
  reduceMotion: boolean;
}) {
  const n = rows.length;
  const canScroll = !reduceMotion && n > RANK_VISIBLE;
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    setOffset(0);
    setAnimate(true);
  }, [n]);

  useEffect(() => {
    if (!canScroll) return;
    const id = window.setInterval(() => {
      setAnimate(true);
      setOffset((o) => o + 1);
    }, RANK_TICK_MS);
    return () => window.clearInterval(id);
  }, [canScroll, n]);

  useEffect(() => {
    if (!canScroll || offset < n) return;
    const t = window.setTimeout(() => {
      setAnimate(false);
      setOffset(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimate(true));
      });
    }, 420);
    return () => window.clearTimeout(t);
  }, [offset, n, canScroll]);

  if (n === 0) return null;

  const track = canScroll
    ? [...rows, ...rows.slice(0, RANK_VISIBLE)]
    : rows.slice(0, RANK_VISIBLE);

  return (
    <div
      className="overflow-hidden"
      style={{ height: RANK_VISIBLE * RANK_ROW_PX }}
      aria-live="off"
    >
      <div
        className={
          animate && canScroll
            ? "transition-transform duration-[420ms] ease-out"
            : ""
        }
        style={{
          transform: canScroll
            ? `translateY(-${offset * RANK_ROW_PX}px)`
            : undefined,
        }}
      >
        {track.map((row, i) => (
          <div key={i} style={{ height: RANK_ROW_PX }}>
            {row}
          </div>
        ))}
      </div>
    </div>
  );
}

function RankCard({
  title,
  sub,
  empty,
  rows,
  cardRef,
  flash,
  reduceMotion,
}: {
  title: string;
  sub: string;
  empty: string;
  rows: ReactNode[];
  cardRef?: Ref<HTMLElement>;
  flash?: boolean;
  reduceMotion: boolean;
}) {
  return (
    <section
      ref={cardRef}
      className={`scroll-mt-4 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors duration-150 ${
        flash ? "!bg-[#FBF3E4]" : ""
      }`}
    >
      <h3 className="text-sm font-bold text-[var(--ink)]">{title}</h3>
      <p className="mb-3 mt-0.5 text-[11.5px] text-[var(--muted)]">{sub}</p>
      {rows.length > 0 ? (
        <AutoScrollRankRows rows={rows} reduceMotion={reduceMotion} />
      ) : (
        <p className="py-4 text-sm text-[var(--muted)]">{empty}</p>
      )}
    </section>
  );
}

function NewsSidebar({
  items,
  insightLinks,
  insightsLoading,
}: {
  items: CompanyHomeNewsItem[];
  insightLinks: HomeInsightLink[];
  insightsLoading: boolean;
}) {
  const shown = items.slice(0, 8);
  return (
    <aside className="flex w-full flex-col gap-3 self-start xl:w-[300px] xl:shrink-0">
      <div className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-4">
        <h3 className="text-sm font-bold text-[var(--ink)]">Live 뉴스</h3>
        <p className="mb-2.5 mt-0.5 text-[11.5px] text-[var(--muted)]">
          업로드 · 방문 · 운영 · 최대 8건
        </p>
        {shown.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">아직 뉴스가 없습니다.</p>
        ) : (
          <ul className="m-0 max-h-[360px] list-none overflow-auto p-0">
            {shown.map((item, i) => {
              const fresh = isNewsFresh(item.at);
              return (
                <li
                  key={item.id}
                  className={`relative border-[var(--line)] py-2 pl-3.5 ${
                    i === 0 ? "border-t-0" : "border-t"
                  }`}
                >
                  <span
                    className={`absolute left-0 top-3.5 h-[5px] w-[5px] rounded-full ${
                      fresh ? "bp-news-dot bg-[#1F5FD8]" : "bg-[var(--line)]"
                    }`}
                  />
                  <p className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                    <b className="font-semibold text-[var(--ink)]">
                      {fmtNewsWhen(item.at)}
                    </b>
                    <span className={newsKindTone(item.kind)}>{item.kind}</span>
                  </p>
                  <p
                    className={`my-0.5 text-[12.5px] font-bold leading-snug ${
                      fresh ? "bp-news-title text-[#1F5FD8]" : "text-[var(--ink)]"
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="line-clamp-2 text-[11px] leading-snug text-[var(--muted)]">
                    {item.body}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <CompanyHomeShareDonuts links={insightLinks} loading={insightsLoading} />
    </aside>
  );
}

export function CompanyHomeLanding({
  companyName,
  companyId,
  onOpenPerformance,
  onOpenPublish,
  onOpenPool,
}: {
  companyName: string;
  companyId: string;
  onOpenPerformance?: () => void;
  onOpenPublish?: () => void;
  onOpenPool?: () => void;
}) {
  const [data, setData] = useState<CompanyHomePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightLinks, setInsightLinks] = useState<HomeInsightLink[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [flashMonthly, setFlashMonthly] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const monthlyRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/com/home", { cache: "no-store" })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || "요약을 불러오지 못했습니다.");
          if (!cancelled) {
            setData(body as CompanyHomePayload);
            setError(null);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setError(
              e instanceof Error ? e.message : "요약을 불러오지 못했습니다.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // ponytail: board + 도넛이 같은 소스 — 한 번만 fetch
  useEffect(() => {
    let cancelled = false;
    setInsightsLoading(true);
    fetch("/api/com/insights?days=180", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "성과를 불러오지 못했습니다.");
        if (!cancelled) {
          setInsightLinks(
            Array.isArray(body.links) ? (body.links as HomeInsightLink[]) : [],
          );
          setInsightsError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setInsightLinks([]);
          setInsightsError(
            e instanceof Error ? e.message : "성과를 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const week = data?.best.week || [];
  const month = data?.best.month || [];
  const tickerItems = reduceMotion ? month.slice(0, 3) : month;
  const tickerLoop = !reduceMotion && month.length > 0;

  function goMonthly() {
    monthlyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFlashMonthly(true);
    window.setTimeout(() => setFlashMonthly(false), 900);
  }

  const content = data?.content;
  const inf = data?.influencers;
  const weekViews = data?.weekViews;
  const infBar =
    inf && inf.contracted > 0
      ? Math.min(100, Math.round((inf.withPerformance / inf.contracted) * 100))
      : 0;

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="px-0 pb-8 pt-0 sm:px-0">
        {loading && !data ? (
          <p className="px-5 py-5 text-sm text-[var(--muted)] sm:px-8">
            불러오는 중…
          </p>
        ) : null}
        {error ? (
          <p className="px-5 py-3 text-sm text-[var(--danger)] sm:px-8">
            {error}
          </p>
        ) : null}

        {data ? (
          <>
            <p className="px-5 pt-3 text-[11.5px] text-[var(--muted)] sm:px-8">
              {companyName} · {data.asOf} 조회 시점 기준
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 px-5 sm:grid-cols-2 sm:px-8 xl:grid-cols-3">
              <KpiHoverTip
                title="콘텐츠 발행"
                rows={[
                  {
                    label: "발행완료",
                    value: `${content?.published ?? 0}건`,
                  },
                  {
                    label: "목표",
                    value:
                      content?.target != null
                        ? `${content.target}건`
                        : "미설정",
                  },
                  {
                    label: "진행률",
                    value:
                      content?.target
                        ? `${Math.round((content.published / content.target) * 100)}%`
                        : "—",
                  },
                ]}
                note="발행완료 콘텐츠 건수 / 배정 목표 콘텐츠 수 합계입니다."
              >
                <DonutCell
                  pct={
                    content?.target
                      ? (content.published / content.target) * 100
                      : null
                  }
                  color="var(--accent)"
                  label="콘텐츠 발행"
                  caption={
                    content?.target
                      ? `${content.published}건 / ${content.target}건`
                      : `${content?.published ?? 0}건`
                  }
                  onClick={onOpenPublish}
                />
              </KpiHoverTip>
              <KpiHoverTip
                title="계약 인플루언서"
                rows={[
                  {
                    label: "계약",
                    value: `${inf?.contracted ?? 0}명`,
                  },
                  {
                    label: "성과 발생",
                    value: `${inf?.withPerformance ?? 0}명`,
                  },
                  {
                    label: "성과 발생률",
                    value: infBar ? `${infBar}%` : "0%",
                  },
                ]}
                note="배정된 인플루언서입니다. 성과 발생은 조회수가 있는 인원입니다."
              >
                <StripPlain
                  label="계약 인플루언서"
                  value={inf ? `${inf.contracted}명` : "0명"}
                  hint={`성과 발생 ${inf?.withPerformance ?? 0}명`}
                  extra={
                    <div className="h-[5px] overflow-hidden rounded-full bg-[#EDE7DC]">
                      <span
                        className="block h-full bg-[#2F7D5A]"
                        style={{ width: `${infBar}%` }}
                      />
                    </div>
                  }
                  onClick={onOpenPool}
                />
              </KpiHoverTip>
              <KpiHoverTip
                title="누적 조회"
                rows={[
                  {
                    label: "누적 조회",
                    value: formatHomeViews(weekViews?.total ?? 0),
                  },
                  {
                    label: "7일 대비",
                    value:
                      weekViews?.wowPct == null
                        ? "—"
                        : `${weekViews.wowPct > 0 ? "+" : ""}${weekViews.wowPct}%`,
                  },
                ]}
                note={`${data.asOf} 조회 시점 기준 · 성과 탭과 동일 누적값입니다.`}
              >
                <ViewsCell
                  total={weekViews?.total ?? 0}
                  wowPct={weekViews?.wowPct ?? null}
                  curve={weekViews?.curve || []}
                  onClick={onOpenPerformance}
                />
              </KpiHoverTip>
            </div>

            <div className="mt-4 flex items-center gap-3.5 overflow-hidden border-y border-[var(--line)] bg-[var(--surface)] px-5 py-2 sm:px-8">
              <button
                type="button"
                className="shrink-0 bg-transparent text-[11.5px] font-bold text-[var(--accent)] hover:underline"
                onClick={goMonthly}
              >
                월간 랭킹 바로가기
              </button>
              <div className="h-5 min-w-0 flex-1 overflow-hidden">
                {month.length === 0 ? (
                  <span className="text-[12.5px] text-[var(--muted)]">
                    최근 30일 발행된 게시물이 없습니다
                  </span>
                ) : (
                  <div
                    className={`flex gap-7 whitespace-nowrap ${
                      tickerLoop ? "bp-ticker-track" : ""
                    }`}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.animationPlayState =
                        "paused";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.animationPlayState =
                        "running";
                    }}
                  >
                    {(tickerLoop ? [0, 1] : [0]).flatMap((copy) =>
                      tickerItems.map((row, i) => (
                        <span
                          key={`${copy}-${row.id}`}
                          className="text-[12.5px] text-[var(--ink)]"
                        >
                          <b className="mr-1.5 font-semibold tabular-nums text-[var(--muted)]">
                            {i + 1}
                          </b>
                          {displayHandle(row.name)} · {formatHomeViews(row.views)}{" "}
                          조회
                        </span>
                      )),
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-5 border-b border-[var(--line)] px-5 py-5 sm:px-8 xl:flex-row xl:items-start">
              <div className="min-w-0 flex-1">
                <CompanyHomePerformanceBoard
                  links={insightLinks}
                  loading={insightsLoading}
                  error={insightsError}
                  onOpenMore={onOpenPerformance}
                />
              </div>
              <CompanyHomeVisitBoard visits={data.visits} />
              <NewsSidebar
                items={data.news}
                insightLinks={insightLinks}
                insightsLoading={insightsLoading}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:px-8 md:grid-cols-2 xl:grid-cols-4">
              <EfficiencyPlaceholder />
              <RankCard
                title="주간 랭킹 TOP 10"
                sub="조회수 기준 · 4명씩 자동 스크롤"
                empty="이번 주 발행된 게시물이 없습니다"
                reduceMotion={reduceMotion}
                rows={week.map((row, i) => (
                  <RankPostRow key={row.id} row={row} rank={i + 1} />
                ))}
              />
              <RankCard
                title="월간 랭킹 TOP 10"
                sub="조회수 기준 · 4명씩 자동 스크롤"
                empty="최근 30일 발행된 게시물이 없습니다"
                cardRef={monthlyRef}
                flash={flashMonthly}
                reduceMotion={reduceMotion}
                rows={month.map((row, i) => (
                  <RankPostRow key={row.id} row={row} rank={i + 1} />
                ))}
              />
              <RankCard
                title="인플루언서"
                sub="성과순 → 팔로워순 · 4명씩 자동 스크롤"
                empty="계약된 인플루언서가 없습니다"
                reduceMotion={reduceMotion}
                rows={(inf?.ranking || []).map((row, i) => (
                  <RankInfRow
                    key={row.id}
                    row={row}
                    rank={i + 1}
                    onOpen={onOpenPool}
                  />
                ))}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
