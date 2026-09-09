import { formatMetric } from "@/lib/content-insights";
import { canonicalBranchName } from "@/lib/store-name";

export type CompanyHomeNewsKind = "일정" | "성과";

export type CompanyHomeNewsDetail =
  | {
      type: "visit";
      name: string;
      store: string;
      visitDate: string;
      product: string;
      contentLabel: string;
      followers: number;
      influencerId: string;
      handle: string;
      profileUrl: string | null;
    }
  | {
      type: "publish";
      name: string;
      product: string;
      day: string;
      influencerId: string;
      handle: string;
      followers: number;
      profileUrl: string | null;
      contentUrl: string | null;
    };

export type CompanyHomeNewsItem = {
  id: string;
  at: string;
  kind: CompanyHomeNewsKind;
  title: string;
  body: string;
  detail?: CompanyHomeNewsDetail;
};

export type CompanyHomeBestPost = {
  id: string;
  influencerId: string;
  url: string | null;
  handle: string;
  name: string;
  product: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string | null;
};

export type CompanyHomeInfluencerRow = {
  id: string;
  name: string;
  handle: string;
  product: string;
  followers: number;
  views: number;
};

export type CompanyHomeVisitRow = {
  id: string;
  name: string;
  handle: string;
  visitDate: string;
  product: string;
  snsUrl: string | null;
};

export type CompanyHomeVisits = {
  asOf: string;
  upcoming: CompanyHomeVisitRow[];
  done: CompanyHomeVisitRow[];
};

