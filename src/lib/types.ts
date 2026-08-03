export type AppRole = "admin" | "influencer" | "pharmacist";
export type SnsPlatform = "instagram" | "xiaohongshu" | "facebook" | "other";
export type AllocationStatus =
  | "pending"
  | "verified"
  | "ready"
  | "picked_up"
  | "cancelled";

export type Profile = {
  id: string;
  role: AppRole;
  display_name: string | null;
  store_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Store = {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
};

export type Influencer = {
  id: string;
  profile_id: string | null;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SnsIdentity = {
  id: string;
  influencer_id: string;
  platform: SnsPlatform;
  handle: string;
  handle_normalized: string;
  created_at: string;
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
  verified_at: string | null;
  picked_up_at: string | null;
  picked_up_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AllocationWithRelations = Allocation & {
  products: Product | null;
  stores: Store | null;
  influencers: Influencer | null;
};

export const SNS_PLATFORM_LABEL: Record<SnsPlatform, string> = {
  instagram: "Instagram",
  xiaohongshu: "샤오홍슈",
  facebook: "Facebook",
  other: "Other",
};

export const ALLOCATION_STATUS_LABEL: Record<AllocationStatus, string> = {
  pending: "대기",
  verified: "본인확인 완료",
  ready: "반출 준비",
  picked_up: "반출 완료",
  cancelled: "취소",
};
