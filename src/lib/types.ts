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
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreatorLinkStatus = "submitted" | "approved" | "rejected";

export type ThumbnailStatus = "pending" | "ok" | "failed";

export type CreatorLink = {
  id: string;
  allocation_id: string;
  influencer_id: string;
  url: string;
  platform: "instagram" | "tiktok" | "youtube" | "naver_blog" | "etc";
  status: CreatorLinkStatus;
  content_status?: "제출" | "승인" | "발행완료" | "반려" | null;
  publish_url?: string | null;
  submitted_file_path?: string | null;
  verification_failed?: boolean;
  memo: string | null;
  submitted_at: string;
  updated_at: string;
  thumbnail_status?: ThumbnailStatus;
  thumbnail_source_url?: string | null;
  thumbnail_fetched_at?: string | null;
  tiktok_video_id?: string | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
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
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  created_at: string;
};

export type CampaignStatus = "견적수립" | "시행" | "결과" | "보류" | "취소";

export type Campaign = {
  id: string;
  company_id: string;
  product_id: string;
  status: CampaignStatus;
  name: string | null;
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
