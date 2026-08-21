"use client";

import { useState } from "react";
import {
  CREATOR_LINK_STATUS_LABEL,
  CREATOR_PLATFORM_LABEL,
  type CreatorPlatform,
} from "@/lib/creator-link";
import { type CreatorLink } from "@/lib/types";

type ReviewRow = CreatorLink & {
  content_status?: string | null;
  submitted_file_path?: string | null;
  publish_url?: string | null;
  allocations?: {
    visit_date?: string | null;
    rollup_status?: string | null;
    products?: { name?: string | null } | null;
    stores?: { name?: string | null } | null;
    influencers?: {
      name?: string | null;
      instagram_handle?: string | null;
    } | null;
    companies?: { name?: string | null } | null;
  } | null;
};

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n >= 10000
    ? `${(n / 10000).toFixed(1)}만`
    : n.toLocaleString();
}

function MetricsBadge({ link, onRefresh }: { link: ReviewRow; onRefresh: (id: string) => void }) {
  const [refreshing, setRefreshing] = useState(false);

  if (link.platform !== "tiktok" && link.platform !== "instagram") return null;

  async function handleRefresh() {
    setRefreshing(true);
    await onRefresh(link.id);
    setRefreshing(false);
  }

  const hasMetrics =
    link.views != null ||
    link.likes != null ||
    link.comments != null ||
    link.saves != null ||
    link.shares != null ||
    link.reposts != null;
  const collectedAt = link.metrics_collected_at
    ? new Date(link.metrics_collected_at).toLocaleString("ko-KR", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-[var(--surface)] px-3 py-2">
      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--ink)]">
        <span title="조회수">👁 {fmt(link.views)}</span>
        <span title="좋아요">♥ {fmt(link.likes)}</span>
        <span title="댓글">💬 {fmt(link.comments)}</span>
        {link.saves != null ? <span title="저장">저장 {fmt(link.saves)}</span> : null}
        {link.shares != null ? <span title="공유">공유 {fmt(link.shares)}</span> : null}
        {link.reposts != null ? (
          <span title="리포스트">리포스트 {fmt(link.reposts)}</span>
        ) : null}
        {collectedAt && !hasMetrics && (
          <span className="text-[var(--muted)]">미수집</span>
        )}
        {collectedAt && hasMetrics && (
          <span className="text-[var(--muted)]">{collectedAt} 기준</span>
        )}
      </div>
      <button
        type="button"
        disabled={refreshing}
        onClick={() => void handleRefresh()}
        className="shrink-0 rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
      >
        {refreshing ? "조회 중…" : "↻ 새로고침"}
      </button>
    </div>
  );
}

