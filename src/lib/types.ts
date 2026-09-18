export type AllocationStatus =
  | "pending"
  | "visited"
  | "ready"
  | "picked_up"
  | "cancelled";

export type VisitSource = "auto" | "pharmacist" | "admin";

export type Company = {
  id: string;
  name: string;
  login_id: string;
  aliases: string[];
  contact: string | null;
  contact_email?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** 최초 미팅 일자 (YYYY-MM-DD) */
  first_meet_on?: string | null;
  /** 소요예정기간 시작 */
  planned_start_on?: string | null;
  /** 소요예정기간 종료 */
  planned_end_on?: string | null;
  /** 계약 진행 단계 */
  contract_stage?: string | null;
  /** 회원사 배정 예산(원) */
  budget_amount?: number | null;
  /** 운영 기록용 소요 비용(원) */
  spent_amount?: number | null;
  /** 콘텐츠 가이드라인 URL */
  guideline_url?: string | null;
};

export type CreatorLinkStatus = "submitted" | "approved" | "rejected";

export type ThumbnailStatus = "pending" | "ok" | "failed";

export type CreatorLink = {
  id: string;
  allocation_id: string;
  influencer_id: string;
  url: string;
  platform: "instagram" | "tiktok" | "xiaohongshu" | "youtube" | "naver_blog" | "etc";
  status: CreatorLinkStatus;
  content_status?: "제출" | "승인" | "발행완료" | "반려" | null;
  publish_url?: string | null;
  submitted_file_path?: string | null;
  verification_failed?: boolean;
  memo: string | null;
  submitted_at: string;
  /** SNS 업로드 시각 (Apify). 검수 제출일과 별개 */
  published_at?: string | null;
  updated_at: string;
  thumbnail_status?: ThumbnailStatus;
  thumbnail_source_url?: string | null;
  thumbnail_fetched_at?: string | null;
  tiktok_video_id?: string | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  saves?: number | null;
  shares?: number | null;
  reposts?: number | null;
  metrics_collected_at?: string | null;
};

export type Store = {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
};

export type Influencer = {
  id: string;
  name: string;
  instagram_handle: string;
  instagram_handle_normalized: string;
  /** SNS 프로필 URL */
  sns_url: string | null;
  /** Storage influencer-avatars/{id}.jpg */
  profile_image_path: string | null;
  /** SNS 팔로워 수 (프로필 수집) */
  followers?: number | null;
  /** 계정 국가 ISO */
  region?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  company_id?: string | null;
  created_at: string;
  /** false면 보관됨 — 배정 이력이 있어 하드 삭제가 막혀 목록에서만 숨긴 상태 */
  is_active?: boolean;
};

export type CampaignStatus = "견적수립" | "시행" | "결과" | "보류" | "취소";

