"use client";

import { useEffect, useMemo, useState, Fragment, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CreatorPhoto } from "@/components/creator-photo";
import { EmptyState } from "@/components/empty-state";
import { formatMetric } from "@/lib/content-insights";
import { findPoolCreator, type PoolCreator } from "@/lib/creator-pool-mock";
import type { ContentPeriod } from "@/lib/content-insights";
import { addDaysYmd, formatMd, ymdKst } from "@/lib/types";

type LinkRow = {
  id: string;
  link_url: string | null;
  status: string;
  published_at: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  saves?: number | null;
  shares?: number | null;
  reposts?: number | null;
  metrics_collected_at: string | null;
  allocations: {
    id: string;
    company_id?: string;
    influencer_id: string;
    influencers: {
      id: string;
      name: string;
      instagram_handle_normalized?: string;
      instagram_handle?: string;
    } | null;
    products: { id: string; name: string } | null;
    companies?: { id: string; name: string } | null;
  } | null;
};

type MetricRow = {
  creator_link_id: string;
  collected_at: string;
  views: number;
  likes: number;
  comments: number;
};

type InitialPerformanceData = {
  links: LinkRow[];
  metrics: MetricRow[];
  collectedAt: string | null;
  nextCollectAt?: string | null;
  source?: "mock" | "apify";
};

