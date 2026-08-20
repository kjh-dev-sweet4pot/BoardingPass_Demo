"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { CompanyPerformanceTab } from "@/components/company-performance-tab";
import {
  CompanyConsoleShell,
  type CompanyConsoleView,
} from "@/components/company-console-shell";
import type { ContentFocus } from "@/components/company-content-dashboard";
import {
  CompanyBudgetGate,
  useBudgetGate,
} from "@/components/company-budget-gate";
import { CompanyCreatorPool } from "@/components/company-creator-pool";
import { CompanyProgressTab } from "@/components/company-progress-tab";
import { buildMockContentInsights } from "@/lib/content-insights-mock";
import {
  buildProgressPoolAllocations,
  buildPublishDemoAllocations,
  buildPublishDemoInsights,
  buildPublishDemoPerformance,
} from "@/lib/publish-demo-data";
import { formatMetric } from "@/lib/content-insights";
import {
  ALLOCATION_LINK_LABEL,
  summarizeAllocationLinks,
  type AllocationLinkSummary,
} from "@/lib/creator-link";
import { todayYmdKst } from "@/lib/inf-visit";
import { VISIT_CONTENT_GUIDE_URL } from "@/lib/creator-pool-mock";
import {
  allocationStatusDisplayLabel,
  formatMd,
  type AllocationWithRelations,
  type Company,
  type CreatorLink,
} from "@/lib/types";

const contentGuideLinkClass =
  "inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-xs font-bold text-[var(--accent)] shadow-sm transition hover:bg-[var(--accent)] hover:!text-white";