export function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function visitProfileHref(row: Pick<CompanyHomeVisitRow, "handle" | "snsUrl">) {
  const u = (row.snsUrl || "").trim();
  if (/^https?:\/\//i.test(u)) return u;
  const h = (row.handle || "").replace(/^@+/, "").trim();
  if (!h || h === "—" || /[^\w.]/.test(h)) return null;
  return `https://www.instagram.com/${h}/`;
}

/** 실제 수령과 무관. 오늘부터 30일 이내 예정 / 지난 30일 완료. 인원당 1행. */
export function splitHomeVisits(
  rows: {
    id: string;
    name: string;
    handle: string;
    visitDate: string | null;
    product: string;
    snsUrl?: string | null;
  }[],
  asOf: string,
  windowDays = 30,
): CompanyHomeVisits {
  type Acc = {
    id: string;
    name: string;
    handle: string;
    snsUrl: string | null;
    dates: string[];
    products: string[];
  };
  const until = addDaysYmd(asOf, windowDays);
  const from = addDaysYmd(asOf, -windowDays);
  const byInf = new Map<string, Acc>();
  for (const r of rows) {
    const d = (r.visitDate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const snsUrl = (r.snsUrl || "").trim() || null;
    const prev = byInf.get(r.id);
    if (!prev) {
      byInf.set(r.id, {
        id: r.id,
        name: r.name,
        handle: r.handle,
        snsUrl,
        dates: [d],
        products: r.product ? [r.product] : [],
      });
      continue;
    }
    prev.dates.push(d);
    if (!prev.snsUrl && snsUrl) prev.snsUrl = snsUrl;
    if (r.product && !prev.products.includes(r.product)) {
      prev.products.push(r.product);
    }
  }
  const upcoming: CompanyHomeVisitRow[] = [];
  const done: CompanyHomeVisitRow[] = [];
  for (const p of byInf.values()) {
    const dates = [...new Set(p.dates)].sort();
    const future = dates.filter((d) => d >= asOf && d <= until);
    const past = dates.filter((d) => d >= from && d < asOf);
    const product = p.products.join(", ");
    if (future.length) {
      upcoming.push({
        id: p.id,
        name: p.name,
        handle: p.handle,
        visitDate: future[0]!,
        product,
        snsUrl: p.snsUrl,
      });
    } else if (past.length) {
      done.push({
        id: p.id,
        name: p.name,
        handle: p.handle,
        visitDate: past[past.length - 1]!,
        product,
        snsUrl: p.snsUrl,
      });
    }
  }
  upcoming.sort(
    (a, b) =>
      a.visitDate.localeCompare(b.visitDate) || a.name.localeCompare(b.name, "ko"),
  );
  done.sort(
    (a, b) =>
      b.visitDate.localeCompare(a.visitDate) || a.name.localeCompare(b.name, "ko"),
  );
  return { asOf, upcoming, done };
}

export type CompanyHomeBudgetRound = {
  label: string;
  total: number;
  status: "집행 완료" | "진행중";
};

/** ponytail: login_id 한 곳. 차수 테이블로 옮기면 이 상수 삭제 */
export const TELOACT_BUDGET_ROUNDS: CompanyHomeBudgetRound[] = [
  { label: "1차", total: 40_000_000, status: "집행 완료" },
  { label: "2차", total: 60_000_000, status: "진행중" },
];

export function teloactHomeBudget() {
  return {
    ...summarizeBudget(100_000_000, 40_000_000, 0),
    rounds: TELOACT_BUDGET_ROUNDS,
  };
}

export type CompanyHomePayload = {
  asOf: string;
  budget: {
    total: number | null;
    /** 발행완료 — 실제 사용 (예산 성과와 동일) */
    spent: number;
    /** 진행~발행 이전 — 차감 예정 */
    scheduled: number;
    /** spent + scheduled */
    committed: number;
    remaining: number | null;
    /** committed / total */
    pct: number | null;
    rounds?: CompanyHomeBudgetRound[];
  };
  content: { published: number; target: number | null };
  influencers: {
    contracted: number;
    withPerformance: number;
    ranking: CompanyHomeInfluencerRow[];
  };
  weekViews: {
    total: number;
    wowPct: number | null;
    series: number[];
    /** 성과 탭 ViewsCurve와 동일 (첫 업로드 기준 D+) */
    curve: { day: number; views: number }[];
  };
  best: {
    week: CompanyHomeBestPost[];
    month: CompanyHomeBestPost[];
    all: CompanyHomeBestPost[];
  };
  news: CompanyHomeNewsItem[];
  visits: CompanyHomeVisits;
};

export function ymdKstNow() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

export function windowStartIso(days: number, asOfYmd = ymdKstNow()) {
  const [y, m, d] = asOfYmd.split("-").map(Number);
  const base = new Date(Date.UTC(y!, m! - 1, d!));
  base.setUTCDate(base.getUTCDate() - (days - 1));
  return `${base.toISOString().slice(0, 10)}T00:00:00+09:00`;
}

export function rankBestPosts(
  posts: CompanyHomeBestPost[],
  sinceIso: string | null,
  limit = 10,
) {
  const filtered = sinceIso
    ? posts.filter((p) => p.publishedAt && p.publishedAt >= sinceIso)
    : posts;
  return [...filtered]
    .sort((a, b) => b.views - a.views || b.likes - a.likes)
    .slice(0, limit);
}

export function summarizeBudget(
  total: number | null,
  spent: number,
  scheduled = 0,
) {
  const committed = spent + scheduled;
  if (total == null || total <= 0) {
    return {
      total,
      spent,
      scheduled,
      committed,
      remaining: null as number | null,
      pct: null as number | null,
    };
  }
  const remaining = Math.max(0, total - committed);
  const pct = Math.round((committed / total) * 1000) / 10;
  return { total, spent, scheduled, committed, remaining, pct };
}

export function publishYmd(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** ponytail: 일별 시계열 없음. 발행일 기준 현재 스냅샷 조회 합. */
export function viewsByPublishDay(
  posts: CompanyHomeBestPost[],
  asOfYmd: string,
  days = 7,
) {
  const keys = Array.from({ length: days }, (_, i) =>
    addDaysYmd(asOfYmd, -(days - 1 - i)),
  );
  const map = new Map(keys.map((k) => [k, 0]));
  for (const p of posts) {
    const k = publishYmd(p.publishedAt);
    if (!map.has(k)) continue;
    map.set(k, (map.get(k) || 0) + (p.views || 0));
  }
  return keys.map((k) => map.get(k) || 0);
}

/** 성과 탭 curvePoints와 동일 산식. D+0 → 현재. D+0 값 없어도 됨. */
export function buildViewsCurvePoints(
  links: { id: string; published_at: string | null }[],
  metrics: {
    creator_link_id: string;
    collected_at: string;
    views: number | null;
  }[],
  nowMs = Date.now(),
): { day: number; views: number }[] {
  let minTs: number | null = null;
  for (const l of links) {
    if (!l.published_at) continue;
    const ts = new Date(l.published_at).getTime();
    if (!Number.isFinite(ts)) continue;
    if (minTs == null || ts < minTs) minTs = ts;
  }
  if (minTs == null) return [];

  const startTs = minTs;
  const endTs = Math.max(nowMs, startTs);

  function viewsAt(tMs: number) {
    const latest = new Map<string, number>();
    for (const m of metrics) {
      const cMs = new Date(m.collected_at).getTime();
      if (!Number.isFinite(cMs) || cMs < startTs || cMs > tMs) continue;
      const v = Number(m.views) || 0;
      const prev = latest.get(m.creator_link_id);
      if (prev == null || v > prev) latest.set(m.creator_link_id, v);
    }
    let views = 0;
    for (const v of latest.values()) views += v;
    return views;
  }

  function dayKey(tMs: number) {
    const elapsed = Math.max(0, (tMs - startTs) / 86_400_000);
    return elapsed < 1 ? Math.round(elapsed * 48) / 48 : elapsed;
  }

  const daily = new Map<number, number>();
  daily.set(0, viewsAt(startTs));
  for (const m of metrics) {
    const tMs = new Date(m.collected_at).getTime();
    if (!Number.isFinite(tMs) || tMs < startTs || tMs > endTs) continue;
    daily.set(dayKey(tMs), viewsAt(tMs));
  }
  daily.set(dayKey(endTs), viewsAt(endTs));

  const raw = [...daily.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, views]) => ({ day, views }));

  return raw.filter((p, i) => {
    if (i === 0 || i === raw.length - 1) return true;
    return p.views !== raw[i - 1]!.views;
  });
}

/** 조회수 추이 SVG — 꺾은선/계단이 아니라 단조 큐빅 곡선. */
export function monotoneCurvePath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return "";
  const fmt = (n: number) => n.toFixed(1);
  if (pts.length === 1) return `M${fmt(pts[0]!.x)},${fmt(pts[0]!.y)}`;
  if (pts.length === 2) {
    const a = pts[0]!;
    const b = pts[1]!;
    const mx = (a.x + b.x) / 2;
    return `M${fmt(a.x)},${fmt(a.y)} C${fmt(mx)},${fmt(a.y)} ${fmt(mx)},${fmt(b.y)} ${fmt(b.x)},${fmt(b.y)}`;
  }
  const n = pts.length;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = pts[i + 1]!.x - pts[i]!.x;
    dx[i] = h;
    m[i] = h === 0 ? 0 : (pts[i + 1]!.y - pts[i]!.y) / h;
  }
  const t: number[] = [m[0]!];
  for (let i = 1; i < n - 1; i++) {
    t[i] = m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2;
  }
  t[n - 1] = m[n - 2]!;
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(m[i]!) < 1e-12) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i]! / m[i]!;
    const b = t[i + 1]! / m[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const q = 3 / Math.sqrt(s);
      t[i] = q * a * m[i]!;
      t[i + 1] = q * b * m[i]!;
    }
  }
  let d = `M${fmt(pts[0]!.x)},${fmt(pts[0]!.y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i]!;
    const p1 = pts[i + 1]!;
    const h = dx[i]!;
    d += ` C${fmt(p0.x + h / 3)},${fmt(p0.y + (t[i]! * h) / 3)} ${fmt(p1.x - h / 3)},${fmt(p1.y - (t[i + 1]! * h) / 3)} ${fmt(p1.x)},${fmt(p1.y)}`;
  }
  return d;
}

/** 성과 탭과 동일: content_metrics 시점별 링크 최신 조회 합 (최근 N일). */
export function cumulativeViewsSeriesFromMetrics(
  metrics: {
    creator_link_id: string;
    collected_at: string;
    views: number | null;
  }[],
  asOfYmd: string,
  days = 7,
): number[] {
  const keys = Array.from({ length: days }, (_, i) =>
    addDaysYmd(asOfYmd, -(days - 1 - i)),
  );
  return keys.map((ymd) => {
    const end = new Date(`${ymd}T23:59:59+09:00`).getTime();
    const latest = new Map<string, number>();
    for (const m of metrics) {
      const t = new Date(m.collected_at).getTime();
      if (!Number.isFinite(t) || t > end) continue;
      const v = Number(m.views) || 0;
      const prev = latest.get(m.creator_link_id);
      if (prev == null || v > prev) latest.set(m.creator_link_id, v);
    }
    let sum = 0;
    for (const v of latest.values()) sum += v;
    return sum;
  });
}

export function sumViewsInRange(
  posts: CompanyHomeBestPost[],
  sinceYmd: string,
  untilYmd: string,
) {
  return posts.reduce((sum, p) => {
    const d = publishYmd(p.publishedAt);
    if (!d || d < sinceYmd || d > untilYmd) return sum;
    return sum + (p.views || 0);
  }, 0);
}

export function wowPct(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** 홈 성과 보드용 — insights links 최소 형태 */
export type HomeInsightLink = {
  id: string;
  link_url: string | null;
  published_at: string | null;
  views: number | null;
  likes: number | null;
  saves?: number | null;
  allocations: {
    influencer_id?: string;
    influencers: {
      id: string;
      name: string;
      instagram_handle_normalized?: string;
      instagram_handle?: string;
      region?: string | null;
    } | null;
    products: { id: string; name: string } | null;
    allocation_pricing?:
      | { display_price: number | null }
      | { display_price: number | null }[]
      | null;
  } | null;
};

export type WeekPoint = {
  key: string;
  label: string;
  axisLabel: string;
  uploads: number;
  views: number;
  likes: number;
  saves: number;
};

export type ShareSegment = { label: string; value: number };

function kstParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const num = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value || 0);
  return { year: num("year"), month: num("month"), day: num("day") };
}

/** 그달 1~7=1주차 … 29~말일=5주차 */
export function weekOfMonth(day: number) {
  return Math.min(5, Math.ceil(day / 7));
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function platformOf(url: string | null) {
  if (!url) return "기타";
  if (/xiaohongshu|xhslink|rednote/i.test(url)) return "샤오홍슈";
  if (/tiktok/i.test(url)) return "틱톡";
  if (/instagram/i.test(url)) return "인스타그램";
  if (/youtube|youtu\.be/i.test(url)) return "유튜브";
  return "기타";
}

export function regionLabel(raw: string | null | undefined) {
  const r = (raw || "").toLowerCase();
  if (!r) return "기타";
  if (r.includes("jp") || r.includes("일본")) return "일본권";
  if (r.includes("cn") || r.includes("중국") || r.includes("zh")) return "중화권";
  if (r.includes("kr") || r.includes("한국")) return "한국";
  if (r.includes("us") || r.includes("en") || r.includes("영미")) return "영미권";
  return raw || "기타";
}

/**
 * 발행일 기준 주차별 누적 (달력 1~7=1주차…).
 * fromMonth 기본 8 = 해당 연도 8월부터.
 */
export function buildWeekSeries(
  links: Pick<
    HomeInsightLink,
    "published_at" | "views" | "likes" | "saves"
  >[],
  fromMonth = 8,
  asOf = kstParts(),
): WeekPoint[] {
  const { year, month, day } = asOf;
  let startYear = year;
  if (month < fromMonth) startYear = year - 1;

  type Bucket = { key: string; label: string; axisLabel: string; endYmd: string };
  const buckets: Bucket[] = [];
  let cy = startYear;
  let cm = fromMonth;

  while (cy < year || (cy === year && cm <= month)) {
    const lastDay = lastDayOfMonth(cy, cm);
    const maxWeek = weekOfMonth(lastDay);
    const currentWeek = cy === year && cm === month ? weekOfMonth(day) : maxWeek;
    for (let w = 1; w <= currentWeek; w++) {
      const weekEnd = Math.min(w * 7, lastDay);
      const endDay =
        cy === year && cm === month && w === currentWeek ? day : weekEnd;
      buckets.push({
        key: `${cy}-${pad2(cm)}-W${w}`,
        label: `${cm}월 ${w}주차`,
        axisLabel: `${cm}월${w}주`,
        endYmd: `${cy}-${pad2(cm)}-${pad2(endDay)}`,
      });
    }
    cm += 1;
    if (cm > 12) {
      cm = 1;
      cy += 1;
    }
  }

  return buckets.map((b) => {
    let uploads = 0;
    let views = 0;
    let likes = 0;
    let saves = 0;
    for (const l of links) {
      const pub = publishYmd(l.published_at);
      if (!pub || pub > b.endYmd) continue;
      uploads += 1;
      views += Number(l.views) || 0;
      likes += Number(l.likes) || 0;
      saves += Number(l.saves) || 0;
    }
    return {
      key: b.key,
      label: b.label,
      axisLabel: b.axisLabel,
      uploads,
      views,
      likes,
      saves,
    };
  });
}

function sortShare(entries: [string, number][]): ShareSegment[] {
  return entries
    .map(([label, value]) => ({ label, value }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function shareSegmentsByPlatform(links: HomeInsightLink[]): ShareSegment[] {
  const m = new Map<string, number>();
  for (const l of links) {
    const k = platformOf(l.link_url);
    m.set(k, (m.get(k) || 0) + (Number(l.likes) || 0) + (Number(l.saves) || 0));
  }
  return sortShare([...m.entries()]);
}

export function shareSegmentsByRegion(links: HomeInsightLink[]): ShareSegment[] {
  const m = new Map<string, number>();
  for (const l of links) {
    const region = regionLabel(l.allocations?.influencers?.region);
    m.set(
      region,
      (m.get(region) || 0) + (Number(l.likes) || 0) + (Number(l.saves) || 0),
    );
  }
  return sortShare([...m.entries()]);
}

export function rankInfluencers(
  rows: CompanyHomeInfluencerRow[],
  limit = 10,
) {
  return [...rows]
    .sort((a, b) => {
      const ap = a.views > 0 ? 1 : 0;
      const bp = b.views > 0 ? 1 : 0;
      if (bp !== ap) return bp - ap;
      if (ap) return b.views - a.views || b.followers - a.followers;
      return b.followers - a.followers;
    })
    .slice(0, limit);
}

export function displayHandle(handle: string) {
  return handle.replace(/^@+/, "").trim() || handle;
}

export function visitStoreNewsLabel(store: string) {
  const n = canonicalBranchName(store);
  if (!n) return "매장";
  return /점$/.test(n) ? n : `${n}점`;
}

export function visitTimelineTitle(store: string, name: string) {
  const who = name.trim() || "인플루언서";
  return `${who} ${visitStoreNewsLabel(store)} 방문`;
}

export function daysAgoLabel(ymd: string, asOf: string) {
  const a = Date.parse(`${ymd.slice(0, 10)}T00:00:00+09:00`);
  const b = Date.parse(`${asOf.slice(0, 10)}T00:00:00+09:00`);
  const n = Math.round((b - a) / 86_400_000);
  if (!Number.isFinite(n) || n <= 0) return "오늘";
  if (n === 1) return "1일 전";
  return `${n}일 전`;
}

export function groupByDay<T>(rows: T[], dayOf: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const day = dayOf(row).slice(0, 10);
    const list = map.get(day) || [];
    list.push(row);
    map.set(day, list);
  }
  return [...map.entries()];
}

export function buildDerivedNews(input: {
  asOf?: string;
  visits?: {
    id: string;
    influencerId?: string;
    name: string;
    store: string;
    visitDate: string;
    handle?: string;
    snsUrl?: string | null;
    product?: string;
    followers?: number;
    published?: boolean;
  }[];
  uploads?: {
    id: string;
    influencerId?: string;
    name: string;
    handle?: string;
    at: string;
    url: string | null;
    product?: string;
    followers?: number;
  }[];
}): CompanyHomeNewsItem[] {
  const items: CompanyHomeNewsItem[] = [];
  const asOf = input.asOf || ymdKstNow();
  const from = addDaysYmd(asOf, -30);
  for (const v of input.visits || []) {
    const d = (v.visitDate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (d >= asOf || d < from) continue;
    const who = v.name.trim() || "인플루언서";
    const storeLabel = visitStoreNewsLabel(v.store);
    const handle = v.handle || "";
    const product = (v.product || "").trim();
    const contentLabel = v.published ? "발행완료" : "콘텐츠 대기";
    items.push({
      id: `visit-${v.id}`,
      at: `${d}T23:59:00+09:00`,
      kind: "일정",
      title: visitTimelineTitle(v.store, who),
      body: `${product || "상품"} · ${contentLabel}`,
      detail: {
        type: "visit",
        name: who,
        store: storeLabel,
        visitDate: d,
        product: product || "—",
        contentLabel,
        followers: Number(v.followers) || 0,
        influencerId: v.influencerId || v.id,
        handle,
        profileUrl: visitProfileHref({
          handle,
          snsUrl: v.snsUrl || null,
        }),
      },
    });
  }
  for (const u of input.uploads || []) {
    const raw = (u.at || "").trim();
    const day = /^\d{4}-\d{2}-\d{2}$/.test(raw.slice(0, 10))
      ? raw.slice(0, 10)
      : asOf;
    if (day > asOf || day < from) continue;
    const who = u.name.trim() || "인플루언서";
    const handle = u.handle || "";
    const product = (u.product || "").trim();
    const at = raw && raw.length >= 10 ? raw : `${day}T12:00:00+09:00`;
    items.push({
      id: `pub-${u.id}`,
      at,
      kind: "성과",
      title: `${who} 발행 완료`,
      body: product ? `${product} · 조회·좋아요 수집 중` : "조회·좋아요 수집 중",
      detail: {
        type: "publish",
        name: who,
        product: product || "—",
        day,
        influencerId: u.influencerId || u.id,
        handle,
        followers: Number(u.followers) || 0,
        profileUrl: visitProfileHref({ handle, snsUrl: null }),
        contentUrl: (u.url || "").trim() || null,
      },
    });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

/** 방문만 최신 8건이면 발행이 안 보인다. 둘 다 남긴다. */
export function pickNewsFeed(items: CompanyHomeNewsItem[], limit = 8) {
  const visits = items.filter((i) => i.detail?.type === "visit");
  const pubs = items.filter((i) => i.detail?.type === "publish");
  if (pubs.length === 0) return visits.slice(0, limit);
  if (visits.length === 0) return pubs.slice(0, limit);
  const pTake = Math.min(pubs.length, Math.max(2, Math.ceil(limit / 2)));
  const vTake = Math.min(visits.length, limit - pTake);
  return [...visits.slice(0, vTake), ...pubs.slice(0, pTake)].sort((a, b) =>
    b.at.localeCompare(a.at),
  );
}

export function formatHomeViews(n: number) {
  return formatMetric(n);
}

function assertRankBestPosts() {
  const posts: CompanyHomeBestPost[] = [
    {
      id: "a",
      influencerId: "a",
      url: null,
      handle: "@a",
      name: "A",
      product: "p",
      views: 100,
      likes: 1,
      comments: 0,
      publishedAt: "2026-09-01T00:00:00+09:00",
    },
    {
      id: "b",
      influencerId: "b",
      url: null,
      handle: "@b",
      name: "B",
      product: "p",
      views: 200,
      likes: 1,
      comments: 0,
      publishedAt: "2026-08-01T00:00:00+09:00",
    },
  ];
  const week = rankBestPosts(posts, "2026-08-28T00:00:00+09:00", 3);
  if (week.length !== 1 || week[0]!.id !== "a") {
    throw new Error("rankBestPosts window failed");
  }
  const all = rankBestPosts(posts, null, 1);
  if (all[0]!.id !== "b") throw new Error("rankBestPosts all failed");
  const bgt = summarizeBudget(10_000_000, 700_000, 800_000);
  if (
    bgt.committed !== 1_500_000 ||
    bgt.remaining !== 8_500_000 ||
    bgt.pct !== 15
  ) {
    throw new Error("summarizeBudget committed failed");
  }
  const telo = teloactHomeBudget();
  if (
    telo.spent !== 40_000_000 ||
    telo.rounds[0]?.status !== "집행 완료" ||
    telo.rounds[1]?.status !== "진행중"
  ) {
    throw new Error("teloactHomeBudget failed");
  }
  if (visitTimelineTitle("OWM 명동점", "서하얀") !== "서하얀 명동점 방문") {
    throw new Error("visitTimelineTitle failed");
  }
  if (daysAgoLabel("2026-09-07", "2026-09-09") !== "2일 전") {
    throw new Error("daysAgoLabel failed");
  }
  const visitNews = buildDerivedNews({
    asOf: "2026-09-09",
    visits: [
      {
        id: "1",
        name: "서하얀",
        store: "명동",
        visitDate: "2026-09-08",
        handle: "@seohayan",
        snsUrl: "https://instagram.com/seohayan",
        product: "닥터리앤장",
      },
      { id: "2", name: "미래", store: "강남점", visitDate: "2026-09-09" },
      { id: "3", name: "옛", store: "부산", visitDate: "2026-07-01" },
    ],
    uploads: [
      {
        id: "u1",
        name: "서하얀",
        at: "2026-09-08T14:00:00+09:00",
        url: "https://www.instagram.com/p/abc",
      },
      {
        id: "u2",
        name: "옛",
        at: "2026-07-01T14:00:00+09:00",
        url: "https://x.com/old",
      },
    ],
  });
  if (
    visitNews.length !== 2 ||
    visitNews[0]!.detail?.type !== "visit" ||
    visitNews[0]!.title !== "서하얀 명동점 방문" ||
    visitNews[1]!.detail?.type !== "publish" ||
    visitNews[1]!.title !== "서하얀 발행 완료"
  ) {
    throw new Error("buildDerivedNews visit/publish failed");
  }
  const undated = buildDerivedNews({
    asOf: "2026-09-09",
    uploads: [{ id: "u0", name: "발행자", at: "", url: "https://x.com/p" }],
  });
  if (undated.length !== 1 || undated[0]!.title !== "발행자 발행 완료") {
    throw new Error("buildDerivedNews undated publish failed");
  }
  const mixed = pickNewsFeed([
    ...Array.from({ length: 8 }, (_, i) => visitNews[0]!),
    visitNews[1]!,
  ]);
  if (!mixed.some((i) => i.detail?.type === "publish")) {
    throw new Error("pickNewsFeed dropped publish");
  }
  const series = viewsByPublishDay(posts, "2026-09-03", 7);
  if (series.length !== 7 || series[4] !== 100) {
    throw new Error("viewsByPublishDay failed");
  }
  const cum = cumulativeViewsSeriesFromMetrics(
    [
      {
        creator_link_id: "a",
        collected_at: "2026-09-01T12:00:00+09:00",
        views: 50,
      },
      {
        creator_link_id: "a",
        collected_at: "2026-09-03T12:00:00+09:00",
        views: 120,
      },
    ],
    "2026-09-03",
    7,
  );
  if (cum[4] !== 50 || cum[6] !== 120) {
    throw new Error("cumulativeViewsSeriesFromMetrics failed");
  }
  const curve = buildViewsCurvePoints(
    [
      { id: "a", published_at: "2026-09-01T00:00:00+09:00" },
      { id: "b", published_at: "2026-09-02T00:00:00+09:00" },
    ],
    [
      {
        creator_link_id: "a",
        collected_at: "2026-09-01T12:00:00+09:00",
        views: 10,
      },
      {
        creator_link_id: "a",
        collected_at: "2026-09-03T12:00:00+09:00",
        views: 40,
      },
      {
        creator_link_id: "b",
        collected_at: "2026-09-03T12:00:00+09:00",
        views: 20,
      },
    ],
    Date.parse("2026-09-09T00:00:00+09:00"),
  );
  if (
    curve[0]?.day !== 0 ||
    curve[0]?.views !== 0 ||
    curve[curve.length - 1]!.views !== 60 ||
    (curve[curve.length - 1]!.day ?? 0) < 7
  ) {
    throw new Error("buildViewsCurvePoints failed");
  }
  const emptyStart = buildViewsCurvePoints(
    [{ id: "a", published_at: "2026-09-01T00:00:00+09:00" }],
    [],
    Date.parse("2026-09-03T00:00:00+09:00"),
  );
  if (
    emptyStart.length !== 2 ||
    emptyStart[0]!.views !== 0 ||
    emptyStart[1]!.day < 1
  ) {
    throw new Error("buildViewsCurvePoints d0-to-now failed");
  }
  const path = monotoneCurvePath([
    { x: 0, y: 10 },
    { x: 10, y: 20 },
    { x: 20, y: 20 },
  ]);
  if (!path.startsWith("M") || !path.includes(" C")) {
    throw new Error("monotoneCurvePath failed");
  }
  const ranked = rankInfluencers([
    { id: "x", name: "x", handle: "@x", product: "p", followers: 9, views: 0 },
    { id: "y", name: "y", handle: "@y", product: "p", followers: 1, views: 10 },
  ]);
  if (ranked[0]!.id !== "y") throw new Error("rankInfluencers failed");

  const visits = splitHomeVisits(
    [
      {
        id: "a",
        name: "A",
        handle: "@a",
        visitDate: "2026-09-08",
        product: "p1",
      },
      {
        id: "a",
        name: "A",
        handle: "@a",
        visitDate: "2026-09-20",
        product: "p2",
      },
      {
        id: "b",
        name: "B",
        handle: "@b",
        visitDate: "2026-09-01",
        product: "p",
      },
      {
        id: "c",
        name: "C",
        handle: "@c",
        visitDate: "2026-07-01",
        product: "p",
      },
      {
        id: "d",
        name: "D",
        handle: "@d",
        visitDate: "2026-09-06",
        product: "p",
      },
    ],
    "2026-09-09",
  );
  if (
    visits.upcoming.length !== 1 ||
    visits.upcoming[0]!.id !== "a" ||
    visits.upcoming[0]!.visitDate !== "2026-09-20" ||
    visits.done.length !== 2 ||
    visits.done[0]!.id !== "d" ||
    visits.done[1]!.id !== "b"
  ) {
    throw new Error("splitHomeVisits failed");
  }
  if (visitProfileHref({ handle: "@foo", snsUrl: null }) !== "https://www.instagram.com/foo/") {
    throw new Error("visitProfileHref failed");
  }
  if (weekOfMonth(1) !== 1 || weekOfMonth(8) !== 2 || weekOfMonth(31) !== 5) {
    throw new Error("weekOfMonth failed");
  }
  const weeks = buildWeekSeries(
    [
      {
        published_at: "2026-08-20T00:00:00+09:00",
        views: 100,
        likes: 10,
        saves: 1,
      },
    ],
    8,
    { year: 2026, month: 9, day: 3 },
  );
  if (
    weeks.length !== 6 ||
    weeks[0]!.label !== "8월 1주차" ||
    weeks[weeks.length - 1]!.label !== "9월 1주차" ||
    weeks[1]!.uploads !== 0 ||
    weeks[2]!.uploads !== 1 ||
    weeks[5]!.uploads !== 1
  ) {
    throw new Error("buildWeekSeries failed");
  }
}

if (process.env.RUN_COMPANY_HOME_SELF_CHECK === "1") {
  assertRankBestPosts();
  console.log("company-home self-check ok");
}
