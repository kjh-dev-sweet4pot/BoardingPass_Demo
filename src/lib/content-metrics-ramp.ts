/** ponytail: 첫 실측 전 공백만 가상 시계열. 실측·최종값은 그대로. */

export type RampMetric = {
  creator_link_id: string;
  collected_at: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  reposts: number | null;
};

const OFFSET_DAYS = [0, 3, 7, 14, 21, 28, 45, 60];

/** 초반부터 높게. t=0 → 22%, t=0.5 → 81%, 첫 실측에서 100%. */
function rampRatio(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return 0.22 + 0.78 * x ** 0.4;
}

function rampDayOffsets(gapDays: number) {
  const days = new Set<number>();
  for (const d of OFFSET_DAYS) {
    if (d < gapDays - 0.05) days.add(d);
  }
  for (const p of [0.55, 0.7, 0.82, 0.9, 0.96]) {
    const d = p * gapDays;
    if (d > 0.5 && d < gapDays - 0.05) days.add(Math.round(d * 100) / 100);
  }
  days.add(Math.max(0, gapDays - 2 / 24));
  return [...days].sort((a, b) => a - b);
}

function scale(n: number, e: number) {
  return Math.round(n * e);
}

function scaleMaybe(n: number | null | undefined, e: number) {
  if (n == null) return null;
  return scale(Number(n) || 0, e);
}

export function padMetricsBeforeFirstCollect(
  links: {
    id: string;
    published_at: string | null;
    views?: number | null;
    likes?: number | null;
    comments?: number | null;
    saves?: number | null;
    shares?: number | null;
    reposts?: number | null;
  }[],
  metrics: RampMetric[],
): RampMetric[] {
  const byLink = new Map<string, RampMetric[]>();
  for (const m of metrics) {
    const arr = byLink.get(m.creator_link_id) || [];
    arr.push(m);
    byLink.set(m.creator_link_id, arr);
  }

  let origin = Number.POSITIVE_INFINITY;
  for (const link of links) {
    if (!link.published_at) continue;
    const ts = new Date(link.published_at).getTime();
    if (Number.isFinite(ts) && ts < origin) origin = ts;
  }
  if (!Number.isFinite(origin)) return metrics;

  const extra: RampMetric[] = [];
  for (const link of links) {
    const rows = [...(byLink.get(link.id) || [])].sort(
      (a, b) =>
        new Date(a.collected_at).getTime() - new Date(b.collected_at).getTime(),
    );
    const first = rows[0];
    const endAt = first ? new Date(first.collected_at).getTime() : Date.now();
    if (!Number.isFinite(endAt) || endAt <= origin) continue;
    const gapDays = (endAt - origin) / 86_400_000;
    if (gapDays < 2) continue;
    const endViews = Math.max(
      Number(first?.views) || 0,
      Number(link.views) || 0,
    );
    if (endViews <= 0) continue;
    const endLikes = Number(first?.likes ?? link.likes) || 0;
    const endComments = Number(first?.comments ?? link.comments) || 0;
    const endSaves = first?.saves ?? link.saves;
    const endShares = first?.shares ?? link.shares;
    const endReposts = first?.reposts ?? link.reposts;
    const offsets = rampDayOffsets(gapDays);
    const lastD = offsets[offsets.length - 1];
    for (const d of offsets) {
      const e = d === lastD ? 1 : rampRatio(d / gapDays);
      extra.push({
        creator_link_id: link.id,
        collected_at: new Date(origin + d * 86_400_000).toISOString(),
        views: scale(endViews, e),
        likes: scale(endLikes, e),
        comments: scale(endComments, e),
        saves: scaleMaybe(endSaves, e),
        shares: scaleMaybe(endShares, e),
        reposts: scaleMaybe(endReposts, e),
      });
    }
  }
  if (extra.length === 0) return metrics;
  return [...extra, ...metrics].sort((a, b) =>
    a.collected_at.localeCompare(b.collected_at),
  );
}

function assertPadMetrics() {
  const out = padMetricsBeforeFirstCollect(
    [{ id: "a", published_at: "2026-08-01T00:00:00.000Z", views: 1000 }],
    [
      {
        creator_link_id: "a",
        collected_at: "2026-08-29T00:00:00.000Z",
        views: 1000,
        likes: 100,
        comments: 10,
        saves: null,
        shares: null,
        reposts: null,
      },
    ],
  );
  const mid = out.find(
    (m) => m.collected_at.startsWith("2026-08-15") && m.creator_link_id === "a",
  );
  const last = out[out.length - 1];
  const pre = out[out.length - 2];
  if (!mid || (mid.views ?? 0) < 700 || (mid.views ?? 0) >= 1000) {
    throw new Error("padMetricsBeforeFirstCollect ramp failed");
  }
  if (last?.views !== 1000 || last.likes !== 100) {
    throw new Error("padMetricsBeforeFirstCollect final changed");
  }
  if (!pre || pre.views !== 1000) {
    throw new Error("padMetricsBeforeFirstCollect end step");
  }
}

assertPadMetrics();
