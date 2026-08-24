"use client";

import { useCallback, useEffect, useState } from "react";
import { primaryBtnClass, secondaryBtnClass } from "@/components/ui";
import { parseTikTokVideoId } from "@/lib/tiktok-oembed";

type Guideline = { id: string; title: string | null; body: string | null; file_path: string | null };
type Feedback = { id: string; body: string; created_at: string };

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
}: {
  linkId: string;
  path: string | null;
  snsUrl: string | null;
  thumbUrl: string | null;
}) {
  const [started, setStarted] = useState(false);
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
  }, [started, linkId, path]);

  const shellClass =
    "flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl border border-[var(--line)] bg-black";

  if (!canPreview) {
    return (
      <p className={`${shellClass} bg-[var(--surface-hover)] px-4 text-center text-sm text-[var(--muted)]`}>
        제출 파일·URL이 없습니다.
      </p>
    );
  }

  if (!started) {
    return (
      <div className={`${shellClass} bg-[var(--surface-hover)] px-4`}>
        <button
          type="button"
          className={primaryBtnClass}
          onClick={() => setStarted(true)}
        >
          미리보기 재생
        </button>
      </div>
    );
  }

  if (path) {
    if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;
    if (loading || !src) {
      return (
        <p className={`${shellClass} px-4 text-center text-sm text-[var(--muted)]`}>
          불러오는 중…
        </p>
      );
    }
    if (fileKind(path) === "image") {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="제출 콘텐츠" className={`${shellClass} max-h-[70vh] w-full object-contain`} />
      );
    }
    if (fileKind(path) === "video") {
      return <video src={src} controls className={`${shellClass} max-h-[70vh] w-full`} />;
    }
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
      >
        제출 파일 열기 (단기 URL)
      </a>
    );
  }

  if (embedSrc) {
    return (
      <iframe
        src={embedSrc}
        title="콘텐츠 미리보기"
        className={`${shellClass} aspect-[9/16] max-h-[70vh] w-full border-0`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  if (thumbUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={thumbUrl} alt="SNS 미리보기" className={`${shellClass} max-h-[70vh] w-full object-contain`} />
    );
  }

  if (httpUrl) {
    return (
      <div className={`${shellClass} flex-col gap-3 bg-[var(--surface-hover)] px-4 text-center`}>
        <p className="text-sm text-[var(--muted)]">임베드 미지원 URL입니다.</p>
        <a
          href={httpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm font-semibold text-[var(--accent)] underline"
        >
          원본 열기 ↗
        </a>
      </div>
    );
  }

  return null;
}

const QUEUE_KEYS = [
  "reviewPending",
  "verifyFailed",
  "collectFailed",
  "publishStale",
] as const;

type ReviewQueueKey = (typeof QUEUE_KEYS)[number];

const QUEUE_COPY: Record<
  ReviewQueueKey,
  { title: string; list: string; blurb: string }
> = {
  reviewPending: {
    title: "검수 대기",
    list: "제출 대기",
    blurb:
      "콘텐츠「제출」건. 가이드라인·회원사 의견을 보고 승인/반려합니다. 0건이면 정상입니다.",
  },
  verifyFailed: {
    title: "검증 실패",
    list: "검증 실패",
    blurb:
      "검증실패 플래그가 켜진 콘텐츠입니다. 상태와 함께 표시될 수 있으며 수동 수집으로 재시도할 수 있습니다.",
  },
  collectFailed: {
    title: "수집 연속 실패",
    list: "수집 실패",
    blurb:
      "최근 수집이 3회 연속「실패」인 건입니다. URL·권한을 점검하고 수동 수집하세요. 0건이면 정상입니다.",
  },
  publishStale: {
    title: "발행 미이행",
    list: "발행 미이행",
    blurb:
      "승인 후 발행 URL이 없고 마지막 갱신이 3일을 넘긴 건입니다. 발행 독촉·확인이 필요합니다.",
  },
};

export function AdminReviewQueue({
  queue = "reviewPending",
  onQueueChange,
}: {
  queue?: ReviewQueueKey;
  onQueueChange?: (queue: ReviewQueueKey) => void;
}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [collectMsg, setCollectMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "수집 실패");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

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
        className="flex flex-wrap gap-1 rounded-full border border-[var(--line)] bg-white p-0.5"
        role="tablist"
        aria-label="검수 큐"
      >
        {QUEUE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === queue}
            onClick={() => onQueueChange?.(key)}
            className={`rounded-full px-3.5 py-2 text-xs font-semibold ${
              key === queue
                ? "bg-[var(--accent)] !text-white"
                : "text-[var(--muted)]"
            }`}
          >
            {QUEUE_COPY[key].title}
            {key === queue && !loading ? (
              <span className="ml-1 tabular-nums opacity-80">{items.length}</span>
            ) : null}
          </button>
        ))}
      </div>
      <p className="text-[12.5px] leading-relaxed text-[var(--muted)]">
        {QUEUE_COPY[queue].blurb}
      </p>
    </>
  );

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
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {QUEUE_COPY[queue].title}
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
                <span className="block font-medium">
                  {item.allocations?.influencers?.name || "인플루언서"}
                </span>
                <span className="block text-xs text-[var(--muted)]">
                  {item.allocations?.products?.name || "상품"} · {fmtDt(item.submitted_at)}
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

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--muted)]">인플루언서</dt>
              <dd>
                {alloc?.influencers?.name || "—"}
                {alloc?.influencers?.instagram_handle
                  ? ` @${alloc.influencers.instagram_handle.replace(/^@/, "")}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">캠페인</dt>
              <dd>{campaign?.name || "(이름 없음)"} {campaign?.status ? `· ${campaign.status}` : ""}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">회원사 · 상품</dt>
              <dd>
                {alloc?.companies?.name || "—"} · {alloc?.products?.name || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">제출 일시</dt>
              <dd>{fmtDt(current.submitted_at)}</dd>
            </div>
          </dl>

          {current.verification_failed ? (
            <div className="space-y-2 rounded-xl bg-red-50 px-3 py-2">
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
            <h3 className="text-sm font-semibold">가이드라인</h3>
            {guidelines.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--muted)]">등록된 가이드라인이 없습니다.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {guidelines.map((g) => (
                  <li key={g.id} className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
                    <p className="font-medium">{g.title || "가이드라인"}</p>
                    {g.body ? <p className="mt-1 whitespace-pre-wrap text-[var(--muted)]">{g.body}</p> : null}
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
                  <li key={f.id} className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
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
              className="min-h-[72px] rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
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
