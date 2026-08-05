"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ALLOCATION_STATUS_LABEL,
  type AllocationWithRelations,
  type Influencer,
} from "@/lib/types";

/* ─── 유틸 ─────────────────────────────────────────── */
function formatKst(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function todayYmdKst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function visitDateYmd(item: AllocationWithRelations) {
  return item.visit_date ? String(item.visit_date).slice(0, 10) : null;
}

function isVisitToday(item: AllocationWithRelations) {
  const v = visitDateYmd(item);
  return Boolean(v && v === todayYmdKst());
}

function formatVisitDateKo(ymd: string | null) {
  if (!ymd) return "날짜 미정";
  const [, m, d] = ymd.split("-").map(Number);
  if (!m || !d) return ymd;
  return `${m}월 ${d}일`;
}

function formatVisitDayOfWeek(ymd: string | null) {
  if (!ymd) return "";
  const date = new Date(ymd + "T00:00:00+09:00");
  return ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
}

function visitBlockedMessage(item: AllocationWithRelations) {
  const label = formatVisitDateKo(visitDateYmd(item));
  return `${label} 방문시 수령할 수 있습니다!`;
}

function formatIgHandle(influencer: Influencer) {
  const raw =
    influencer.instagram_handle_normalized || influencer.instagram_handle || "";
  return raw.replace(/^@+/, "").trim() ? `@${raw.replace(/^@+/, "").trim()}` : "—";
}

function formatSnsUrl(url?: string | null) {
  const raw = (url || "").trim();
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function isPickedUp(item: AllocationWithRelations) {
  return item.status === "picked_up" || Boolean(item.picked_up_at);
}

function sortItems(items: AllocationWithRelations[]) {
  return [...items].sort((a, b) => {
    const rank = (i: AllocationWithRelations) => {
      if (isPickedUp(i)) return 2;
      if (i.status === "cancelled") return 3;
      if (isVisitToday(i)) return 0;
      return 1;
    };
    const d = rank(a) - rank(b);
    return d !== 0 ? d : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/* ─── 방문 그룹 타입 ──────────────────────────────── */
interface TripGroup {
  key: string;          // `${visitDate}__${storeId}`
  visitDate: string | null;
  storeName: string;
  storeId: string | null;
  items: AllocationWithRelations[];
  isToday: boolean;
  totalQty: number;
  doneQty: number;
}

function buildTripGroups(allocations: AllocationWithRelations[]): TripGroup[] {
  const map = new Map<string, TripGroup>();

  for (const item of allocations) {
    if (item.status === "cancelled") continue;
    const date = visitDateYmd(item);
    const storeId = item.store_id || "unknown";
    const storeName = item.stores?.name || "매장";
    const key = `${date ?? "none"}__${storeId}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        visitDate: date,
        storeName,
        storeId: item.store_id || null,
        items: [],
        isToday: Boolean(date && date === todayYmdKst()),
        totalQty: 0,
        doneQty: 0,
      });
    }

    const group = map.get(key)!;
    group.items.push(item);
    group.totalQty += item.quantity;
    if (isPickedUp(item)) group.doneQty += item.quantity;
  }

  return [...map.values()].sort((a, b) => {
    if (a.isToday && !b.isToday) return -1;
    if (!a.isToday && b.isToday) return 1;
    const da = a.visitDate ?? "";
    const db = b.visitDate ?? "";
    return da < db ? -1 : da > db ? 1 : 0;
  });
}

/* ─── 아이콘 ─────────────────────────────────────────── */
function IconBox() {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f0f0f5]">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="4" y="8" width="14" height="11" rx="2" stroke="#c0bce8" strokeWidth="1.4" />
        <path d="M8 8V6a3 3 0 016 0v2" stroke="#c0bce8" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function StoreIconSm() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path
        d="M2 5.5L6.5 2 11 5.5V11a.5.5 0 01-.5.5h-2.5V8H5v3.5H2.5A.5.5 0 012 11V5.5z"
        stroke="#aaa"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type View = "welcome" | "trips" | "list";
type Tab  = "active" | "done";
type Step = "review" | "confirm";
type ModalMode = "pickup" | "blocked";

/* ─── 메인 컴포넌트 ──────────────────────────────────── */
export function InfAllocationList({
  influencer,
  initialAllocations,
}: {
  influencer: Influencer;
  initialAllocations: AllocationWithRelations[];
}) {
  const router = useRouter();
  const [allocations, setAllocations] = useState(() => sortItems(initialAllocations));
  const [view, setView] = useState<View>("welcome");
  const [selectedTrip, setSelectedTrip] = useState<TripGroup | null>(null);
  const [tab, setTab] = useState<Tab>("active");

  const [selected, setSelected] = useState<AllocationWithRelations | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>("pickup");
  const [step, setStep] = useState<Step>("review");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAllocations(sortItems(initialAllocations));
  }, [initialAllocations]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  function closeModal() {
    setSelected(null);
    setModalMode("pickup");
    setStep("review");
    setError(null);
  }

  function openItem(item: AllocationWithRelations) {
    const done = isPickedUp(item);
    const blocked = !done && item.status !== "cancelled" && !isVisitToday(item);
    setSelected(item);
    setModalMode(blocked ? "blocked" : "pickup");
    setStep("review");
    setError(null);
  }

  function openTrip(trip: TripGroup) {
    setSelectedTrip(trip);
    setTab("active");
    setView("list");
  }

  async function confirmPickup() {
    if (!selected) return;
    if (!isVisitToday(selected)) { setError(visitBlockedMessage(selected)); return; }
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/inf/allocations/${selected.id}/pickup`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "수령 확인 실패");
      const updated = body.allocation as AllocationWithRelations;
      setAllocations((prev) =>
        sortItems(prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))),
      );
      setSelected((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
      setStep("review");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "수령 확인 중 오류가 발생했습니다.");
    } finally {
      setConfirming(false);
    }
  }

  const tripGroups = buildTripGroups(allocations);
  const todayItems = allocations.filter(
    (a) => !isPickedUp(a) && a.status !== "cancelled" && isVisitToday(a),
  );

  const defaultTrip = tripGroups.find((g) => g.isToday) ?? tripGroups[0] ?? null;

  const alreadyPickedUp = selected ? isPickedUp(selected) : false;
  const cancelled = selected?.status === "cancelled";

  const effectiveTrip = selectedTrip ?? defaultTrip;

  /* ── 방문 일정 목록을 최신 상태로 재계산 ── */
  const currentTrip = selectedTrip
    ? tripGroups.find((g) => g.key === selectedTrip.key) ?? selectedTrip
    : null;

  const tripActiveItems = currentTrip
    ? currentTrip.items.filter((a) => !isPickedUp(a) && a.status !== "cancelled")
    : [];
  const tripDoneItems = currentTrip
    ? currentTrip.items.filter((a) => isPickedUp(a) || a.status === "cancelled")
    : [];
  const tabItems = tab === "active" ? tripActiveItems : tripDoneItems;

  /* ════════════════════════════════════════════
     뷰 1 : 환영 화면
  ════════════════════════════════════════════ */
  if (view === "welcome") {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          {/* 체크 아이콘 */}
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-[#7c6ef5]/10" />
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="16" stroke="#7c6ef5" strokeWidth="2" strokeOpacity=".3" />
              <path
                d="M13 20l5.5 5.5 9.5-10"
                stroke="#7c6ef5"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-[#1a1a2e]">
              안녕하세요, {influencer.name}님!
            </h1>
            {effectiveTrip && (
              <p className="mt-2 text-xs font-semibold text-[#7c6ef5]">
                {effectiveTrip.storeName}에 오신걸 환영합니다 !
              </p>
            )}
            <p className="mt-1.5 text-sm text-[#999]">본인 확인이 완료되었습니다.</p>
            {influencer.sns_url && (
              <a
                href={formatSnsUrl(influencer.sns_url)!}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-[#7c6ef5] underline underline-offset-2"
              >
                SNS 프로필
              </a>
            )}
          </div>

          {/* 방문 일정 리스트 */}
          <div className="w-full px-1">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#1a1a2e]">방문 일정</p>
              <span className="text-xs text-[#aaa]">{tripGroups.length}개</span>
            </div>

            <div className="max-h-[230px] overflow-y-auto pr-1">
              {tripGroups.length === 0 ? (
                <p className="py-10 text-center text-xs text-[#ccc]">
                  예정된 방문 일정이 없습니다.
                </p>
              ) : (
                <ul className="space-y-3">
                  {tripGroups.map((trip) => {
                    const allDone = trip.doneQty >= trip.totalQty;
                    const dateLabel = formatVisitDateKo(trip.visitDate);
                    const dayLabel = formatVisitDayOfWeek(trip.visitDate);
                    const isSelected = effectiveTrip?.key === trip.key;

                    return (
                      <li key={trip.key}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTrip(trip);
                            setTab("active");
                          }}
                          className={`flex w-full items-stretch overflow-hidden rounded-2xl border bg-white transition active:bg-[#fafafa] ${
                            isSelected
                              ? "border-[#7c6ef5] bg-[#f5f3ff]"
                              : "border-[#f0f0f0]"
                          }`}
                        >
                          <div
                            className={`flex w-[72px] shrink-0 flex-col items-center justify-center gap-0.5 py-5 ${
                              trip.isToday ? "bg-[#7c6ef5]" : "bg-[#f5f5f5]"
                            }`}
                          >
                            <span
                              className={`text-[10px] font-semibold ${
                                trip.isToday ? "text-white/70" : "text-[#bbb]"
                              }`}
                            >
                              {dayLabel}요일
                            </span>
                            <span
                              className={`text-lg font-bold leading-tight ${
                                trip.isToday ? "text-white" : "text-[#555]"
                              }`}
                            >
                              {dateLabel}
                            </span>
                            {trip.isToday && (
                              <span className="mt-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                                오늘
                              </span>
                            )}
                          </div>

                          <div className="flex flex-1 items-center gap-3 px-4 py-4">
                            <div className="flex-1 text-left">
                              <div className="flex items-center gap-1.5">
                                <StoreIconSm />
                                <p className="text-sm font-semibold text-[#1a1a2e]">
                                  {trip.storeName}
                                </p>
                              </div>
                              <p className="mt-1 text-xs text-[#aaa]">
                                상품 {trip.items.length}종 · 총 {trip.totalQty}개
                              </p>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              {allDone ? (
                                <span className="rounded-full bg-[#f3eee3] px-2.5 py-1 text-[10px] font-semibold text-[#8a7a5c]">
                                  완료
                                </span>
                              ) : trip.isToday ? (
                                <span className="rounded-full bg-[#f3f0fe] px-2.5 py-1 text-[10px] font-semibold text-[#7c6ef5]">
                                  수령 가능
                                </span>
                              ) : (
                                <span className="rounded-full bg-[#f5f5f5] px-2.5 py-1 text-[10px] font-semibold text-[#aaa]">
                                  방문 예정
                                </span>
                              )}
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 14 14"
                                fill="none"
                                aria-hidden="true"
                              >
                                <path
                                  d="M5 3l4 4-4 4"
                                  stroke="#ccc"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <p className="text-xs text-[#bbb]">
            일정을 선택한 후 매장에서 수령할 상품을 확인하세요
          </p>
        </div>

        {/* 상품 확인하기 버튼 */}
        <div className="px-6 pb-12 pt-4">
          <button
            type="button"
            onClick={() => {
              if (!effectiveTrip) return;
              setSelectedTrip(effectiveTrip);
              setTab("active");
              setView("list");
            }}
            disabled={!effectiveTrip}
            className="w-full rounded-2xl bg-[#7c6ef5] py-4 text-sm font-semibold text-white transition active:brightness-90 disabled:opacity-50"
          >
            상품 확인하기
          </button>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════
     뷰 2 : 방문 일정 × 지점 카드 목록
  ════════════════════════════════════════════ */
  if (view === "trips") {
    return (
      <div className="flex flex-1 flex-col">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 pb-3 pt-5">
          <button
            type="button"
            onClick={() => setView("welcome")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f5]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="#666" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <div>
            <h2 className="text-base font-bold text-[#1a1a2e]">방문 일정</h2>
            <p className="text-xs text-[#aaa]">일정을 선택하면 해당 상품 목록을 확인합니다</p>
          </div>
        </div>

        {/* 카드 목록 */}
        <div className="flex-1 overflow-y-auto px-5 py-2 pb-10">
          {tripGroups.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f5f5]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M8 2v3M16 2v3M3 9h18M5 4h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
                    stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-sm text-[#ccc]">예정된 방문 일정이 없습니다.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {tripGroups.map((trip) => {
                const allDone = trip.doneQty >= trip.totalQty;
                const dateLabel = formatVisitDateKo(trip.visitDate);
                const dayLabel = formatVisitDayOfWeek(trip.visitDate);

                return (
                  <li key={trip.key}>
                    <button
                      type="button"
                      onClick={() => openTrip(trip)}
                      className="flex w-full items-stretch gap-0 overflow-hidden rounded-2xl border border-[#f0f0f0] bg-white shadow-sm transition active:bg-[#fafafa]"
                    >
                      {/* 날짜 컬럼 */}
                      <div
                        className={`flex w-[72px] shrink-0 flex-col items-center justify-center gap-0.5 py-5 ${
                          trip.isToday
                            ? "bg-[#7c6ef5]"
                            : "bg-[#f5f5f5]"
                        }`}
                      >
                        <span
                          className={`text-[10px] font-semibold ${
                            trip.isToday ? "text-white/70" : "text-[#bbb]"
                          }`}
                        >
                          {dayLabel}요일
                        </span>
                        <span
                          className={`text-lg font-bold leading-tight ${
                            trip.isToday ? "text-white" : "text-[#555]"
                          }`}
                        >
                          {dateLabel}
                        </span>
                        {trip.isToday && (
                          <span className="mt-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                            오늘
                          </span>
                        )}
                      </div>

                      {/* 정보 컬럼 */}
                      <div className="flex flex-1 items-center gap-3 px-4 py-4">
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-1.5">
                            <StoreIconSm />
                            <p className="text-sm font-semibold text-[#1a1a2e]">
                              {trip.storeName}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-[#aaa]">
                            상품 {trip.items.length}종 · 총 {trip.totalQty}개
                            {allDone && (
                              <span className="ml-2 text-[#8a7a5c]">수령 완료</span>
                            )}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {allDone ? (
                            <span className="rounded-full bg-[#f3eee3] px-2.5 py-1 text-[10px] font-semibold text-[#8a7a5c]">
                              완료
                            </span>
                          ) : trip.isToday ? (
                            <span className="rounded-full bg-[#f3f0fe] px-2.5 py-1 text-[10px] font-semibold text-[#7c6ef5]">
                              수령 가능
                            </span>
                          ) : (
                            <span className="rounded-full bg-[#f5f5f5] px-2.5 py-1 text-[10px] font-semibold text-[#aaa]">
                              방문 예정
                            </span>
                          )}
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M5 3l4 4-4 4" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 하단 네비 */}
        <BottomNav onHome={() => setView("welcome")} />
      </div>
    );
  }

  /* ════════════════════════════════════════════
     뷰 3 : 특정 지점 × 날짜 상품 리스트
  ════════════════════════════════════════════ */
  return (
    <div className="flex flex-1 flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        <button
          type="button"
          onClick={() => setView("trips")}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f5]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="#666" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-[#1a1a2e]">
            {currentTrip?.storeName}
          </h2>
          <p className="text-xs text-[#aaa]">
            {formatVisitDateKo(currentTrip?.visitDate ?? null)}
            {currentTrip?.isToday ? " · 오늘" : ""}
          </p>
        </div>
      </div>

      {/* 탭 */}
      <div className="border-b border-[#f0f0f0] px-5">
        <div className="flex gap-4">
          {(["active", "done"] as Tab[]).map((t) => {
            const label = t === "active" ? "수령할 상품" : "수령 완료";
            const count = t === "active" ? tripActiveItems.length : tripDoneItems.length;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`relative py-3 text-sm font-semibold transition ${
                  tab === t ? "text-[#1a1a2e]" : "text-[#bbb]"
                }`}
              >
                {label}
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                    tab === t ? "bg-[#7c6ef5] text-white" : "bg-[#f0f0f0] text-[#bbb]"
                  }`}
                >
                  {count}
                </span>
                {tab === t && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#7c6ef5]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 안내 문구 */}
      {tab === "active" && currentTrip && !currentTrip.isToday && (
        <div className="bg-[#fffbea] px-5 py-3 text-xs text-[#b08d3b]">
          오늘 방문 예정인 지점의 상품만 수령 확인할 수 있습니다.
        </div>
      )}
      {tab === "active" && currentTrip?.isToday && (
        <div className="bg-[#fafafa] px-5 py-3 text-xs text-[#aaa]">
          수령 확인 후에는 취소할 수 없습니다.
        </div>
      )}

      {/* 카드 목록 */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tabItems.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f5f5]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 9h18M3 9l2-4h14l2 4M3 9v10h18V9" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm text-[#ccc]">
              {tab === "active" ? "수령할 상품이 없습니다." : "수령 완료된 상품이 없습니다."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {tabItems.map((item) => {
              const done = isPickedUp(item);
              const today = isVisitToday(item);
              const isCancelled = item.status === "cancelled";

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-[#f0f0f0] bg-white px-4 py-4 text-left shadow-sm transition active:bg-[#fafafa]"
                  >
                    <IconBox />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isCancelled
                              ? "bg-[#f5f5f5] text-[#ccc]"
                              : done
                                ? "bg-[#f3eee3] text-[#8a7a5c]"
                                : today
                                  ? "bg-[#f3f0fe] text-[#7c6ef5]"
                                  : "bg-[#f5f5f5] text-[#aaa]"
                          }`}
                        >
                          {isCancelled ? "취소" : done ? "수령 완료" : today ? "수령 가능" : "방문 예정"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                        {item.products?.name || "상품"}
                      </p>
                      <p className="mt-0.5 text-xs text-[#aaa]">
                        수량 {item.quantity}개
                        {item.visit_code ? ` · 코드 ${item.visit_code}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-[#1a1a2e]">{item.quantity}개</p>
                      <p className="text-xs text-[#ccc]">›</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 하단 네비 */}
      <BottomNav onHome={() => setView("welcome")} />

      {/* ── 방문 예정 안내 바텀시트 ── */}
      {selected && modalMode === "blocked" && (
        <BottomSheet onClose={closeModal} label="방문 예정 안내">
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fff3cd]">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 10v5M14 19h.01" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                <circle cx="14" cy="14" r="11" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity=".5" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#1a1a2e]">오늘은 수령할 수 없습니다</h3>
              <p className="mt-1 text-sm text-[#999]">{visitBlockedMessage(selected)}</p>
            </div>
            <div className="w-full rounded-2xl bg-[#f9f9f9] px-4 py-3 text-left text-sm text-[#444]">
              <p className="font-medium">{selected.products?.name || "상품"}</p>
              <p className="mt-0.5 text-xs text-[#aaa]">
                {selected.stores?.name || "매장"} · {selected.quantity}개
              </p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="w-full rounded-2xl bg-[#7c6ef5] py-4 text-sm font-semibold text-white"
            >
              확인
            </button>
          </div>
        </BottomSheet>
      )}

      {/* ── 수령 확인 바텀시트 ── */}
      {selected && modalMode === "pickup" && (
        <BottomSheet
          onClose={closeModal}
          label={step === "confirm" ? "수령 최종 확인" : "수령 정보 확인"}
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium tracking-widest text-[#7c6ef5] uppercase">
                {step === "confirm" ? "Confirm" : "Review"}
              </p>
              <h3 className="mt-1 text-xl font-bold text-[#1a1a2e]">
                {step === "confirm" ? "수령 최종 확인" : "수령 정보 확인"}
              </h3>
              <p className="mt-1 text-sm text-[#999]">
                {step === "confirm"
                  ? "아래 내용이 맞다면 최종 확인을 눌러 주세요."
                  : "관계자에게 제시 후 상품을 수령하세요."}
              </p>
            </div>

            {/* 요약 카드 */}
            <div className="space-y-2.5 rounded-2xl bg-[#f9f9f9] px-4 py-4">
              <InfoRow label="인플루언서">
                {influencer.name}{" "}
                <span className="text-[#7c6ef5]">{formatIgHandle(influencer)}</span>
                {formatSnsUrl(influencer.sns_url) && (
                  <a
                    href={formatSnsUrl(influencer.sns_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-xs text-[#aaa] underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    프로필
                  </a>
                )}
              </InfoRow>
              <InfoRow label="상품">{selected.products?.name || "상품"}</InfoRow>
              {selected.products?.description && (
                <InfoRow label="설명">{selected.products.description}</InfoRow>
              )}
              <InfoRow label="수량">{selected.quantity}개</InfoRow>
              <InfoRow label="매장">
                {selected.stores?.name || "매장"}
                {selected.stores?.address ? ` · ${selected.stores.address}` : ""}
              </InfoRow>
              {selected.visit_date && (
                <InfoRow label="방문 예정일">{selected.visit_date}</InfoRow>
              )}
              {selected.visit_code && (
                <InfoRow label="방문 코드">{selected.visit_code}</InfoRow>
              )}
              <InfoRow label="수령 여부">
                <span
                  className={
                    alreadyPickedUp
                      ? "text-[#8a7a5c]"
                      : cancelled
                        ? "text-[#aaa]"
                        : "text-[#7c6ef5]"
                  }
                >
                  {alreadyPickedUp
                    ? "수령 완료"
                    : cancelled
                      ? ALLOCATION_STATUS_LABEL.cancelled
                      : "수령 대기"}
                </span>
              </InfoRow>
              {selected.picked_up_at && (
                <InfoRow label="수령 시간">{formatKst(selected.picked_up_at)}</InfoRow>
              )}
            </div>

            {error && (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-500">{error}</p>
            )}

            {/* 액션 버튼 */}
            {alreadyPickedUp ? (
              <div className="rounded-2xl bg-[#f3eee3] px-4 py-3 text-center text-sm font-semibold text-[#8a7a5c]">
                ✓ 수령 확인 완료
                {selected.picked_up_at ? ` · ${formatKst(selected.picked_up_at)}` : ""}
              </div>
            ) : cancelled ? (
              <p className="text-center text-sm text-[#aaa]">
                취소된 배정은 수령 확인할 수 없습니다.
              </p>
            ) : step === "review" ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-2xl border border-[#e8e8e8] py-4 text-sm font-semibold text-[#666]"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={() => setStep("confirm")}
                  className="flex-1 rounded-2xl bg-[#7c6ef5] py-4 text-sm font-semibold text-white"
                >
                  수령 확인
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="rounded-2xl bg-[#f3f0fe] px-4 py-3 text-center text-sm text-[#7c6ef5]">
                  수령 확정 후에는 취소할 수 없습니다.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={confirming}
                    onClick={() => { setStep("review"); setError(null); }}
                    className="flex-1 rounded-2xl border border-[#e8e8e8] py-4 text-sm font-semibold text-[#666] disabled:opacity-50"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    disabled={confirming}
                    onClick={confirmPickup}
                    className="flex-1 rounded-2xl bg-[#7c6ef5] py-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {confirming ? "확인 중…" : "최종 수령 확인"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

/* ─── 하단 네비 ──────────────────────────────────────── */
function BottomNav({ onHome }: { onHome: () => void }) {
  return (
    <nav className="border-t border-[#f0f0f0] bg-white px-6 pb-8 pt-3">
      <div className="flex items-center justify-around">
        <button
          type="button"
          onClick={onHome}
          className="flex flex-col items-center gap-1"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="3" y="8" width="16" height="11" rx="2" stroke="#ccc" strokeWidth="1.5" />
            <path d="M7 8V6a4 4 0 018 0v2" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[10px] font-medium text-[#ccc]">내 상품</span>
        </button>

        <form action="/api/inf/clear" method="post">
          <button type="submit" className="flex flex-col items-center gap-1">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="7" stroke="#ccc" strokeWidth="1.5" />
              <path d="M11 8v3l2 2" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] font-medium text-[#ccc]">다시 확인</span>
          </button>
        </form>
      </div>
    </nav>
  );
}

/* ─── InfoRow ────────────────────────────────────────── */
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-20 shrink-0 text-xs text-[#aaa]">{label}</dt>
      <dd className="text-sm text-[#1a1a2e]">{children}</dd>
    </div>
  );
}

/* ─── BottomSheet ────────────────────────────────────── */
function BottomSheet({
  onClose,
  label,
  children,
}: {
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white px-5 pb-10 pt-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-[#e8e8e8]" />
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-[#ccc]">{label}</span>
          <button type="button" onClick={onClose} className="text-xs text-[#aaa] hover:text-[#666]">
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