export type Campaign = {
  id: string;
  company_id: string;
  product_id: string;
  status: CampaignStatus;
  name: string | null;
  /** 캠페인 예산(원). 집행% = Accept 노출가 합 / budget_amount */
  budget_amount?: number | null;
  /** 소속 시즌. null이면 시즌 미배정 */
  season_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type Season = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  accent_hex: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PlacementGuideScope = "season" | "campaign";

export type PlacementGuide = {
  id: string;
  scope: PlacementGuideScope;
  season_id: string | null;
  campaign_id: string | null;
  store_id: string | null;
  title: string;
  body: string;
  image_path: string | null;
  priority: number;
  starts_on: string;
  ends_on: string;
  created_at: string;
  updated_at: string;
};

export type CastingStatus = "Pending" | "Nego" | "Accept" | "결렬";

export type Casting = {
  id: string;
  campaign_id: string;
  company_id: string;
  influencer_id: string;
  status: CastingStatus;
  allocation_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NegotiationLog = {
  id: string;
  casting_id: string;
  proposed_amount: number | null;
  memo: string | null;
  proposer: "company" | "operator";
  operator_label: string | null;
  created_at: string;
};

export const CASTING_STATUS_LABEL: Record<CastingStatus, string> = {
  Pending: "Pending",
  Nego: "Nego",
  Accept: "Accept",
  결렬: "결렬",
};

export type Allocation = {
  id: string;
  influencer_id: string;
  product_id: string;
  store_id: string;
  company_id: string | null;
  campaign_id?: string | null;
  target_content_count?: number | null;
  rollup_status?: string | null;
  quantity: number;
  status: AllocationStatus;
  visit_code: string | null;
  /** 방문 예정일 (YYYY-MM-DD) */
  visit_date: string | null;
  /** 첫 매장 방문 확인 시각 (한 번 찍히면 변경하지 않음) */
  verified_at: string | null;
  /** 가장 최근 매장 방문 확인 시각 (재방문 시 갱신, 화면 표시용) */
  last_visited_at: string | null;
  picked_up_at: string | null;
  visit_source: VisitSource | null;
  visit_confirmed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AllocationWithRelations = Allocation & {
  products: Product | null;
  stores: Store | null;
  companies?: Pick<Company, "id" | "name"> | null;
  /** 조인 시만 존재 (Inf 목록 등에서는 생략 가능) */
  influencers?: Influencer | null;
  campaigns?: Pick<Campaign, "id" | "name"> | null;
  creator_links?: CreatorLink[];
};

export const ALLOCATION_STATUS_LABEL: Record<AllocationStatus, string> = {
  pending: "대기",
  visited: "매장 방문 완료",
  ready: "반출 준비",
  picked_up: "반출 완료",
  cancelled: "취소",
};

export const VISIT_SOURCE_LABEL: Record<VisitSource, string> = {
  auto: "자동",
  pharmacist: "약사 확인",
  admin: "운영자 확인",
};

/** ISO / Date → YYYY-MM-DD (KST) */
export function ymdKst(input: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof input === "string" ? new Date(input) : input);
}

/** YYYY-MM-DD ± days (calendar, UTC date parts) */
export function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

/** YYYY-MM-DD → `M월 D일` */
export function formatMd(ymd: string) {
  const [, m, d] = ymd.split("-").map(Number);
  if (!m || !d) return ymd;
  return `${m}월 ${d}일`;
}

function formatVisitCompleteLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ALLOCATION_STATUS_LABEL.visited;
  return `${m}월 ${d}일 방문 완료`;
}

/**
 * 운영 콘솔·약사 카운터 상태 표시.
 * 방문했지만 아직 수령 전(visited/ready)이면 최근 방문일(last_visited_at,
 * 없으면 verified_at) 기준으로 "M월 D일 방문 완료"로 표시.
 * 첫 방문일(verified_at)은 이력으로 유지되며 덮어쓰지 않음.
 */
export function allocationStatusDisplayLabel(
  item: Pick<
    Allocation,
    "status" | "visit_date" | "verified_at" | "last_visited_at"
  >,
) {
  if (item.status === "visited" || item.status === "ready") {
    const stamp = item.last_visited_at || item.verified_at;
    if (stamp) {
      const day = ymdKst(stamp);
      if (day) return formatVisitCompleteLabel(day);
    }
  }
  return ALLOCATION_STATUS_LABEL[item.status];
}

// ---------------------------------------------------------------------------
// 마진 관리 (1단계)
// ---------------------------------------------------------------------------

export type Tier = "nano" | "micro" | "mid" | "macro" | "mega";

export type ContentType = "carousel" | "visit" | "seeding";

export type Platform = "instagram" | "tiktok" | "youtube" | "naver_blog" | "etc";

export type OtherCostType = "광고비" | "상품제공가" | "대행수수료" | "기타";

export type WarnType = "margin_low" | "margin_high" | "budget_over" | "slot_over";

export interface CampaignTarget {
  id: string;
  campaign_id: string;
  target_publish_count: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetPlanItem {
  id: string;
  campaign_id: string;
  /** "unclassified" = 인보이스 설명에서 등급을 못 알아낸 경우 */
  tier: Tier | "unclassified";
  content_type: ContentType | null;
  platform: Platform | null;
  unit_cost: number;
  slot_count: number;
  expected_publish_per_slot: number;
  sort_order: number;
  /** 원문 메모 (예: 인보이스 항목 설명을 그대로 옮겨둔 것) */
  memo?: string | null;
  created_at: string;
  updated_at: string;
  // derived, not stored — compute in API layer
  planned_amount?: number;
  filled_count?: number;
  remaining_count?: number;
}

export interface CampaignOtherCost {
  id: string;
  campaign_id: string;
  cost_type: OtherCostType;
  amount: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorRateCard {
  id: string;
  influencer_id: string;
  content_type: ContentType;
  platform: Platform;
  standard_cost: number;
  source: "invoice" | "manual";
  effective_from: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarginOverrideLog {
  id: string;
  campaign_id: string;
  casting_id: string | null;
  margin_before: number | null;
  margin_after: number | null;
  warn_type: WarnType;
  reason: string;
  actor: string;
  created_at: string;
}

export interface CastingCostSplit {
  id: string;
  casting_id: string;
  campaign_id: string;
  amount: number;
  is_manual: boolean;
  created_at: string;
  updated_at: string;
}

/** v_campaign_margin 뷰 반환 행 */
export interface CampaignMarginRow {
  campaign_id: string;
  company_id: string;
  revenue: number;
  planned_cost: number;
  committed_cost: number;
  spent_display: number;
  realized_cost: number;
  other_cost: number;
  committed_margin_rate: number | null;
  realized_margin_rate: number | null;
  burn_rate: number | null;
  spend_pct: number | null;
  target_publish_count: number | null;
  published_count: number;
  slot_total: number;
  slot_filled: number;
}

export const TARGET_MARGIN_RATE = 70;
export const MARGIN_RATE_MIN = 60;
export const MARGIN_RATE_MAX = 80;

export function calcMarginRate(revenue: number, cost: number): number | null {
  if (!revenue || revenue <= 0) return null;
  return Math.round(((revenue - cost) / revenue) * 1000) / 10;
}

export function calcBurnRate(revenue: number, committedCost: number): number | null {
  if (!revenue || revenue <= 0) return null;
  const allowedCost = revenue * 0.3;
  if (allowedCost <= 0) return null;
  return Math.round((committedCost / allowedCost) * 1000) / 10;
}

export function marginState(
  rate: number | null,
): "over" | "ok" | "caution" | "risk" | "unknown" {
  if (rate === null) return "unknown";
  if (rate > MARGIN_RATE_MAX) return "over";
  if (rate >= MARGIN_RATE_MIN) return "ok";
  if (rate >= 55) return "caution";
  return "risk";
}

export const MARGIN_STATE_COLOR: Record<ReturnType<typeof marginState>, string> = {
  over: "#2563EB",
  ok: "#16A34A",
  caution: "#D97706",
  risk: "#DC2626",
  unknown: "#6B7280",
};
