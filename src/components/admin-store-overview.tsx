"use client";

import { useMemo, useState } from "react";
import {
  type AllocationStatus,
  type AllocationWithRelations,
  type Store,
} from "@/lib/types";

function todayYmdKst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${y}.${m}`;
}

function currentMonthYm() {
  return todayYmdKst().slice(0, 7);
}

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function visitYm(item: AllocationWithRelations) {
  const d = item.visit_date ? String(item.visit_date).slice(0, 10) : "";
  return d ? d.slice(0, 7) : "";
}

function isScheduled(status: AllocationStatus) {
  return status === "pending";
}

function isCompleted(status: AllocationStatus) {
  return (
    status === "visited" || status === "ready" || status === "picked_up"
  );
}

type StoreMonthStats = {
  storeId: string;
  storeName: string;
  /** 이달 방문 예정 인원 (pending, 중복 제거) */
  scheduledPeople: number;
  /** 이달 방문 완료 인원 (visited/ready/picked_up, 중복 제거) */
  completedPeople: number;
  /** 오늘 방문 예정·방문 인원 (중복 제거) */
  todayPeople: number;
};

function buildStoreStats(
  storeList: Store[],
  list: AllocationWithRelations[],
  ym: string,
  today: string,
): StoreMonthStats[] {
  const byStore = new Map<
    string,
    {
      name: string;
      scheduled: Set<string>;
      completed: Set<string>;
      todayPeople: Set<string>;
    }
  >();

  for (const store of storeList) {
    byStore.set(store.id, {
      name: store.name,
      scheduled: new Set(),
      completed: new Set(),
      todayPeople: new Set(),
    });
  }

  for (const item of list) {
    if (!item.store_id || item.status === "cancelled") continue;
    const bucket =
      byStore.get(item.store_id) ??
      (() => {
        const next = {
          name: item.stores?.name || "매장",
          scheduled: new Set<string>(),
          completed: new Set<string>(),
          todayPeople: new Set<string>(),
        };
        byStore.set(item.store_id, next);
        return next;
      })();

    const d = item.visit_date ? String(item.visit_date).slice(0, 10) : "";
    if (visitYm(item) === ym && item.influencer_id) {
      if (isScheduled(item.status)) bucket.scheduled.add(item.influencer_id);
      if (isCompleted(item.status)) bucket.completed.add(item.influencer_id);
    }
    if (d === today && item.influencer_id) {
      bucket.todayPeople.add(item.influencer_id);
    }
  }

  return [...byStore.entries()]
    .map(([storeId, v]) => ({
      storeId,
      storeName: v.name,
      scheduledPeople: v.scheduled.size,
      completedPeople: v.completed.size,
      todayPeople: v.todayPeople.size,
    }))
    .sort((a, b) => {
      if (b.todayPeople !== a.todayPeople) return b.todayPeople - a.todayPeople;
      if (b.scheduledPeople !== a.scheduledPeople) {
        return b.scheduledPeople - a.scheduledPeople;
      }
      return a.storeName.localeCompare(b.storeName, "ko");
    });
}

export function AdminStoreOverview({
  storeList,
  list,
  selectedStoreId,
  onSelectStore,
}: {
  storeList: Store[];
  list: AllocationWithRelations[];
  selectedStoreId: string | null;
  onSelectStore: (storeId: string | null) => void;
}) {
  const [ym, setYm] = useState(currentMonthYm);
  const today = todayYmdKst();

  const stats = useMemo(
    () => buildStoreStats(storeList, list, ym, today),
    [storeList, list, ym, today],
  );

  const totals = useMemo(() => {
    return stats.reduce(
      (acc, s) => {
        acc.scheduled += s.scheduledPeople;
        acc.completed += s.completedPeople;
        acc.todayPeople += s.todayPeople;
        return acc;
      },
      { scheduled: 0, completed: 0, todayPeople: 0 },
    );
  }, [stats]);

  return (
    <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2
            className="text-base text-[var(--ink)]"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            월간 요약
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="px-1.5 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
              onClick={() => setYm((v) => shiftMonth(v, -1))}
              aria-label="이전 달"
            >
              ◀
            </button>
            <span className="min-w-[4.5rem] text-center text-xs font-semibold tabular-nums text-[var(--accent)]">
              {monthLabel(ym)}
            </span>
            <button
              type="button"
              className="px-1.5 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
              onClick={() => setYm((v) => shiftMonth(v, 1))}
              aria-label="다음 달"
            >
              ▶
            </button>
          </div>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
          월별 방문 예정 · 방문 완료 인원
        </p>
        <p className="mt-2 text-sm font-semibold text-[var(--ink)]">전체 지점 현황</p>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-3 text-center">
          <div>
            <p className="text-[10px] tracking-wide text-[var(--muted)] uppercase">
              오늘
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--accent)]">
              {totals.todayPeople}
              <span className="text-[10px] font-normal">명</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] tracking-wide text-[var(--muted)] uppercase">
              이달 예정
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--ink)]">
              {totals.scheduled}
              <span className="text-[10px] font-normal text-[var(--muted)]">
                명
              </span>
            </p>
          </div>
          <div>
            <p className="text-[10px] tracking-wide text-[var(--muted)] uppercase">
              이달 방문 완료
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--ink)]">
              {totals.completed}
              <span className="text-[10px] font-normal text-[var(--muted)]">
                명
              </span>
            </p>
          </div>
        </div>
      </div>

      <ul className="max-h-[min(42vh,380px)] divide-y divide-[var(--line)] overflow-y-auto">
        {stats.length === 0 ? (
          <li className="px-4 py-6 text-center text-xs text-[var(--muted)]">
            등록된 지점이 없습니다.
          </li>
        ) : (
          stats.map((s) => {
            const active = selectedStoreId === s.storeId;
            return (
              <li key={s.storeId}>
                <button
                  type="button"
                  onClick={() => onSelectStore(active ? null : s.storeId)}
                  className={`flex w-full flex-col gap-2 px-4 py-3 text-left transition ${
                    active
                      ? "bg-[var(--accent-soft)]"
                      : "hover:bg-[var(--accent-soft)]/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--ink)]">
                      {s.storeName}
                    </span>
                    {s.todayPeople > 0 ? (
                      <span className="shrink-0 rounded-full border border-[var(--accent)] bg-white px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                        오늘 {s.todayPeople}명
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] text-[var(--muted)]">
                        오늘 0
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-[var(--line)] bg-white/80 px-2.5 py-1.5">
                      <p className="text-[10px] text-[var(--muted)]">
                        방문 예정
                      </p>
                      <p className="mt-0.5 font-semibold tabular-nums text-[var(--ink)]">
                        {s.scheduledPeople}
                        <span className="ml-0.5 text-[10px] font-normal text-[var(--muted)]">
                          명
                        </span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--line)] bg-white/80 px-2.5 py-1.5">
                      <p className="text-[10px] text-[var(--muted)]">
                        방문 완료
                      </p>
                      <p className="mt-0.5 font-semibold tabular-nums text-[var(--accent)]">
                        {s.completedPeople}
                        <span className="ml-0.5 text-[10px] font-normal text-[var(--muted)]">
                          명
                        </span>
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>

      {selectedStoreId ? (
        <div className="border-t border-[var(--line)] px-4 py-2">
          <button
            type="button"
            className="text-xs font-medium text-[var(--accent)] hover:underline"
            onClick={() => onSelectStore(null)}
          >
            전체 지점 보기
          </button>
        </div>
      ) : null}
    </section>
  );
}
