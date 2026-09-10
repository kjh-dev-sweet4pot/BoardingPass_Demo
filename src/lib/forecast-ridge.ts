/**
 * 옵티팜 샤오홍슈 train CSV (이상치 7명 제외, seed 20260910).
 * StandardScaler(모분산) + Ridge(alpha=10, intercept 미패널티)
 * X = log1p(조회·좋아요·댓글·저장)
 */
const ALPHA = 10;
const MEAN = [
  7.646996106978342, 3.157617777740222, 1.0088371515282817, 2.1438811614736357,
] as const;
const STD = [
  1.031232703761997, 1.0409993522361751, 0.8559021547838442, 1.1362516354080912,
] as const;
const BETA_VIEWS = [
  7.8675914439035095, 0.2973167654012908, 0.29204038764441187,
  0.12469305638758514, 0.07094801319811968,
] as const;
const BETA_LIKES = [
  3.4503931246769053, 0.293994381916509, 0.29017166862208615,
  0.11002515294351992, 0.0661055708828874,
] as const;
const BETA_SAVES = [
  1.9529584852852762, 0.22429441981827308, 0.13824789932661075,
  0.18517950215042736, 0.4653016438631015,
] as const;
const INTERVAL_LO = 0.9;
const INTERVAL_HI = 1.1;

/** train, |예측−실제|/실제 ≤ 10% */
export const RIDGE_ACCURACY_PCT = {
  views: 8,
  likes: 10,
  saves: 11,
} as const;

export type RidgeAvgInput = {
  views: number;
  likes: number;
  comments?: number | null;
  saves?: number | null;
};

export type RidgeInterval = {
  point: number;
  lo: number;
  hi: number;
};

function z(v: number, i: number) {
  return (Math.log(Math.max(v, 0) + 1) - MEAN[i]!) / STD[i]!;
}

function ridgeRaw(avg: RidgeAvgInput, beta: readonly number[], expm1: boolean) {
  const zv = z(avg.views, 0);
  const zl = z(avg.likes, 1);
  const zc = z(avg.comments ?? 0, 2);
  const zs = z(avg.saves ?? 0, 3);
  const logY =
    beta[0]! + beta[1]! * zv + beta[2]! * zl + beta[3]! * zc + beta[4]! * zs;
  const raw = Math.exp(logY);
  return expm1 ? Math.max(0, raw - 1) : raw;
}

function band(pointRaw: number): RidgeInterval {
  const point = Math.max(0, Math.round(pointRaw));
  const lo = Math.max(0, Math.round(pointRaw * INTERVAL_LO));
  const hi = Math.max(lo, Math.round(pointRaw * INTERVAL_HI));
  return { point, lo, hi };
}

export function predictRidgeViews(avg: RidgeAvgInput): number {
  return Math.max(0, Math.round(ridgeRaw(avg, BETA_VIEWS, false)));
}

export function predictRidgeViewsInterval(avg: RidgeAvgInput): RidgeInterval {
  return band(ridgeRaw(avg, BETA_VIEWS, false));
}

export function predictRidgeLikesInterval(avg: RidgeAvgInput): RidgeInterval {
  return band(ridgeRaw(avg, BETA_LIKES, true));
}

export function predictRidgeSavesInterval(avg: RidgeAvgInput): RidgeInterval {
  return band(ridgeRaw(avg, BETA_SAVES, true));
}

if (process.env.NODE_ENV !== "production") {
  const nami = predictRidgeViews({
    views: 95805,
    likes: 1136,
    comments: 10,
    saves: 100,
  });
  if (nami < 20_000 || nami > 50_000) {
    throw new Error(`predictRidgeViews nami-scale ${nami}`);
  }
  const avg = { views: 100, likes: 10, comments: 1, saves: 2 };
  const v = predictRidgeViewsInterval(avg);
  const l = predictRidgeLikesInterval(avg);
  const s = predictRidgeSavesInterval(avg);
  if (v.point !== 788 || v.lo >= v.hi) {
    throw new Error(`views interval ${JSON.stringify(v)}`);
  }
  if (l.point !== 9 || s.point !== 1) {
    throw new Error(`likes/saves ${l.point} ${s.point}`);
  }
  if (ALPHA !== 10) throw new Error("ridge alpha");
}
