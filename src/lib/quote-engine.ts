import { calcMarginRate, marginState, TARGET_MARGIN_RATE, type ContentType, type Platform, type Tier } from "@/lib/types";

export type QuoteLine = {
  tier: Tier;
  content_type: ContentType;
  platform: Platform;
  unit_cost: number;
  slot_count: number;
};

export function quoteCost(lines: QuoteLine[]): number {
  return lines.reduce((sum, l) => sum + (l.unit_cost || 0) * (l.slot_count || 0), 0);
}

/** 목표 마진율을 유지하는 데 필요한 매출(예산). targetRate는 %(0~99). */
export function suggestedRevenue(cost: number, targetRate: number = TARGET_MARGIN_RATE): number {
  if (targetRate >= 100 || targetRate < 0) return cost;
  return Math.round(cost / (1 - targetRate / 100));
}

export function quoteSummary(lines: QuoteLine[], revenue: number | null, targetRate = TARGET_MARGIN_RATE) {
  const cost = quoteCost(lines);
  const suggested = suggestedRevenue(cost, targetRate);
  const rate = revenue != null ? calcMarginRate(revenue, cost) : calcMarginRate(suggested, cost);
  return {
    cost,
    suggestedRevenue: suggested,
    marginRate: rate,
    state: marginState(rate),
  };
}

if (
  quoteCost([{ tier: "micro", content_type: "carousel", platform: "instagram", unit_cost: 100_000, slot_count: 3 }]) !==
  300_000
) {
  throw new Error("quoteCost failed");
}
if (suggestedRevenue(700_000, 70) !== 2_333_333) {
  throw new Error("suggestedRevenue failed");
}
if (suggestedRevenue(1_000_000, 100) !== 1_000_000) {
  throw new Error("suggestedRevenue should not divide by zero at 100%");
}
{
  const s = quoteSummary(
    [{ tier: "mid", content_type: "seeding", platform: "tiktok", unit_cost: 300_000, slot_count: 10 }],
    null,
    70,
  );
  if (s.cost !== 3_000_000 || s.marginRate !== 70 || s.state !== "ok") {
    throw new Error(`quoteSummary failed: ${JSON.stringify(s)}`);
  }
}
