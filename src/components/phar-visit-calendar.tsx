"use client";

import { useMemo, useRef } from "react";
import { StateBadge } from "@/components/state-badge";
import { CreatorPhoto } from "@/components/creator-photo";
import { PharTopProducts } from "@/components/phar-top-products";
import { resolvePoolCreator } from "@/lib/creator-pool-mock";
import { todayYmdKst } from "@/lib/inf-visit";
import {
  LOAD_HEAT,
  WEEKDAYS_KO,
  groupVisitors,
  isValidYmd,
  loadLevel,
  monthHeatCells,
  monthLabelKo,
  monthNavState,
  summarizeVisitDays,
  undatedItems,
  weekdayIndex,
  type DayVisitor,
} from "@/lib/phar-calendar";
import { shiftMonthYm, visitKey } from "@/lib/admin-alloc-schedule";
import { formatMd, type AllocationWithRelations } from "@/lib/types";

const UNDATED = "undated";

function formatSnsHref(url?: string | null) {
  const raw = (url || "").trim();
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function VisitorRow({
  visitor,
  onOpenDetail,
}: {
  visitor: DayVisitor;
  onOpenDetail: () => void;
}) {
  const inf = visitor.badgeItem.influencers;
  const sns = formatSnsHref(inf?.sns_url);
  const creator = resolvePoolCreator({
    id: visitor.influencerId,
    name: visitor.name,
    handle: visitor.handle ? `@${visitor.handle}` : "—",
    url: inf?.sns_url,
  });
  return (
    <tr className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--accent-soft)]/40">
      <td className="py-2 pl-3 pr-2">
        <div className="flex items-center gap-2.5">
          <CreatorPhoto creator={creator} size="thumb" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--ink)]">{visitor.name}</p>
            {visitor.handle ? (
              <p className="truncate text-[11px] text-[var(--muted)]">@{visitor.handle}</p>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-2 py-2 text-[13px] text-[var(--ink)]">
        {visitor.products.map((p, idx) => (
          <span key={p.id}>
            {idx > 0 && <span className="mx-1 text-[var(--muted)]">·</span>}
            {p.name}
            {p.quantity > 1 ? <b className="ml-0.5 font-semibold">×{p.quantity}</b> : null}
          </span>
        ))}
      </td>
      <td className="px-2 py-2 text-[12px] text-[var(--muted)]">
        {visitor.companies.join(" · ") || "—"}
      </td>
      <td className="px-2 py-2">
        {sns ? (
          <a
            href={sns}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-semibold text-[var(--accent)] underline"
          >
            프로필 →
          </a>
        ) : (
          <span className="text-[12px] text-[var(--muted)]">—</span>
        )}
      </td>
      <td className="px-2 py-2">
        <StateBadge value={visitor.badgeStatus} />
      </td>
      <td className="py-2 pl-2 pr-3 text-right">
        <button
          type="button"
          onClick={onOpenDetail}
          className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[12px] font-semibold text-[var(--accent)]"
        >
          상세
        </button>
      </td>
    </tr>
  );
}

