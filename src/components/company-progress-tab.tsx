"use client";

import { useEffect, useMemo, useState } from "react";
import { CreatorPhoto } from "@/components/creator-photo";
import { EmptyState } from "@/components/empty-state";
import { StateBadge } from "@/components/state-badge";
import { formatMetric } from "@/lib/content-insights";
import {
  buildKanbanFromAllocations,
  KANBAN_COLUMNS,
  productOptionsFromAllocations,
  type ProgressKanbanCard,
  type ProgressLink,
} from "@/lib/com-progress-kanban";
import { findPoolCreator, type CreatorPost, type PoolCreator } from "@/lib/creator-pool-mock";
import type { AllocationWithRelations } from "@/lib/types";

function postsFromLinks(card: ProgressKanbanCard): CreatorPost[] {
  const seen = new Set<string>();
  const out: CreatorPost[] = [];
  for (const link of [...card.publishedLinks, ...card.submittedLinks, ...card.links]) {
    if (!link.url || seen.has(link.url)) continue;
    seen.add(link.url);
    out.push({
      platform: /tiktok/i.test(link.platform) ? "tiktok" : "instagram",
      url: link.url,
    });
  }
  return out;
}

function poolCreatorForCard(card: ProgressKanbanCard): PoolCreator {
  const fromPool = findPoolCreator({
    id: card.influencerId,
    handle: card.handle,
    name: card.name,
  });
  if (fromPool) return fromPool;

  const posts = postsFromLinks(card);
  const channel = posts.some((p) => p.platform === "tiktok") ? "tiktok" : "instagram";

  return {
    id: card.influencerId,
    name: card.name,
    handle: card.handle,
    market: "jp",
    channel,
    profileUrl: null,
    followers: 0,
    priceKrw: 0,
    overlap: null,
    tier: "micro",
    product: null,
    posts,
    uploadYmd: null,
    metrics: { views: 0, likes: 0, comments: 0, saves: 0, shares: 0 },
    category: null,
  };
}

function KanbanCreatorPhoto({
  card,
  size = "avatar",
}: {
  card: ProgressKanbanCard;
  size?: "avatar" | "thumb";
}) {
  const creator = useMemo(
    () => poolCreatorForCard(card),
    [card.id, card.influencerId, card.handle, card.name, card.links.length],
  );
  return <CreatorPhoto creator={creator} size={size} />;
}

function PublishedLinkChip({ link }: { link: ProgressLink }) {
  const label = link.url
    ? `${link.platform} · 콘텐츠 열기 ↗`
    : link.hasFile
      ? "제출 파일"
      : link.status === "승인"
        ? "승인됨"
        : "콘텐츠";
  if (!link.url && !link.hasFile && link.status !== "승인") return null;
  if (!link.url) {
    return (
      <span className="block truncate rounded-lg border border-[#f0e6d8] bg-[#faf4ec] px-2 py-1 text-[10px] font-semibold text-[var(--accent)]">
        {label}
      </span>
    );
  }
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="block truncate rounded-lg border border-[#f0e6d8] bg-[#faf4ec] px-2 py-1 text-[10px] font-semibold text-[var(--accent)] hover:bg-[var(--surface-hover)]"
      title={link.url}
    >
      {link.platform} · 콘텐츠 열기 ↗
    </a>
  );
}