function fmtCollected(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function performanceMetaCopy(opts: {
  asOfYmd: string;
  collectedAt: string | null;
  nextCollectAt: string | null;
  source: "mock" | "apify";
}) {
  const asOf = `${formatMd(opts.asOfYmd)} 조회 시점 기준`;
  const last = opts.collectedAt
    ? `최종 수집 ${fmtCollected(opts.collectedAt)}`
    : null;
  const next = opts.nextCollectAt
    ? opts.source === "mock"
      ? `갱신 예정 ${formatMd(opts.nextCollectAt.slice(0, 10))} 00:00`
      : `갱신 예정 ${fmtCollected(opts.nextCollectAt)}`
    : null;
  return [asOf, last, next].filter(Boolean).join(" · ");
}

function poolCreatorFromLink(row: LinkRow): PoolCreator {
  const alloc = row.allocations;
  const inf = alloc?.influencers;
  const id = alloc?.influencer_id || inf?.id || row.id;
  const raw =
    inf?.instagram_handle_normalized ||
    inf?.instagram_handle ||
    inf?.name ||
    "";
  const bare = raw.replace(/^@+/, "").trim();
  const handle = bare ? `@${bare}` : "—";
  const fromPool = findPoolCreator({ id, handle, name: inf?.name || "—" });
  if (fromPool) return fromPool;

  const url = row.link_url || "";
  const channel = /tiktok/i.test(url) ? ("tiktok" as const) : ("instagram" as const);
  return {
    id,
    name: inf?.name || "—",
    handle,
    market: "jp",
    channel,
    profileUrl: null,
    followers: 0,
    priceKrw: 0,
    overlap: null,
    tier: "micro",
    product: null,
    posts: url ? [{ platform: channel, url }] : [],
    uploadYmd: null,
    metrics: { views: 0, likes: 0, comments: 0, saves: 0, shares: 0 },
    category: null,
  };
}

function platformLabel(url: string | null) {
  if (!url) return "기타";
  if (url.includes("tiktok")) return "TikTok";
  if (url.includes("instagram")) return "Instagram";
  if (url.includes("youtube") || url.includes("youtu.be")) return "YouTube";
  return "기타";
}

function er(views: number, likes: number, comments: number) {
  return views > 0 ? ((likes + comments) / views) * 100 : 0;
}

function fmtPct(n: number) {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

/** 비율 순위: 조회수 극소 건이 1위를 차지하지 않도록 */
const RATIO_MIN_VIEWS = 100;

const METRIC_WHY = {
  views:
    "도달·바이럴 규모를 봅니다. 캠페인 인지도와 확산력 비교에 씁니다.",
  likes:
    "절대 반응량입니다. 노출이 큰 콘텐츠의 호감 반응을 확인할 때 씁니다.",
  likeRate:
    "좋아요 ÷ 조회수. 조회 대비 호감도를 비교해, 규모와 무관한 콘텐츠 퀄리티를 봅니다.",
  commentRate:
    "댓글 ÷ 조회수. 대화·질문·리뷰형 반응이 강한 콘텐츠를 고를 때 씁니다.",
  er: "참여율(ER) = (좋아요 + 댓글) ÷ 조회수. 종합 반응 밀도이며, 재섭외·단가 판단의 기본 지표입니다.",
  saves:
    "저장(북마크) 합계. 다시 보고 싶은 콘텐츠 신호로, 구매·탐색 의도와 가깝습니다.",
  shares:
    "공유 합계(TikTok 공유 · Instagram DM/공유). 확산·바이럴 지표입니다.",
  reposts:
    "리포스트 합계(주로 Instagram). 타인 프로필로 다시 게시된 횟수입니다.",
  platformEr:
    "플랫폼별로 합산한 뒤 ER을 계산합니다. Instagram·TikTok 등 채널 예산·포맷 배분에 씁니다.",
  early:
    "각 게시물 제출 기준 D+1~D+2 조회 스냅샷입니다. 그 구간 수집이 없으면 첫·둘째 수집 사이 조회 증가로 대체합니다.",
  product:
    "상품 단위로 조회·좋아요·ER을 합산합니다. 상품별 캠페인 효율을 비교합니다.",
  curve:
    "필터된 콘텐츠 중 가장 먼저 업로드된 시점을 D+0으로 잡고, 이후 경과일별 조회 합(콘텐츠당 당일 최대값)입니다.",
  platformShare:
    "플랫폼별 조회수 비중입니다. 채널 기여도를 한눈에 봅니다.",
  company:
    "회원사 단위로 조회·좋아요·ER을 합산합니다. 전체 회원사 비교에 씁니다.",
} as const;

function InfoTip({ text }: { text: string }) {
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    place: "above" | "below";
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function show(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const tipW = 240;
    const pad = 12;
    let left = r.left + r.width / 2;
    left = Math.max(pad + tipW / 2, Math.min(left, window.innerWidth - pad - tipW / 2));
    const place = r.top > 120 ? "above" : "below";
    setPos({
      top: place === "above" ? r.top - 8 : r.bottom + 8,
      left,
      place,
    });
  }

  return (
    <span className="relative inline-flex shrink-0 align-middle">
      <button
        type="button"
        className="inline-flex h-[15px] w-[15px] items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[9px] font-semibold leading-none text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        aria-label={text}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={() => setPos(null)}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={() => setPos(null)}
      >
        i
      </button>
      {mounted && pos
        ? createPortal(
            <span
              role="tooltip"
              className={`pointer-events-none fixed z-[200] w-[240px] -translate-x-1/2 rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-left text-[11px] font-normal leading-relaxed text-white shadow-lg ${
                pos.place === "above" ? "-translate-y-full" : ""
              }`}
              style={{ top: pos.top, left: pos.left }}
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

function ContentMetricsTip({
  views,
  likes,
  comments,
  saves,
  shares,
  reposts,
  children,
}: {
  views: number;
  likes: number;
  comments: number;
  saves?: number | null;
  shares?: number | null;
  reposts?: number | null;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function show(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    setPos({
      top: r.top - 8,
      left: Math.min(
        Math.max(12 + 110, r.left + r.width / 2),
        window.innerWidth - 12 - 110,
      ),
    });
  }

  const rows: { label: string; value: string }[] = [
    { label: "조회수", value: formatMetric(views) },
    { label: "좋아요", value: formatMetric(likes) },
    { label: "댓글", value: formatMetric(comments) },
  ];
  if (saves != null) rows.push({ label: "저장", value: formatMetric(saves) });
  if (shares != null) rows.push({ label: "공유", value: formatMetric(shares) });
  if (reposts != null) rows.push({ label: "리포스트", value: formatMetric(reposts) });

  return (
    <div
      className="relative"
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {mounted && pos
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[200] w-[220px] -translate-x-1/2 -translate-y-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2.5 text-white shadow-lg"
              style={{ top: pos.top, left: pos.left }}
            >
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-white/60">
                지표
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
                {rows.map((row) => (
                  <Fragment key={row.label}>
                    <dt className="text-white/65">{row.label}</dt>
                    <dd className="text-right tabular-nums font-semibold">{row.value}</dd>
                  </Fragment>
                ))}
              </dl>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function PanelTitle({
  title,
  why,
  aside,
}: {
  title: string;
  why: string;
  aside?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-[#f0e6d8] px-[18px] py-3.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="text-[13.5px] font-semibold text-[var(--ink)]">{title}</span>
        <InfoTip text={why} />
      </div>
      {aside ? (
        <span className="shrink-0 text-[11px] text-[var(--muted)]">{aside}</span>
      ) : null}
    </div>
  );
}

type TopMetric =
  | { kind: "views" }
  | { kind: "likes" }
  | { kind: "likeRate" }
  | { kind: "commentRate" }
  | { kind: "er" }
  | { kind: "earlyViews" }
  | { kind: "saves" }
  | { kind: "shares" }
  | { kind: "reposts" };

function topMetricValue(row: LinkRow, metric: TopMetric): number {
  const views = row.views ?? 0;
  const likes = row.likes ?? 0;
  const comments = row.comments ?? 0;
  if (metric.kind === "views" || metric.kind === "earlyViews") return views;
  if (metric.kind === "likes") return likes;
  if (metric.kind === "saves") return row.saves ?? 0;
  if (metric.kind === "shares") return row.shares ?? 0;
  if (metric.kind === "reposts") return row.reposts ?? 0;
  if (metric.kind === "likeRate") return views > 0 ? (likes / views) * 100 : 0;
  if (metric.kind === "commentRate") {
    return views > 0 ? (comments / views) * 100 : 0;
  }
  return er(views, likes, comments);
}

function formatTopMetric(value: number, metric: TopMetric) {
  if (
    metric.kind === "likeRate" ||
    metric.kind === "commentRate" ||
    metric.kind === "er"
  ) {
    return `${fmtPct(value)}%`;
  }
  return formatMetric(value);
}

function topMetricUnit(metric: TopMetric) {
  if (metric.kind === "views" || metric.kind === "earlyViews") return "조회";
  if (metric.kind === "likes") return "좋아요";
  if (metric.kind === "likeRate") return "좋아요율";
  if (metric.kind === "commentRate") return "댓글율";
  if (metric.kind === "saves") return "저장";
  if (metric.kind === "shares") return "공유";
  if (metric.kind === "reposts") return "리포스트";
  return "ER";
}

function showsViewsSubline(metric: TopMetric) {
  return (
    metric.kind === "likeRate" ||
    metric.kind === "commentRate" ||
    metric.kind === "er"
  );
}

function TopContentPanel({
  title,
  why,
  metric,
  items,
  aside,
}: {
  title: string;
  why: string;
  metric: TopMetric;
  items: Array<LinkRow & { earlyViews?: number }>;
  aside?: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
      <PanelTitle title={title} why={why} aside={aside} />
      {items.length === 0 ? (
        <p className="px-[18px] py-6 text-sm text-[var(--muted)]">데이터 없음</p>
      ) : (
        <ul className="divide-y divide-[#f4ece2]">
          {items.map((row, idx) => {
            const inf = row.allocations?.influencers;
            const product = row.allocations?.products?.name || "상품";
            const company = row.allocations?.companies?.name;
            const value =
              metric.kind === "earlyViews"
                ? (row.earlyViews ?? 0)
                : topMetricValue(row, metric);
            return (
              <li key={row.id}>
                <ContentMetricsTip
                  views={row.views ?? 0}
                  likes={row.likes ?? 0}
                  comments={row.comments ?? 0}
                  saves={row.saves}
                  shares={row.shares}
                  reposts={row.reposts}
                >
                  <a
                    href={row.link_url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-[18px] py-3 transition hover:bg-[var(--surface-hover)]"
                  >
                    <span className="w-5 shrink-0 text-[11px] font-semibold tabular-nums text-[var(--muted)]">
                      {idx + 1}
                    </span>
                    <CreatorPhoto creator={poolCreatorFromLink(row)} size="thumb" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[var(--ink)]">
                        {inf?.name || "—"}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-[var(--muted)]">
                        {[company, product, platformLabel(row.link_url)]
                          .filter(Boolean)
                          .join(" · ")}
                        {showsViewsSubline(metric)
                          ? ` · 조회 ${formatMetric(row.views ?? 0)}`
                          : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[13px] font-semibold tabular-nums text-[var(--accent)]">
                        {formatTopMetric(value, metric)}
                      </span>
                      <span className="text-[10.5px] text-[var(--muted)]">
                        {topMetricUnit(metric)}
                      </span>
                    </span>
                  </a>
                </ContentMetricsTip>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PlatformErPanel({
  rows,
}: {
  rows: { label: string; views: number; likes: number; comments: number; color: string }[];
}) {
  const maxEr = Math.max(...rows.map((r) => er(r.views, r.likes, r.comments)), 0.1);
  return (
    <div className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
      <PanelTitle title="플랫폼별 ER" why={METRIC_WHY.platformEr} />
      {rows.length === 0 ? (
        <p className="px-[18px] py-6 text-sm text-[var(--muted)]">데이터 없음</p>
      ) : (
        <ul className="space-y-3.5 px-[18px] py-4">
          {rows.map((row) => {
            const rate = er(row.views, row.likes, row.comments);
            return (
              <li key={row.label}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="flex items-center gap-2 font-medium text-[var(--ink)]">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: row.color }}
                    />
                    {row.label}
                  </span>
                  <span className="tabular-nums font-semibold text-[var(--accent)]">
                    {fmtPct(rate)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(4, (rate / maxEr) * 100)}%`,
                      background: row.color,
                    }}
                  />
                </div>
                <p className="mt-1 text-[10.5px] text-[var(--muted)]">
                  조회 {formatMetric(row.views)} · 좋아요 {formatMetric(row.likes)} · 댓글{" "}
                  {formatMetric(row.comments)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatCurveAxis(day: number, useHours: boolean) {
  if (useHours) {
    const h = Math.max(0, Math.round(day * 24));
    return `${h}시간`;
  }
  return `D+${Math.max(0, Math.floor(day))}`;
}

function ViewsCurve({ points }: { points: { day: number; views: number }[] }) {
  if (points.length < 2) {
    return (
      <p className="mt-6 py-8 text-center text-sm text-[var(--muted)]">
        첫 업로드 이후 수집 시각이 2회 이상이면 곡선이 표시됩니다.
      </p>
    );
  }
  const maxViews = Math.max(...points.map((p) => p.views), 1);
  const maxDay = Math.max(points[points.length - 1]?.day ?? 0, 1e-9);
  const useHours = maxDay < 1;
  const W = 520;
  const H = 170;
  const pad = { l: 34, r: 10, t: 20, b: 30 };

  const pts = points.map((p) => ({
    x: pad.l + (p.day / maxDay) * (W - pad.l - pad.r),
    y: pad.t + (1 - p.views / maxViews) * (H - pad.t - pad.b),
  }));

  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - pad.b} L${pts[0].x.toFixed(1)},${H - pad.b} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2.5 h-[180px] w-full" aria-hidden>
      {[20, 60, 100, 140].map((y) => (
        <line key={y} x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#efe4d6" strokeWidth={1} />
      ))}
      <path d={area} fill="var(--accent)" opacity={0.07} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
      <text x={8} y={24} fill="var(--muted)" fontSize={9.5}>
        {formatMetric(maxViews)}
      </text>
      <text x={pad.l} y={H - 6} fill="var(--muted)" fontSize={9.5}>
        {formatCurveAxis(0, useHours)}
      </text>
      <text x={W / 2 - 12} y={H - 6} fill="var(--muted)" fontSize={9.5}>
        {formatCurveAxis(maxDay / 2, useHours)}
      </text>
      <text x={W - 48} y={H - 6} fill="var(--muted)" fontSize={9.5}>
        {formatCurveAxis(maxDay, useHours)}
      </text>
    </svg>
  );
}

function PlatformDonut({
  segments,
  totals,
}: {
  segments: { label: string; views: number; color: string }[];
  totals: { views: number; likes: number; comments: number };
}) {
  const totalViews = segments.reduce((s, x) => s + x.views, 0) || 1;
  const r = 38;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col">
      <div className="mt-3 flex items-center gap-[18px]">
        <svg viewBox="0 0 100 100" className="h-[120px] w-[120px] -rotate-90">
          <circle cx={50} cy={50} r={r} fill="none" stroke="#f0e6d8" strokeWidth={15} />
          {segments.map((seg) => {
            const dash = (seg.views / totalViews) * c;
            const el = (
              <circle
                key={seg.label}
                cx={50}
                cy={50}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={15}
                strokeDasharray={`${dash} ${c}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="flex flex-col gap-2.5 text-[12.5px]">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: seg.color }}
              />
              {seg.label}{" "}
              <b>{Math.round((seg.views / totalViews) * 100)}%</b>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-auto flex justify-between border-t border-[#f0e6d8] pt-3 text-xs text-[var(--muted)]">
        <span>ER {fmtPct(er(totals.views, totals.likes, totals.comments))}%</span>
        <span>조회 {formatMetric(totals.views)}</span>
        <span>좋아요 {formatMetric(totals.likes)}</span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  delta,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)] px-[18px] py-4">
      <div className="flex items-start justify-between">
        <span className="text-[12.5px] text-[var(--muted)]">{label}</span>
        {delta ? <span className="text-[11px] text-[var(--accent)]">{delta}</span> : null}
      </div>
      <p className="mt-2.5 text-[27px] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)]">
        {value}
        {unit ? (
          <span className="ml-1 text-[13px] font-normal text-[var(--muted)]">{unit}</span>
        ) : null}
      </p>
    </div>
  );
}

export function CompanyPerformanceTab({
  companyId,
  initialData,
  period = "all",
  onPeriodChange,
  onMetaChange,
  insightsUrl = "/api/com/insights",
  enableRecollect = true,
  embedded = false,
}: {
  companyId: string;
  initialData?: InitialPerformanceData;
  period?: ContentPeriod;
  onPeriodChange?: (p: ContentPeriod) => void;
  onMetaChange?: (meta: {
    asOf: string;
    lastCollected: string | null;
    nextCollectAt: string | null;
  }) => void;
  /** 기본: 회원사 세션 API. admin은 /api/admin/insights */
  insightsUrl?: string;
  enableRecollect?: boolean;
  /** admin 등 상위 헤더가 있을 때 타이틀 숨김 */
  embedded?: boolean;
}) {
  const [allLinks, setAllLinks] = useState<LinkRow[]>(initialData?.links ?? []);
  const [allMetrics, setAllMetrics] = useState<MetricRow[]>(initialData?.metrics ?? []);
  const [collectedAt, setCollectedAt] = useState<string | null>(
    initialData?.collectedAt ?? null,
  );
  const [nextCollectAt, setNextCollectAt] = useState<string | null>(
    initialData?.nextCollectAt ?? null,
  );
  const [source, setSource] = useState<"mock" | "apify">(
    initialData?.source ?? "apify",
  );
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [recollecting, setRecollecting] = useState(false);
  const [recollectMsg, setRecollectMsg] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const asOfYmd = ymdKst(new Date());
  const canRecollect = enableRecollect && source !== "mock";

  function applyPayload(data: {
    links?: LinkRow[];
    metrics?: MetricRow[];
    collectedAt?: string | null;
    nextCollectAt?: string | null;
    source?: string;
  }) {
    setAllLinks(Array.isArray(data.links) ? data.links : []);
    setAllMetrics(Array.isArray(data.metrics) ? data.metrics : []);
    setCollectedAt(data.collectedAt ?? null);
    setNextCollectAt(data.nextCollectAt ?? null);
    setSource(data.source === "mock" ? "mock" : "apify");
  }

  async function reload() {
    setRefreshing(true);
    try {
      const res = await fetch(insightsUrl);
      const data = await res.json();
      if (!res.ok) return; // 실패 시 빈 화면으로 덮지 않음
      applyPayload(data);
    } catch {
      /* keep last snapshot */
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  async function recollectMetrics() {
    if (!canRecollect || recollecting) return;
    setRecollecting(true);
    setRecollectMsg(null);
    try {
      const res = await fetch("/api/com/insights/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "재수집 실패");
      }
      const parts = [
        `완료 ${body.ok ?? 0}`,
        `실패 ${body.failed ?? 0}`,
        body.truncated ? `최근 ${body.max}건만` : null,
      ].filter(Boolean);
      setRecollectMsg(parts.join(" · "));
      await reload();
    } catch (err) {
      setRecollectMsg(
        err instanceof Error ? err.message : "재수집 중 오류가 발생했습니다.",
      );
    } finally {
      setRecollecting(false);
    }
  }

  useEffect(() => {
    if (initialData) return;
    setLoading(true);
    void reload();
    // 첫 조회만. 이후는 「다시 조회」
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, initialData, insightsUrl]);

  useEffect(() => {
    onMetaChange?.({
      asOf: formatMd(asOfYmd),
      lastCollected: collectedAt,
      nextCollectAt,
    });
  }, [asOfYmd, collectedAt, nextCollectAt, onMetaChange]);

  const periodFilteredLinks = useMemo(() => {
    if (period !== "month") return allLinks;
    const monthKey = asOfYmd.slice(0, 7);
    return allLinks.filter((l) => l.published_at?.slice(0, 7) === monthKey);
  }, [allLinks, period, asOfYmd]);

  const links = useMemo(
    () =>
      productId
        ? periodFilteredLinks.filter((l) => l.allocations?.products?.id === productId)
        : periodFilteredLinks,
    [periodFilteredLinks, productId],
  );
  const metrics = useMemo(
    () => allMetrics.filter((m) => links.some((l) => l.id === m.creator_link_id)),
    [allMetrics, links],
  );

  const products = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of periodFilteredLinks) {
      const p = l.allocations?.products;
      if (p) map.set(p.id, p.name);
    }
    return [...map.entries()];
  }, [periodFilteredLinks]);

  const topByViews = useMemo(
    () =>
      [...links]
        .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
        .slice(0, 5),
    [links],
  );

  const topByLikes = useMemo(
    () =>
      [...links]
        .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
        .slice(0, 5),
    [links],
  );

  const topByLikeRate = useMemo(
    () =>
      [...links]
        .filter((l) => (l.views ?? 0) >= RATIO_MIN_VIEWS)
        .sort(
          (a, b) =>
            topMetricValue(b, { kind: "likeRate" }) -
            topMetricValue(a, { kind: "likeRate" }),
        )
        .slice(0, 5),
    [links],
  );

  const topByCommentRate = useMemo(
    () =>
      [...links]
        .filter((l) => (l.views ?? 0) >= RATIO_MIN_VIEWS)
        .sort(
          (a, b) =>
            topMetricValue(b, { kind: "commentRate" }) -
            topMetricValue(a, { kind: "commentRate" }),
        )
        .slice(0, 5),
    [links],
  );

  const topByEr = useMemo(
    () =>
      [...links]
        .filter((l) => (l.views ?? 0) >= RATIO_MIN_VIEWS)
        .sort(
          (a, b) =>
            topMetricValue(b, { kind: "er" }) - topMetricValue(a, { kind: "er" }),
        )
        .slice(0, 5),
    [links],
  );

  const topBySaves = useMemo(
    () =>
      [...links]
        .filter((l) => l.saves != null && (l.saves ?? 0) > 0)
        .sort((a, b) => (b.saves ?? 0) - (a.saves ?? 0))
        .slice(0, 5),
    [links],
  );

  const topByShares = useMemo(
    () =>
      [...links]
        .filter((l) => l.shares != null && (l.shares ?? 0) > 0)
        .sort((a, b) => (b.shares ?? 0) - (a.shares ?? 0))
        .slice(0, 5),
    [links],
  );

  const topByReposts = useMemo(
    () =>
      [...links]
        .filter((l) => l.reposts != null && (l.reposts ?? 0) > 0)
        .sort((a, b) => (b.reposts ?? 0) - (a.reposts ?? 0))
        .slice(0, 5),
    [links],
  );

  const timelineStartIso = useMemo(() => {
    let minTs: number | null = null;
    for (const l of links) {
      if (!l.published_at) continue;
      const ts = new Date(l.published_at).getTime();
      if (!Number.isFinite(ts)) continue;
      if (minTs == null || ts < minTs) minTs = ts;
    }
    return minTs == null ? null : new Date(minTs).toISOString();
  }, [links]);

  /** D+1~2 스냅샷 우선, 없으면 첫·둘째 수집 조회 증가분 */
  const { topByEarly, earlyAside } = useMemo(() => {
    const publishedAtMap = new Map(links.map((l) => [l.id, l.published_at]));
    const earlyViews = new Map<string, number>();
    for (const m of metrics) {
      const pub = publishedAtMap.get(m.creator_link_id);
      if (!pub) continue;
      const dayDiff = Math.floor(
        (new Date(m.collected_at).getTime() - new Date(pub).getTime()) / 86400000,
      );
      if (dayDiff < 1 || dayDiff > 2) continue;
      const prev = earlyViews.get(m.creator_link_id);
      if (prev == null || m.views > prev) earlyViews.set(m.creator_link_id, m.views);
    }
    if (earlyViews.size > 0) {
      return {
        topByEarly: links
          .filter((l) => (earlyViews.get(l.id) ?? 0) > 0)
          .map((l) => ({ ...l, earlyViews: earlyViews.get(l.id) ?? 0 }))
          .sort((a, b) => b.earlyViews - a.earlyViews)
          .slice(0, 5),
        earlyAside: "D+1~2 스냅샷",
      };
    }

    // 발행 직후 수집 이력이 없을 때: 첫·둘째 수집 사이 증가
    const byLink = new Map<string, MetricRow[]>();
    for (const m of metrics) {
      const arr = byLink.get(m.creator_link_id) || [];
      arr.push(m);
      byLink.set(m.creator_link_id, arr);
    }
    const growth = new Map<string, number>();
    for (const [id, rows] of byLink) {
      if (rows.length < 2) continue;
      const sorted = [...rows].sort(
        (a, b) =>
          new Date(a.collected_at).getTime() - new Date(b.collected_at).getTime(),
      );
      const delta = sorted[1].views - sorted[0].views;
      if (delta > 0) growth.set(id, delta);
    }
    return {
      topByEarly: links
        .filter((l) => (growth.get(l.id) ?? 0) > 0)
        .map((l) => ({ ...l, earlyViews: growth.get(l.id) ?? 0 }))
        .sort((a, b) => b.earlyViews - a.earlyViews)
        .slice(0, 5),
      earlyAside: "첫·둘째 수집 증가",
    };
  }, [links, metrics]);

  const curvePoints = useMemo(() => {
    if (!timelineStartIso || metrics.length === 0) return [];
    const startTs = new Date(timelineStartIso).getTime();
    // 수집 시각마다: 그 시점까지 각 콘텐츠의 최신 조회를 합산 (같은 날 재수집도 곡선에 반영)
    const times = [
      ...new Set(
        metrics
          .map((m) => m.collected_at)
          .filter((t) => new Date(t).getTime() >= startTs),
      ),
    ].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    if (times.length < 2) return [];

    return times.map((t) => {
      const tMs = new Date(t).getTime();
      const latest = new Map<string, number>();
      for (const m of metrics) {
        const cMs = new Date(m.collected_at).getTime();
        if (cMs > tMs) continue;
        const prev = latest.get(m.creator_link_id);
        if (prev == null || m.views > prev) latest.set(m.creator_link_id, m.views);
      }
      return {
        day: Math.max(0, (tMs - startTs) / 86400000),
        views: [...latest.values()].reduce((sum, v) => sum + v, 0),
      };
    });
  }, [metrics, timelineStartIso]);
  const platformErRows = useMemo(() => {
    const map = new Map<
      string,
      { label: string; views: number; likes: number; comments: number }
    >();
    for (const l of links) {
      const label = platformLabel(l.link_url);
      const row = map.get(label) || {
        label,
        views: 0,
        likes: 0,
        comments: 0,
      };
      row.views += l.views ?? 0;
      row.likes += l.likes ?? 0;
      row.comments += l.comments ?? 0;
      map.set(label, row);
    }
    const colors: Record<string, string> = {
      Instagram: "var(--accent)",
      TikTok: "#c08b5c",
      YouTube: "#a67c52",
      기타: "#d9c3a5",
    };
    return [...map.values()]
      .filter((r) => r.views > 0)
      .sort(
        (a, b) =>
          er(b.views, b.likes, b.comments) - er(a.views, a.likes, a.comments),
      )
      .map((r) => ({ ...r, color: colors[r.label] || "#c08b5c" }));
  }, [links]);

  const metaLine = performanceMetaCopy({
    asOfYmd,
    collectedAt,
    nextCollectAt:
      nextCollectAt ||
      (source === "mock" ? `${addDaysYmd(asOfYmd, 1)}T00:00:00+09:00` : null),
    source,
  });

  const totals = useMemo(() => {
    const views = links.reduce((s, l) => s + (l.views ?? 0), 0);
    const likes = links.reduce((s, l) => s + (l.likes ?? 0), 0);
    const comments = links.reduce((s, l) => s + (l.comments ?? 0), 0);
    const influencerIds = new Set(
      links.map((l) => l.allocations?.influencer_id).filter(Boolean),
    );
    return {
      views,
      likes,
      comments,
      posts: links.length,
      influencers: influencerIds.size,
    };
  }, [links]);

  const byProduct = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; views: number; likes: number; comments: number; posts: number }
    >();
    for (const l of links) {
      const p = l.allocations?.products;
      const key = p?.id || "unknown";
      const row = map.get(key) || {
        id: key,
        name: p?.name || "상품",
        views: 0,
        likes: 0,
        comments: 0,
        posts: 0,
      };
      row.views += l.views ?? 0;
      row.likes += l.likes ?? 0;
      row.comments += l.comments ?? 0;
      row.posts += 1;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.views - a.views);
  }, [links]);

  const byCompany = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; views: number; likes: number; comments: number; posts: number }
    >();
    for (const l of links) {
      const c = l.allocations?.companies;
      const key = c?.id || l.allocations?.company_id || "unknown";
      const row = map.get(key) || {
        id: key,
        name: c?.name || "회원사",
        views: 0,
        likes: 0,
        comments: 0,
        posts: 0,
      };
      row.views += l.views ?? 0;
      row.likes += l.likes ?? 0;
      row.comments += l.comments ?? 0;
      row.posts += 1;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.views - a.views);
  }, [links]);

  const maxProductViews = byProduct[0]?.views || 1;
  const maxCompanyViews = byCompany[0]?.views || 1;
  const showCompanyBreakdown = byCompany.length > 1;

  const platformSegments = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of links) {
      const url = l.link_url || "";
      const plat = url.includes("tiktok")
        ? "TikTok"
        : url.includes("instagram")
          ? "Instagram"
          : "기타";
      map.set(plat, (map.get(plat) ?? 0) + (l.views ?? 0));
    }
    const colors: Record<string, string> = {
      Instagram: "var(--accent)",
      TikTok: "#c08b5c",
      기타: "#d9c3a5",
    };
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, views]) => ({ label, views, color: colors[label] || "#c08b5c" }));
  }, [links]);

  if (loading) {
    return (
      <div className="space-y-3 px-[28px] py-[26px]">
        <div className="h-10 animate-pulse rounded-xl bg-[var(--surface-hover)]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[18px] bg-[var(--surface-hover)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        embedded
          ? "flex min-h-0 flex-1 flex-col gap-[18px] overflow-auto px-1 py-2"
          : "flex min-h-0 flex-1 flex-col gap-[18px] overflow-auto px-[28px] py-[26px]"
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        {embedded ? (
          <div />
        ) : (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Performance
            </p>
            <h2
              className="mt-2 text-[30px] font-semibold leading-tight text-[var(--ink)]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              성과
            </h2>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void reload()}
            disabled={refreshing || recollecting}
            className="h-[38px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13px] font-semibold text-[var(--ink)] disabled:opacity-50"
          >
            {refreshing ? "조회 중…" : "다시 조회"}
          </button>
          {canRecollect ? (
            <button
              type="button"
              onClick={() => void recollectMetrics()}
              disabled={recollecting || refreshing}
              className="h-[38px] rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3.5 text-[13px] font-semibold text-[var(--accent)] disabled:opacity-50"
            >
              {recollecting ? "재수집 중…" : "지표 재수집"}
            </button>
          ) : null}
          <select
            className="h-[38px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13px] text-[#5b4130]"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">상품 전체</option>
            {products.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          {onPeriodChange ? (
            <div className="flex h-[38px] items-center gap-1 rounded-full border border-[var(--line)] bg-[#f5ede3] p-1">
              {(["month", "all"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPeriodChange(p)}
                  className={`flex h-[30px] items-center rounded-full px-3.5 text-[12.5px] ${
                    period === p
                      ? "bg-[var(--accent)] font-medium !text-white"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {p === "month" ? "이번달" : "전체"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <p className="text-[11.5px] leading-relaxed text-[var(--muted)]">{metaLine}</p>
      {recollectMsg ? (
        <p className="text-[12px] text-[var(--accent)]">{recollectMsg}</p>
      ) : null}

      {links.length === 0 ? (
        <EmptyState
          title="발행된 콘텐츠가 없습니다"
          message="성과는 발행완료 건만 집계합니다. 승인된 콘텐츠는 진행현황의 검수중에 있습니다."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <StatCard label="조회수" value={formatMetric(totals.views)} />
            <StatCard label="좋아요" value={formatMetric(totals.likes)} />
            <StatCard label="콘텐츠" value={`${totals.posts}`} unit="건" />
            <StatCard label="인플루언서" value={`${totals.influencers}`} unit="명" />
          </div>

          {showCompanyBreakdown ? (
            <div className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
              <PanelTitle title="회원사별 성과" why={METRIC_WHY.company} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-left text-[12.5px]">
                  <thead>
                    <tr className="text-[var(--muted)]">
                      <th className="px-[18px] py-2 font-medium">회원사</th>
                      <th className="w-[88px] px-3 py-2 font-medium">조회</th>
                      <th className="w-[80px] px-3 py-2 font-medium">좋아요</th>
                      <th className="w-[60px] px-3 py-2 font-medium">ER</th>
                      <th className="w-[60px] px-[18px] py-2 font-medium">콘텐츠</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCompany.map((row) => (
                      <tr key={row.id} className="border-t border-[#f4ece2]">
                        <td className="px-[18px] py-[11px]">
                          <div className="mb-1.5">{row.name}</div>
                          <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                            <div
                              className="h-full rounded-full bg-[var(--accent)]"
                              style={{
                                width: `${Math.max(4, (row.views / maxCompanyViews) * 100)}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-[11px] font-semibold tabular-nums">
                          {formatMetric(row.views)}
                        </td>
                        <td className="px-3 py-[11px] tabular-nums">
                          {formatMetric(row.likes)}
                        </td>
                        <td className="px-3 py-[11px] tabular-nums">
                          {fmtPct(er(row.views, row.likes, row.comments))}%
                        </td>
                        <td className="px-[18px] py-[11px] tabular-nums">{row.posts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3.5 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
              <div className="flex items-center justify-between gap-2 px-[18px] py-3.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13.5px] font-semibold text-[var(--ink)]">
                    조회수 곡선{" "}
                    <span className="font-normal text-[var(--muted)]">캠페인 개시 이후 성과</span>
                  </span>
                  <InfoTip text={METRIC_WHY.curve} />
                </div>
                <span className="text-[11.5px] text-[var(--muted)]">
                  {(() => {
                    const maxDay = curvePoints[curvePoints.length - 1]?.day ?? 0;
                    if (curvePoints.length === 0) return "첫 업로드 기준";
                    if (maxDay < 1) return `0시간 ~ ${Math.round(maxDay * 24)}시간`;
                    return `D+0 ~ D+${Math.floor(maxDay)}`;
                  })()}
                </span>
              </div>
              <div className="px-[18px] pb-[18px]">
                <ViewsCurve points={curvePoints} />
              </div>
            </div>
            <div className="flex min-h-[220px] flex-col rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
              <div className="flex items-center gap-1.5 px-[18px] py-3.5">
                <span className="text-[13.5px] font-semibold text-[var(--ink)]">
                  플랫폼별 성과
                </span>
                <InfoTip text={METRIC_WHY.platformShare} />
              </div>
              <div className="flex flex-1 flex-col px-[18px] pb-[18px]">
                <PlatformDonut
                  segments={platformSegments}
                  totals={{ views: totals.views, likes: totals.likes, comments: totals.comments }}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3.5 lg:grid-cols-3">
            <TopContentPanel
              title="조회수 TOP"
              why={METRIC_WHY.views}
              metric={{ kind: "views" }}
              items={topByViews}
            />
            <TopContentPanel
              title="좋아요 TOP"
              why={METRIC_WHY.likes}
              metric={{ kind: "likes" }}
              items={topByLikes}
            />
            <TopContentPanel
              title="조회수 대비 좋아요 TOP"
              why={METRIC_WHY.likeRate}
              metric={{ kind: "likeRate" }}
              items={topByLikeRate}
              aside={`조회 ${RATIO_MIN_VIEWS.toLocaleString("ko-KR")}+`}
            />
          </div>

          <div className="grid gap-3.5 lg:grid-cols-3">
            <TopContentPanel
              title="저장 TOP"
              why={METRIC_WHY.saves}
              metric={{ kind: "saves" }}
              items={topBySaves}
            />
            <TopContentPanel
              title="공유 TOP"
              why={METRIC_WHY.shares}
              metric={{ kind: "shares" }}
              items={topByShares}
            />
            <TopContentPanel
              title="리포스트 TOP"
              why={METRIC_WHY.reposts}
              metric={{ kind: "reposts" }}
              items={topByReposts}
            />
          </div>

          <div className="grid gap-3.5 lg:grid-cols-3">
            <TopContentPanel
              title="댓글 반응 TOP"
              why={METRIC_WHY.commentRate}
              metric={{ kind: "commentRate" }}
              items={topByCommentRate}
              aside={`조회 ${RATIO_MIN_VIEWS.toLocaleString("ko-KR")}+`}
            />
            <TopContentPanel
              title="참여율(ER) TOP"
              why={METRIC_WHY.er}
              metric={{ kind: "er" }}
              items={topByEr}
              aside={`조회 ${RATIO_MIN_VIEWS.toLocaleString("ko-KR")}+`}
            />
            <TopContentPanel
              title="초기 반응"
              why={METRIC_WHY.early}
              metric={{ kind: "earlyViews" }}
              items={topByEarly}
              aside={earlyAside}
            />
          </div>

          <div className="grid items-start gap-3.5 lg:grid-cols-2">
            <PlatformErPanel rows={platformErRows} />
            <div className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
              <PanelTitle title="상품별 성과" why={METRIC_WHY.product} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-left text-[12.5px]">
                  <thead>
                    <tr className="text-[var(--muted)]">
                      <th className="px-[18px] py-2 font-medium">상품</th>
                      <th className="w-[88px] px-3 py-2 font-medium">조회</th>
                      <th className="w-[80px] px-3 py-2 font-medium">좋아요</th>
                      <th className="w-[60px] px-3 py-2 font-medium">ER</th>
                      <th className="w-[60px] px-[18px] py-2 font-medium">콘텐츠</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byProduct.map((row) => (
                      <tr key={row.id} className="border-t border-[#f4ece2]">
                        <td className="px-[18px] py-[11px]">
                          <div className="mb-1.5">{row.name}</div>
                          <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                            <div
                              className="h-full rounded-full bg-[var(--accent)]"
                              style={{
                                width: `${Math.max(4, (row.views / maxProductViews) * 100)}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-[11px] font-semibold tabular-nums">
                          {formatMetric(row.views)}
                        </td>
                        <td className="px-3 py-[11px] tabular-nums">
                          {formatMetric(row.likes)}
                        </td>
                        <td className="px-3 py-[11px] tabular-nums">
                          {fmtPct(er(row.views, row.likes, row.comments))}%
                        </td>
                        <td className="px-[18px] py-[11px] tabular-nums">{row.posts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
