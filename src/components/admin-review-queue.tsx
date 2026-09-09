"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { primaryBtnClass, secondaryBtnClass } from "@/components/ui";
import { creatorPlatformLabelOf } from "@/lib/creator-link";
import { parseTikTokVideoId } from "@/lib/tiktok-oembed";

type Guideline = { id: string; title: string | null; body: string | null; file_path: string | null };
type Feedback = { id: string; body: string; created_at: string };

type ReviewLog = {
  id: string;
  creator_link_id: string;
  decision: "승인" | "반려";
  memo: string | null;
  operator_label: string;
  operator_id: string;
  created_at: string;
  creator_links?: {
    allocations?: {
      influencers?: { name?: string | null } | null;
      products?: { name?: string | null } | null;
    } | null;
  } | null;
};

type CollectionLog = {
  id: string;
  creator_link_id: string;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
  creator_links?: {
    id?: string;
    platform?: string | null;
    url?: string | null;
    publish_url?: string | null;
    allocations?: {
      companies?: { id?: string; name?: string | null } | null;
      influencers?: { name?: string | null; instagram_handle?: string | null } | null;
      products?: { name?: string | null } | null;
    } | null;
  } | null;
};

type QueueItem = {
  id: string;
  url?: string | null;
  platform?: string | null;
  content_status?: string | null;
  submitted_at: string | null;
  submitted_file_path: string | null;
  thumbnail_source_url?: string | null;
  verification_failed?: boolean;
  allocations?: {
    visit_date?: string | null;
    rollup_status?: string | null;
    products?: { name?: string | null } | null;
    stores?: { name?: string | null } | null;
    influencers?: { name?: string | null; instagram_handle?: string | null } | null;
    companies?: { name?: string | null } | null;
    campaigns?: {
      id: string;
      name: string | null;
      status: string;
      guidelines?: Guideline[] | Guideline | null;
    } | null;
  } | null;
  content_feedback?: Feedback[] | null;
};

function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function fmtDt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function decisionClass(decision: ReviewLog["decision"]) {
  return decision === "승인" ? "font-semibold text-green-700" : "font-semibold text-red-700";
}

function collectStatusClass(status: string) {
  if (status === "성공") return "font-semibold text-[var(--badge-ok-fg)]";
  if (status === "실패") return "font-semibold text-red-600";
  if (status === "실행중") return "font-semibold text-amber-700";
  return "font-semibold text-[var(--muted)]";
}

