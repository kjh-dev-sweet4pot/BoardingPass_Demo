// Margin management (1단계) — type additions.
// Append to / merge with existing src/lib/types.ts. Do not duplicate existing
// Campaign / Casting / Allocation / Influencer types — those already exist.

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
  tier: Tier;
  content_type: ContentType | null;
  platform: Platform | null;
  unit_cost: number;
  slot_count: number;
  expected_publish_per_slot: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // derived, not stored — compute in API layer
  planned_amount?: number; // unit_cost * slot_count
  filled_count?: number; // count of castings referencing this slot
  remaining_count?: number; // slot_count - filled_count
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
  effective_from: string; // date
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

// Row shape returned by v_campaign_margin
export interface CampaignMarginRow {
  campaign_id: string;
  company_id: string;
  revenue: number; // campaigns.budget_amount
  planned_cost: number;
  committed_cost: number;
  spent_display: number;
  realized_cost: number;
  other_cost: number;
  committed_margin_rate: number | null; // 대표값
  realized_margin_rate: number | null;
  burn_rate: number | null;
  spend_pct: number | null;
  target_publish_count: number | null;
  published_count: number;
  slot_total: number;
  slot_filled: number;
}

// ---------------------------------------------------------------------------
// Pure calculation helpers — colocate with the view's formulas (spec §4, §8.5)
// so the client-side preview (casting accept modal) matches the DB view exactly.
// ---------------------------------------------------------------------------

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

// PRICING_KEYS extension — merge into existing stripPricingFields() list.
export const MARGIN_PRICING_KEYS = [
  "margin_rate",
  "committed_margin_rate",
  "realized_margin_rate",
  "burn_rate",
  "spend_pct",
  "planned_amount",
  "unit_cost",
  "standard_cost",
  "committed_cost",
  "realized_cost",
  "other_cost",
  "spent_display",
] as const;
