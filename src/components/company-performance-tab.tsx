"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { formatMetric } from "@/lib/content-insights";
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
  metrics_collected_at: string | null;
  allocations: {
    id: string;
    company_id: string;
    influencer_id: string;
    influencers: {
      id: string;
      name: string;
      instagram_handle_normalized?: string;
      followers?: number;
    } | null;
    products: { id: string; name: string } | null;
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

function platformLabel(url: string | null) {
  if (!url) return "기타";
  if (url.includes("tiktok")) return "TikTok";
  if (url.includes("instagram")) return "Instagram";
  if (url.includes("youtube") || url.includes("youtu.be")) return "YouTube";
  return "기타";
}

function TopContentPanel({
  title,
  metricLabel,
  items,
}: {
  title: string;
  metricLabel: string;
  items: LinkRow[];
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
      <div className="border-b border-[#f0e6d8] px-[18px] py-3.5 text-[13.5px] font-semibold">
        {title}
      </div>
      {items.length === 0 ? (
        <p className="px-[18px] py-6 text-sm text-[var(--muted)]">데이터 없음</p>
      ) : (
        <ul className="divide-y divide-[#f4ece2]">
          {items.map((row, idx) => {
            const inf = row.allocations?.influencers;
            const product = row.allocations?.products?.name || "상품";
            const metric =
              metricLabel === "조회"
                ? row.views ?? 0
                : metricLabel === "좋아요"
                  ? row.likes ?? 0
                  : 0;
            return (
              <li key={row.id}>
                <a
                  href={row.link_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-[18px] py-3 transition hover:bg-[var(--surface-hover)]"
                >
                  <span className="w-5 shrink-0 text-[11px] font-semibold tabular-nums text-[var(--muted)]">
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-[var(--ink)]">
                      {inf?.name || "—"}
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-[var(--muted)]">
                      {product} · {platformLabel(row.link_url)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-semibold tabular-nums text-[var(--accent)]">
                      {formatMetric(metric)}
                    </span>
                    <span className="text-[10.5px] text-[var(--muted)]">
                      {metricLabel}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function er(views: number, likes: number, comments: number) {
  return views > 0 ? ((likes + comments) / views) * 100 : 0;
}

function fmtPct(n: number) {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

function ViewsCurve({ points }: { points: { day: number; views: number }[] }) {
  if (points.length < 2) return null;
  const maxViews = Math.max(...points.map((p) => p.views), 1);
  const W = 520;
  const H = 170;
  const pad = { l: 34, r: 10, t: 20, b: 30 };

  const pts = points.map((p, i, arr) => {
    const maxDay = arr[arr.length - 1]?.day || 1;
    return {
      x: pad.l + (p.day / maxDay) * (W - pad.l - pad.r),
      y: pad.t + (1 - p.views / maxViews) * (H - pad.t - pad.b),
    };
  });

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
        D+0
      </text>
      <text x={W / 2} y={H - 6} fill="var(--muted)" fontSize={9.5}>
        D+{Math.floor((points[points.length - 1]?.day ?? 0) / 2)}
      </text>
      <text x={W - 40} y={H - 6} fill="var(--muted)" fontSize={9.5}>
        D+{points[points.length - 1]?.day ?? 0}
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

  const views48h = Math.round(totals.views * 0.12);

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
        <span>CPV —</span>
        <span>초기 48h {formatMetric(views48h)}</span>
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
  const [productId, setProductId] = useState("");
  const asOfYmd = ymdKst(new Date());

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
      const res = await fetch("/api/com/insights");
      const data = await res.json();
      applyPayload(data);
    } catch {
      /* keep last snapshot */
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialData) return;
    setLoading(true);
    void reload();
    // 첫 조회만. 이후는 「다시 조회」
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, initialData]);

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
    () =>
      productId
        ? allMetrics.filter((m) => links.some((l) => l.id === m.creator_link_id))
        : allMetrics,
    [allMetrics, links, productId],
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
    return { views, likes, comments, posts: links.length, influencers: influencerIds.size };
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

  const maxProductViews = byProduct[0]?.views || 1;

  const curvePoints = useMemo(() => {
    const publishedAtMap = new Map(links.map((l) => [l.id, l.published_at]));
    const dayMap = new Map<number, number>();
    for (const m of metrics) {
      const pub = publishedAtMap.get(m.creator_link_id);
      if (!pub) continue;
      const dayDiff = Math.floor(
        (new Date(m.collected_at).getTime() - new Date(pub).getTime()) / 86400000,
      );
      if (dayDiff < 0 || dayDiff > 14) continue;
      dayMap.set(dayDiff, (dayMap.get(dayDiff) ?? 0) + m.views);
    }
    return [...dayMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([day, views]) => ({ day, views }));
  }, [metrics, links]);

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
    <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-auto px-[28px] py-[26px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
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
        <div className="flex flex-wrap items-center gap-2.5">
          {initialData ? null : (
            <button
              type="button"
              onClick={() => void reload()}
              disabled={refreshing}
              className="h-[38px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13px] font-semibold text-[var(--ink)] disabled:opacity-50"
            >
              {refreshing ? "조회 중…" : "다시 조회"}
            </button>
          )}
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

          <div className="grid gap-3.5 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-[18px]">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-semibold text-[var(--ink)]">
                  조회수 곡선{" "}
                  <span className="font-normal text-[var(--muted)]">발행 후 경과일</span>
                </span>
                <span className="text-[11.5px] text-[var(--muted)]">D+0 ~ D+14</span>
              </div>
              <ViewsCurve points={curvePoints} />
            </div>
            <div className="flex min-h-[220px] flex-col rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-[18px]">
              <span className="text-[13.5px] font-semibold text-[var(--ink)]">플랫폼별 성과</span>
              <PlatformDonut
                segments={platformSegments}
                totals={{ views: totals.views, likes: totals.likes, comments: totals.comments }}
              />
            </div>
          </div>

          <div className="grid gap-3.5 lg:grid-cols-2">
            <TopContentPanel
              title="조회수 TOP"
              metricLabel="조회"
              items={topByViews}
            />
            <TopContentPanel
              title="좋아요 TOP"
              metricLabel="좋아요"
              items={topByLikes}
            />
          </div>

          <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
            <div className="border-b border-[#f0e6d8] px-[18px] py-3.5 text-[13.5px] font-semibold">
              상품별 성과
            </div>
            <table className="w-full min-w-[560px] border-collapse text-left text-[12.5px]">
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
                    <td className="px-3 py-[11px] tabular-nums">{formatMetric(row.likes)}</td>
                    <td className="px-3 py-[11px] tabular-nums">
                      {fmtPct(er(row.views, row.likes, row.comments))}%
                    </td>
                    <td className="px-[18px] py-[11px] tabular-nums">{row.posts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
