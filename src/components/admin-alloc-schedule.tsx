"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminAllocationEditForm } from "@/components/admin-allocation-edit";
import { todayYmdKst } from "@/lib/inf-visit";
import {
  VISIT_BUCKET_LABEL,
  addBucket,
  barWidths,
  bucketOf,
  buildMonthCells,
  dayDiffYmd,
  dayRelLabel,
  emptyCounts,
  monthLabel,
  padDateDot,
  shiftMonthYm,
  visitKey,
  type BucketCounts,
  type VisitBucket,
} from "@/lib/admin-alloc-schedule";
import { addDaysYmd, type AllocationWithRelations, type Company, type Store } from "@/lib/types";

type StatusTab = "all" | VisitBucket;

const BADGE: Record<VisitBucket, { bg: string; fg: string; dot: string }> = {
  plan: { bg: "bg-[#f5ecdb]", fg: "text-[#8a6a3c]", dot: "bg-[#dcc39a]" },
  visited: { bg: "bg-[#f2e8d8]", fg: "text-[#7a5a2e]", dot: "bg-[#a8834e]" },
  received: { bg: "bg-[#e8f0e6]", fg: "text-[#2f5c3c]", dot: "bg-[#4a7c59]" },
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function StatusBar({
  counts,
  track = "bg-[#efe3d1]",
}: {
  counts: BucketCounts;
  track?: string;
}) {
  const w = barWidths(counts.plan, counts.visited, counts.received);
  return (
    <div className={`flex h-1.5 overflow-hidden rounded-full ${track}`}>
      {w.wReceived > 0 ? (
        <div className="bg-[#4a7c59]" style={{ width: `${w.wReceived}%` }} />
      ) : null}
      {w.wVisited > 0 ? (
        <div className="bg-[#a8834e]" style={{ width: `${w.wVisited}%` }} />
      ) : null}
      {w.wPlan > 0 ? (
        <div className="bg-[#dcc39a]" style={{ width: `${w.wPlan}%` }} />
      ) : null}
    </div>
  );
}

function KpiCell({
  label,
  value,
  dot,
  valueClass = "text-[var(--ink)]",
}: {
  label: string;
  value: number;
  dot: string;
  valueClass?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 border-r border-[var(--line)] px-4 py-4 last:border-r-0">
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-sm ${dot}`} />
        <span className="text-[11px] font-bold text-[var(--muted)]">{label}</span>
      </div>
      <p
        className={`text-[26px] font-bold leading-tight ${valueClass}`}
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        {value}
      </p>
    </div>
  );
}

export function AdminAllocSchedule({
  list: initialList,
  storeList,
  companyList,
}: {
  list: AllocationWithRelations[];
  storeList: Store[];
  companyList: Company[];
}) {
  const today = todayYmdKst();
  const [liveList, setLiveList] = useState(initialList);
  const [monthYm, setMonthYm] = useState(() => today.slice(0, 7));
  const [storeId, setStoreId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(today);
  const [status, setStatus] = useState<StatusTab>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setLiveList(initialList);
  }, [initialList]);

  const storeName = storeId
    ? storeList.find((s) => s.id === storeId)?.name || null
    : null;

  const scoped = useMemo(
    () =>
      liveList.filter(
        (item) =>
          (!storeId || item.store_id === storeId) &&
          bucketOf(item.status) !== null,
      ),
    [liveList, storeId],
  );

  const monthStats = useMemo(() => {
    const kpi = emptyCounts();
    const byDay = new Map<string, BucketCounts>();
    const tomorrow = addDaysYmd(today, 1);
    let imminentToday = 0;
    let imminentTomorrow = 0;

    for (const item of scoped) {
      const b = bucketOf(item.status);
      if (!b) continue;
      const k = visitKey(item);
      if (k.startsWith(monthYm)) {
        addBucket(kpi, b);
        const dayC = byDay.get(k) || emptyCounts();
        addBucket(dayC, b);
        byDay.set(k, dayC);
      }
      if (b === "plan") {
        if (k === today) imminentToday += 1;
        else if (k === tomorrow) imminentTomorrow += 1;
      }
    }

    return {
      kpi,
      cells: buildMonthCells(monthYm, byDay),
      imminent: { today: imminentToday, tomorrow: imminentTomorrow },
    };
  }, [scoped, monthYm, today]);

  const storeRows = useMemo(() => {
    const byStore = new Map<string, BucketCounts & { todayPlan: number }>();
    for (const store of storeList) {
      byStore.set(store.id, { ...emptyCounts(), todayPlan: 0 });
    }
    for (const item of liveList) {
      const b = bucketOf(item.status);
      if (!b) continue;
      const row = byStore.get(item.store_id);
      if (!row) continue;
      const k = visitKey(item);
      if (k.startsWith(monthYm)) addBucket(row, b);
      if (k === today && b === "plan") row.todayPlan += 1;
    }
    return storeList
      .map((store) => {
        const c = byStore.get(store.id)!;
        return {
          id: store.id,
          name: store.name,
          ...c,
          rate: c.total ? Math.round((c.received / c.total) * 100) : 0,
          bars: barWidths(c.plan, c.visited, c.received),
        };
      })
      .filter((s) => s.total > 0 || storeId === s.id)
      .sort((a, b) => b.total - a.total);
  }, [storeList, liveList, monthYm, today, storeId]);

  const listRows = useMemo(() => {
    let rows = scoped.filter((item) => {
      const k = visitKey(item);
      return day ? k === day : k.startsWith(monthYm);
    });

    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((item) => {
        const blob = [
          item.influencers?.name,
          item.influencers?.instagram_handle,
          item.products?.name,
          item.companies?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
    }

    const tabCounts = {
      all: rows.length,
      plan: 0,
      visited: 0,
      received: 0,
    };
    for (const r of rows) {
      const b = bucketOf(r.status);
      if (b) tabCounts[b] += 1;
    }

    if (status !== "all") {
      rows = rows.filter((r) => bucketOf(r.status) === status);
    }

    rows = rows.slice().sort((a, b) => visitKey(a).localeCompare(visitKey(b)));
    return { rows, tabCounts };
  }, [scoped, day, monthYm, query, status]);

  const openItem = openId
    ? liveList.find((item) => item.id === openId) || null
    : null;

  const listTitle = day
    ? `${padDateDot(day)} 방문 목록`
    : `${monthLabel(monthYm)} 전체 방문 목록`;

  const tabDefs: { id: StatusTab; label: string }[] = [
    { id: "all", label: "전체" },
    { id: "plan", label: VISIT_BUCKET_LABEL.plan },
    { id: "visited", label: VISIT_BUCKET_LABEL.visited },
    { id: "received", label: VISIT_BUCKET_LABEL.received },
  ];

  const gridCols =
    "md:grid-cols-[minmax(92px,1.1fr)_minmax(0,1.35fr)_minmax(0,1.15fr)_minmax(60px,0.85fr)_minmax(0,1fr)_minmax(96px,1.1fr)_minmax(52px,0.62fr)]";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 pb-8 sm:px-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
            Allocations · Schedule
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <h1
              className="text-[28px] font-semibold leading-tight text-[var(--ink)] sm:text-[30px]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              배정·매장
            </h1>
            <span className="text-sm text-[var(--muted)]">
              {storeName || "전체 매장"} · 날짜를 눌러 목록을 봅니다
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none"
            value={storeId || "__all"}
            onChange={(e) =>
              setStoreId(e.target.value === "__all" ? null : e.target.value)
            }
          >
            <option value="__all">전체 매장</option>
            {storeList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-1.5 py-1">
            <button
              type="button"
              className="px-2.5 py-1.5 text-xs text-[var(--accent)]"
              onClick={() => {
                setMonthYm((ym) => shiftMonthYm(ym, -1));
                setDay(null);
              }}
            >
              ◀
            </button>
            <span className="min-w-[88px] text-center text-sm font-bold text-[var(--ink)]">
              {monthLabel(monthYm)}
            </span>
            <button
              type="button"
              className="px-2.5 py-1.5 text-xs text-[var(--accent)]"
              onClick={() => {
                setMonthYm((ym) => shiftMonthYm(ym, 1));
                setDay(null);
              }}
            >
              ▶
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setMonthYm(today.slice(0, 7));
              setDay(today);
            }}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-sm font-bold text-[var(--accent)]"
          >
            오늘
          </button>
        </div>
      </header>

      <section className="flex overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex min-w-0 flex-[1.3] flex-col gap-2 border-r border-[var(--line)] px-5 py-4">
          <p className="text-[11px] font-bold text-[var(--muted)]">
            {monthLabel(monthYm)} 배정 인원
          </p>
          <p className="flex items-baseline gap-1.5">
            <span
              className="text-3xl font-bold text-[var(--ink)]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              {monthStats.kpi.total}
            </span>
            <span className="text-sm text-[var(--muted)]">명</span>
          </p>
          <StatusBar counts={monthStats.kpi} />
        </div>
        <KpiCell
          label={VISIT_BUCKET_LABEL.plan}
          value={monthStats.kpi.plan}
          dot="bg-[#dcc39a]"
        />
        <KpiCell
          label={VISIT_BUCKET_LABEL.visited}
          value={monthStats.kpi.visited}
          dot="bg-[#a8834e]"
        />
        <KpiCell
          label={VISIT_BUCKET_LABEL.received}
          value={monthStats.kpi.received}
          dot="bg-[#4a7c59]"
          valueClass="text-[#2f5c3c]"
        />
        <div className="flex min-w-0 flex-[1.1] flex-col gap-1.5 bg-[#fdf3ef] px-4 py-4">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#b5533f]" />
            <span className="text-[11px] font-bold text-[#8d3f2c]">방문 임박</span>
          </div>
          <p
            className="text-[26px] font-bold leading-tight text-[#8d3f2c]"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {monthStats.imminent.today}
          </p>
          <p className="text-[11px] text-[#b0705d]">
            오늘 예정 · 내일 {monthStats.imminent.tomorrow}명
          </p>
        </div>
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)]">
        <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2
              className="text-base font-bold text-[var(--ink)]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              방문 캘린더
            </h2>
            <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[#4a7c59]" />
                반출
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[#a8834e]" />
                방문
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[#dcc39a]" />
                예정
              </span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={`pb-0.5 text-center text-[11px] font-bold ${
                  i === 0
                    ? "text-[#b5533f]"
                    : i === 6
                      ? "text-[#6b7f9a]"
                      : "text-[var(--muted)]"
                }`}
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {monthStats.cells.map((c) => {
              const selected = day === c.ymd;
              const isToday = c.ymd === today;
              const t = c.counts.total;
              return (
                <button
                  key={c.ymd}
                  type="button"
                  disabled={t === 0}
                  onClick={() => setDay(c.ymd)}
                  className={`flex min-h-[76px] min-w-0 flex-col gap-1.5 overflow-hidden rounded-lg border p-2 text-left transition ${
                    selected
                      ? "border-[#b8905f] bg-[#f6ecda]"
                      : isToday
                        ? "border-[#ecccc0] bg-[#fdf3ef]"
                        : t
                          ? "border-[var(--line)] bg-[#fffdf9] hover:bg-[var(--accent-soft)]"
                          : "cursor-default border-[var(--line)] bg-[#fbf6ec]"
                  } ${c.inMonth ? "" : "opacity-40"}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isToday ? "text-[#8d3f2c]" : "text-[var(--ink)]"
                      }`}
                    >
                      {c.num}
                    </span>
                    <span
                      className={`text-[11px] font-bold ${
                        isToday ? "text-[#8d3f2c]" : "text-[var(--muted)]"
                      }`}
                    >
                      {t ? `${t}명` : ""}
                    </span>
                  </div>
                  <div className="mt-auto">
                    <StatusBar
                      counts={c.counts}
                      track={t ? "bg-[#efe3d1]" : "bg-transparent"}
                    />
                  </div>
                  <p className="truncate text-[10px] text-[#a89578]">
                    {t
                      ? `예정 ${c.counts.plan} · 반출 ${c.counts.received}`
                      : ""}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
            <h2
              className="text-[15px] font-bold text-[var(--ink)]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              매장별 현황
            </h2>
            <span className="text-[11px] text-[var(--muted)]">
              {monthLabel(monthYm)}
            </span>
          </div>
          {storeRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
              이달 배정이 있는 매장이 없습니다.
            </p>
          ) : (
            storeRows.map((s) => {
              const sel = storeId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStoreId(sel ? null : s.id)}
                  className={`flex w-full flex-col gap-1.5 border-b border-[var(--line)] px-4 py-2.5 text-left transition hover:bg-[var(--accent-soft)] ${
                    sel ? "bg-[#f6ecda] shadow-[inset_3px_0_0_#6b4423]" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[var(--ink)]">
                      {s.name}
                    </span>
                    <span className="text-[11px] text-[var(--muted)]">
                      {s.total}명
                    </span>
                    <span className="ml-auto text-xs font-bold text-[var(--ink)]">
                      {s.rate}%
                    </span>
                  </div>
                  <StatusBar counts={s} />
                  <div className="flex gap-3 text-[10px] text-[var(--muted)]">
                    <span>예정 {s.plan}</span>
                    <span>방문 {s.visited}</span>
                    <span>반출 {s.received}</span>
                    {s.todayPlan ? (
                      <span className="ml-auto font-bold text-[#b5533f]">
                        오늘 {s.todayPlan}명
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-4 py-3">
          <h2
            className="text-base font-bold text-[var(--ink)]"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {listTitle}
          </h2>
          <span className="text-sm text-[var(--muted)]">
            {listRows.rows.length}건
          </span>
          <div className="flex flex-wrap gap-1.5">
            {tabDefs.map((t) => {
              const on = status === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setStatus(t.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                    on
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"
                  }`}
                >
                  {t.label} {listRows.tabCounts[t.id]}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setDay(null)}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--muted)]"
          >
            {day ? "해당 월 전체 보기" : "월 전체 표시중"}
          </button>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="계정 · 상품 · 회원사 검색"
            className="ml-auto w-full max-w-[230px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none"
          />
        </div>

        <div
          className={`hidden border-b border-[var(--line)] bg-[var(--accent-soft)] px-4 text-[11px] font-bold text-[var(--muted)] md:grid ${gridCols}`}
        >
          <div className="py-2.5">방문일</div>
          <div className="py-2.5">계정</div>
          <div className="py-2.5">상품</div>
          <div className="py-2.5">매장</div>
          <div className="py-2.5">회원사</div>
          <div className="py-2.5 pl-3.5">상태</div>
          <div className="py-2.5 text-right">상세</div>
        </div>

        <div className="max-h-[440px] overflow-y-auto">
          {listRows.rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--muted)]">
              조건에 맞는 배정이 없습니다.
            </p>
          ) : (
            listRows.rows.map((item) => {
              const b = bucketOf(item.status)!;
              const badge = BADGE[b];
              const ymd = visitKey(item);
              const handle = item.influencers?.instagram_handle || "";
              const near =
                Boolean(ymd) &&
                dayDiffYmd(ymd, today) >= 0 &&
                dayDiffYmd(ymd, today) <= 1;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setOpenId(item.id)}
                  className={`grid w-full grid-cols-1 items-center border-b border-[var(--line)] px-4 text-left transition hover:bg-[var(--accent-soft)] ${gridCols} ${
                    ymd === today ? "bg-[#fdf7f4]" : ""
                  }`}
                >
                  <div className="py-2.5 tabular-nums">
                    <div className="text-sm font-bold text-[var(--ink)]">
                      {ymd ? padDateDot(ymd) : "—"}
                    </div>
                    <div
                      className={`text-[11px] ${
                        near ? "text-[#b5533f]" : "text-[var(--muted)]"
                      }`}
                    >
                      {ymd ? dayRelLabel(ymd, today) : ""}
                    </div>
                  </div>
                  <div className="py-2.5">
                    <div className="text-sm font-bold text-[var(--ink)]">
                      {item.influencers?.name || "—"}
                    </div>
                    <div className="text-[11px] text-[var(--muted)]">
                      {handle || "—"}
                    </div>
                  </div>
                  <div className="py-2.5 text-sm text-[var(--ink)]">
                    {item.products?.name || "—"}
                  </div>
                  <div className="py-2.5 text-sm text-[var(--ink)]">
                    {item.stores?.name || "—"}
                  </div>
                  <div className="py-2.5 text-sm text-[var(--muted)]">
                    {item.companies?.name || "—"}
                  </div>
                  <div className="py-2.5 pl-0 md:pl-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.bg} ${badge.fg}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                      {VISIT_BUCKET_LABEL[b]}
                    </span>
                  </div>
                  <div className="py-2.5 text-right text-xs font-bold text-[var(--accent)]">
                    보기 →
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {openItem ? (
        <div
          className="owm-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="배정 상세"
          onClick={() => setOpenId(null)}
        >
          <div
            className="owm-drawer-panel flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-[var(--line)] bg-[var(--surface)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Detail
                </p>
                <h3 className="mt-1 text-xl font-bold text-[var(--ink)]">
                  {openItem.influencers?.name ||
                    openItem.influencers?.instagram_handle ||
                    "배정"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="rounded-full px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--accent-soft)]"
              >
                닫기
              </button>
            </div>
            <AdminAllocationEditForm
              item={openItem}
              storeList={storeList}
              companyList={companyList}
              onUpdated={(next) =>
                setLiveList((prev) =>
                  prev.map((item) => (item.id === next.id ? next : item)),
                )
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
