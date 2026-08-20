"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { formatMetric } from "@/lib/content-insights";

// ──────────────── 타입 ────────────────
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
    influencers: { id: string; name: string; instagram_handle_normalized?: string; followers?: number } | null;
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

// ──────────────── 산식 (전역 규칙) ────────────────
function er(views: number, likes: number, comments: number) {
  return views > 0 ? ((likes + comments) / views) * 100 : 0;
}
function cpv(exposureFee: number, views: number) {
  return views > 0 ? exposureFee / views : 0;
}
function cpe(exposureFee: number, likes: number, comments: number) {
  return likes + comments > 0 ? exposureFee / (likes + comments) : 0;
}
function followerMultiple(views: number, followers: number) {
  return followers > 0 ? views / followers : 0;
}

function fmt(n: number, digits = 1) {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

// ──────────────── 조회수 곡선 (경과일 기준) ────────────────
function ViewsCurve({ points }: { points: { day: number; views: number }[] }) {
  if (points.length < 2) return null;
  const maxViews = Math.max(...points.map((p) => p.views), 1);
  const maxDay = Math.max(...points.map((p) => p.day), 1);
  const W = 480;
  const H = 80;
  const pad = { l: 4, r: 4, t: 4, b: 4 };

  const pts = points.map((p) => ({
    x: pad.l + ((p.day / maxDay) * (W - pad.l - pad.r)),
    y: pad.t + ((1 - p.views / maxViews) * (H - pad.t - pad.b)),
  }));

  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${d} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#cg)" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ──────────────── KPI 카드 ────────────────
function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-[var(--ink)]">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

type InitialPerformanceData = {
  links: LinkRow[];
  metrics: MetricRow[];
  collectedAt: string | null;
};

// ──────────────── 메인 컴포넌트 ────────────────
export function CompanyPerformanceTab({
  companyId,
  initialData,
}: {
  companyId: string;
  initialData?: InitialPerformanceData;
}) {
  const [allLinks, setAllLinks] = useState<LinkRow[]>(initialData?.links ?? []);
  const [allMetrics, setAllMetrics] = useState<MetricRow[]>(initialData?.metrics ?? []);
  const [collectedAt, setCollectedAt] = useState<string | null>(initialData?.collectedAt ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [productId, setProductId] = useState<string>("");
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (initialData) return; // 목업 주입 시 fetch 생략
    setLoading(true);
    fetch(`/api/com/insights`)
      .then((r) => r.json())
      .then((data) => {
        setAllLinks(Array.isArray(data.links) ? data.links : []);
        setAllMetrics(Array.isArray(data.metrics) ? data.metrics : []);
        setCollectedAt(data.collectedAt ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [companyId, initialData]);

  // 상품 필터 적용
  const links = useMemo(
    () => productId ? allLinks.filter((l) => l.allocations?.products?.id === productId) : allLinks,
    [allLinks, productId],
  );
  const metrics = useMemo(
    () => productId ? allMetrics.filter((m) => links.some((l) => l.id === m.creator_link_id)) : allMetrics,
    [allMetrics, links, productId],
  );

  // 상품 목록
  const products = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of allLinks) {
      const p = l.allocations?.products;
      if (p) map.set(p.id, p.name);
    }
    return [...map.entries()];
  }, [allLinks]);

  // 집계 (원시값 합산 후 산식)
  const totals = useMemo(() => {
    const views = links.reduce((s, l) => s + (l.views ?? 0), 0);
    const likes = links.reduce((s, l) => s + (l.likes ?? 0), 0);
    const comments = links.reduce((s, l) => s + (l.comments ?? 0), 0);
    const followers = links.reduce((s, l) => s + (l.allocations?.influencers?.followers ?? 0), 0);
    return { views, likes, comments, followers };
  }, [links]);

  // 조회수 곡선 — 발행 후 경과일 기준 (각 링크 metrics 합산)
  const curvePoints = useMemo(() => {
    const publishedAtMap = new Map(links.map((l) => [l.id, l.published_at]));
    const dayMap = new Map<number, number>();
    for (const m of metrics) {
      const pub = publishedAtMap.get(m.creator_link_id);
      if (!pub) continue;
      const dayDiff = Math.floor(
        (new Date(m.collected_at).getTime() - new Date(pub).getTime()) / 86400000,
      );
      if (dayDiff < 0) continue;
      dayMap.set(dayDiff, (dayMap.get(dayDiff) ?? 0) + m.views);
    }
    return [...dayMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([day, views]) => ({ day, views }));
  }, [metrics, links]);

  // 플랫폼별
  const byPlatform = useMemo(() => {
    const map = new Map<string, { views: number; likes: number; comments: number; count: number }>();
    for (const l of links) {
      const url = l.link_url || "";
      const plat = url.includes("tiktok") ? "TikTok" : url.includes("instagram") ? "Instagram" : url.includes("youtube") ? "YouTube" : "기타";
      const cur = map.get(plat) ?? { views: 0, likes: 0, comments: 0, count: 0 };
      cur.views += l.views ?? 0;
      cur.likes += l.likes ?? 0;
      cur.comments += l.comments ?? 0;
      cur.count += 1;
      map.set(plat, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].views - a[1].views);
  }, [links]);

  if (loading) return <div className="py-16 text-center text-sm text-[var(--muted)]">불러오는 중…</div>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
      {/* 헤더 — 조회 기준 일시 */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted)]">
          {today} 조회 시점 기준
          {collectedAt
            ? ` · 최종 수집 ${new Date(collectedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`
            : ""}
        </p>
        {/* 상품 필터 */}
        {products.length > 0 && (
          <select
            className="h-8 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">상품 전체</option>
            {products.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        )}
      </div>

      {links.length === 0 ? (
        <EmptyState title="발행된 콘텐츠가 없습니다" message="콘텐츠가 발행완료 되면 성과가 여기에 표시됩니다." />
      ) : (
        <>
          {/* KPI 6종 */}
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="조회수" value={formatMetric(totals.views)} />
            <Kpi label="참여율 (ER)" value={`${fmt(er(totals.views, totals.likes, totals.comments))}%`} />
            <Kpi label="CPV" value={totals.views > 0 ? `—` : "—"} sub="노출가 미설정" />
            <Kpi label="CPE" value={totals.views > 0 ? `—` : "—"} sub="노출가 미설정" />
            <Kpi
              label="팔로워 대비 조회"
              value={totals.followers > 0 ? `${fmt(followerMultiple(totals.views, totals.followers))}x` : "—"}
            />
            <Kpi label="콘텐츠" value={`${links.length}건`} />
          </div>

          {/* 조회수 곡선 */}
          {curvePoints.length >= 2 && (
            <div className="shrink-0 rounded-2xl border border-[var(--line)] bg-white px-5 py-4">
              <p className="mb-3 text-sm font-semibold text-[var(--ink)]">조회수 곡선 <span className="ml-1 text-xs font-normal text-[var(--muted)]">발행 후 경과일</span></p>
              <ViewsCurve points={curvePoints} />
              <div className="mt-1 flex justify-between text-[10px] text-[var(--muted)]">
                <span>발행일</span>
                <span>{curvePoints[curvePoints.length - 1]?.day}일 후</span>
              </div>
            </div>
          )}

          {/* 플랫폼별 성과 */}
          {byPlatform.length > 0 && (
            <div className="shrink-0 rounded-2xl border border-[var(--line)] bg-white px-5 py-4">
              <p className="mb-3 text-sm font-semibold text-[var(--ink)]">플랫폼별 성과</p>
              <div className="space-y-2">
                {byPlatform.map(([plat, row]) => (
                  <div key={plat} className="flex items-center gap-3 text-sm">
                    <span className="w-20 shrink-0 text-xs font-medium text-[var(--muted)]">{plat}</span>
                    <div className="flex-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--accent-soft)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${Math.max(4, (row.views / (byPlatform[0][1].views || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-20 shrink-0 text-right tabular-nums text-xs">{formatMetric(row.views)}</span>
                    <span className="w-12 shrink-0 text-right text-[11px] text-[var(--muted)]">ER {fmt(er(row.views, row.likes, row.comments))}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 콘텐츠 목록 */}
          <div className="min-h-0 overflow-auto rounded-2xl border border-[var(--line)] bg-white">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-[var(--accent-soft)]">
                <tr className="text-xs text-[var(--muted)]">
                  <th className="px-4 py-2 font-medium">인플루언서</th>
                  <th className="px-4 py-2 font-medium">상품</th>
                  <th className="px-4 py-2 font-medium text-right">조회</th>
                  <th className="px-4 py-2 font-medium text-right">ER</th>
                  <th className="px-4 py-2 font-medium">링크</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => {
                  const v = l.views ?? 0;
                  const lk = l.likes ?? 0;
                  const cm = l.comments ?? 0;
                  const name = l.allocations?.influencers?.name || "—";
                  const product = l.allocations?.products?.name || "—";
                  return (
                    <tr key={l.id} className="border-t border-[var(--line)] hover:bg-[var(--accent-soft)]/40">
                      <td className="px-4 py-3 font-medium">{name}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{product}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMetric(v)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs">{fmt(er(v, lk, cm))}%</td>
                      <td className="px-4 py-3">
                        {l.link_url ? (
                          <a href={l.link_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--accent)] underline">열기</a>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
