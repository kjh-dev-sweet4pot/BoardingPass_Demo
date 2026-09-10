"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CreatorPhoto } from "@/components/creator-photo";
import { formatMetric, formatViews } from "@/lib/content-insights";
import { resolveCreatorPlatform } from "@/lib/creator-link";
import {
  buildWeekSeries,
  groupByDay,
  regionLabel,
  shareSegmentsByPlatform,
  shareSegmentsByRegion,
  type CompanyHomeVisitRow,
  type CompanyHomeVisits,
  type HomeForecast,
  type HomeInsightLink,
  type WeekPoint,
  visitProfileHref,
} from "@/lib/company-home";
import { resolvePoolCreator } from "@/lib/creator-pool-mock";
import { formatMd } from "@/lib/types";

function CumulativeChart({
  points,
  forecastTail = false,
  forecastT = 1,
  lockMax,
}: {
  points: WeekPoint[];
  forecastTail?: boolean;
  forecastT?: number;
  lockMax?: { u: number; v: number; l: number; s: number };
}) {
  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--muted)]">
        누적 성과 데이터가 없습니다.
      </p>
    );
  }
  const W = 720;
  const H = 210;
  const pad = { l: 28, r: 18, t: 22, b: 36 };
  const maxU = Math.max(...points.map((p) => p.uploads), lockMax?.u ?? 0, 1);
  const maxV = Math.max(...points.map((p) => p.views), lockMax?.v ?? 0, 1);
  const maxL = Math.max(...points.map((p) => p.likes), lockMax?.l ?? 0, 1);
  const maxS = Math.max(...points.map((p) => p.saves), lockMax?.s ?? 0, 1);
  const OTHER_SCALE = 4;
  const n = points.length;
  const plotH = H - pad.t - pad.b;
  const span = W - pad.l - pad.r;
  const t = forecastTail && n > 1 ? Math.max(0, Math.min(1, forecastT)) : 1;
  const denom = forecastTail && n > 1 ? n - 2 + t : Math.max(n - 1, 1);
  const xAt = (i: number) => {
    if (forecastTail && n > 1 && i === n - 1) {
      return pad.l + ((n - 2 + t) / Math.max(denom, 0.001)) * span;
    }
    return pad.l + (i / Math.max(denom, 0.001)) * span;
  };
  const yAt = (v: number, max: number) => pad.t + (1 - v / max) * plotH;
  const split = forecastTail && n > 1 ? n - 2 : n - 1;
  const grid = forecastTail ? "#c5d4e4" : "#efe4d6";
  const barW = Math.min(
    22,
    Math.max(8, (span / Math.max(n, 1)) * 0.45),
  );
  const pathBetween = (vals: number[], max: number, from: number, to: number) =>
    vals
      .map((v, i) => {
        if (i < from || i > to) return "";
        return `${i === from ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(v, max).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");
  const series = [
    { vals: points.map((p) => p.views), max: maxV, color: "#3b82f6", w: 2.4 },
    {
      vals: points.map((p) => p.likes),
      max: maxL * OTHER_SCALE,
      color: forecastTail ? "#c2410c" : "#f59e0b",
      w: 2,
    },
    {
      vals: points.map((p) => p.saves),
      max: maxS * OTHER_SCALE,
      color: forecastTail ? "#0f766e" : "#22c55e",
      w: 2,
    },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[210px] w-full" aria-hidden>
      {[0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.t + (1 - t) * plotH;
        return (
          <line
            key={t}
            x1={pad.l}
            y1={y}
            x2={W - pad.r}
            y2={y}
            stroke={grid}
            strokeWidth={1}
          />
        );
      })}
      {points.map((p, i) => {
        const h = Math.max(
          (plotH * p.uploads) / (maxU * OTHER_SCALE),
          p.uploads > 0 ? 2 : 0,
        );
        const y = pad.t + plotH - h;
        const isForecast = forecastTail && i === n - 1;
        const isLast = i === n - 1;
        return (
          <g key={`bar-${p.key}`}>
            <rect
              x={xAt(i) - barW / 2}
              y={y}
              width={barW}
              height={h}
              rx={3}
              fill={isForecast ? "#1e3a5f" : isLast ? "#3b82f6" : "#93c5fd"}
              opacity={isForecast ? 0.35 + 0.55 * t : isLast ? 0.9 : 0.45}
            />
            {isLast ? (
              <text
                x={xAt(i)}
                y={y - 5}
                textAnchor="middle"
                fill={isForecast ? "#1e3a5f" : "#3b82f6"}
                fontSize={10}
                fontWeight={700}
              >
                {p.uploads}
              </text>
            ) : null}
          </g>
        );
      })}
      {series.map((s) => (
        <g key={s.color}>
          <path
            d={pathBetween(s.vals, s.max, 0, split)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.w}
          />
          {forecastTail && n > 1 ? (
            <path
              d={pathBetween(s.vals, s.max, split, n - 1)}
              className={t > 0.85 ? "bp-forecast-stroke" : undefined}
              fill="none"
              stroke={s.color}
              strokeWidth={s.w}
              strokeDasharray="7 5"
              opacity={t}
            />
          ) : null}
        </g>
      ))}
      {points.map((p, i) => (
        <text
          key={p.key}
          x={xAt(i)}
          y={H - 10}
          textAnchor="middle"
          fill={forecastTail && i === n - 1 ? "#1e3a5f" : "var(--muted)"}
          fontSize={n > 8 ? 8 : 9}
          fontWeight={forecastTail && i === n - 1 ? 700 : 400}
          opacity={forecastTail && i === n - 1 ? t : 1}
        >
          {p.axisLabel}
        </text>
      ))}
    </svg>
  );
}

function ShareDonut({
  title,
  sub,
  segments,
  colors,
}: {
  title: string;
  sub: string;
  segments: { label: string; value: number }[];
  colors: string[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const denom = total || 1;
  const r = 36;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-[13px] font-semibold text-[var(--ink)]">{title}</p>
      <p className="mt-0.5 text-[11px] text-[var(--muted)]">{sub}</p>
      {total === 0 ? (
        <p className="mt-6 text-sm text-[var(--muted)]">집계할 성과가 없습니다.</p>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <div className="relative h-[108px] w-[108px] shrink-0">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
              {segments.map((seg, i) => {
                const len = (seg.value / denom) * c;
                const dash = `${len} ${c - len}`;
                const el = (
                  <circle
                    key={seg.label}
                    cx={50}
                    cy={50}
                    r={r}
                    fill="none"
                    stroke={colors[i % colors.length]}
                    strokeWidth={14}
                    strokeDasharray={dash}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return el;
              })}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-center">
              <div>
                <p className="text-[16px] font-extrabold tabular-nums text-[var(--ink)]">
                  {formatMetric(total)}
                </p>
                <p className="text-[10px] text-[var(--muted)]">상호작용</p>
              </div>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5 text-[11.5px]">
            {segments.map((seg, i) => (
              <li
                key={seg.label}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-1.5 text-[var(--ink)]">
                  <i
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: colors[i % colors.length] }}
                  />
                  {seg.label}
                </span>
                <span className="tabular-nums text-[var(--muted)]">
                  {Math.round((seg.value / denom) * 100)}% ·{" "}
                  {formatMetric(seg.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function VisitPerson({
  row,
  kind,
}: {
  row: CompanyHomeVisitRow;
  kind: "upcoming" | "done";
}) {
  const href = visitProfileHref(row);
  const photo = (
    <CreatorPhoto
      creator={resolvePoolCreator({
        id: row.id,
        name: row.name,
        handle: row.handle,
        url: row.snsUrl,
        product: row.product,
      })}
      size="thumb"
      className="!h-9 !w-9 shrink-0 !rounded-full"
    />
  );
  const body = (
    <>
      {photo}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold leading-snug text-[var(--ink)]">
          {row.name}
        </span>
        <span className="mt-0.5 block truncate text-[11px] leading-snug text-[var(--muted)]">
          {row.product || row.handle}
        </span>
      </span>
      <span
        className={
          kind === "done"
            ? "shrink-0 rounded-full bg-[#E7F3EA] px-1.5 py-0.5 text-[10px] font-semibold text-[#2f6b3c]"
            : "shrink-0 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]"
        }
      >
        {kind === "done" ? "방문" : "예정"}
      </span>
    </>
  );
  const cls =
    "flex w-full items-center gap-2 rounded-[6px] py-1.5 text-left hover:bg-[var(--accent-soft)]/50";
  if (!href) {
    return <div className={cls}>{body}</div>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${cls} focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]`}
    >
      {body}
    </a>
  );
}

