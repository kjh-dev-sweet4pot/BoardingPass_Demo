"use client";

import { todayYmdKst } from "@/lib/inf-visit";
import { upcomingProductRanking } from "@/lib/phar-calendar";
import type { AllocationWithRelations } from "@/lib/types";

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function PharTopProducts({
  items,
  compact = false,
}: {
  items: AllocationWithRelations[];
  /** 달력 탭 옆 좁은 칸에 넣을 때 — 문구·여백을 줄이고 목록만 스크롤한다. */
  compact?: boolean;
}) {
  const rows = upcomingProductRanking(items, todayYmdKst(), 14, 10);

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${compact ? "gap-1.5" : "gap-2.5"}`}>
      {compact ? (
        <p className="shrink-0 truncate text-[11px] font-bold text-[var(--ink)]">
          인기 상품 <span className="font-normal text-[var(--muted)]">· 향후 2주 방문 예정 기준</span>
        </p>
      ) : (
        <div className="shrink-0 rounded-[6px] border border-[var(--line)] bg-[var(--accent-soft)] px-3 py-2 text-[11px] text-[var(--ink)]">
          향후 2주 방문 예정 배정 건수 기준 추정치입니다 (실제 매출·조회수 예측이 아니라, 이미 잡힌 방문 일정 집계입니다).
        </div>
      )}
      {rows.length === 0 ? (
        <p className={`text-center text-[var(--muted)] ${compact ? "py-3 text-xs" : "p-4 text-sm"}`}>
          향후 2주간 예정된 방문이 없습니다.
        </p>
      ) : (
        <ol className={`flex min-h-0 flex-1 flex-col overflow-auto ${compact ? "gap-1" : "gap-1.5"}`}>
          {rows.map((r) => (
            <li
              key={`${r.rank}-${r.name}-${r.brand ?? ""}`}
              className={`flex items-center gap-2.5 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] ${
                compact ? "px-2 py-1.5" : "px-3 py-2.5"
              }`}
            >
              <span
                className={`shrink-0 text-center font-bold text-[var(--accent)] ${
                  compact ? "w-5 text-sm" : "w-7 text-base"
                }`}
              >
                {RANK_MEDAL[r.rank] ?? r.rank}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-semibold text-[var(--ink)] ${compact ? "text-xs" : "text-sm"}`}>
                  {r.name}
                </span>
                {r.brand && !compact ? (
                  <span className="block truncate text-[11px] text-[var(--muted)]">{r.brand}</span>
                ) : null}
              </span>
              <span className={`shrink-0 text-right tabular-nums text-[var(--muted)] ${compact ? "text-[10px]" : "text-xs"}`}>
                <span className="font-semibold text-[var(--ink)]">{r.visitorCount}명</span>
                {compact ? null : (
                  <>
                    {" "}방문 예정
                    <br />
                    수량 {r.qty}개
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