function httpReviewUrl(url: string | null | undefined) {
  const u = url?.trim();
  if (!u || !/^https?:\/\//i.test(u) || u.startsWith("content://")) return null;
  return u;
}

const LOG_PREVIEW_W = 270;

function fileKind(path: string | null) {
  const p = (path || "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|heic)$/.test(p)) return "image";
  if (/\.(mp4|webm|mov|m4v)$/.test(p)) return "video";
  return "other";
}

function snsEmbedSrc(raw: string | null): string | null {
  const u = raw?.trim();
  if (!u || !/^https?:\/\//i.test(u) || u.startsWith("content://")) return null;
  const ttId = parseTikTokVideoId(u);
  if (ttId) return `https://www.tiktok.com/embed/v2/${ttId}`;
  try {
    const m = new URL(u).pathname.match(/\/(p|reel|reels|tv)\/([^/?#]+)/i);
    if (!m?.[2]) return null;
    const kind = m[1].toLowerCase() === "p" || m[1].toLowerCase() === "tv" ? "p" : "reel";
    return `https://www.instagram.com/${kind}/${m[2]}/embed/`;
  } catch {
    return null;
  }
}

function Preview({
  linkId,
  path,
  snsUrl,
  thumbUrl,
  compact = false,
}: {
  linkId: string;
  path: string | null;
  snsUrl: string | null;
  thumbUrl: string | null;
  compact?: boolean;
}) {
  const [started, setStarted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const embedSrc = snsEmbedSrc(snsUrl);
  const rawHttp =
    snsUrl?.trim() && /^https?:\/\//i.test(snsUrl.trim()) && !snsUrl.startsWith("content://")
      ? snsUrl.trim()
      : null;
  const httpUrl = rawHttp && !embedSrc ? rawHttp : null;
  const canPreview = Boolean(path || embedSrc || httpUrl || thumbUrl);

  useEffect(() => {
    if (!started || !path) return;
    let cancelled = false;
    setLoading(true);
    setSrc(null);
    setError(null);
    fetch(`/api/admin/links/${linkId}/file`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "미리보기 URL 생성 실패");
        if (!cancelled) setSrc(json.url);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "미리보기 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [started, linkId, path, attempt]);

  function reloadPreview() {
    setError(null);
    setSrc(null);
    setAttempt((a) => a + 1);
    setStarted(true);
  }

  const frameClass = compact
    ? "aspect-[9/16] w-full overflow-hidden rounded-[6px] border border-[var(--line)]"
    : "aspect-[9/16] w-full max-h-[70vh] overflow-hidden rounded-[6px] border border-[var(--line)]";
  const embedClass = compact
    ? frameClass
    : "aspect-[9/16] w-full max-h-[70vh] overflow-hidden rounded-[6px] border border-[var(--line)] bg-black";

  function previewShell(className: string, body: ReactNode) {
    return <div className={`${frameClass} ${className}`}>{body}</div>;
  }

  function withRetry(body: ReactNode, hint?: string) {
    return (
      <div>
        {body}
        {hint ? <p className="mt-1 text-[11px] text-[var(--muted)]">{hint}</p> : null}
        <button
          type="button"
          className="mt-1 text-xs text-[var(--accent)] underline"
          onClick={reloadPreview}
        >
          다시 불러오기
        </button>
      </div>
    );
  }

  if (!canPreview) {
    return previewShell(
      "flex items-center justify-center bg-[var(--surface-hover)] px-4 text-center text-sm text-[var(--muted)]",
      "제출 파일·URL이 없습니다.",
    );
  }

  if (!started) {
    return previewShell(
      "flex items-center justify-center bg-[var(--surface-hover)] px-4",
      <button type="button" className={primaryBtnClass} onClick={() => setStarted(true)}>
        미리보기 재생
      </button>,
    );
  }

  if (path) {
    if (error) {
      return previewShell(
        "flex flex-col items-center justify-center gap-2 bg-[var(--surface-hover)] px-3 py-4 text-center",
        <>
          <p className="text-xs text-[var(--danger)]">
            미리보기를 불러오지 못했습니다.
            <br />
            잠시 후 다시 시도해 주세요.
          </p>
          <button
            type="button"
            className="text-xs text-[var(--accent)] underline"
            onClick={reloadPreview}
          >
            다시 불러오기
          </button>
        </>,
      );
    }
    if (loading || !src) {
      return previewShell(
        "flex items-center justify-center bg-[var(--surface-hover)] px-4 text-center text-sm text-[var(--muted)]",
        "불러오는 중…",
      );
    }
    if (fileKind(path) === "image") {
      return withRetry(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="제출 콘텐츠"
          className={`${frameClass} bg-black object-contain`}
          onError={() => setError("미리보기를 불러오지 못했습니다.")}
        />,
      );
    }
    if (fileKind(path) === "video") {
      return withRetry(
        <video
          key={attempt}
          src={src}
          controls
          className={`${frameClass} bg-black object-contain`}
          onError={() => setError("미리보기를 불러오지 못했습니다.")}
        />,
      );
    }
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-[6px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
      >
        제출 파일 열기 (단기 URL)
      </a>
    );
  }

  if (embedSrc) {
    return withRetry(
      <iframe
        key={attempt}
        src={embedSrc}
        title="콘텐츠 미리보기"
        className={`${embedClass} w-full border-0 bg-black`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />,
      "임베드 오류 시 다시 불러오기를 눌러 주세요.",
    );
  }

  if (thumbUrl) {
    return withRetry(
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbUrl}
        alt="SNS 미리보기"
        className={`${frameClass} bg-black object-contain`}
        onError={() => setError("미리보기를 불러오지 못했습니다.")}
      />,
    );
  }

  if (httpUrl) {
    return previewShell(
      "flex flex-col items-center justify-center gap-3 bg-[var(--surface-hover)] px-4 text-center",
      <>
        <p className="text-sm text-[var(--muted)]">임베드 미지원 URL입니다.</p>
        <a
          href={httpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm font-semibold text-[var(--accent)] underline"
        >
          원본 열기 ↗
        </a>
      </>,
    );
  }

  return null;
}

function GuidelinePdfEmbed({ guideline }: { guideline: Guideline }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!guideline.file_path) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setUrl(null);
    fetch(`/api/admin/guidelines/${guideline.id}/file`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "가이드라인 파일을 열 수 없습니다.");
        if (!cancelled) setUrl(json.url as string);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "불러오기 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [guideline.id, guideline.file_path]);

  if (!guideline.file_path) {
    return guideline.body ? (
      <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">{guideline.body}</p>
    ) : null;
  }

  if (loading) {
    return <p className="mt-2 text-xs text-[var(--muted)]">PDF 불러오는 중…</p>;
  }
  if (error) {
    return <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>;
  }
  if (!url) return null;

  return (
    <div className="mt-2 overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--surface-hover)]">
      <iframe
        title={guideline.title || "가이드라인 PDF"}
        src={url}
        className="h-[420px] w-full border-0 bg-white"
      />
      <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-3 py-2">
        <p className="truncate text-xs text-[var(--muted)]">
          {guideline.title || "컨텐츠 가이드라인"}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-semibold text-[var(--accent)] underline"
        >
          새 탭에서 열기 ↗
        </a>
      </div>
    </div>
  );
}

function ReviewLogLinkDetail({
  item,
  loading,
  error,
}: {
  item: QueueItem | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return <p className="mt-2 px-1 text-xs text-[var(--muted)]">콘텐츠 불러오는 중…</p>;
  }
  if (error) {
    return <p className="mt-2 px-1 text-xs text-[var(--danger)]">{error}</p>;
  }
  if (!item) return null;
  const alloc = item.allocations;
  const campaignRaw = alloc?.campaigns;
  const campaign = Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw;
  const httpUrl = httpReviewUrl(item.url);
  const hasPreview = Boolean(item.submitted_file_path || httpUrl || item.thumbnail_source_url);
  return (
    <div className="mt-2 flex gap-3 rounded-[6px] border border-[var(--line)] bg-[var(--surface-hover)] p-3 text-xs">
      {hasPreview ? (
        <div className="shrink-0" style={{ width: LOG_PREVIEW_W, maxWidth: "45%" }}>
          <Preview
            key={item.id}
            linkId={item.id}
            path={item.submitted_file_path}
            snsUrl={item.url ?? null}
            thumbUrl={item.thumbnail_source_url ?? null}
            compact
          />
        </div>
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        <p>
          {alloc?.influencers?.name || "—"} · {campaign?.name || "캠페인"}
        </p>
        <p className="text-[var(--muted)]">
          {alloc?.companies?.name || "—"} · {alloc?.products?.name || "—"}
        </p>
        <p className="text-[var(--muted)]">
          {item.content_status || "—"} · 제출 {fmtDt(item.submitted_at)}
        </p>
        {httpUrl ? (
          <a
            href={httpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-[var(--accent)] underline"
          >
            제출 URL ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}

function ReviewLogList({
  logs,
  loading,
  emptyLabel,
  selectedLogId,
  onSelect,
  logDetail,
  logDetailLoading,
  detailError,
}: {
  logs: ReviewLog[];
  loading: boolean;
  emptyLabel: string;
  selectedLogId?: string | null;
  onSelect?: (log: ReviewLog) => void;
  logDetail?: QueueItem | null;
  logDetailLoading?: boolean;
  detailError?: string | null;
}) {
  if (loading) {
    return <p className="text-sm text-[var(--muted)]">검수 기록 불러오는 중…</p>;
  }
  if (logs.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>;
  }
  return (
    <ul className="max-h-[70vh] space-y-2 overflow-auto">
      {logs.map((log) => {
        const alloc = log.creator_links?.allocations;
        const ctx = alloc
          ? `${alloc.influencers?.name || "인플루언서"} · ${alloc.products?.name || "상품"} · `
          : "";
        const selected = selectedLogId === log.id;
        return (
          <li key={log.id}>
            <button
              type="button"
              onClick={() => onSelect?.(log)}
              className={`w-full rounded-[6px] border px-3 py-2 text-left text-sm ${
                selected
                  ? "border-[var(--accent)] bg-[var(--surface-hover)]"
                  : "border-[var(--line)]"
              }`}
            >
              <p className="text-[var(--ink)]">
                {ctx}
                <span className={decisionClass(log.decision)}>{log.decision}</span>
                {" · "}
                {log.operator_label} ({log.operator_id})
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{fmtDt(log.created_at)}</p>
              {log.memo ? (
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-[var(--muted)]">
                  {log.memo}
                </p>
              ) : null}
            </button>
            {selected ? (
              <ReviewLogLinkDetail
                item={logDetail ?? null}
                loading={Boolean(logDetailLoading)}
                error={detailError ?? null}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function CollectionLogList({
  logs,
  loading,
  emptyLabel,
  busyId,
  onRecollect,
}: {
  logs: CollectionLog[];
  loading: boolean;
  emptyLabel: string;
  busyId?: string | null;
  onRecollect?: (linkId: string) => void;
}) {
  if (loading) {
    return <p className="text-sm text-[var(--muted)]">수집 로그 불러오는 중…</p>;
  }
  if (logs.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>;
  }
  return (
    <ul className="max-h-[70vh] space-y-2 overflow-auto">
      {logs.map((log) => {
        const allocRaw = log.creator_links?.allocations;
        const alloc = Array.isArray(allocRaw) ? allocRaw[0] : allocRaw;
        const company = alloc?.companies?.name || "회원사 미상";
        const influencer = alloc?.influencers?.name || "인플루언서";
        const product = alloc?.products?.name || "상품";
        const when = fmtDt(log.finished_at || log.started_at || log.created_at);
        const sns = log.creator_links?.publish_url || log.creator_links?.url;
        const canRecollect = log.status === "실패" && onRecollect;
        return (
          <li
            key={log.id}
            className="rounded-[6px] border border-[var(--line)] px-3 py-2.5 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[var(--ink)]">
                  <span className="font-semibold">{company}</span>
                  {" · "}
                  {influencer}
                  {" · "}
                  {product}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {when}
                  {log.creator_links
                    ? ` · ${creatorPlatformLabelOf(
                        log.creator_links.publish_url || log.creator_links.url,
                        log.creator_links.platform,
                      )}`
                    : ""}
                </p>
                {log.error_message ? (
                  <p className="mt-1 line-clamp-2 text-xs text-red-600">{log.error_message}</p>
                ) : null}
                {sns && /^https?:\/\//i.test(sns) ? (
                  <a
                    href={sns}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-[var(--accent)] underline"
                  >
                    콘텐츠 URL ↗
                  </a>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className={collectStatusClass(log.status)}>{log.status}</span>
                {canRecollect ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
                    disabled={busyId === log.creator_link_id}
                    onClick={() => onRecollect(log.creator_link_id)}
                  >
                    {busyId === log.creator_link_id ? "수집 중…" : "수동 수집"}
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const REVIEW_TABS = [
  "reviewPending",
  "reviewLogs",
  "publishStale",
  "collectResults",
] as const;

type ReviewQueueKey = "reviewPending" | "publishStale" | "collectResults";

export type AdminReviewTab = ReviewQueueKey | "reviewLogs";

const REVIEW_LOGS_BLURB =
  "승인·반려 처리 이력입니다. 기록을 클릭하면 콘텐츠 요약을 볼 수 있습니다.";

const TAB_TITLE: Record<AdminReviewTab, string> = {
  reviewPending: "검수 대기",
  reviewLogs: "검수 기록",
  publishStale: "발행 미이행",
  collectResults: "성과자료 수집 결과",
};

const QUEUE_COPY: Record<
  ReviewQueueKey,
  { list: string; blurb: string }
> = {
  reviewPending: {
    list: "제출 대기",
    blurb:
      "콘텐츠「제출」건. 가이드라인·회원사 의견을 보고 승인/반려합니다. 0건이면 정상입니다.",
  },
  publishStale: {
    list: "발행 미이행",
    blurb:
      "승인 후 발행 URL이 없고 마지막 갱신이 3일을 넘긴 건입니다. 발행 독촉·확인이 필요합니다.",
  },
  collectResults: {
    list: "수집 결과",
    blurb:
      "Apify 성과 수집 이력입니다. 수집 시각·회원사·상태를 확인할 수 있습니다. 검증실패·연속 실패 건은 아래에서 수동 수집할 수 있습니다.",
  },
};

export function AdminReviewQueue({
  queue = "reviewPending",
  onQueueChange,
}: {
  queue?: AdminReviewTab;
  onQueueChange?: (queue: AdminReviewTab) => void;
}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [collectMsg, setCollectMsg] = useState<string | null>(null);
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [collectionLogs, setCollectionLogs] = useState<CollectionLog[]>([]);
  const [collectionLogsLoading, setCollectionLogsLoading] = useState(false);
  const [recollectBusyId, setRecollectBusyId] = useState<string | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [logDetail, setLogDetail] = useState<QueueItem | null>(null);
  const [logDetailLoading, setLogDetailLoading] = useState(false);
  const [logDetailError, setLogDetailError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/admin/review-logs?limit=30", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "검수 기록 조회 실패");
      setLogs(json.logs ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const loadCollectionLogs = useCallback(async () => {
    setCollectionLogsLoading(true);
    try {
      const res = await fetch("/api/admin/collection-logs?limit=100", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "수집 로그 조회 실패");
      setCollectionLogs(json.logs ?? []);
    } catch {
      setCollectionLogs([]);
    } finally {
      setCollectionLogsLoading(false);
    }
  }, []);

  const openLogDetail = useCallback(async (log: ReviewLog) => {
    if (selectedLogId === log.id) {
      setSelectedLogId(null);
      setLogDetail(null);
      setLogDetailError(null);
      return;
    }
    setSelectedLogId(log.id);
    setLogDetail(null);
    setLogDetailError(null);
    setLogDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/links/${log.creator_link_id}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "콘텐츠 조회 실패");
      setLogDetail(json.link ?? null);
    } catch (e) {
      setLogDetailError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLogDetailLoading(false);
    }
  }, [selectedLogId]);

  const load = useCallback(async () => {
    if (queue === "reviewLogs") return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/review-queue?queue=${queue}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "검수 큐 조회 실패");
      setItems(json.items ?? []);
      setIndex(0);
      setMemo("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }, [queue]);

  async function manualCollect(linkId: string) {
    setBusy(true);
    setRecollectBusyId(linkId);
    setError(null);
    setCollectMsg(null);
    try {
      const res = await fetch(`/api/admin/links/${linkId}/refresh-metrics`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "수집 실패");
      setItems((prev) =>
        prev.map((item) =>
          item.id === linkId ? { ...item, verification_failed: false } : item,
        ),
      );
      const m = json.metrics as {
        views?: number;
        likes?: number;
        comments?: number;
        collected_at?: string;
      };
      const when = m.collected_at ? fmtDt(m.collected_at) : "—";
      setCollectMsg(`수집 완료 (${when})`);
      if (queue === "collectResults") void loadCollectionLogs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "수집 실패");
    } finally {
      setBusy(false);
      setRecollectBusyId(null);
    }
  }

  useEffect(() => {
    if (queue === "reviewLogs") {
      setSelectedLogId(null);
      setLogDetail(null);
      setLogDetailError(null);
      void loadLogs();
    } else if (queue === "collectResults") {
      void load();
      void loadCollectionLogs();
    } else {
      void load();
    }
  }, [queue, load, loadLogs, loadCollectionLogs]);

  const current = items[index] ?? null;
  const alloc = current?.allocations;
  const campaignRaw = alloc?.campaigns;
  const campaign = Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw;
  const guidelines = asArray(campaign?.guidelines);
  const feedback = asArray(current?.content_feedback);

  async function decide(status: "approved" | "rejected") {
    if (!current) return;
    if (status === "rejected" && !memo.trim()) {
      setError("반려 사유를 입력하세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/links/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, memo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "처리 실패");
      const next = items.filter((item) => item.id !== current.id);
      setItems(next);
      setIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
      setMemo("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setBusy(false);
    }
  }

  const tabs = (
    <>
      <div
        className="flex flex-wrap gap-1 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-0.5"
        role="tablist"
        aria-label="검수 큐"
      >
        {REVIEW_TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === queue}
            onClick={() => onQueueChange?.(key)}
            className={`rounded-[6px] px-3.5 py-2 text-xs font-semibold ${
              key === queue
                ? "bg-[var(--accent)] !text-white"
                : "text-[var(--muted)]"
            }`}
          >
            {TAB_TITLE[key]}
            {key === queue &&
            (key === "reviewLogs"
              ? !logsLoading
              : key === "collectResults"
                ? !collectionLogsLoading
                : !loading) ? (
              <span className="ml-1 tabular-nums opacity-80">
                {key === "reviewLogs"
                  ? logs.length
                  : key === "collectResults"
                    ? collectionLogs.length
                    : items.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <p className="text-[12.5px] leading-relaxed text-[var(--muted)]">
        {queue === "reviewLogs" ? REVIEW_LOGS_BLURB : QUEUE_COPY[queue].blurb}
      </p>
    </>
  );

  if (queue === "reviewLogs") {
    return (
      <div className="flex flex-col gap-4">
        {tabs}
        <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--ink)]">최근 검수 기록</h2>
            <button
              type="button"
              className="text-xs text-[var(--accent)]"
              onClick={() => void loadLogs()}
            >
              새로고침
            </button>
          </div>
          <ReviewLogList
            logs={logs}
            loading={logsLoading}
            emptyLabel="검수 기록이 없습니다."
            selectedLogId={selectedLogId}
            onSelect={(log) => void openLogDetail(log)}
            logDetail={logDetail}
            logDetailLoading={logDetailLoading}
            detailError={logDetailError}
          />
        </section>
      </div>
    );
  }

  if (queue === "collectResults") {
    return (
      <div className="flex flex-col gap-4">
        {tabs}
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {collectMsg ? <p className="text-sm text-[var(--accent)]">{collectMsg}</p> : null}

        <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--ink)]">
              Apify 수집 로그 {collectionLogsLoading ? "" : `${collectionLogs.length}건`}
            </h2>
            <button
              type="button"
              className="text-xs text-[var(--accent)]"
              onClick={() => {
                void loadCollectionLogs();
                void load();
              }}
            >
              새로고침
            </button>
          </div>
          <CollectionLogList
            logs={collectionLogs}
            loading={collectionLogsLoading}
            emptyLabel="수집 로그가 없습니다. 스케줄·수동 수집이 실행되면 여기에 기록됩니다."
            busyId={recollectBusyId}
            onRecollect={(linkId) => void manualCollect(linkId)}
          />
        </section>

        {!loading && items.length > 0 ? (
          <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--ink)]">
                처리 필요 {items.length}건
              </h2>
              <p className="text-xs text-[var(--muted)]">검증실패 · 수집 연속 실패</p>
            </div>
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[var(--line)] px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--ink)]">
                      {item.allocations?.companies?.name || "회원사"} ·{" "}
                      {item.allocations?.influencers?.name || "인플루언서"}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {item.allocations?.products?.name || "상품"}
                      {item.verification_failed ? " · 검증실패" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
                    disabled={recollectBusyId === item.id}
                    onClick={() => void manualCollect(item.id)}
                  >
                    {recollectBusyId === item.id ? "수집 중…" : "수동 수집"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {tabs}
        <p className="text-sm text-[var(--muted)]">검수 큐를 불러오는 중…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {tabs}
        <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm">
          <h2
            className="text-lg text-[var(--ink)]"
          >
            {TAB_TITLE[queue]}
          </h2>
          <p className="mt-4 text-sm text-[var(--muted)]">처리 대기 없음</p>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {tabs}
    <div className="grid min-h-0 gap-4 lg:grid-cols-[220px_minmax(280px,400px)_minmax(0,1fr)]">
      <aside className="owm-panel border border-[var(--line)] bg-[var(--surface)] shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-sm font-semibold">
            {QUEUE_COPY[queue].list} {items.length}건
          </h2>
          <button type="button" className="text-xs text-[var(--accent)]" onClick={() => void load()}>
            새로고침
          </button>
        </div>
        <ul className="max-h-[70vh] overflow-auto">
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  setIndex(i);
                  setMemo("");
                  setError(null);
                  setCollectMsg(null);
                }}
                className={`w-full border-b border-[var(--line)] px-4 py-3 text-left text-sm ${
                  i === index ? "bg-[var(--surface-hover)]" : ""
                }`}
              >
                <span className="block font-semibold text-[var(--ink)]">
                  {item.allocations?.influencers?.name || "인플루언서"}
                </span>
                <span className="mt-0.5 block text-xs font-medium text-[var(--ink)]">
                  {item.allocations?.companies?.name || "회원사"} ·{" "}
                  {item.allocations?.products?.name || "상품"}
                </span>
                <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
                  {fmtDt(item.submitted_at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {current ? (
        <>
          <div className="owm-panel sticky top-4 self-start border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm">
            <Preview
              key={current.id}
              linkId={current.id}
              path={current.submitted_file_path}
              snsUrl={current.url ?? null}
              thumbUrl={current.thumbnail_source_url ?? null}
            />
          </div>

          <section className="owm-panel flex min-w-0 flex-col gap-4 border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              검수 대상
            </p>
            <h2 className="mt-1 text-[26px] font-bold leading-tight tracking-[-0.03em] text-[var(--ink)]">
              {alloc?.influencers?.name || "인플루언서"}
            </h2>
            {alloc?.influencers?.instagram_handle ? (
              <p className="mt-1 text-[13px] text-[var(--muted)]">
                @{alloc.influencers.instagram_handle.replace(/^@/, "")}
              </p>
            ) : null}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-[6px] border border-[var(--line)] bg-[var(--surface-hover)] px-3 py-2.5">
                <p className="text-[11px] font-semibold text-[var(--muted)]">회원사</p>
                <p className="mt-0.5 text-[16px] font-bold text-[var(--ink)]">
                  {alloc?.companies?.name || "—"}
                </p>
              </div>
              <div className="rounded-[6px] border border-[var(--line)] bg-[var(--surface-hover)] px-3 py-2.5">
                <p className="text-[11px] font-semibold text-[var(--muted)]">상품</p>
                <p className="mt-0.5 text-[16px] font-bold text-[var(--ink)]">
                  {alloc?.products?.name || "—"}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[12px] text-[var(--muted)]">
              {campaign?.name || "캠페인"}
              {campaign?.status ? ` · ${campaign.status}` : ""}
              {" · 제출 "}
              {fmtDt(current.submitted_at)}
            </p>
          </div>

          {current.verification_failed ? (
            <div className="space-y-2 rounded-[6px] bg-red-50 px-3 py-2">
              <p className="text-sm text-red-700">검증실패 플래그 (이전 기록)</p>
              <button
                type="button"
                className={secondaryBtnClass}
                disabled={busy}
                onClick={() => void manualCollect(current.id)}
              >
                {busy ? "수집 중…" : "수동 수집"}
              </button>
              {collectMsg ? (
                <p className="text-xs text-[var(--muted)]">{collectMsg}</p>
              ) : null}
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-semibold">컨텐츠 가이드라인</h3>
            {guidelines.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--muted)]">등록된 가이드라인이 없습니다.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {guidelines.map((g) => (
                  <li key={g.id}>
                    {!g.file_path ? (
                      <div className="rounded-[6px] border border-[var(--line)] px-3 py-2 text-sm">
                        <p className="font-medium">{g.title || "가이드라인"}</p>
                        {g.body ? (
                          <p className="mt-1 whitespace-pre-wrap text-[var(--muted)]">{g.body}</p>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <p className="text-[13px] font-medium text-[var(--ink)]">
                          {g.title || "가이드라인 PDF"}
                        </p>
                        <GuidelinePdfEmbed guideline={g} />
                        {g.body ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">
                            {g.body}
                          </p>
                        ) : null}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold">회원사 의견</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">검수 결정은 운영자가 수행한다</p>
            {feedback.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--muted)]">의견이 없습니다.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {feedback.map((f) => (
                  <li key={f.id} className="rounded-[6px] border border-[var(--line)] px-3 py-2 text-sm">
                    <p className="text-xs text-[var(--muted)]">{fmtDt(f.created_at)}</p>
                    <p className="mt-1 whitespace-pre-wrap">{f.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {current.content_status === "제출" ? (
          <div className="mt-auto grid gap-3 border-t border-[var(--line)] pt-4">
            <textarea
              className="min-h-[72px] rounded-[6px] border border-[var(--line)] px-3 py-2 text-sm"
              placeholder="반려 시 사유 필수"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={primaryBtnClass}
                disabled={busy}
                onClick={() => void decide("approved")}
              >
                승인
              </button>
              <button
                type="button"
                className={secondaryBtnClass}
                disabled={busy}
                onClick={() => void decide("rejected")}
              >
                반려
              </button>
            </div>
          </div>
          ) : null}
          </section>
        </>
      ) : null}
    </div>
    </div>
  );
}
