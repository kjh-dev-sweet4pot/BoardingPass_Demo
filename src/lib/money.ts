/**
 * 금액 파싱.
 * - 미입력 → null
 * - 형식 오류 → NaN
 * - 정상 → 정수 원
 */
export function parseMoney(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v < 0) return Number.NaN;
    return Math.round(v);
  }
  const s = String(v)
    .trim()
    .replace(/,/g, "")
    .replace(/원/g, "")
    .replace(/\s+/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return Number.NaN;
  return Math.round(n);
}

export function isMoneyOk(v: number | null): v is number {
  return v != null && !Number.isNaN(v);
}
