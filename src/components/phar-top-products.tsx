"use client";

import { todayYmdKst } from "@/lib/inf-visit";
import { upcomingProductRanking } from "@/lib/phar-calendar";
import { formatMetric } from "@/lib/content-insights";
import { creatorPlatformLabelOf } from "@/lib/creator-link";
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
    <div
      className={`flex flex-col ${compact ? "gap-1.5" : "min-h-0 flex-1 gap-2.5"}`}
    >
      {compact ? (
        <p className="shrink-0 truncate text-[11px] font-bold text-[var(--ink)]">
          인기 상품 <span className="font-normal text-[var(--muted)]">· 최근 40일 콘텐츠 성과 기준</span>
        </p>
      ) : (
        <div className="shrink-0 rounded-[6px] border border-[var(--line)] bg-[var(--accent-soft)] px-3 py-2 text-[11px] text-[var(--ink)]">
          향후 2주 방문 예정 상품 중, 최근 40일 발행 콘텐츠의 조회수·좋아요·참여율(ER)을 종합한
          랭킹입니다. 성과 데이터가 없으면 방문 예정 인원 순으로 대체됩니다.
        </div>
      )}
      {rows.length === 0 ? (
        <p className={`text-center text-[var(--muted)] ${compact ? "py-3 text-xs" : "p-4 text-sm"}`}>
          향후 2주간 예정된 방문이 없습니다.
        </p>
      ) : (
        <ol
          className={`flex flex-col overflow-auto ${
            compact ? "max-h-[280px] gap-1" : "min-h-0 flex-1 gap-1.5"
          }`}
        >
          {rows.map((r) => (
            <li
              key={`${r.rank}-${r.name}-${r.brand ?? ""}`}
              className={`rounded-[6px] border border-[var(--line)] bg-[var(--surface)] ${
                compact ? "px-2 py-1.5" : "px-3 py-2.5"
              }`}
            >
              <div className="flex items-center gap-2.5">
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
                  {r.views > 0 ? (
                    <>
                      <span className="font-semibold text-[var(--ink)]">
                        조회 {formatMetric(r.views)}
                      </span>
                      {compact ? null : (
                        <>
                          <br />
                          좋아요 {formatMetric(r.likes)} · ER {r.er.toFixed(1)}%
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-[var(--ink)]">{r.visitorCount}명</span>
                      {compact ? null : (
                        <>
                          {" "}방문 예정
                          <br />
                          수량 {r.qty}개
                        </>
                      )}
                    </>
                  )}
                </span>
              </div>
              {r.topLink ? (
                <a
                  href={r.topLink.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`mt-1.5 flex items-center justify-between gap-2 rounded-[4px] bg-[var(--accent-soft)] px-2 py-1 text-[var(--accent)] ${
                    compact ? "text-[10px]" : "text-[11px]"
                  }`}
                >
                  <span className="truncate">
                    {r.topLink.influencerName} ·{" "}
                    {creatorPlatformLabelOf(r.topLink.url, r.topLink.platform)}
                  </span>
                  <span className="shrink-0 font-semibold">콘텐츠 보기 →</span>
                </a>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
