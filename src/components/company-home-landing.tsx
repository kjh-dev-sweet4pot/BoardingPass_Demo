"use client";

import {
  cloneElement,
  Fragment,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type TransitionEvent,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { CreatorPhoto } from "@/components/creator-photo";
import {
  CompanyHomePerformanceBoard,
  CompanyHomeShareDonuts,
  CompanyHomeVisitBoard,
} from "@/components/company-home-performance-board";
import {
  daysAgoLabel,
  displayHandle,
  formatHomeViews,
  groupByDay,
  pickNewsFeed,
  monotoneCurvePath,
  type CompanyHomeBestPost,
  type CompanyHomeInfluencerRow,
  type CompanyHomeNewsItem,
  type CompanyHomePayload,
  type HomeInsightLink,
} from "@/lib/company-home";
import { formatFollowers, resolvePoolCreator } from "@/lib/creator-pool-mock";
import { formatMd } from "@/lib/types";

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
            className="com-home-donut-arc"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={c.toFixed(2)}
            strokeDashoffset={off.toFixed(2)}
            style={
              {
                "--donut-c": c.toFixed(2),
                "--donut-off": off.toFixed(2),
              } as CSSProperties
            }
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
    "flex h-[88px] w-full items-center gap-3 overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 com-surface";
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
    "flex h-[88px] w-full items-center gap-3 overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 com-surface";
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
  const line = monotoneCurvePath(pts);
  const last = pts[pts.length - 1]!;
  const first = pts[0]!;
  const area = `${line} L${last.x.toFixed(1)},${H - pad.b} L${first.x.toFixed(1)},${H - pad.b} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[52px] w-full" aria-hidden>
      <path d={area} fill="var(--accent)" opacity={0.1} />
      <path
        d={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
    "flex h-[88px] w-full items-center gap-2 overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 com-surface";
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
const RANK_SLIDE_MS = 420;
const RANK_ROW_INTERACT =
  "cursor-pointer hover:bg-[var(--accent-soft)] hover:shadow-[inset_3px_0_0_0_var(--accent)] focus-visible:bg-[var(--accent-soft)] focus-visible:shadow-[inset_3px_0_0_0_var(--accent)] focus-visible:outline-none";

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
        className={`${cls} ${RANK_ROW_INTERACT}`}
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
        className={`${cls} ${RANK_ROW_INTERACT}`}
      >
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/** 4줄 고정 뷰포트 · 3초마다 한 줄씩 위로 밀기. 호버/포커스 시 멈춤. */
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
  const [paused, setPaused] = useState(false);
  const wrapping = useRef(false);

  useEffect(() => {
    setOffset(0);
    setAnimate(true);
    wrapping.current = false;
  }, [n]);

  useEffect(() => {
    if (!canScroll || paused) return;
    const id = window.setInterval(() => {
      setAnimate(true);
      setOffset((o) => (o >= n ? o : o + 1));
    }, RANK_TICK_MS);
    return () => window.clearInterval(id);
  }, [canScroll, n, paused]);

  function snapLoop() {
    if (wrapping.current) return;
    wrapping.current = true;
    setAnimate(false);
    setOffset(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        wrapping.current = false;
        setAnimate(true);
      });
    });
  }

  function onTrackTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "transform") return;
    if (offset >= n) snapLoop();
  }

  useEffect(() => {
    if (!canScroll || offset < n) return;
    const t = window.setTimeout(snapLoop, RANK_SLIDE_MS + 80);
    return () => window.clearTimeout(t);
  }, [offset, n, canScroll]);

  if (n === 0) return null;

  const clones = rows.slice(0, RANK_VISIBLE).map((row, i) =>
    isValidElement(row) ? cloneElement(row, { key: `clone-${i}` }) : row,
  );
  const track = canScroll ? [...rows, ...clones] : rows.slice(0, RANK_VISIBLE);

  return (
    <div
      className="overflow-hidden"
      style={{ height: RANK_VISIBLE * RANK_ROW_PX }}
      aria-live="off"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
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
        onTransitionEnd={onTrackTransitionEnd}
      >
        {track.map((row, i) => (
          <div
            key={i < n ? `r-${i}` : `c-${i - n}`}
            style={{ height: RANK_ROW_PX }}
          >
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
      className={`com-surface scroll-mt-4 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors duration-150 ${
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

function NewsFace({
  id,
  name,
  handle,
  url,
  size,
}: {
  id: string;
  name: string;
  handle: string;
  url?: string | null;
  size: "sm" | "lg";
}) {
  return (
    <CreatorPhoto
      creator={resolvePoolCreator({ id, name, handle, url })}
      size="thumb"
      className={
        size === "lg"
          ? "!h-14 !w-14 shrink-0 !rounded-full"
          : "!h-9 !w-9 shrink-0 !rounded-full"
      }
    />
  );
}

function newsGhostBtnClass(ok: boolean) {
  return `inline-flex h-8 items-center justify-center rounded-[6px] border border-[var(--line)] text-[12px] font-semibold ${
    ok ? "" : "text-[var(--muted)]"
  }`;
}

function NewsDetailPanel({
  item,
  asOf,
  onOpenPerformance,
  onOpenProgress,
}: {
  item: CompanyHomeNewsItem;
  asOf: string;
  onOpenPerformance?: () => void;
  onOpenProgress?: (influencerId?: string) => void;
}) {
  const d = item.detail;
  if (d?.type !== "visit" && d?.type !== "publish") {
    return (
      <div className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-lg">
        <p className="text-[13px] font-bold">{item.title}</p>
        <p className="mt-1 text-[12px] text-[var(--muted)]">{item.body}</p>
      </div>
    );
  }
  const visit = d.type === "visit";
  const handle = displayHandle(d.handle);
  const leftHref = visit ? d.profileUrl : d.contentUrl;
  const rows: [string, string, string?][] = visit
    ? [
        ["방문일", `${d.visitDate} (${daysAgoLabel(d.visitDate, asOf)})`],
        ["매장", d.store],
        ["캠페인", d.product],
        ["콘텐츠", d.contentLabel, "text-[#6b5a45]"],
      ]
    : [
        ["발행일", `${d.day} (${daysAgoLabel(d.day, asOf)})`],
        ["캠페인", d.product],
        ["콘텐츠", "발행완료", "text-[#2f6b3c]"],
      ];
  return (
    <div className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-lg">
      <div className="flex items-start gap-2.5">
        <NewsFace
          id={d.influencerId}
          name={d.name}
          handle={d.handle}
          url={d.profileUrl}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold leading-tight text-[var(--ink)]">
            {d.name}
          </p>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-[var(--muted)]">
            {handle ? `@${handle}` : ""}
            {d.followers > 0 ? ` · ${formatFollowers(d.followers)} 팔로워` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            visit
              ? "bg-[#E7F3EA] text-[#2f6b3c]"
              : "bg-[#E8F0FC] text-[#1F5FD8]"
          }`}
        >
          {visit ? "방문" : "발행"}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-[3.25rem_1fr] gap-x-3 gap-y-1 text-[12px] leading-tight">
        {rows.map(([k, v, cls]) => (
          <Fragment key={k}>
            <dt className="text-[var(--muted)]">{k}</dt>
            <dd className={`text-right ${cls || ""}`}>{v}</dd>
          </Fragment>
        ))}
      </dl>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {leftHref ? (
          <a
            href={leftHref}
            target="_blank"
            rel="noopener noreferrer"
            className={newsGhostBtnClass(true)}
          >
            {visit ? "프로필" : "컨텐츠 보기"}
          </a>
        ) : (
          <span className={newsGhostBtnClass(false)}>
            {visit ? "프로필" : "컨텐츠 보기"}
          </span>
        )}
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center rounded-[6px] bg-[var(--accent)] text-[12px] font-semibold text-white"
          onClick={() =>
            visit ? onOpenProgress?.(d.influencerId) : onOpenPerformance?.()
          }
        >
          {visit ? "진행 현황에서 보기" : "성과 바로가기"}
        </button>
      </div>
      <p className="mt-2.5 text-[10.5px] leading-snug text-[var(--muted)]">
        {visit
          ? "발행되면 성과 탭에서 조회수를 볼 수 있습니다."
          : "조회·좋아요는 성과 탭에서 확인할 수 있습니다."}
      </p>
    </div>
  );
}

function NewsSidebar({
  items,
  asOf,
  insightLinks,
  insightsLoading,
  onOpenPerformance,
  onOpenProgress,
}: {
  items: CompanyHomeNewsItem[];
  asOf: string;
  insightLinks: HomeInsightLink[];
  insightsLoading: boolean;
  onOpenPerformance?: () => void;
  onOpenProgress?: (influencerId?: string) => void;
}) {
  const shown = pickNewsFeed(items);
  const groups = useMemo(() => groupByDay(shown, (i) => i.at), [shown]);
  const hideTimer = useRef<number | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [tipPos, setTipPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const hover = shown.find((n) => n.id === hoverId) || null;

  useEffect(() => setMounted(true), []);
  useEffect(
    () => () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    },
    [],
  );

  function cancelHide() {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }

  function scheduleHide() {
    cancelHide();
    hideTimer.current = window.setTimeout(() => {
      setHoverId(null);
      setTipPos(null);
    }, 160);
  }

  function placeHover(id: string, el?: HTMLElement | null) {
    cancelHide();
    const r = el?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(320, window.innerWidth - 24);
    const gap = 10;
    let left = r.left - width - gap;
    if (left < 8) left = 8;
    let top = r.top;
    const estH = 280;
    if (top + estH > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - estH - 8);
    }
    setHoverId(id);
    setTipPos({ top, left, width });
  }

  return (
    <aside className="flex w-full flex-col gap-3 self-start xl:w-[300px] xl:shrink-0">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-[18px] font-bold tracking-tight text-[var(--ink)]">
            소식
          </h2>
          {onOpenProgress ? (
            <button
              type="button"
              onClick={onOpenProgress}
              className="text-[12.5px] font-semibold text-[var(--accent)] hover:underline"
            >
              전체 보기 →
            </button>
          ) : null}
        </div>
        <p className="mt-0.5 text-[12px] text-[var(--muted)]">
          방문 · 발행 · 운영
        </p>
      </div>
      <div
        className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-3"
        onMouseLeave={scheduleHide}
      >
        {shown.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">아직 소식이 없습니다.</p>
        ) : (
          <div className="max-h-[360px] overflow-auto">
            {groups.map(([day, rows]) => {
              const fresh = rows.some((r) => isNewsFresh(r.at));
              return (
                <section key={day} className="mb-2 last:mb-0">
                  <div className="mb-1.5 flex items-center gap-2">
                    <p className="shrink-0 text-[12px] font-semibold text-[var(--ink)]">
                      {formatMd(day)}
                    </p>
                    <span className="h-px min-w-0 flex-1 bg-[var(--line)]" />
                    {fresh ? (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1F5FD8]" />
                    ) : null}
                  </div>
                  <ul className="m-0 list-none p-0">
                    {rows.map((item) => {
                      const visit =
                        item.detail?.type === "visit" ? item.detail : null;
                      const pub =
                        item.detail?.type === "publish" ? item.detail : null;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={`flex w-full items-center gap-2 rounded-[6px] py-1.5 text-left hover:bg-[var(--surface-hover)] ${
                              hoverId === item.id
                                ? "bg-[var(--surface-hover)]"
                                : ""
                            }`}
                            onMouseEnter={(e) =>
                              placeHover(item.id, e.currentTarget)
                            }
                            onFocus={(e) =>
                              placeHover(item.id, e.currentTarget)
                            }
                            onClick={(e) =>
                              placeHover(item.id, e.currentTarget)
                            }
                          >
                            {visit ? (
                              <NewsFace
                                id={visit.influencerId}
                                name={visit.name}
                                handle={visit.handle}
                                url={visit.profileUrl}
                                size="sm"
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-[#E8F0FC] text-[10px] font-bold text-[#1F5FD8]">
                                발행
                              </div>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-bold leading-snug text-[var(--ink)]">
                                {item.title}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] leading-snug text-[var(--muted)]">
                                {item.body}
                              </span>
                            </span>
                            {pub ? (
                              <span className="shrink-0 rounded-full bg-[#E8F0FC] px-1.5 py-0.5 text-[10px] font-semibold text-[#1F5FD8]">
                                발행
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-full bg-[#E7F3EA] px-1.5 py-0.5 text-[10px] font-semibold text-[#2f6b3c]">
                                방문
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
      {mounted && hover && tipPos
        ? createPortal(
            <div
              className="owm-theme fixed z-[200] !bg-transparent"
              style={{
                top: tipPos.top,
                left: tipPos.left,
                width: tipPos.width,
                background: "transparent",
              }}
              onMouseEnter={cancelHide}
              onMouseLeave={scheduleHide}
            >
              <NewsDetailPanel
                item={hover}
                asOf={asOf}
                onOpenPerformance={onOpenPerformance}
                onOpenProgress={onOpenProgress}
              />
            </div>,
            document.body,
          )
        : null}
      <CompanyHomeShareDonuts links={insightLinks} loading={insightsLoading} />
    </aside>
  );
}

export function CompanyHomeLanding({
  companyName,
  active = true,
  onOpenPerformance,
  onOpenPublish,
  onOpenPool,
}: {
  companyName: string;
  /** 탭이 보일 때만 60초 폴링. 마운트 시 1회 로드는 항상 함. */
  active?: boolean;
  onOpenPerformance?: () => void;
  onOpenPublish?: (influencerId?: string) => void;
  onOpenPool?: () => void;
}) {
  const [data, setData] = useState<CompanyHomePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flashMonthly, setFlashMonthly] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const monthlyRef = useRef<HTMLElement | null>(null);
  const homeEnterRef = useRef<HTMLDivElement | null>(null);
  const homeEnterReady = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
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
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      fetch("/api/com/home", { cache: "no-store" })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (!res.ok) return;
          setData(body as CompanyHomePayload);
          setError(null);
        })
        .catch(() => {
          /* 폴링 실패는 기존 화면 유지 */
        });
    }, 60_000);
    return () => window.clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active || !data || reduceMotion) return;
    const el = homeEnterRef.current;
    if (!el) return;
    if (!homeEnterReady.current) {
      homeEnterReady.current = true;
      return;
    }
    el.classList.remove("com-home-enter");
    void el.offsetWidth;
    el.classList.add("com-home-enter");
  }, [active, Boolean(data), reduceMotion]);
  const insightLinks = data?.links || [];
  const boardLoading = loading && !data;
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
          <p className="com-loading px-5 py-5 text-sm text-[var(--muted)] sm:px-8">
            불러오는 중…
          </p>
        ) : null}
        {error ? (
          <p className="px-5 py-3 text-sm text-[var(--danger)] sm:px-8">
            {error}
          </p>
        ) : null}

        {data ? (
          <div ref={homeEnterRef} className="com-home-enter">
            <p className="px-5 pt-3 text-[11.5px] text-[var(--muted)] sm:px-8">
              {companyName} · {data.asOf} 조회 시점 기준
            </p>
            <div className="com-home-kpis mt-3 grid grid-cols-1 gap-3 px-5 sm:grid-cols-2 sm:px-8 xl:grid-cols-3">
              <KpiHoverTip
                title="콘텐츠 발행"
                rows={[
                  {
                    label: "발행완료",
                    value: `${content?.published ?? 0}건`,
                  },
                  {
                    label: "배정",
                    value:
                      content?.target != null
                        ? `${content.target}건`
                        : "없음",
                  },
                  {
                    label: "진행률",
                    value:
                      content?.target
                        ? `${Math.round((content.published / content.target) * 100)}%`
                        : "—",
                  },
                ]}
                note="발행완료 배정 건수 / 전체 배정 건수입니다."
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
                        className="com-home-bar block h-full bg-[#2F7D5A]"
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

            <div className="com-home-boards flex flex-col gap-5 border-b border-[var(--line)] px-5 py-5 sm:px-8 xl:flex-row xl:items-start">
              <div className="min-w-0 flex-1">
                <CompanyHomePerformanceBoard
                  links={insightLinks}
                  loading={boardLoading}
                  error={null}
                  forecast={data.forecast}
                  onOpenMore={onOpenPerformance}
                />
              </div>
              <CompanyHomeVisitBoard
                visits={data.visits}
                onOpenProgress={onOpenPublish}
              />
              <NewsSidebar
                items={data.news}
                asOf={data.asOf}
                insightLinks={insightLinks}
                insightsLoading={boardLoading}
                onOpenPerformance={onOpenPerformance}
                onOpenProgress={onOpenPublish}
              />
            </div>

            <div className="com-home-ranks grid grid-cols-1 gap-4 px-5 py-5 sm:px-8 md:grid-cols-2 xl:grid-cols-4">
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
          </div>
        ) : null}
      </div>
    </div>
  );
}
