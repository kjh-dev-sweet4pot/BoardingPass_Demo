"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PHAR_COUNTER_ROOT_ID } from "@/components/phar-header-actions";
import { PharListWithModal } from "@/components/phar-list-with-modal";
import { PharVisitCalendar } from "@/components/phar-visit-calendar";
import { todayYmdKst } from "@/lib/inf-visit";
import {
  defaultPharTab,
  isValidYmd,
  monthVisitorTotal,
  summarizeVisitDays,
} from "@/lib/phar-calendar";
import type { AllocationWithRelations } from "@/lib/types";

type Tab = "calendar" | "counter";

export function PharConsole({
  items,
  storeId,
  initialTab,
  initialDate,
}: {
  items: AllocationWithRelations[];
  storeId: string;
  initialTab?: string;
  initialDate?: string;
}) {
  const today = todayYmdKst();
  const [liveItems, setLiveItems] = useState(items);
  const todayVisitors =
    summarizeVisitDays(items).get(today)?.visitorCount ?? 0;

  const [tab, setTab] = useState<Tab>(() =>
    initialTab === "counter" || initialTab === "calendar"
      ? initialTab
      : defaultPharTab(todayVisitors),
  );
  const [dateKey, setDateKey] = useState(() =>
    initialDate === "undated" || isValidYmd(initialDate || "")
      ? initialDate!
      : today,
  );

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setLiveItems(items);
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/phar/allocations", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) {
          window.location.href = "/phar/login";
          return;
        }
        if (!res.ok) return;
        const body = await res.json();
        setLiveItems((body.allocations as AllocationWithRelations[]) || []);
      } catch {
        // 다음 주기
      }
    }
    const id = window.setInterval(refresh, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (tab === "calendar") params.set("date", dateKey);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [tab, dateKey, pathname, router]);

  const byDay = useMemo(() => summarizeVisitDays(liveItems), [liveItems]);
  const todayN = byDay.get(today)?.visitorCount ?? 0;
  const monthN = monthVisitorTotal(liveItems, today.slice(0, 7));

  return (
    <div
      id={PHAR_COUNTER_ROOT_ID}
      className="flex min-h-0 flex-1 flex-col gap-2.5"
    >
      <p className="shrink-0 text-sm text-[var(--muted)]">
        {todayN > 0 ? (
          <>
            오늘 방문 <b className="text-[var(--ink)]">{todayN}명</b> · 이번 달{" "}
            <b className="text-[var(--ink)]">{monthN}명</b>
          </>
        ) : (
          <>
            오늘 방문 예정 없음 · 이번 달{" "}
            <b className="text-[var(--ink)]">{monthN}명</b>
          </>
        )}
      </p>

      <div
        className="flex w-fit shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5"
        role="tablist"
        aria-label="약사 화면"
      >
        {(
          [
            ["calendar", "방문 달력"],
            ["counter", "오늘 카운터"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              tab === id
                ? "bg-[var(--accent)] !text-white"
                : "text-[var(--muted)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "calendar" ? (
        <PharVisitCalendar
          items={liveItems}
          selectedKey={dateKey}
          onSelect={setDateKey}
          onOpenCounter={() => setTab("counter")}
        />
      ) : (
        <PharListWithModal
          items={liveItems}
          lockedStoreId={storeId}
          fillHeight
          embedInConsole
        />
      )}
    </div>
  );
}