export function CompanyHomeVisitBoard({
  visits,
  onOpenProgress,
}: {
  visits: CompanyHomeVisits;
  onOpenProgress?: () => void;
}) {
  const blocks = [
    {
      kind: "upcoming" as const,
      title: "한달 이내 방문 예정",
      rows: visits.upcoming,
      empty: "한달 이내 예정이 없습니다.",
    },
    {
      kind: "done" as const,
      title: "한달 이내 방문 완료",
      rows: visits.done,
      empty: "한달 이내 완료가 없습니다.",
    },
  ];
  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 self-start xl:w-[280px]">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-[18px] font-bold tracking-tight text-[var(--ink)]">
            방문
          </h2>
          {onOpenProgress ? (
            <button
              type="button"
              onClick={onOpenProgress}
              className="text-[12.5px] font-semibold text-[var(--accent)] hover:underline"
            >
              진행현황 전체 보기 →
            </button>
          ) : null}
        </div>
        <p className="mt-0.5 text-[12px] text-[var(--muted)]">
          {visits.asOf} 기준 · 방문일 순 · 프로필 클릭
        </p>
      </div>
      {blocks.map((b) => (
        <div
          key={b.title}
          className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-3"
        >
          <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
            <p className="text-[13px] font-semibold text-[var(--ink)]">{b.title}</p>
            <p className="text-[11px] tabular-nums text-[var(--muted)]">
              {b.rows.length}명
            </p>
          </div>
          {b.rows.length === 0 ? (
            <p className="px-0.5 py-4 text-[12px] text-[var(--muted)]">{b.empty}</p>
          ) : (
            <div className="max-h-[360px] overflow-auto">
              {groupByDay(b.rows, (r) => r.visitDate).map(([day, rows]) => (
                <section key={`${b.title}-${day}`} className="mb-2 last:mb-0">
                  <div className="mb-1.5 flex items-center gap-2">
                    <p className="shrink-0 text-[12px] font-semibold text-[var(--ink)]">
                      {formatMd(day)}
                    </p>
                    <span className="h-px min-w-0 flex-1 bg-[var(--line)]" />
                  </div>
                  <ul className="m-0 list-none p-0">
                    {rows.map((r) => (
                      <li key={`${b.title}-${r.id}-${day}`}>
                        <VisitPerson row={r} kind={b.kind} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}

const FORECAST_DISCLAIMER =
  "협력 인원의 과거 성과를 기준한 추정치이며, 이는 보장된 성과 수치가 아닙니다";

function ForecastPanel({
  forecast,
  open,
}: {
  forecast?: HomeForecast | null;
  open: boolean;
}) {
  const n = forecast?.pendingCount ?? 0;
  const rows = forecast?.rows || [];
  const withAvg = rows.filter((r) => r.avgCount > 0).length;
  const hasSum =
    (forecast?.views || 0) + (forecast?.likes || 0) + (forecast?.saves || 0) > 0;
  const maxViews = Math.max(...rows.map((r) => r.views || 0), 1);
  const cells = [
    { label: "조회수", value: forecast?.views ?? 0, color: "#3b82f6" },
    { label: "좋아요", value: forecast?.likes ?? 0, color: "#c2410c" },
    { label: "저장", value: forecast?.saves ?? 0, color: "#0f766e" },
  ];
  return (
    <div
      className={`mt-3 border-t border-[#b7c9dc] pt-3 ${open ? "bp-forecast-in" : ""}`}
    >
      {n === 0 ? (
        <p className="text-[12.5px] leading-relaxed text-[#4a6580]">
          지금은 업로드 예정인 인원이 없습니다.
        </p>
      ) : (
        <>
          <p className="text-[13px] text-[#1e3a5f]">
            <b>{n}명</b>이 업로드할 예정이에요.
          </p>
          <p className="mt-1.5 rounded-[6px] bg-white/80 px-3 py-2 text-[12px] leading-relaxed text-[#4a6580]">
            <span className="font-semibold text-[#1e3a5f]">근거 · </span>
            아직 발행하지 않은 배정 인원의 관련된 게시물 3건의 평균을 기반으로
            추정합니다.
            {withAvg > 0 && withAvg < n
              ? ` 3건 평균이 있는 ${withAvg}명만 포함했습니다.`
              : null}
            {withAvg === 0
              ? " 3건 평균이 있는 인원이 없어 합계는 비어 있습니다."
              : null}
            <span className="mt-1.5 block w-fit max-w-full rounded-[6px] border border-[var(--danger)] px-2 py-1.5 font-extrabold text-[var(--danger)]">
              {FORECAST_DISCLAIMER}
            </span>
          </p>
          {hasSum ? (
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {cells.map((c, i) => (
                <div
                  key={c.label}
                  className={`${open ? "bp-forecast-cell" : ""} rounded-[8px] border border-[#c5d4e4] bg-white px-2.5 py-2.5 sm:px-3`}
                  style={{ animationDelay: `${80 + i * 70}ms` }}
                >
                  <p className="text-[10.5px] font-semibold tracking-wide text-[#6b849c]">
                    예측 {c.label}
                  </p>
                  <p
                    className="mt-0.5 text-[18px] font-extrabold leading-tight tabular-nums sm:text-[22px]"
                    style={{ color: c.color }}
                  >
                    +{formatMetric(c.value)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-[11px] font-semibold text-[#4a6580]">
            인플루언서별 예측 · 관련 게시 3건 평균
          </p>
          <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_4.25rem_4.25rem_4.25rem] gap-x-2 px-0.5 text-[10.5px] text-[#6b849c]">
            <span>이름</span>
            <span className="text-right">조회</span>
            <span className="text-right">좋아요</span>
            <span className="text-right">저장</span>
          </div>
          <ul className="mt-1 max-h-[240px] list-none overflow-auto p-0">
            {rows.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-[minmax(0,1fr)_4.25rem_4.25rem_4.25rem] items-center gap-x-2 border-t border-[#d5e0ec] py-1.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-[#1e3a5f]">
                    {r.name}
                  </span>
                  <span
                    className="mt-1 block h-1 overflow-hidden rounded-full bg-[#d7e4f0]"
                    aria-hidden
                  >
                    <span
                      className="block h-full rounded-full bg-[#7ba3cc]"
                      style={{
                        width: `${Math.round(((r.views || 0) / maxViews) * 100)}%`,
                      }}
                    />
                  </span>
                </span>
                {r.avgCount > 0 ? (
                  <>
                    <span className="text-right text-[13px] font-bold tabular-nums text-[#3b82f6]">
                      {formatMetric(r.views || 0)}
                      {r.viewsEstimated ? (
                        <span className="ml-0.5 text-[9px] font-semibold text-[#6b849c]">
                          추정
                        </span>
                      ) : null}
                    </span>
                    <span className="text-right text-[13px] font-bold tabular-nums text-[#c2410c]">
                      {formatMetric(r.likes || 0)}
                    </span>
                    <span className="text-right text-[13px] font-bold tabular-nums text-[#0f766e]">
                      {formatMetric(r.saves || 0)}
                    </span>
                  </>
                ) : (
                  <span className="col-span-3 text-right text-[11px] text-[#6b849c]">
                    관련 게시 3건 없음
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function CompanyHomePerformanceBoard({
  links,
  loading,
  error,
  forecast,
  onOpenMore,
}: {
  links: HomeInsightLink[];
  loading: boolean;
  error: string | null;
  forecast?: HomeForecast | null;
  onOpenMore?: () => void;
}) {
  const [cardLimit, setCardLimit] = useState(6);
  const [showForecast, setShowForecast] = useState(false);
  const [blend, setBlend] = useState(0);
  const blendRef = useRef(0);
  const weeks = useMemo(() => buildWeekSeries(links, 8), [links]);
  const latest = weeks[weeks.length - 1];

  useEffect(() => {
    const to = showForecast ? 1 : 0;
    const from = blendRef.current;
    if (Math.abs(from - to) < 0.01) {
      blendRef.current = to;
      setBlend(to);
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      blendRef.current = to;
      setBlend(to);
      return;
    }
    const start = performance.now();
    const dur = 300;
    let id = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - p) ** 2;
      const v = from + (to - from) * eased;
      blendRef.current = v;
      setBlend(v);
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [showForecast]);

  const lastWeek = weeks[weeks.length - 1] || {
    key: "now",
    label: "현재",
    axisLabel: "현재",
    uploads: 0,
    views: 0,
    likes: 0,
    saves: 0,
  };
  const chartPoints = useMemo(() => {
    if (blend <= 0.02 || !forecast) return weeks;
    const base = weeks.length ? weeks : [lastWeek];
    return [
      ...base,
      {
        key: "forecast",
        label: "예측",
        axisLabel: "예측",
        uploads: Math.round(lastWeek.uploads + forecast.pendingCount * blend),
        views: Math.round(lastWeek.views + forecast.views * blend),
        likes: Math.round(lastWeek.likes + forecast.likes * blend),
        saves: Math.round(lastWeek.saves + forecast.saves * blend),
      },
    ];
  }, [weeks, blend, forecast, lastWeek]);
  const lockMax =
    blend > 0.02 && forecast
      ? {
          u: lastWeek.uploads + forecast.pendingCount,
          v: lastWeek.views + forecast.views,
          l: lastWeek.likes + forecast.likes,
          s: lastWeek.saves + forecast.saves,
        }
      : undefined;

  const cards = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        handle: string;
        product: string;
        region: string;
        views: number;
        likes: number;
        saves: number;
        viewsEstimated: boolean;
        url: string | null;
        publishedAt: string | null;
      }
    >();
    for (const l of links) {
      const inf = l.allocations?.influencers;
      const id = inf?.id || l.allocations?.influencer_id || l.id;
      const raw =
        inf?.instagram_handle_normalized || inf?.instagram_handle || "";
      const handle = raw ? `@${String(raw).replace(/^@+/, "")}` : "—";
      const prev = map.get(id);
      const views = Number(l.views) || 0;
      const likes = Number(l.likes) || 0;
      const saves = Number(l.saves) || 0;
      const viewsEstimated =
        resolveCreatorPlatform(l.link_url) === "xiaohongshu";
      if (!prev) {
        map.set(id, {
          id,
          name: inf?.name || "인플루언서",
          handle,
          product: l.allocations?.products?.name || "상품",
          region: regionLabel(inf?.region),
          views,
          likes,
          saves,
          viewsEstimated,
          url: l.link_url,
          publishedAt: l.published_at,
        });
      } else {
        prev.views += views;
        prev.likes += likes;
        prev.saves += saves;
        prev.viewsEstimated = prev.viewsEstimated || viewsEstimated;
        if ((l.published_at || "") > (prev.publishedAt || "")) {
          prev.publishedAt = l.published_at;
          prev.url = l.link_url;
        }
      }
    }
    return [...map.values()]
      .sort((a, b) => b.views - a.views)
      .map((c) => ({
        ...c,
        creator: resolvePoolCreator({
          id: c.id,
          name: c.name,
          handle: c.handle,
          url: c.url,
          product: c.product,
          views: c.views,
          likes: c.likes,
        }),
      }));
  }, [links]);

  const shown = cards.slice(0, cardLimit);

  return (
    <section className="min-w-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-bold tracking-tight text-[var(--ink)]">
            콘텐츠 성과
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            발행완료 콘텐츠 기준 · 성과 탭과 동일 소스
          </p>
        </div>
        {onOpenMore ? (
          <button
            type="button"
            onClick={onOpenMore}
            className="text-[12.5px] font-semibold text-[var(--accent)] hover:underline"
          >
            성과 탭에서 더 보기 →
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">성과 불러오는 중…</p>
      ) : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {!loading && !error ? (
        <div className="space-y-4">
          <div
            className={
              showForecast
                ? "rounded-[10px] border border-[#7C9CBF] bg-[#E8F1F8] p-4 shadow-[0_8px_24px_rgb(30_58_95_/_0.08)] transition-[background-color,border-color,box-shadow] duration-300 ease-out"
                : "rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-none transition-[background-color,border-color,box-shadow] duration-300 ease-out"
            }
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p
                className={
                  showForecast
                    ? "text-[13px] font-semibold text-[#1e3a5f]"
                    : "text-[13px] font-semibold text-[var(--ink)]"
                }
              >
                {showForecast ? "예측 증가" : "누적 성과"}
                {showForecast ? (
                  <span className="ml-2 rounded-full bg-[#1e3a5f] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                    예측
                  </span>
                ) : (
                  <span className="ml-2 text-[11px] font-normal text-[var(--muted)]">
                    8월부터 주차별
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={() => setShowForecast((v) => !v)}
                className={
                  showForecast
                    ? "rounded-full bg-[#1e3a5f] px-2.5 py-1 text-[12px] font-semibold text-white transition-colors duration-200"
                    : "rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-[var(--accent)] transition-colors duration-200 hover:underline"
                }
              >
                {showForecast ? "실측으로 돌아가기" : "예측치 보기"}
              </button>
            </div>
            {showForecast ? (
              <p className="mb-2 w-fit max-w-full rounded-[6px] border border-[var(--danger)] px-2.5 py-1.5 text-[12.5px] font-extrabold leading-snug text-[var(--danger)]">
                {FORECAST_DISCLAIMER}
              </p>
            ) : (
            <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
                <span className="inline-flex items-center gap-1">
                  <i className="h-2.5 w-2 rounded-[2px] bg-[#93c5fd]" /> 누적
                  업로드
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="h-2 w-2 rounded-full bg-[#3b82f6]" /> 누적 조회수
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="h-2 w-2 rounded-full bg-[#f59e0b]" /> 누적 좋아요
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="h-2 w-2 rounded-full bg-[#22c55e]" /> 누적 저장
                </span>
            </div>
            )}
            <CumulativeChart
              points={chartPoints}
              forecastTail={blend > 0.02}
              forecastT={blend}
              lockMax={lockMax}
            />
            <div
              className={
                showForecast
                  ? "mt-3 flex flex-wrap items-center gap-2 border-t border-[#b7c9dc] pt-3 text-[12.5px] text-[#4a6580]"
                  : "mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3 text-[12.5px]"
              }
            >
              <span
                className={
                  showForecast
                    ? "rounded-full border border-[#b7c9dc] bg-white/80 px-2.5 py-1 text-[#4a6580]"
                    : "rounded-full border border-[var(--line)] bg-[var(--surface-hover)] px-2.5 py-1 text-[var(--muted)]"
                }
              >
                {showForecast
                  ? "현재 실측"
                  : latest
                    ? `${latest.label}까지 누적`
                    : "누적"}
              </span>
              <span className="text-[var(--muted)]">업로드</span>
              <b className="tabular-nums text-[var(--ink)]">
                {latest?.uploads ?? 0}건
              </b>
              <span className="text-[var(--line-strong,#cfc6b7)]">·</span>
              <span className="text-[var(--muted)]">조회수</span>
              <b className="tabular-nums text-[var(--ink)]">
                {formatMetric(latest?.views ?? 0)}
              </b>
              <span className="text-[var(--line-strong,#cfc6b7)]">·</span>
              <span className="text-[var(--muted)]">좋아요</span>
              <b className="tabular-nums text-[var(--ink)]">
                {formatMetric(latest?.likes ?? 0)}
              </b>
              <span className="text-[var(--line-strong,#cfc6b7)]">·</span>
              <span className="text-[var(--muted)]">저장</span>
              <b className="tabular-nums text-[var(--ink)]">
                {formatMetric(latest?.saves ?? 0)}
              </b>
            </div>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                showForecast ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <ForecastPanel forecast={forecast} open={showForecast} />
              </div>
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
              발행된 콘텐츠가 없습니다.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((c) => (
                <article
                  key={c.id}
                  className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-3.5"
                >
                  <p className="truncate text-[10.5px] text-[var(--muted)]">
                    {c.product} · {c.region}
                  </p>
                  <div className="mt-2 flex items-start gap-2.5">
                    <CreatorPhoto creator={c.creator} size="thumb" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-[var(--ink)]">
                        {c.name}
                      </p>
                      <p className="truncate text-[11.5px] text-[var(--muted)]">
                        {c.handle}
                      </p>
                    </div>
                    {c.url ? (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-full border border-[var(--line)] px-2 py-1 text-[10.5px] font-semibold text-[var(--accent)]"
                      >
                        보기
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-2.5 text-center">
                    <div>
                      <p className="text-[10px] text-[var(--muted)]">조회수</p>
                      <p className="text-[13px] font-bold tabular-nums text-[var(--ink)]">
                        {formatViews(c.views, c.viewsEstimated)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--muted)]">좋아요</p>
                      <p className="text-[13px] font-bold tabular-nums text-[var(--ink)]">
                        {formatMetric(c.likes)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--muted)]">저장</p>
                      <p className="text-[13px] font-bold tabular-nums text-[var(--ink)]">
                        {c.saves > 0 ? formatMetric(c.saves) : "—"}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {cards.length > cardLimit ? (
            <button
              type="button"
              onClick={() => setCardLimit((n) => n + 6)}
              className="mt-3 w-full rounded-[6px] border border-[var(--line)] bg-[var(--surface)] py-2.5 text-[12.5px] font-semibold text-[var(--accent)]"
            >
              {Math.min(6, cards.length - cardLimit)}개 더 보기
            </button>
          ) : null}
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            {shown.length}건 표시
            {cards.length > shown.length
              ? ` · 남은 ${cards.length - shown.length}건`
              : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}

/** Live 뉴스 아래 — 부모에서 받은 links 공유 (이중 fetch 금지) */
export function CompanyHomeShareDonuts({
  links,
  loading,
}: {
  links: HomeInsightLink[];
  loading: boolean;
}) {
  const platformSeg = useMemo(
    () => shareSegmentsByPlatform(links),
    [links],
  );
  const regionSeg = useMemo(() => shareSegmentsByRegion(links), [links]);

  if (loading) {
    return (
      <p className="text-[12px] text-[var(--muted)]">채널·국가 집계 중…</p>
    );
  }

  return (
    <div className="space-y-3">
      <ShareDonut
        title="채널별 성과"
        sub="좋아요 + 저장 합산"
        segments={platformSeg}
        colors={["#3b82f6", "#6366f1", "#f59e0b", "#94a3b8"]}
      />
      <ShareDonut
        title="국가별 비중"
        sub="좋아요 + 저장 · 전체 기준"
        segments={regionSeg}
        colors={["#ef4444", "#3b82f6", "#22c55e", "#94a3b8"]}
      />
    </div>
  );
}
