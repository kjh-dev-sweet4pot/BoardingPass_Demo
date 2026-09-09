"use client";

import { useMemo, useState } from "react";
import { CreatorPhoto } from "@/components/creator-photo";
import { formatMetric, formatViews } from "@/lib/content-insights";
import { resolveCreatorPlatform } from "@/lib/creator-link";
import {
  buildWeekSeries,
  regionLabel,
  shareSegmentsByPlatform,
  shareSegmentsByRegion,
  type CompanyHomeVisitRow,
  type CompanyHomeVisits,
  type HomeInsightLink,
  type WeekPoint,
  visitProfileHref,
} from "@/lib/company-home";
import { resolvePoolCreator } from "@/lib/creator-pool-mock";

function CumulativeChart({ points }: { points: WeekPoint[] }) {
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
  const maxU = Math.max(...points.map((p) => p.uploads), 1);
  const maxV = Math.max(...points.map((p) => p.views), 1);
  const maxL = Math.max(...points.map((p) => p.likes), 1);
  const maxS = Math.max(...points.map((p) => p.saves), 1);
  // ponytail: 조회수 강조 — 나머지 지표는 최댓값이 차트 높이 ~1/4만 쓰게 스케일
  const OTHER_SCALE = 4;
  const n = points.length;
  const plotH = H - pad.t - pad.b;
  const xAt = (i: number) =>
    pad.l + (i / Math.max(n - 1, 1)) * (W - pad.l - pad.r);
  const yAt = (v: number, max: number) => pad.t + (1 - v / max) * plotH;
  const line = (vals: number[], max: number) =>
    vals
      .map(
        (v, i) =>
          `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(v, max).toFixed(1)}`,
      )
      .join(" ");
  const gap = (W - pad.l - pad.r) / Math.max(n, 1);
  const barW = Math.min(22, Math.max(8, gap * 0.45));

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
            stroke="#efe4d6"
            strokeWidth={1}
          />
        );
      })}
      {points.map((p, i) => {
        const h = Math.max(
          (plotH * p.uploads) / (maxU * OTHER_SCALE),
          p.uploads > 0 ? 2 : 0,
        );
        const x = xAt(i) - barW / 2;
        const y = pad.t + plotH - h;
        const isLast = i === n - 1;
        return (
          <g key={`bar-${p.key}`}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={3}
              fill={isLast ? "#3b82f6" : "#93c5fd"}
              opacity={isLast ? 0.9 : 0.45}
            />
            {isLast ? (
              <text
                x={xAt(i)}
                y={y - 5}
                textAnchor="middle"
                fill="#3b82f6"
                fontSize={10}
                fontWeight={700}
              >
                {p.uploads}
              </text>
            ) : null}
          </g>
        );
      })}
      <path
        d={line(
          points.map((p) => p.views),
          maxV,
        )}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2.4}
      />
      <path
        d={line(
          points.map((p) => p.likes),
          maxL * OTHER_SCALE,
        )}
        fill="none"
        stroke="#f59e0b"
        strokeWidth={2}
      />
      <path
        d={line(
          points.map((p) => p.saves),
          maxS * OTHER_SCALE,
        )}
        fill="none"
        stroke="#22c55e"
        strokeWidth={2}
      />
      {points.map((p, i) => (
        <text
          key={p.key}
          x={xAt(i)}
          y={H - 10}
          textAnchor="middle"
          fill="var(--muted)"
          fontSize={n > 8 ? 8 : 9}
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

function VisitPerson({ row }: { row: CompanyHomeVisitRow }) {
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
      size="avatar"
    />
  );
  const body = (
    <>
      {photo}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-[var(--ink)]">
          {row.name}
        </span>
        <span className="block truncate text-[10.5px] text-[var(--muted)]">
          {row.handle}
        </span>
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-[var(--muted)]">
        {row.visitDate.slice(5)}
      </span>
    </>
  );
  const cls =
    "flex w-full items-center gap-2 rounded-[6px] px-1.5 py-1.5 text-left hover:bg-[var(--surface-hover)]";
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

export function CompanyHomeVisitBoard({ visits }: { visits: CompanyHomeVisits }) {
  const blocks = [
    {
      title: "한달 이내 방문 예정",
      rows: visits.upcoming,
      empty: "한달 이내 예정이 없습니다.",
    },
    {
      title: "한달 이내 방문 완료",
      rows: visits.done,
      empty: "한달 이내 완료가 없습니다.",
    },
  ] as const;
  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 self-start xl:w-[280px]">
      <div>
        <h2 className="text-[18px] font-bold tracking-tight text-[var(--ink)]">
          방문
        </h2>
        <p className="mt-0.5 text-[12px] text-[var(--muted)]">
          {visits.asOf} 기준 · 방문일 순 · 프로필 클릭
        </p>
      </div>
      {blocks.map((b) => (
        <div
          key={b.title}
          className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-3"
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-2 px-0.5">
            <p className="text-[13px] font-semibold text-[var(--ink)]">{b.title}</p>
            <p className="text-[11px] tabular-nums text-[var(--muted)]">
              {b.rows.length}명
            </p>
          </div>
          <ul className="m-0 max-h-[360px] list-none space-y-0.5 overflow-auto p-0">
            {b.rows.length === 0 ? (
              <li className="px-1 py-4 text-[12px] text-[var(--muted)]">{b.empty}</li>
            ) : (
              b.rows.map((r) => (
                <li key={`${b.title}-${r.id}`}>
                  <VisitPerson row={r} />
                </li>
              ))
            )}
          </ul>
        </div>
      ))}
    </aside>
  );
}

export function CompanyHomePerformanceBoard({
  links,
  loading,
  error,
  onOpenMore,
}: {
  links: HomeInsightLink[];
  loading: boolean;
  error: string | null;
  onOpenMore?: () => void;
}) {
  const [cardLimit, setCardLimit] = useState(6);
  const weeks = useMemo(() => buildWeekSeries(links, 8), [links]);
  const latest = weeks[weeks.length - 1];

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
          <div className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-[var(--ink)]">
                누적 성과
                <span className="ml-2 text-[11px] font-normal text-[var(--muted)]">
                  8월부터 주차별
                </span>
              </p>
              <div className="flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
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
            </div>
            <CumulativeChart points={weeks} />
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3 text-[12.5px]">
              <span className="rounded-full border border-[var(--line)] bg-[var(--surface-hover)] px-2.5 py-1 text-[var(--muted)]">
                {latest ? `${latest.label}까지 누적` : "누적"}
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
