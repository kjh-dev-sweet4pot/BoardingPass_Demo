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
  influencers: Influencer | null;
};

export const ALLOCATION_STATUS_LABEL: Record<AllocationStatus, string> = {
  pending: "대기",
  visited: "매장 방문 완료",
  ready: "반출 준비",
  picked_up: "반출 완료",
  cancelled: "취소",
};
