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

/** 등급 없음 — 인보이스 설명·팔로워 수에서 티어를 못 알아냈을 때 쓰는 값 */
export const UNCLASSIFIED_TIER = "unclassified" as const;

/** 인보이스 항목 설명에서 등급(티어) 키워드를 찾는다. 없으면 UNCLASSIFIED_TIER. */
export function classifyTierFromText(text: string): Tier | typeof UNCLASSIFIED_TIER {
  const t = text.toLowerCase();
  if (text.includes("메가") || /\bmega\b/.test(t)) return "mega";
  if (text.includes("매크로") || /\bmacro\b/.test(t)) return "macro";
  if (text.includes("마이크로") || /\bmicro\b/.test(t)) return "micro";
  if (text.includes("나노") || /\bnano\b/.test(t)) return "nano";
  if (text.includes("미들") || /\bmid(dle)?\b/.test(t)) return "mid";
  return UNCLASSIFIED_TIER;
}

/** 팔로워 수 기준 통상적인 인플루언서 등급 구간 */
export const FOLLOWER_TIER_BANDS: { tier: Tier; min: number }[] = [
  { tier: "mega", min: 1_000_000 },
  { tier: "macro", min: 500_000 },
  { tier: "mid", min: 100_000 },
  { tier: "micro", min: 10_000 },
  { tier: "nano", min: 0 },
];

/** 팔로워 수로 등급을 나눈다 (통상적인 구간: nano<1만<micro<10만<mid<50만<macro<100만<=mega). */
export function classifyTierByFollowers(followers: number | null | undefined): Tier | typeof UNCLASSIFIED_TIER {
  if (followers == null || !Number.isFinite(followers) || followers < 0) return UNCLASSIFIED_TIER;
  const band = FOLLOWER_TIER_BANDS.find((b) => followers >= b.min);
  return band?.tier ?? UNCLASSIFIED_TIER;
}

export const DEFAULT_TIER_COST: Record<Tier, number> = {
  mega: 3_000_000,
  macro: 1_500_000,
  mid: 700_000,
  micro: 300_000,
  nano: 100_000,
};

const TIER_FILL_ORDER: Tier[] = ["mega", "macro", "mid", "micro", "nano"];

/**
 * 예산(목표 원가)에 맞춰 등급별 슬롯 조합을 제안한다. 실제로는 더 싼 비용으로
 * 섭외하더라도, 클라이언트에게 낼 견적 구성은 이 조합으로 보여준다.
 * ponytail: 등급별 표준 단가로 그리디하게 채우는 근사치 — 배낭 문제 최적해 아님.
 * 등급 내 단가 다양화(같은 메가라도 3백/1백 혼합)가 필요해지면 DP로 업그레이드.
 */
export function suggestQuoteLines(
  targetCost: number,
  content_type: ContentType = "carousel",
  platform: Platform = "instagram",
  tierCost: Record<Tier, number> = DEFAULT_TIER_COST,
): QuoteLine[] {
  const lines: QuoteLine[] = [];
  let remaining = Math.max(0, Math.round(targetCost));
  for (const tier of TIER_FILL_ORDER) {
    const unit = tierCost[tier];
    const count = Math.floor(remaining / unit);
    if (count > 0) {
      lines.push({ tier, content_type, platform, unit_cost: unit, slot_count: count });
      remaining -= count * unit;
    }
  }
  if (remaining > 0 && lines.length > 0) {
    lines[lines.length - 1].slot_count += 1;
  }
  return lines;
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
{
  // 10,000,000원 목표 원가 → mega 3명(9,000,000) + mid 1명(700,000) + micro 1명(300,000)
  const suggested = suggestQuoteLines(10_000_000);
  const byTier = Object.fromEntries(suggested.map((l) => [l.tier, l.slot_count]));
  if (byTier.mega !== 3 || byTier.mid !== 1 || byTier.micro !== 1) {
    throw new Error(`suggestQuoteLines failed: ${JSON.stringify(suggested)}`);
  }
  if (quoteCost(suggested) !== 10_000_000) {
    throw new Error("suggestQuoteLines cost mismatch");
  }
}
{
  const cases: [string, Tier | typeof UNCLASSIFIED_TIER][] = [
    ["메가 인플루언서 1회 방문", "mega"],
    ["마이크로 콘텐츠 3건", "micro"],
    ["미들 등급 캐러셀", "mid"],
    ["나노 인플루언서 시딩", "nano"],
    ["매크로 등급 발행", "macro"],
    ["그냥 광고 진행비", UNCLASSIFIED_TIER],
  ];
  for (const [text, expected] of cases) {
    if (classifyTierFromText(text) !== expected) {
      throw new Error(`classifyTierFromText failed for "${text}"`);
    }
  }
}
{
  const cases: [number | null, Tier | typeof UNCLASSIFIED_TIER][] = [
    [null, UNCLASSIFIED_TIER],
    [0, "nano"],
    [9_999, "nano"],
    [10_000, "micro"],
    [99_999, "micro"],
    [100_000, "mid"],
    [499_999, "mid"],
    [500_000, "macro"],
    [999_999, "macro"],
    [1_000_000, "mega"],
    [5_000_000, "mega"],
  ];
  for (const [followers, expected] of cases) {
    if (classifyTierByFollowers(followers) !== expected) {
      throw new Error(`classifyTierByFollowers failed for ${followers}`);
    }
  }
}