function KanbanCard({
  card,
  onClick,
}: {
  card: ProgressKanbanCard;
  onClick: () => void;
}) {
  const ratio =
    card.targetCount > 0 ? Math.min(1, card.publishedCount / card.targetCount) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-[7px] rounded-[13px] border border-[var(--line)] bg-[var(--surface)] p-[11px_12px] text-left transition hover:bg-[var(--surface-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
    >
      <div className="flex items-center gap-2">
        <KanbanCreatorPhoto card={card} />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[var(--ink)]">{card.name}</p>
          <p className="truncate text-[10px] text-[var(--muted)]">{card.handle}</p>
        </div>
      </div>
      <p className="truncate text-[11px] text-[#5b4130]">{card.productName}</p>
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-semibold text-[var(--ink)]">
          {card.publishedCount} / {card.targetCount} 발행
        </span>
        <span className="text-[10.5px] text-[var(--muted)]">{card.updatedAt}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.max(ratio * 100, 4)}%` }}
        />
      </div>
      {card.status === "발행완료" && card.publishedLinks.length > 0 ? (
        <div className="space-y-1">
          {card.publishedLinks.slice(0, 2).map((link) => (
            <PublishedLinkChip key={link.id} link={link} />
          ))}
        </div>
      ) : card.submittedLinks.length > 0 ? (
        <div className="space-y-1">
          {card.submittedLinks.slice(0, 2).map((link) => (
            <PublishedLinkChip key={link.id} link={link} />
          ))}
        </div>
      ) : null}
    </button>
  );
}

function linkStatusBadge(status: string): "승인" | "제출" | "발행완료" | "반려" {
  if (status === "approved" || status === "승인") return "승인";
  if (status === "발행완료") return "발행완료";
  if (status === "반려") return "반려";
  return "제출";
}

function FeedbackForm({ link }: { link: ProgressLink }) {
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!comment.trim()) return;
    const res = await fetch("/api/com/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creator_link_id: link.id, comment }),
    });
    if (res.ok) {
      setSent(true);
      setComment("");
    }
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="mb-2 flex items-center gap-2">
        {link.url ? (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-[var(--accent)] underline"
          >
            콘텐츠 링크
          </a>
        ) : link.hasFile ? (
          <span className="text-xs text-[var(--muted)]">제출 파일</span>
        ) : (
          <span className="text-xs text-[var(--muted)]">콘텐츠 링크 없음</span>
        )}
        <StateBadge value={linkStatusBadge(link.status)} />
      </div>
      {sent ? (
        <p className="text-xs text-[var(--muted)]">의견이 제출되었습니다.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            className="w-full resize-none rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
            rows={2}
            placeholder="의견을 입력하세요"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!comment.trim()}
              onClick={submit}
              className="h-[34px] rounded-[10px] bg-[var(--accent)] px-3.5 text-xs font-semibold !text-white disabled:opacity-40"
            >
              의견 등록
            </button>
            <p className="text-[11px] text-[var(--danger)]">
              의견은 검수 결정권이 아닙니다. 승인·반려는 운영자가 판단합니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PublishedLinkRow({ link }: { link: ProgressLink }) {
  return (
    <div className="rounded-xl border border-[#f0e6d8] bg-[#faf4ec] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <StateBadge value="발행완료" />
        <span className="text-xs text-[var(--muted)]">{link.platform}</span>
        {link.submitted_at ? (
          <span className="text-[10px] text-[var(--muted)]">
            {link.submitted_at.slice(0, 10)}
          </span>
        ) : null}
      </div>
      {link.url ? (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 truncate text-sm font-medium text-[var(--accent)] underline"
          title={link.url}
        >
          {link.platform} · 콘텐츠 열기 ↗
        </a>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
        {link.views != null ? <span>조회 {formatMetric(link.views)}</span> : null}
        {link.likes != null ? <span>좋아요 {formatMetric(link.likes)}</span> : null}
        {link.comments != null ? <span>댓글 {formatMetric(link.comments)}</span> : null}
      </div>
    </div>
  );
}

function DetailPanel({
  card,
  onClose,
}: {
  card: ProgressKanbanCard;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-none"
        role="dialog"
        aria-modal
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <KanbanCreatorPhoto card={card} size="thumb" />
            <div className="min-w-0">
              <p className="text-xs text-[var(--muted)]">{card.productName}</p>
              <p className="mt-1 text-lg font-semibold text-[var(--ink)]">{card.name}</p>
              <p className="text-sm text-[var(--muted)]">{card.handle}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {card.publishedCount} / {card.targetCount} 발행 ·{" "}
                <StateBadge value={card.status} />
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]"
          >
            닫기
          </button>
        </div>

        {card.publishedLinks.length > 0 ? (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              발행 콘텐츠
            </p>
            {card.publishedLinks.map((link) => (
              <PublishedLinkRow key={link.id} link={link} />
            ))}
          </div>
        ) : null}

        {card.submittedLinks.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              검토 대기 콘텐츠
            </p>
            {card.submittedLinks.map((link) => (
              <FeedbackForm key={link.id} link={link} />
            ))}
          </div>
        ) : card.publishedLinks.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">등록된 콘텐츠가 없습니다.</p>
        ) : null}
      </div>
    </div>
  );
}

export function CompanyProgressTab({
  companyId: _companyId,
  initialAllocations = [],
  live = false,
}: {
  companyId: string;
  initialAllocations?: AllocationWithRelations[];
  live?: boolean;
}) {
  const [productFilter, setProductFilter] = useState("");
  const [selected, setSelected] = useState<ProgressKanbanCard | null>(null);
  const [allocations, setAllocations] = useState(initialAllocations);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setAllocations(initialAllocations);
  }, [initialAllocations]);

  async function reload() {
    if (!live) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/company/allocations");
      const json = await res.json();
      if (Array.isArray(json.allocations)) setAllocations(json.allocations);
    } finally {
      setRefreshing(false);
    }
  }

  const products = useMemo(
    () => productOptionsFromAllocations(allocations),
    [allocations],
  );

  const cards = useMemo(
    () =>
      buildKanbanFromAllocations(allocations, productFilter || undefined, {
        demoMetrics: !live,
      }),
    [allocations, productFilter, live],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ProgressKanbanCard[]>();
    for (const col of KANBAN_COLUMNS) map.set(col, []);
    for (const card of cards) {
      const list = map.get(card.status);
      if (list) list.push(card);
    }
    return map;
  }, [cards]);

  const maxCount = Math.max(...KANBAN_COLUMNS.map((c) => grouped.get(c)?.length ?? 0), 1);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-[26px] py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
            Progress · 배정 보드
          </p>
          <h2
            className="mt-1.5 text-[28px] font-semibold leading-tight text-[var(--ink)]"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            진행 현황
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {live ? (
            <button
              type="button"
              onClick={() => void reload()}
              disabled={refreshing}
              className="h-[34px] rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-3 text-[12.5px] font-semibold text-[var(--ink)] disabled:opacity-50"
            >
              {refreshing ? "조회 중…" : "다시 조회"}
            </button>
          ) : null}
          <span className="text-[11.5px] text-[var(--muted)]">
            읽기 전용 · 상태는 운영자·매장 처리로 전이
          </span>
          {products.length > 0 ? (
            <select
              className="h-[34px] rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-3 text-[12.5px]"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
            >
              <option value="">상품 전체</option>
              {products.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          title="진행 중인 배정이 없습니다"
          message="운영팀이 배정을 생성하면 여기에 표시됩니다."
        />
      ) : (
        <>
          <div className="grid min-w-[640px] grid-cols-5 gap-[11px] overflow-x-auto lg:min-w-0">
            {KANBAN_COLUMNS.map((col) => {
              const items = grouped.get(col) ?? [];
              const fill = items.length / maxCount;
              return (
                <div
                  key={col}
                  className="flex min-w-[140px] flex-col gap-[9px] rounded-2xl border border-[var(--line)] bg-[#fbf5ed] p-3"
                >
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-xs font-semibold text-[var(--ink)]">{col}</span>
                    <span className="text-[11px] text-[var(--muted)]">{items.length}</span>
                  </div>
                  <div className="h-[3px] overflow-hidden rounded-full bg-[var(--line)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${Math.max(fill * 100, items.length ? 8 : 0)}%` }}
                    />
                  </div>
                  {items.length === 0 ? (
                    <p className="px-1 py-2 text-[11px] text-[var(--muted)]">배정 없음</p>
                  ) : (
                    items.map((card) => (
                      <KanbanCard
                        key={card.id}
                        card={card}
                        onClick={() => setSelected(card)}
                      />
                    ))
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-6 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-[18px] py-3.5 text-[11.5px] leading-relaxed text-[var(--muted)]">
            <span>
              배정 상태는 롤업 결과입니다 — 등록만{" "}
              <b className="text-[var(--accent)]">대기</b> · 방문{" "}
              <b className="text-[var(--accent)]">수령완료</b> · 수령 후 제출 전{" "}
              <b className="text-[var(--accent)]">제작중</b> · 제출 후{" "}
              <b className="text-[var(--accent)]">검수중</b> · 목표 도달{" "}
              <b className="text-[var(--accent)]">발행완료</b>.
            </span>
            <span className="ml-auto">
              미리보기 가능: 콘텐츠 상태 <b className="text-[var(--accent)]">제출</b>인 건만
            </span>
          </div>
        </>
      )}

      {selected ? (
        <DetailPanel card={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}