function fmtCollectedKst(iso: string) {
  const d = new Date(iso);
  const ymd = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const [y, m, day] = ymd.split("-");
  const hm = d.toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${y}. ${m}. ${day}. ${hm}`;
}

function visitKey(item: AllocationWithRelations) {
  return item.visit_date ? String(item.visit_date).slice(0, 10) : "";
}

function statusRank(item: AllocationWithRelations) {
  if (item.status === "picked_up" || item.picked_up_at) return 0;
  if (item.status === "visited" || item.status === "ready") return 1;
  if (item.status === "cancelled") return 3;
  return 2;
}

function formatKst(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function formatHandle(item: AllocationWithRelations) {
  const raw =
    item.influencers?.instagram_handle_normalized ||
    item.influencers?.instagram_handle ||
    "";
  const n = raw.replace(/^@+/, "").trim();
  return n ? `@${n}` : "—";
}

function snsUrl(url?: string | null) {
  const raw = (url || "").trim();
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function matchesSearch(item: AllocationWithRelations, q: string) {
  if (!q) return true;
  const hay = [
    item.influencers?.name,
    item.influencers?.instagram_handle,
    item.influencers?.instagram_handle_normalized,
    item.products?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function formatVisitLabel(ymd: string) {
  if (!ymd) return "날짜 미정";
  return formatMd(ymd);
}

function statusChipClass(item: AllocationWithRelations) {
  if (item.status === "cancelled") return "bg-[#f0ece6] text-[#8a8074]";
  if (item.status === "picked_up") return "bg-[#e7f3ea] text-[#2f6b3c]";
  if (item.status === "visited" || item.status === "ready") {
    return "bg-[#f8ecd8] text-[#8a4b12]";
  }
  return "bg-[#f5ede3] text-[#6b3b1f]";
}

function statusChipLabel(item: AllocationWithRelations) {
  if (item.status === "cancelled") return "취소";
  if (item.status === "picked_up") return "수령 완료";
  if (item.status === "pending") return "대기";
  return allocationStatusDisplayLabel(item);
}

function linkChipClass(sum: AllocationLinkSummary) {
  if (sum === "approved") return "bg-[#e7f3ea] text-[#2f6b3c]";
  if (sum === "reviewing") return "bg-[#f8ecd8] text-[#8a4b12]";
  if (sum === "rejected") return "bg-[#f8e4e4] text-[#9b2c2c]";
  return "bg-[#f0ece6] text-[#8a8074]";
}

type AllocSortKey = "visit" | "views" | "likes" | "comments";
type SortDir = "asc" | "desc";

function compareAllocRows(
  a: AllocationWithRelations,
  b: AllocationWithRelations,
  sort: { key: AllocSortKey; dir: SortDir },
  insightMap: Map<string, { views: number; likes: number; comments: number }>,
) {
  const sign = sort.dir === "asc" ? 1 : -1;
  if (sort.key === "visit") {
    return sign * visitKey(a).localeCompare(visitKey(b));
  }
  const va = insightMap.get(a.id)?.[sort.key] ?? -1;
  const vb = insightMap.get(b.id)?.[sort.key] ?? -1;
  return sign * (va - vb);
}

function AllocSortTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: AllocSortKey;
  activeKey: AllocSortKey;
  dir: SortDir;
  onSort: (key: AllocSortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  const right = className.includes("text-right");
  return (
    <th className={`px-4 py-3 font-medium ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition ${
          right ? "ml-auto" : ""
        } ${
          active
            ? "font-semibold text-[var(--accent)]"
            : "text-[var(--muted)] hover:text-[var(--ink)]"
        } ${right ? "flex w-full justify-end" : ""}`}
      >
        {label}
        <span className="text-[10px] tabular-nums" aria-hidden>
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

export function CompanyConsole({
  company,
  initialAllocations,
  initialMonthInsights,
  initialAllInsights,
  sidebarActions,
}: {
  company: Company;
  initialAllocations: AllocationWithRelations[];
  initialMonthInsights: ReturnType<typeof buildMockContentInsights>;
  initialAllInsights: ReturnType<typeof buildMockContentInsights>;
  sidebarActions?: React.ReactNode;
}) {
  const gate = useBudgetGate(company.id);
  const [view, setView] = useState<"alloc" | "content" | "pool" | "publish">(
    "pool",
  );
  const [period, setPeriod] = useState<"month" | "all">("all");
  const [searchQ, setSearchQ] = useState("");
  const [storeId, setStoreId] = useState("");
  const [status, setStatus] = useState("");
  const [linkFilter, setLinkFilter] = useState<
    "all" | "none" | "has" | "approved"
  >("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [contentFocus, setContentFocus] = useState<ContentFocus>(null);
  const [allocSort, setAllocSort] = useState<{
    key: AllocSortKey;
    dir: SortDir;
  }>({ key: "visit", dir: "desc" });
  const [performanceMeta, setPerformanceMeta] = useState<{
    asOf: string;
    lastCollected: string | null;
    nextCollectAt: string | null;
  } | null>(null);
  const deferredQ = useDeferredValue(searchQ.trim().toLowerCase());
  const today = todayYmdKst();
  const monthKey = today.slice(0, 7);

  const hasSeededAllocations = initialAllocations.length > 0;

  // TS 시드가 있으면 DB 우선, 없으면 기존 JP 목업 유지
  const items = useMemo(
    () =>
      hasSeededAllocations ? initialAllocations : buildPublishDemoAllocations(),
    [hasSeededAllocations, initialAllocations],
  );

  /** 진행현황 — 크리에이터 풀 전원, 상태별 분배 */
  const progressItems = useMemo(() => buildProgressPoolAllocations(), []);

  const scoped = useMemo(() => {
    return items.filter((item) => {
      const d = visitKey(item);
      if (period === "month" && (!d || !d.startsWith(monthKey))) return false;
      return true;
    });
  }, [items, period, monthKey]);

  const counters = useMemo(() => {
    let total = 0;
    let visited = 0;
    let picked = 0;
    let linked = 0;
    for (const item of scoped) {
      if (item.status === "cancelled") continue;
      total += 1;
      if (item.status === "visited" || item.status === "ready") {
        visited += 1;
      }
      if (item.status === "picked_up") picked += 1;
      if (summarizeAllocationLinks(item.creator_links || []) === "approved") {
        linked += 1;
      }
    }
    return { total, visited, picked, linked };
  }, [scoped]);

  const insights = useMemo(() => {
    if (!hasSeededAllocations) return buildPublishDemoInsights(period);
    return period === "month" ? initialMonthInsights : initialAllInsights;
  }, [
    hasSeededAllocations,
    initialAllInsights,
    initialMonthInsights,
    period,
  ]);

  const insightByAllocId = useMemo(() => {
    const map = new Map<
      string,
      { views: number; likes: number; comments: number }
    >();
    const posts = hasSeededAllocations
      ? initialAllInsights.posts
      : buildPublishDemoInsights("all").posts;
    for (const post of posts) {
      if (post.allocationId) {
        map.set(post.allocationId, {
          views: post.views,
          likes: post.likes,
          comments: post.comments,
        });
      }
    }
    return map;
  }, [hasSeededAllocations, initialAllInsights.posts]);

  function toggleAllocSort(key: AllocSortKey) {
    setAllocSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
  }

  const storeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.store_id && item.stores?.name) {
        map.set(item.store_id, item.stores.name);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [items]);

  const filtered = useMemo(() => {
    const next = items.filter((item) => {
      const d = visitKey(item);
      if (period === "month" && (!d || !d.startsWith(monthKey))) return false;
      if (storeId && item.store_id !== storeId) return false;
      if (status === "visited") {
        if (item.status !== "visited" && item.status !== "ready") return false;
      } else if (status && item.status !== status) {
        return false;
      }
      if (!matchesSearch(item, deferredQ)) return false;
      const linkSum = summarizeAllocationLinks(item.creator_links || []);
      if (linkFilter === "none" && linkSum !== "none") return false;
      if (linkFilter === "has" && linkSum === "none") return false;
      if (linkFilter === "approved" && linkSum !== "approved") return false;
      return true;
    });
    return next.sort((a, b) => {
      const primary = compareAllocRows(a, b, allocSort, insightByAllocId);
      if (primary !== 0) return primary;
      const sa = statusRank(a);
      const sb = statusRank(b);
      if (sa !== sb) return sa - sb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [
    items,
    period,
    monthKey,
    storeId,
    status,
    deferredQ,
    linkFilter,
    allocSort,
    insightByAllocId,
  ]);

  const selected = items.find((i) => i.id === openId) || null;
  const related = selected
    ? items.filter((i) => i.influencer_id === selected.influencer_id)
    : [];

  const counterActive = {
    all: status === "" && linkFilter === "all",
    visited: status === "visited" && linkFilter === "all",
    picked: status === "picked_up" && linkFilter === "all",
    linked: linkFilter === "approved" && status === "",
  };

  function applyCounter(key: "all" | "visited" | "picked" | "linked") {
    if (key === "all" || counterActive[key]) {
      setStatus("");
      setLinkFilter("all");
      return;
    }
    if (key === "visited") {
      setStatus("visited");
      setLinkFilter("all");
      return;
    }
    if (key === "picked") {
      setStatus("picked_up");
      setLinkFilter("all");
      return;
    }
    setStatus("");
    setLinkFilter("approved");
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function openAllocFromContent(opts: {
    allocationId?: string | null;
    search: string;
  }) {
    setView("alloc");
    setSearchQ(opts.search);
    setStoreId("");
    setStatus("");
    setLinkFilter("all");
    setOpenId(opts.allocationId || null);
  }

  if (!gate.ready) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--muted)]">
        불러오는 중…
      </div>
    );
  }

  if (!gate.unlocked) {
    return (
      <CompanyBudgetGate
        companyName={company.name}
        onUnlock={() => gate.unlock()}
      />
    );
  }

  const sidebarFooter =
    view === "content" && performanceMeta ? (
      <>
        <p>{performanceMeta.asOf} 조회 시점 기준</p>
        {performanceMeta.lastCollected ? (
          <p>최종 수집 {fmtCollectedKst(performanceMeta.lastCollected)}</p>
        ) : null}
        {performanceMeta.nextCollectAt ? (
          <p>
            갱신 예정 {formatMd(performanceMeta.nextCollectAt.slice(0, 10))} 00:00
          </p>
        ) : null}
      </>
    ) : null;

  const mobileActions = (
    <div className="flex flex-wrap items-center gap-2">
      {view === "pool" || view === "alloc" ? (
        <a
          href={VISIT_CONTENT_GUIDE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={contentGuideLinkClass}
        >
          가이드 ↗
        </a>
      ) : null}
      <button
        type="button"
        onClick={() => gate.lock()}
        className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]"
      >
        게이트
      </button>
    </div>
  );

  return (
    <CompanyConsoleShell
      companyName={company.name}
      view={view as CompanyConsoleView}
      onViewChange={setView}
      sidebarActions={sidebarActions}
      sidebarFooter={sidebarFooter}
      mobileActions={mobileActions}
    >
      {view === "pool" ? (
        <CompanyCreatorPool companyId={company.id} />
      ) : view === "publish" ? (
        <CompanyProgressTab companyId={company.id} initialAllocations={progressItems} />
      ) : view === "content" ? (
        <CompanyPerformanceTab
          companyId={company.id}
          initialData={buildPublishDemoPerformance() as never}
          period={period}
          onPeriodChange={setPeriod}
          onMetaChange={setPerformanceMeta}
        />
      ) : (
      <div className="grid min-h-0 flex-1 gap-3 overflow-auto px-[28px] py-[26px] lg:grid-cols-[minmax(0,1.9fr)_minmax(280px,0.7fr)]">
        <div className="flex min-h-0 flex-col gap-3">
      <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["all", "배정", counters.total, counterActive.all],
            ["visited", "방문 완료", counters.visited, counterActive.visited],
            ["picked", "수령 완료", counters.picked, counterActive.picked],
            ["linked", "링크 제출", counters.linked, counterActive.linked],
          ] as const
        ).map(([key, label, value, active]) => (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => applyCounter(key)}
            className={`rounded-2xl border px-4 py-4 text-left transition ${
              active
                ? "border-[var(--accent)] bg-white"
                : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]/50"
            }`}
          >
            <p className="text-xs text-[var(--muted)]">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--accent)]">
              {value}
              <span className="ml-1 text-sm font-medium text-[var(--muted)]">
                건
              </span>
            </p>
          </button>
        ))}
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <input
          className="h-10 min-w-[12rem] flex-1 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
          placeholder="인플루언서 · 상품 검색"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
        <select
          className="h-10 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
        >
          <option value="">매장 전체</option>
          {storeOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">진행 상태</option>
          <option value="pending">대기</option>
          <option value="visited">방문 완료</option>
          <option value="picked_up">수령 완료</option>
          <option value="cancelled">취소</option>
        </select>
        <button
          type="button"
          onClick={() =>
            setLinkFilter((v) =>
              v === "all" ? "has" : v === "has" ? "none" : "all",
            )
          }
          className={`h-10 rounded-xl border px-3 text-sm font-medium ${
            linkFilter === "all"
              ? "border-[var(--line)] text-[var(--muted)]"
              : "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          }`}
        >
          링크{" "}
          {linkFilter === "all"
            ? "전체"
            : linkFilter === "none"
              ? "미제출"
              : linkFilter === "approved"
                ? "제출 완료"
                : "제출"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            조건에 맞는 배정이 없습니다.
          </p>
        ) : (
          <table className="min-w-[1020px] w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[var(--line)] bg-[var(--accent-soft)] text-xs text-[var(--muted)]">
                <AllocSortTh
                  label="방문 예정일"
                  sortKey="visit"
                  activeKey={allocSort.key}
                  dir={allocSort.dir}
                  onSort={toggleAllocSort}
                />
                <th className="px-4 py-3 font-medium">인플루언서</th>
                <th className="px-4 py-3 font-medium">매장</th>
                <th className="px-4 py-3 font-medium">상품 / 수량</th>
                <th className="px-4 py-3 font-medium">진행 상태</th>
                <th className="px-4 py-3 font-medium">링크</th>
                <AllocSortTh
                  label="조회"
                  sortKey="views"
                  activeKey={allocSort.key}
                  dir={allocSort.dir}
                  onSort={toggleAllocSort}
                  className="text-right"
                />
                <AllocSortTh
                  label="좋아요"
                  sortKey="likes"
                  activeKey={allocSort.key}
                  dir={allocSort.dir}
                  onSort={toggleAllocSort}
                  className="text-right"
                />
                <AllocSortTh
                  label="댓글"
                  sortKey="comments"
                  activeKey={allocSort.key}
                  dir={allocSort.dir}
                  onSort={toggleAllocSort}
                  className="text-right"
                />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const date = visitKey(item);
                const linkSum = summarizeAllocationLinks(
                  item.creator_links || [],
                );
                const perf = insightByAllocId.get(item.id);
                return (
                  <tr
                    key={item.id}
                    className={`cursor-pointer border-b border-[var(--line)] last:border-b-0 ${
                      item.id === openId
                        ? "bg-[var(--accent-soft)]"
                        : "hover:bg-[var(--accent-soft)]/40"
                    }`}
                    onClick={() =>
                      setOpenId((id) => (id === item.id ? null : item.id))
                    }
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium">
                        {formatVisitLabel(date)}
                      </span>
                      {date === today ? (
                        <span className="ml-2 text-[11px] font-semibold text-[var(--accent)]">
                          오늘
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold">
                        {item.influencers?.name || "—"}
                      </span>
                      <span className="text-[var(--accent)]">
                        {formatHandle(item)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {item.stores?.name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {item.products?.name || "상품"} · {item.quantity}개
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusChipClass(item)}`}
                      >
                        {statusChipLabel(item)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${linkChipClass(linkSum)}`}
                      >
                        {ALLOCATION_LINK_LABEL[linkSum]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {perf ? (
                        <span className="font-semibold text-[var(--ink)]">
                          {formatMetric(perf.views)}
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">
                      {perf ? formatMetric(perf.likes) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">
                      {perf ? formatMetric(perf.comments) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

        </div>

        <aside className="min-h-[50vh] min-w-0 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm lg:min-h-0">
          {selected ? (
            <CompanyInfPanel
              item={selected}
              related={related}
              insight={
                insights.posts.find((p) => p.allocationId === selected.id) ||
                null
              }
              onClose={() => setOpenId(null)}
              onSelect={(id) => setOpenId(id)}
              onOpenContent={(postId) => {
                setView("content");
                setContentFocus({ kind: "post", id: postId });
              }}
            />
          ) : (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-4 text-center">
              <div>
                <p className="text-base font-medium text-[var(--ink)]">
                  행을 선택하면 상세가 여기에 표시됩니다
                </p>
                <p className="mt-2 text-sm leading-5 text-[var(--muted)]">
                  목록에서 인플루언서를 선택하세요
                </p>
              </div>
              <a
                href={VISIT_CONTENT_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={contentGuideLinkClass}
              >
                컨텐츠 가이드라인 보기
                <span aria-hidden>↗</span>
              </a>
            </div>
          )}
        </aside>
      </div>
      )}
    </CompanyConsoleShell>
  );
}

function CompanyInfPanel({
  item,
  related,
  insight,
  onClose,
  onSelect,
  onOpenContent,
}: {
  item: AllocationWithRelations;
  related: AllocationWithRelations[];
  insight: {
    id: string;
    views: number;
    likes: number;
    comments: number;
    source: "mock" | "apify";
  } | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onOpenContent: (postId: string) => void;
}) {
  const [relatedOpen, setRelatedOpen] = useState(false);
  useEffect(() => {
    setRelatedOpen(false);
  }, [item.influencer_id]);
  const handle = formatHandle(item);
  const sns = snsUrl(item.influencers?.sns_url);
  const links = (item.creator_links || []) as CreatorLink[];
  const linkSum = summarizeAllocationLinks(links);

  return (
    <div>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
              Influencer
            </p>
            <h3 className="mt-1 text-2xl font-bold text-[var(--ink)]">
              {item.influencers?.name || handle}
            </h3>
            <p className="mt-1 text-[var(--accent)]">{handle}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusChipClass(item)}`}
              >
                {statusChipLabel(item)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${linkChipClass(linkSum)}`}
              >
                {ALLOCATION_LINK_LABEL[linkSum]}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-[var(--muted)]"
          >
            닫기
          </button>
        </div>

        {sns ? (
          <a
            href={sns}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-5 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold !text-white"
          >
            SNS 프로필
          </a>
        ) : null}

        <a
          href={VISIT_CONTENT_GUIDE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`mb-5 w-full justify-center py-2.5 text-sm ${contentGuideLinkClass}`}
        >
          컨텐츠 가이드라인 보기
          <span aria-hidden>↗</span>
        </a>

        <dl className="grid gap-3 rounded-2xl bg-[var(--accent-soft)]/50 px-4 py-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[var(--muted)]">상품</dt>
            <dd className="mt-1 font-semibold">
              {item.products?.name || "상품"}
              {item.products?.sku ? (
                <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                  SKU {item.products.sku}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">수량</dt>
            <dd className="mt-1 font-semibold">{item.quantity}개</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">매장</dt>
            <dd className="mt-1">{item.stores?.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">방문 예정일</dt>
            <dd className="mt-1">{formatVisitLabel(visitKey(item))}</dd>
          </div>
          {item.visit_code ? (
            <div>
              <dt className="text-xs text-[var(--muted)]">방문 코드</dt>
              <dd className="mt-1">{item.visit_code}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-[var(--muted)]">최초 방문</dt>
            <dd className="mt-1 text-sm">{formatKst(item.verified_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">최근 방문</dt>
            <dd className="mt-1 text-sm">{formatKst(item.last_visited_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">수령일시</dt>
            <dd className="mt-1 text-sm">{formatKst(item.picked_up_at)}</dd>
          </div>
        </dl>

        {insight ? (
          <div className="mt-5 rounded-2xl border border-[var(--line)] px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">콘텐츠 성과</h4>
              <span className="text-[11px] text-[var(--muted)]">
                {insight.source === "mock" ? "미리보기" : "수집"}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-[11px] text-[var(--muted)]">조회</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                  {formatMetric(insight.views)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-[var(--muted)]">좋아요</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                  {formatMetric(insight.likes)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-[var(--muted)]">댓글</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                  {formatMetric(insight.comments)}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => onOpenContent(insight.id)}
              className="mt-3 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-medium"
            >
              콘텐츠 대시보드에서 보기
            </button>
          </div>
        ) : null}

        <div className="mt-5">
          <h4 className="mb-2 text-sm font-semibold">콘텐츠 링크</h4>
          {links.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">제출된 링크가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {links.map((link) => (
                <li
                  key={link.id}
                  className="rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm"
                >
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-[var(--accent)] underline"
                  >
                    {link.url}
                  </a>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {link.platform} ·{" "}
                    {
                      ALLOCATION_LINK_LABEL[
                        link.status === "approved"
                          ? "approved"
                          : link.status === "submitted"
                            ? "reviewing"
                            : "rejected"
                      ]
                    }{" "}
                    · {formatKst(link.submitted_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {related.length > 1 ? (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setRelatedOpen((v) => !v)}
              className="w-full rounded-xl border border-[var(--line)] px-4 py-3 text-left text-sm"
            >
              이 인플루언서 자사 배정 {related.length}건{" "}
              {relatedOpen ? "▲" : "▼"}
            </button>
            {relatedOpen ? (
              <ul className="mt-2 space-y-2">
                {related.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(row.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left text-sm ${
                        row.id === item.id
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[var(--line)]"
                      }`}
                    >
                      {row.products?.name || "상품"} ·{" "}
                      {formatVisitLabel(visitKey(row))} ·{" "}
                      {allocationStatusDisplayLabel(row)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
    </div>
  );
}
