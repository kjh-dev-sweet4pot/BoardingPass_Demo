import { isDemoCompany } from "@/lib/company";
import { formatMetric } from "@/lib/content-insights";

export type CompanyHomeNewsKind =
  | "계약"
  | "예산"
  | "입금"
  | "할인"
  | "일정"
  | "검토"
  | "성과"
  | "섭외";

export type CompanyHomeNewsItem = {
  id: string;
  at: string;
  kind: CompanyHomeNewsKind;
  title: string;
  body: string;
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

export type CompanyHomePayload = {
  asOf: string;
  budget: {
    total: number | null;
    spent: number;
    remaining: number | null;
    pct: number | null;
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

export function summarizeBudget(total: number | null, spent: number) {
  if (total == null || total <= 0) {
    return { total, spent, remaining: null as number | null, pct: null as number | null };
  }
  const remaining = Math.max(0, total - spent);
  const pct = Math.round((spent / total) * 1000) / 10;
  return { total, spent, remaining, pct };
}

export function addDaysYmd(ymd: string, delta: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
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

/** 성과 탭 curvePoints와 동일 산식. */
export function buildViewsCurvePoints(
  links: { id: string; published_at: string | null }[],
  metrics: {
    creator_link_id: string;
    collected_at: string;
    views: number | null;
  }[],
): { day: number; views: number }[] {
  let minTs: number | null = null;
  for (const l of links) {
    if (!l.published_at) continue;
    const ts = new Date(l.published_at).getTime();
    if (!Number.isFinite(ts)) continue;
    if (minTs == null || ts < minTs) minTs = ts;
  }
  if (minTs == null || metrics.length === 0) return [];

  const startTs = minTs;
  const times = [
    ...new Set(
      metrics
        .map((m) => m.collected_at)
        .filter((t) => new Date(t).getTime() >= startTs),
    ),
  ].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  if (times.length < 2) return [];

  const daily = new Map<number, number>();
  for (const t of times) {
    const tMs = new Date(t).getTime();
    const latest = new Map<string, number>();
    for (const m of metrics) {
      const cMs = new Date(m.collected_at).getTime();
      if (cMs > tMs) continue;
      const v = Number(m.views) || 0;
      const prev = latest.get(m.creator_link_id);
      if (prev == null || v > prev) latest.set(m.creator_link_id, v);
    }
    let views = 0;
    for (const v of latest.values()) views += v;
    const elapsed = Math.max(0, (tMs - startTs) / 86400000);
    const key =
      elapsed < 1 ? Math.round(elapsed * 48) / 48 : Math.floor(elapsed);
    daily.set(key, views);
  }

  const raw = [...daily.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, views]) => ({ day, views }));

  return raw.filter((p, i) => {
    if (i === 0 || i === raw.length - 1) return true;
    return p.views !== raw[i - 1]!.views;
  });
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

/** 데모 회원사: 계약·입금·할인 등 운영 뉴스를 시연용으로 채움 */
export function buildDemoCompanyNews(companyName: string): CompanyHomeNewsItem[] {
  return [
    {
      id: "demo-budget",
      at: "2026-08-31T14:00:00+09:00",
      kind: "예산",
      title: `확보 예산 9,000만원`,
      body: `${companyName} · 닥터 리앤장·크리에이터 · Rxme 계약 확정`,
    },
    {
      id: "demo-deposit-rxme",
      at: "2026-08-31T11:00:00+09:00",
      kind: "입금",
      title: "Rxme 입금 확인",
      body: "1,000만원 · 원브랜드 가이드 제작 중",
    },
    {
      id: "demo-deposit-dr",
      at: "2026-08-30T18:00:00+09:00",
      kind: "입금",
      title: "닥터 리앤장 입금 확인",
      body: "3,000만원 · PPL 컨셉안 전달 완료 · 가이드 제작 중",
    },
    {
      id: "demo-discount",
      at: "2026-08-30T16:00:00+09:00",
      kind: "할인",
      title: "패키지 할인 5% 적용",
      body: "다캠페인 묶음 · 노출가 기준 조정 · 운영관리자 확정",
    },
    {
      id: "demo-schedule",
      at: "2026-08-30T15:00:00+09:00",
      kind: "일정",
      title: "9/6 방문 마케팅 시작",
      body: "목표 발행 54건 · 명동 80% · 북촌 20%",
    },
    {
      id: "demo-review",
      at: "2026-08-28T10:00:00+09:00",
      kind: "검토",
      title: "헤브블루 온보딩 진행",
      body: "예산 2,000–3,000만원 · 계약 예정 · 검토 중",
    },
    {
      id: "demo-contract",
      at: "2026-08-27T09:00:00+09:00",
      kind: "계약",
      title: "최초 계약 체결",
      body: `${companyName} Boarding Pass 이용 계약 · 콘텐츠 가이드라인 공유`,
    },
    {
      id: "demo-perf",
      at: "2026-08-28T09:00:00+09:00",
      kind: "성과",
      title: "명동 오픈 캠페인 반영",
      body: "발행 콘텐츠 성과 지표 수집 시작",
    },
  ];
}

export function buildDerivedNews(input: {
  companyName: string;
  campaigns: { id: string; name: string | null; status: string; budget_amount: number | null; created_at: string }[];
  acceptCount: number;
  publishedCount: number;
}): CompanyHomeNewsItem[] {
  const items: CompanyHomeNewsItem[] = [];
  for (const c of input.campaigns.slice(0, 5)) {
    items.push({
      id: `camp-${c.id}`,
      at: c.created_at,
      kind: "계약",
      title: c.name?.trim() || "캠페인 등록",
      body: `상태 ${c.status}${
        c.budget_amount != null
          ? ` · 예산 ${c.budget_amount.toLocaleString("ko-KR")}원`
          : ""
      }`,
    });
    if (c.budget_amount != null && c.budget_amount > 0) {
      items.push({
        id: `budget-${c.id}`,
        at: c.created_at,
        kind: "예산",
        title: `예산 ${(c.budget_amount / 10_000).toLocaleString("ko-KR")}만원`,
        body: `${c.name || "캠페인"} · 집행 한도 설정`,
      });
    }
  }
  if (input.acceptCount > 0) {
    items.push({
      id: "accept-rollup",
      at: new Date().toISOString(),
      kind: "섭외",
      title: `섭외 확정 ${input.acceptCount}건`,
      body: `${input.companyName} · Accept 기준 노출가 합산으로 예산 사용`,
    });
  }
  if (input.publishedCount > 0) {
    items.push({
      id: "pub-rollup",
      at: new Date().toISOString(),
      kind: "성과",
      title: `발행완료 ${input.publishedCount}건`,
      body: "조회·좋아요·댓글 지표 수집 중",
    });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);
}

export function newsKindTone(kind: CompanyHomeNewsKind) {
  if (kind === "입금" || kind === "예산") return "text-[var(--accent)]";
  if (kind === "성과") return "text-[#2f6b3c]";
  if (kind === "할인") return "text-[#8a4b12]";
  if (kind === "검토") return "text-[#6b5a45]";
  return "text-[var(--muted)]";
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
  );
  if (curve.length < 2 || curve[curve.length - 1]!.views !== 60) {
    throw new Error("buildViewsCurvePoints failed");
  }
  const ranked = rankInfluencers([
    { id: "x", name: "x", handle: "@x", product: "p", followers: 9, views: 0 },
    { id: "y", name: "y", handle: "@y", product: "p", followers: 1, views: 10 },
  ]);
  if (ranked[0]!.id !== "y") throw new Error("rankInfluencers failed");

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