export function PharVisitCalendar({
  items,
  selectedKey,
  onSelect,
  onOpenCounter,
}: {
  items: AllocationWithRelations[];
  selectedKey: string;
  onSelect: (key: string) => void;
  onOpenCounter: (allocationId?: string) => void;
}) {
  const today = todayYmdKst();
  const todayYm = today.slice(0, 7);
  const monthYm = selectedKey === UNDATED || !isValidYmd(selectedKey)
    ? todayYm
    : selectedKey.slice(0, 7);
  const viewYmRef = useRef(monthYm);
  if (selectedKey !== UNDATED && isValidYmd(selectedKey)) {
    viewYmRef.current = selectedKey.slice(0, 7);
  }
  const viewYm = selectedKey === UNDATED ? viewYmRef.current : monthYm;
  const nav = monthNavState(viewYm, todayYm);

  const byDay = useMemo(() => summarizeVisitDays(items), [items]);
  const cells = useMemo(() => monthHeatCells(viewYm, byDay), [viewYm, byDay]);
  const undated = useMemo(() => undatedItems(items), [items]);

  const selectedItems = useMemo(() => {
    if (selectedKey === UNDATED) return undated;
    return items.filter(
      (item) => item.status !== "cancelled" && visitKey(item) === selectedKey,
    );
  }, [items, selectedKey, undated]);

  const visitors = useMemo(
    () => groupVisitors(selectedItems),
    [selectedItems],
  );
  const summary =
    selectedKey === UNDATED
      ? null
      : byDay.get(selectedKey) || {
          date: selectedKey,
          visitorCount: 0,
          allocationCount: 0,
          pendingCount: 0,
          visitedCount: 0,
          pickedUpCount: 0,
          loadLevel: 0 as const,
        };

  const swipeX = useRef<number | null>(null);

  function goMonth(delta: number) {
    const next = shiftMonthYm(viewYm, delta);
    const nextNav = monthNavState(next, todayYm);
    if (delta < 0 && !nextNav.canPrev) return;
    if (delta > 0 && !nextNav.canNext) return;
    viewYmRef.current = next;
    if (next === todayYm) onSelect(today);
    else onSelect(`${next}-01`);
  }

  const header =
    selectedKey === UNDATED
      ? `방문예정일 미정 · ${undated.length}건`
      : `${formatMd(selectedKey)} (${WEEKDAYS_KO[weekdayIndex(selectedKey)]}) · ${summary?.visitorCount ?? 0}명 / ${summary?.allocationCount ?? 0}건`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
    <div className="grid shrink-0 grid-cols-1 gap-3 min-[900px]:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
      <section className="flex flex-col gap-1.5 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-2.5 sm:p-3">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className="rounded-[6px] px-2 py-1 text-xs text-[var(--accent)] disabled:opacity-30"
            disabled={!nav.canPrev}
            onClick={() => goMonth(-1)}
          >
            ◀
          </button>
          <h2 className="min-w-[110px] text-center text-sm font-bold text-[var(--ink)]">
            {monthLabelKo(viewYm)}
          </h2>
          <button
            type="button"
            className="rounded-[6px] px-2 py-1 text-xs text-[var(--accent)] disabled:opacity-30"
            disabled={!nav.canNext}
            onClick={() => goMonth(1)}
          >
            ▶
          </button>
          <button
            type="button"
            className="ml-1 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--accent)]"
            onClick={() => onSelect(today)}
          >
            오늘
          </button>
        </div>

        <div className="grid w-full grid-cols-7 gap-1">
          {WEEKDAYS_KO.map((w, i) => (
            <div
              key={w}
              className={`pb-0.5 text-center text-[11px] font-bold ${
                i === 0
                  ? "text-[#9B2C2C]"
                  : i === 6
                    ? "text-[#2B6CB0]"
                    : "text-[var(--muted)]"
              }`}
            >
              {w}
            </div>
          ))}
        </div>
        <div
          className="grid w-full grid-cols-7 gap-1"
          onTouchStart={(e) => {
            swipeX.current = e.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = swipeX.current;
            swipeX.current = null;
            if (start == null) return;
            const dx = (e.changedTouches[0]?.clientX ?? start) - start;
            if (dx > 56) goMonth(-1);
            else if (dx < -56) goMonth(1);
          }}
        >
          {cells.map((cell) => {
            const n = cell.summary?.visitorCount ?? 0;
            const alloc = cell.summary?.allocationCount ?? 0;
            const lv = loadLevel(n);
            const heat = LOAD_HEAT[lv];
            const selected = cell.inMonth && selectedKey === cell.ymd;
            const isToday = cell.ymd === today;
            const dow = weekdayIndex(cell.ymd);
            if (!cell.inMonth) {
              return (
                <div
                  key={cell.ymd}
                  className="flex aspect-square flex-col rounded-[6px] border border-transparent p-1"
                >
                  <span className="text-xs text-[#A07050]/40">{cell.num}</span>
                </div>
              );
            }
            return (
              <button
                key={cell.ymd}
                type="button"
                onClick={() => onSelect(cell.ymd)}
                aria-label={`${cell.num}일 ${n}명 ${alloc}건`}
                aria-pressed={selected}
                className={`relative flex aspect-square min-w-0 flex-col items-center overflow-hidden rounded-[6px] border p-1 text-center transition ${
                  isToday ? "border-2 border-[#6B3B1F]" : "border-[#E8D5BE]"
                } ${selected ? "ring-[3px] ring-[#6B3B1F]/25" : ""}`}
                style={{ background: heat.bg, color: heat.fg }}
              >
                <span
                  className={`absolute left-1 top-0.5 text-[11px] font-bold ${
                    dow === 0
                      ? "text-[#9B2C2C]"
                      : dow === 6
                        ? "text-[#2B6CB0]"
                        : ""
                  }`}
                >
                  {cell.num}
                </span>
                {isToday ? (
                  <span className="absolute right-1 top-0.5 text-[8px]" aria-hidden>
                    ●
                  </span>
                ) : lv >= 3 ? (
                  <span className="absolute right-1 top-0.5 text-[7px]" aria-hidden>
                    {lv === 4 ? "●●" : "●"}
                  </span>
                ) : null}
                <span className="mt-3.5 text-base font-bold leading-none">
                  {n > 0 ? n : ""}
                </span>
                <span className="mt-0.5 h-3 shrink-0 text-[9px] leading-none opacity-80">
                  {n > 0 ? `${alloc}건` : ""}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
          <span>방문 인원</span>
          {([0, 1, 2, 3, 4] as const).map((k) => {
            const h = LOAD_HEAT[k];
            return (
              <span key={k} className="inline-flex items-center gap-1">
                <i
                  className="inline-block h-2.5 w-2.5 rounded-sm border border-[#E8D5BE]"
                  style={{ background: h.bg }}
                />
                {h.label}
              </span>
            );
          })}
        </div>

        {undated.length > 0 ? (
          <button
            type="button"
            onClick={() => onSelect(UNDATED)}
            className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
              selectedKey === UNDATED
                ? "border-[#6B3B1F] bg-[#F5EDE3] text-[#3D1F0A]"
                : "border-[var(--line)] text-[var(--ink)]"
            }`}
          >
            날짜 미정 {undated.length}건
          </button>
        ) : null}
      </section>

      <div className="overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-2.5">
        <PharTopProducts items={items} compact />
      </div>
    </div>

      <aside className="flex min-h-[220px] flex-1 flex-col overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--surface)]">
        <div className="shrink-0 border-b border-[var(--line)] px-4 py-3">
          <h3 className="text-[15px] font-bold text-[var(--ink)]">{header}</h3>
          {summary && (summary.pendingCount || summary.visitedCount || summary.pickedUpCount) ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {summary.pendingCount > 0 ? (
                <span className="rounded-full bg-[var(--badge-warn-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--badge-warn-fg)]">
                  대기 {summary.pendingCount}
                </span>
              ) : null}
              {summary.visitedCount > 0 ? (
                <span className="rounded-full bg-[var(--badge-ok-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--badge-ok-fg)]">
                  방문완료 {summary.visitedCount}
                </span>
              ) : null}
              {summary.pickedUpCount > 0 ? (
                <span className="rounded-full bg-[var(--badge-neutral-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--badge-neutral-fg)]">
                  반출완료 {summary.pickedUpCount}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {visitors.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
              이 날은 방문 예정이 없습니다.
            </p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--line)] text-[11px] text-[var(--muted)]">
                  <th className="py-2 pl-3 pr-2 font-medium">크리에이터</th>
                  <th className="px-2 py-2 font-medium">상품</th>
                  <th className="px-2 py-2 font-medium">소속</th>
                  <th className="px-2 py-2 font-medium">SNS</th>
                  <th className="px-2 py-2 font-medium">상태</th>
                  <th className="py-2 pl-2 pr-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((v) => (
                  <VisitorRow
                    key={v.influencerId}
                    visitor={v}
                    onOpenDetail={() => onOpenCounter(v.badgeItem.id)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
        {selectedKey === today && (summary?.visitorCount ?? 0) > 0 ? (
          <div className="shrink-0 border-t border-[var(--line)] p-3">
            <button
              type="button"
              onClick={() => onOpenCounter()}
              className="w-full rounded-[6px] bg-[var(--accent)] px-3 py-2.5 text-sm font-bold text-white"
            >
              전체 리스트에서 응대하기
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