export function AdminLinkReview() {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ReviewRow[]>([]);
  const [memoById, setMemoById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"submitted" | "approved">("submitted");

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && links.length === 0) void load();
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/links", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "불러오기 실패");
      setLinks(body.links || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }
  async function review(id: string, status: "approved" | "rejected") {
    const memo = memoById[id] || "";
    const res = await fetch(`/api/admin/links/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, memo }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "처리 실패");
      return;
    }
    // submitted → approved 이동이므로 목록 재로드
    void load();
  }

  async function refreshMetrics(id: string) {
    const res = await fetch(`/api/admin/links/${id}/refresh-metrics`, {
      method: "POST",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "지표 조회 실패");
      return;
    }
    const m = body.metrics as {
      views?: number;
      likes?: number;
      comments?: number;
      saves?: number | null;
      shares?: number | null;
      reposts?: number | null;
      collected_at?: string;
      metrics_collected_at?: string;
    };
    setLinks((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              views: m.views ?? l.views,
              likes: m.likes ?? l.likes,
              comments: m.comments ?? l.comments,
              saves: m.saves ?? l.saves,
              shares: m.shares ?? l.shares,
              reposts: m.reposts ?? l.reposts,
              metrics_collected_at:
                m.collected_at ?? m.metrics_collected_at ?? l.metrics_collected_at,
            }
          : l,
      ),
    );
  }

  async function openFile(id: string) {
    const res = await fetch(`/api/admin/links/${id}/file`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "파일 열기 실패");
      return;
    }
    if (body.url) window.open(body.url, "_blank", "noopener,noreferrer");
  }

  const submitted = links.filter(
    (l) => l.content_status === "제출" || l.status === "submitted",
  );
  const approved = links.filter(
    (l) => l.content_status === "승인" || l.status === "approved",
  );
  const visible = tab === "submitted" ? submitted : approved;

  return (
    <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      <button
        type="button"
        onClick={() => toggleOpen()}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <h2
          className="text-lg text-[var(--ink)]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          링크·콘텐츠 검수
          {submitted.length > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[11px] font-bold text-white">
              {submitted.length}
            </span>
          )}
        </h2>
        <span className="text-xs font-medium text-[var(--muted)]">
          {open ? "접기 ▲" : "펼치기 ▼"}
        </span>
      </button>

      {open ? (
        <div className="border-t border-[var(--line)] px-5 pb-5 pt-4">
          {/* 탭 */}
          <div className="mb-3 flex gap-1 rounded-xl bg-[var(--line)] p-1">
            {(["submitted", "approved"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                  tab === t
                    ? "bg-white text-[var(--accent)] shadow-sm"
                    : "text-[var(--muted)]"
                }`}
              >
                {t === "submitted" ? `검수 대기 (${submitted.length})` : `승인됨 (${approved.length})`}
              </button>
            ))}
          </div>

          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-[var(--muted)]">TikTok/Instagram 링크는 ↻ 새로고침으로 지표를 업데이트할 수 있습니다.</p>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
            >
              {loading ? "로딩 중…" : "전체 새로고침"}
            </button>
          </div>

          {error ? <p className="mb-2 text-sm text-[var(--danger)]">{error}</p> : null}

          {visible.length === 0 && !loading ? (
            <p className="text-sm text-[var(--muted)]">
              {tab === "submitted" ? "검수 대기 링크가 없습니다." : "승인된 링크가 없습니다."}
            </p>
          ) : (
            <ul className="space-y-3">
              {visible.map((link) => {
                const alloc = link.allocations;
                return (
                  <li
                    key={link.id}
                    className="rounded-xl border border-[var(--line)] px-3 py-3 text-sm"
                  >
                    <p className="font-semibold">
                      {alloc?.influencers?.name || "인플루언서"} ·{" "}
                      {alloc?.products?.name || "상품"}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {alloc?.companies?.name || "회원사 미지정"} ·{" "}
                      {alloc?.stores?.name || "매장"} · {alloc?.visit_date || "미정"}
                      {link.content_status ? ` · ${link.content_status}` : ""}
                      {alloc?.rollup_status ? ` · 배정 ${alloc.rollup_status}` : ""}
                    </p>
                    {link.submitted_file_path ? (
                      <button
                        type="button"
                        onClick={() => void openFile(link.id)}
                        className="mt-2 text-sm font-semibold text-[var(--accent)] underline"
                      >
                        제출 파일 보기
                      </button>
                    ) : null}
                    {link.publish_url || (link.url && !link.url.startsWith("content://")) ? (
                      <a
                        href={link.publish_url || link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block break-all text-[var(--accent)] underline"
                      >
                        {link.publish_url || link.url}
                      </a>
                    ) : null}
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {CREATOR_PLATFORM_LABEL[link.platform as CreatorPlatform] ||
                        link.platform}{" "}
                      · {CREATOR_LINK_STATUS_LABEL[link.status]}
                    </p>

                    <MetricsBadge link={link} onRefresh={refreshMetrics} />

                    {tab === "submitted" ? (
                      <>
                        <input
                          className="mt-2 h-9 w-full rounded-lg border border-[var(--line)] px-2 text-xs"
                          placeholder="반려 사유"
                          value={memoById[link.id] || ""}
                          onChange={(e) =>
                            setMemoById((prev) => ({
                              ...prev,
                              [link.id]: e.target.value,
                            }))
                          }
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white"
                            onClick={() => void review(link.id, "approved")}
                          >
                            승인
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs"
                            onClick={() => void review(link.id, "rejected")}
                          >
                            반려
                          </button>
                        </div>
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
