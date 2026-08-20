const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** 캠페인 `결과`·`취소`면 수집 중단 */
export function isCampaignCollectActive(status: string | null | undefined) {
  return status !== "결과" && status !== "취소";
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
}
