export type AllocationStatus =
  | "pending"
  | "visited"
  | "ready"
  | "picked_up"
  | "cancelled";

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

export type Allocation = {
  id: string;
  influencer_id: string;
  product_id: string;
  store_id: string;
  quantity: number;
  status: AllocationStatus;
  visit_code: string | null;
  /** 방문 예정일 (YYYY-MM-DD) */
  visit_date: string | null;
  verified_at: string | null;
  picked_up_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AllocationWithRelations = Allocation & {
  products: Product | null;
  stores: Store | null;
  /** 조인 시만 존재 (Inf 목록 등에서는 생략 가능) */
  influencers?: Influencer | null;
};

export const ALLOCATION_STATUS_LABEL: Record<AllocationStatus, string> = {
  pending: "대기",
  visited: "매장 방문 완료",
  ready: "반출 준비",
  picked_up: "반출 완료",
  cancelled: "취소",
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

function formatVisitCompleteLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ALLOCATION_STATUS_LABEL.visited;
  return `${m}월 ${d}일 방문 완료`;
}

/**
 * 운영 콘솔·약사 카운터 상태 표시.
 * 방문했지만 아직 수령 전(visited/ready)이면 실제 확인일(verified_at) 기준으로
 * "M월 D일 방문 완료"로 표시. 수령 완료(picked_up)는 상태 라벨만 유지.
 */
export function allocationStatusDisplayLabel(
  item: Pick<Allocation, "status" | "visit_date" | "verified_at">,
) {
  if (
    (item.status === "visited" || item.status === "ready") &&
    item.verified_at
  ) {
    const verifiedDay = ymdKst(item.verified_at);
    if (verifiedDay) {
      return formatVisitCompleteLabel(verifiedDay);
    }
  }
  return ALLOCATION_STATUS_LABEL[item.status];
}
