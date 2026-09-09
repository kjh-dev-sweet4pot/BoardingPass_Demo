import { detectPlatform } from "@/lib/creator-link";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** 캠페인 `결과`·`취소`면 수집 중단 */
export function isCampaignCollectActive(status: string | null | undefined) {
  return status !== "결과" && status !== "취소";
}

/** Apify 업로드일. unix s/ms · ISO · YYYY-MM-DD */
export function parsePostedAtIso(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    const ms = v > 0 && v < 1e12 ? v * 1000 : v;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    if (/^\d{10,13}$/.test(s)) return parsePostedAtIso(Number(s));
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  return null;
}

export function canCollectPostedAt(
  url: string | null | undefined,
  platform?: string | null,
) {
  const fromUrl = detectPlatform(url || "");
  const p = fromUrl !== "etc" ? fromUrl : platform || "";
  return p === "tiktok" || p === "instagram" || p === "xiaohongshu";
}

/** 발행 시점 앵커 (content_metrics 스케줄 기준) */
export function publishAnchorIso(link: {
  published_at?: string | null;
  content_status?: string | null;
  updated_at?: string | null;
  submitted_at?: string | null;
  metrics_collected_at?: string | null;
}) {
  if (link.published_at) return link.published_at;
  if (link.content_status === "발행완료" && link.updated_at) return link.updated_at;
  if (link.content_status === "발행완료" && link.submitted_at) return link.submitted_at;
  return link.metrics_collected_at || link.submitted_at || null;
}

/** 마지막 수집 이후 다음 주기가 도래했는지 */
export function isCollectionDue(
  publishedAtIso: string,
  lastCollectedAtIso: string | null | undefined,
  now = Date.now(),
) {
  const publishedAt = new Date(publishedAtIso).getTime();
  if (!Number.isFinite(publishedAt) || publishedAt > now) return false;

  const elapsed = now - publishedAt;
  const sinceLast = lastCollectedAtIso
    ? now - new Date(lastCollectedAtIso).getTime()
    : Infinity;

  if (elapsed <= SEVENTY_TWO_HOURS_MS) {
    return sinceLast >= SIX_HOURS_MS;
  }
  return sinceLast >= ONE_DAY_MS;
}

/** 실패 재시도 대기 (ponytail: 고정 1시간, 백오프는 T6+에서) */
export const COLLECT_RETRY_DELAY_MS = 60 * 60 * 1000;

export function nextRetryAt(from = Date.now()) {
  return new Date(from + COLLECT_RETRY_DELAY_MS).toISOString();
}

// ponytail: self-check
if (process.env.NODE_ENV !== "production") {
  const anchor = "2026-08-01T00:00:00.000Z";
  console.assert(
    isCollectionDue(anchor, null, new Date("2026-08-01T06:00:00.000Z").getTime()),
    "metrics-schedule: first collect due after 6h",
  );
  console.assert(
    !isCollectionDue(anchor, "2026-08-01T05:00:00.000Z", new Date("2026-08-01T06:00:00.000Z").getTime()),
    "metrics-schedule: not due before 6h interval",
  );
  if (parsePostedAtIso(1756403075) !== "2025-08-28T17:44:35.000Z") {
    throw new Error("parsePostedAtIso unix seconds");
  }
  if (parsePostedAtIso("2026-08-11")?.slice(0, 10) !== "2026-08-11") {
    throw new Error("parsePostedAtIso ymd");
  }
  if (parsePostedAtIso("nope") != null) {
    throw new Error("parsePostedAtIso invalid");
  }
  if (!canCollectPostedAt("https://www.tiktok.com/@a/video/1")) {
    throw new Error("canCollectPostedAt tiktok");
  }
  if (canCollectPostedAt("https://www.douyin.com/video/1")) {
    throw new Error("canCollectPostedAt douyin");
  }
}
