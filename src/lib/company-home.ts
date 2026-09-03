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

export type CompanyHomePayload = {
  asOf: string;
  budget: {
    total: number | null;
    spent: number;
    remaining: number | null;
    pct: number | null;
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
}

if (process.env.RUN_COMPANY_HOME_SELF_CHECK === "1") {
  assertRankBestPosts();
  console.log("company-home self-check ok");
}
