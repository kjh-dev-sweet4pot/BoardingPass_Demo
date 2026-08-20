"use client";

import { useCallback, useEffect, useState } from "react";
import { primaryBtnClass, secondaryBtnClass } from "@/components/ui";

type Guideline = { id: string; title: string | null; body: string | null; file_path: string | null };
type Feedback = { id: string; body: string; created_at: string };

type QueueItem = {
  id: string;
  url?: string | null;
  platform?: string | null;
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
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isHttpUrl = Boolean(snsUrl && /^https?:\/\//i.test(snsUrl));

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setError(null);
    if (!path) return;
    fetch(`/api/admin/links/${linkId}/file`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "미리보기 URL 생성 실패");
        if (!cancelled) setSrc(json.url);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "미리보기 실패");
      });
    return () => {
      cancelled = true;
    };
  }, [linkId, path]);

  return (
    <div className="space-y-3">
      {path ? (
        error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : !src ? (
          <p className="rounded-2xl border border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--muted)]">
            미리보기 준비 중…
          </p>
        ) : fileKind(path) === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="제출 콘텐츠" className="max-h-[70vh] w-full rounded-2xl object-contain bg-black" />
        ) : fileKind(path) === "video" ? (
          <video src={src} controls className="max-h-[70vh] w-full rounded-2xl bg-black" />
        ) : (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"
          >
            제출 파일 열기 (단기 URL)
          </a>
        )
      ) : thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbUrl} alt="SNS 미리보기" className="max-h-[70vh] w-full rounded-2xl object-contain bg-black" />
      ) : !isHttpUrl ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-hover)] px-4 py-10 text-center text-sm text-[var(--muted)]">
          제출 파일·URL이 없습니다.
        </p>
      ) : null}
      {isHttpUrl ? (
        <a
          href={snsUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="block break-all text-sm font-semibold text-[var(--accent)] underline"
        >
          {snsUrl}
        </a>
      ) : null}
    </div>
  );
}

export function AdminReviewQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/review-queue", { cache: "no-store" });
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
  }, []);

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

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">검수 큐를 불러오는 중…</p>;
  }

  if (items.length === 0) {
    return (
      <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm">
        <h2
          className="text-lg text-[var(--ink)]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          검수 큐
        </h2>
        <p className="mt-4 text-sm text-[var(--muted)]">처리 대기 없음</p>
      </section>
    );
  }

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="owm-panel border border-[var(--line)] bg-[var(--surface)] shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-sm font-semibold">제출 대기 {items.length}건</h2>
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
        <section className="owm-panel flex min-w-0 flex-col gap-4 border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

          <Preview
            linkId={current.id}
            path={current.submitted_file_path}
            snsUrl={current.url ?? null}
            thumbUrl={current.thumbnail_source_url ?? null}
          />

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
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">검증실패</p>
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
        </section>
      ) : null}
    </div>
  );
}
