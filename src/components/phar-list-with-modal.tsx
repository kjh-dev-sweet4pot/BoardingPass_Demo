"use client";

import {
  forwardRef,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ALLOCATION_STATUS_LABEL,
  allocationStatusDisplayLabel,
  type AllocationStatus,
  type AllocationWithRelations,
  type Influencer,
} from "@/lib/types";

type DetailPayload = {
  influencer: Influencer;
  allocations: AllocationWithRelations[];
};

const filterControlClass =
  "h-9 w-full min-w-0 appearance-none rounded-none border border-[var(--line)] bg-white px-2.5 text-xs font-normal normal-case tracking-normal text-[var(--ink)] outline-none transition focus:border-[var(--accent)]";

const filterSelectClass = `${filterControlClass} bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-7`;

const selectChevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M2.5 4.5L6 8L9.5 4.5' stroke='%235d6b63' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

function formatKst(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function CounterDetailPanel({
  item,
  related,
  today,
  onClose,
  onSelectRelated,
}: {
  item: AllocationWithRelations;
  related: AllocationWithRelations[];
  today: string;
  onClose: () => void;
  onSelectRelated: (id: string) => void;
}) {
  const handle = formatIgHandle(item.influencers);
  const name = (item.influencers?.name || "").trim();
  const sns = formatSnsUrl(item.influencers?.sns_url);
  const d = visitDateKey(item);
  const picked = item.status === "picked_up" || Boolean(item.picked_up_at);
  const [relatedOpen, setRelatedOpen] = useState(false);

  useEffect(() => {
    setRelatedOpen(false);
  }, [item.influencer_id]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
            Detail
          </p>
          <h3 className="mt-1.5 text-2xl font-bold tracking-wide text-[var(--ink)]">
            {name || handle || "인플루언서"}
          </h3>
          {name && handle ? (
            <p className="mt-1 text-base font-medium text-[var(--accent)]">
              {handle}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
        >
          닫기
        </button>
      </div>

      <div className="space-y-4 rounded-2xl bg-[var(--accent-soft)]/50 px-5 py-5">
        <div>
          <p className="text-xs tracking-wide text-[var(--muted)]">배정 상품</p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--ink)]">
            {item.products?.name || "상품"}
          </p>
          {item.products?.sku ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              SKU {item.products.sku}
            </p>
          ) : null}
        </div>
        <p className="text-4xl font-semibold tabular-nums text-[var(--accent)]">
          {item.quantity}
          <span className="ml-1.5 text-lg font-medium text-[var(--muted)]">
            개
          </span>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-4">
          <p className="text-base tabular-nums text-[var(--ink)]">
            {d || "날짜 미정"}
            {d === today ? (
              <span className="ml-2 text-sm font-semibold text-[var(--accent)]">
                오늘
              </span>
            ) : null}
          </p>
          <span
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${statusTone(item.status)}`}
          >
            {allocationStatusDisplayLabel(item)}
          </span>
        </div>
        <p
          className={`text-base font-medium ${
            picked ? "text-[#8a7a5c]" : "text-[var(--accent)]"
          }`}
        >
          {picked
            ? `수령 완료${item.picked_up_at ? ` · ${formatKst(item.picked_up_at)}` : ""}`
            : item.status === "cancelled"
              ? "취소된 배정"
              : "아직 수령 확인 전 — 손님 휴대폰 에서 수령 확인 버튼을 눌러주세요 ! "}
        </p>
      </div>

      {sns ? (
        <a
          href={sns}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-14 items-center justify-center rounded-xl bg-[var(--accent)] text-base font-semibold text-white transition hover:brightness-110"
        >
          SNS 프로필 확인
        </a>
      ) : (
        <p className="rounded-xl border border-[var(--line)] px-4 py-3.5 text-center text-base text-[var(--muted)]">
          등록된 SNS 링크가 없습니다
        </p>
      )}

      {item.visit_code ? (
        <p className="text-base text-[var(--muted)]">
          방문 코드{" "}
          <span className="font-semibold tabular-nums text-[var(--ink)]">
            {item.visit_code}
          </span>
        </p>
      ) : null}

      {item.influencers?.notes ? (
        <p className="text-base leading-7 text-[var(--muted)]">
          {item.influencers.notes}
        </p>
      ) : null}

      {related.length > 1 ? (
        <div>
          <button
            type="button"
            aria-expanded={relatedOpen}
            onClick={() => setRelatedOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-left transition hover:bg-[var(--accent-soft)]/40"
          >
            <span className="text-sm font-medium tracking-wide text-[var(--muted)]">
              이 지점 배정 {related.length}건
            </span>
            <span
              className={`text-xs font-semibold text-[var(--accent)] transition ${
                relatedOpen ? "rotate-180" : ""
              }`}
              aria-hidden
            >
              ▾
            </span>
          </button>
          {relatedOpen ? (
            <ul className="mt-2.5 space-y-2.5">
              {related.map((row) => {
                const active = row.id === item.id;
                const rd = visitDateKey(row);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => onSelectRelated(row.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[var(--line)] bg-white hover:bg-[var(--accent-soft)]/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-[var(--ink)]">
                            {row.products?.name || "상품"}
                          </p>
                          <p className="mt-0.5 text-sm tabular-nums text-[var(--muted)]">
                            {rd || "미정"} · {row.quantity}개
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(row.status)}`}
                        >
                          {ALLOCATION_STATUS_LABEL[row.status]}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatIgHandle(
  influencer?: {
    instagram_handle?: string | null;
    instagram_handle_normalized?: string | null;
  } | null,
) {
  const raw =
    influencer?.instagram_handle_normalized ||
    influencer?.instagram_handle ||
    "";
  const normalized = raw.replace(/^@+/, "").trim();
  return normalized ? `@${normalized}` : null;
}

function formatSnsUrl(url?: string | null) {
  const raw = (url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function statusTone(status: AllocationWithRelations["status"]) {
  if (status === "picked_up") {
    return "border-[#c4b79a] bg-[#efe8d8] text-[#5c4f35]";
  }
  if (status === "cancelled") {
    return "border-[var(--line)] bg-[#e8ebe9] text-[var(--muted)]";
  }
  if (status === "visited" || status === "ready") {
    return "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]";
  }
  return "border-[var(--line)] bg-white text-[var(--muted)]";
}

function matchesInfluencerSearch(item: AllocationWithRelations, q: string) {
  if (!q) return true;
  const handle = formatIgHandle(item.influencers) || "";
  const haystack = [
    item.influencers?.name || "",
    handle,
    item.influencers?.instagram_handle || "",
    item.influencers?.instagram_handle_normalized || "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function matchesProductSearch(item: AllocationWithRelations, q: string) {
  if (!q) return true;
  const haystack = [item.products?.name || "", item.products?.sku || ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/** 이름 · 핸들 · 상품 통합 검색 (지점 카운터용) */
function matchesUnifiedSearch(item: AllocationWithRelations, q: string) {
  if (!q) return true;
  const handle = formatIgHandle(item.influencers) || "";
  const haystack = [
    item.influencers?.name || "",
    handle,
    item.influencers?.instagram_handle || "",
    item.influencers?.instagram_handle_normalized || "",
    item.products?.name || "",
    item.products?.sku || "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function todayYmdKst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function visitDateKey(item: AllocationWithRelations) {
  return item.visit_date ? String(item.visit_date).slice(0, 10) : "";
}

/** 과거 → 오늘 → 미래
 * 초기 스크롤은 오늘. 위로=오늘 이전, 아래로=오늘 이후
 * 오늘과 맞닿는 쪽이 가까운 날짜가 되도록 과거·미래 모두 오늘 쪽으로 정렬
 */
function sortByVisitRelativeToToday(items: AllocationWithRelations[]) {
  const today = todayYmdKst();
  return [...items].sort((a, b) => {
    const da = visitDateKey(a);
    const db = visitDateKey(b);
    const rank = (d: string) => {
      if (!d || d < today) return 0; // past / missing
      if (d === today) return 1; // today
      return 2; // future
    };
    const ra = rank(da);
    const rb = rank(db);
    if (ra !== rb) return ra - rb;
    if (da !== db) {
      // past: ascending (old → recent, yesterday just above today)
      // future: ascending (tomorrow just below today → far)
      // today: tie-break by created_at only
      return da.localeCompare(db);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/** 검색 결과: 오늘과 날짜 거리가 가까운 순 (동일 거리면 미래 우선) */
function sortByClosestToToday(items: AllocationWithRelations[]) {
  const today = todayYmdKst();
  const signedDays = (ymd: string) => {
    if (!ymd) return Number.POSITIVE_INFINITY;
    const a = new Date(`${ymd}T12:00:00`);
    const b = new Date(`${today}T12:00:00`);
    return Math.round((a.getTime() - b.getTime()) / 86_400_000);
  };

  return [...items].sort((a, b) => {
    const sa = signedDays(visitDateKey(a));
    const sb = signedDays(visitDateKey(b));
    const absA = Math.abs(sa);
    const absB = Math.abs(sb);
    if (absA !== absB) return absA - absB;
    // 같은 거리: 오늘/미래(+)를 과거(-)보다 먼저
    if (sa >= 0 && sb < 0) return -1;
    if (sb >= 0 && sa < 0) return 1;
    if (sa !== sb) return sa - sb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

const SectionHeaderRow = forwardRef<
  HTMLTableRowElement,
  { label: string; count: number; tone: "accent" | "muted"; colSpan?: number }
>(function SectionHeaderRow({ label, count, tone, colSpan = 7 }, ref) {
  const accent = tone === "accent";
  return (
    <tr
      ref={ref}
      className={
        accent
          ? "border-y border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-y border-[var(--line)] bg-[#eef2f0]"
      }
    >
      <td colSpan={colSpan} className="px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span
            className={`text-xs font-semibold tracking-[0.12em] uppercase ${
              accent ? "text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
          >
            {label}
          </span>
          <span
            className={`text-xs tabular-nums ${
              accent ? "font-semibold text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
          >
            {count}건
          </span>
        </div>
      </td>
    </tr>
  );
});

function AllocationRow({
  item,
  isToday,
  selected,
  hideStore,
  counter,
  onOpen,
}: {
  item: AllocationWithRelations;
  isToday: boolean;
  selected?: boolean;
  hideStore?: boolean;
  /** 지점 카운터: 글자·행 높이 확대 */
  counter?: boolean;
  onOpen: () => void;
}) {
  const handle = formatIgHandle(item.influencers);
  const name = (item.influencers?.name || "").trim();
  const cell = counter ? "px-4 py-4" : "px-4 py-3.5";
  return (
    <tr
      data-alloc-id={item.id}
      className={`cursor-pointer border-b border-[var(--line)] last:border-b-0 transition ${
        selected
          ? "bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent)]/30"
          : isToday
            ? "bg-[var(--accent-soft)]/40 hover:bg-[var(--accent-soft)]/70"
            : "hover:bg-[var(--accent-soft)]/40"
      }`}
      onClick={onOpen}
      aria-selected={selected}
    >
      <td
        className={`${cell} tabular-nums font-medium text-[var(--ink)] ${
          counter ? "text-base" : ""
        }`}
      >
        {item.visit_date || "—"}
        {isToday ? (
          <span
            className={`ml-2 font-semibold tracking-wide text-[var(--accent)] uppercase ${
              counter ? "text-xs" : "text-[10px]"
            }`}
          >
            오늘
          </span>
        ) : null}
      </td>
      <td className={cell}>
        {name ? (
          <span
            className={`block font-semibold text-[var(--ink)] ${
              counter ? "text-base" : ""
            }`}
          >
            {name}
          </span>
        ) : null}
        <span
          className={`font-medium text-[var(--accent)] ${
            counter ? "text-base" : ""
          }`}
        >
          {handle || "—"}
        </span>
      </td>
      <td className={cell}>
        <span
          className={`font-semibold text-[var(--ink)] ${
            counter ? "text-lg" : "text-base"
          }`}
        >
          {item.products?.name || "상품"}
        </span>
        {item.products?.sku ? (
          <span
            className={`mt-0.5 block text-[var(--muted)] ${
              counter ? "text-sm" : "text-xs"
            }`}
          >
            SKU {item.products.sku}
          </span>
        ) : null}
      </td>
      {!hideStore ? (
        <td className={`${cell} text-[var(--muted)]`}>
          {item.stores?.name || "매장"}
        </td>
      ) : null}
      <td
        className={`${cell} text-right font-semibold tabular-nums text-[var(--accent)] ${
          counter ? "text-lg" : "text-base"
        }`}
      >
        {item.quantity}
        <span
          className={`ml-0.5 font-medium text-[var(--muted)] ${
            counter ? "text-sm" : "text-xs"
          }`}
        >
          개
        </span>
      </td>
      <td className={cell}>
        <span
          className={`inline-block border font-medium ${statusTone(item.status)} ${
            counter
              ? "px-3 py-1.5 text-sm"
              : "px-2.5 py-1 text-xs"
          }`}
        >
          {allocationStatusDisplayLabel(item)}
        </span>
      </td>
      {!hideStore ? (
        <td className={`${cell} text-right text-xs text-[var(--accent)]`}>
          보기 →
        </td>
      ) : null}
    </tr>
  );
}

export function PharListWithModal({
  items,
  fillHeight = false,
  lockedStoreId,
}: {
  items: AllocationWithRelations[];
  /** 부모 높이에 맞춰 목록만 내부 스크롤 (운영 콘솔 등) */
  fillHeight?: boolean;
  /** 지점 로그인 시 매장 필터 숨김 (서버에서 이미 해당 지점만 전달) */
  lockedStoreId?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [influencerQ, setInfluencerQ] = useState("");
  const [productQ, setProductQ] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [storeId, setStoreId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [status, setStatus] = useState("");
  /** 지점(phar)은 기본 오늘만, Admin 전체 목록은 기본 전체 */
  const [todayOnly, setTodayOnly] = useState(() => Boolean(lockedStoreId));
  /** 지점 PC: 기본 미수령만 */
  const [hidePickedUp, setHidePickedUp] = useState(() => Boolean(lockedStoreId));
  /** 지점 PC: 우측 패널용 선택 (allocation id) */
  const [selectedAllocId, setSelectedAllocId] = useState<string | null>(null);
  /** 지점 카운터: INF 수령 등 원격 변경을 반영하기 위한 목록 */
  const [liveItems, setLiveItems] = useState(items);
  /** 카운터 상단 현황: 오늘 / 이번달 / 전체 */
  const [statsPeriod, setStatsPeriod] = useState<"today" | "month" | "all">(
    "today",
  );
  /** 카운터 영역만 브라우저 전체화면 (AppShell 헤더 제외) */
  const [isFullscreen, setIsFullscreen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const counterRootRef = useRef<HTMLDivElement>(null);
  const storeFilterId = lockedStoreId || storeId;
  /** 지점 로그인: 통합 검색 + 상태만 */
  const simpleFilters = Boolean(lockedStoreId);

  useEffect(() => {
    if (!simpleFilters) return;
    function onFsChange() {
      setIsFullscreen(document.fullscreenElement === counterRootRef.current);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [simpleFilters]);

  async function toggleCounterFullscreen() {
    const el = counterRootRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // 브라우저 정책·미지원 시 무시
    }
  }

  useEffect(() => {
    setLiveItems(items);
  }, [items]);

  /** 약사 카운터: 수령/방문 상태 변경을 수 초 내 반영 */
  useEffect(() => {
    if (!lockedStoreId) return;

    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch("/api/phar/allocations", {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          allocations?: AllocationWithRelations[];
        };
        if (!cancelled && Array.isArray(data.allocations)) {
          setLiveItems((prev) => {
            // 내용이 같으면 참조 유지 → 스크롤/선택 상태 보존
            if (
              prev.length === data.allocations!.length &&
              prev.every((row, i) => {
                const next = data.allocations![i];
                return (
                  row.id === next.id &&
                  row.status === next.status &&
                  row.updated_at === next.updated_at &&
                  row.picked_up_at === next.picked_up_at &&
                  row.verified_at === next.verified_at
                );
              })
            ) {
              return prev;
            }
            return data.allocations!;
          });
        }
      } catch {
        // 네트워크 오류 시 다음 주기에 재시도
      }
    }

    void refresh();
    const timer = window.setInterval(refresh, 2500);

    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [lockedStoreId]);

  const deferredInfluencerQ = useDeferredValue(
    influencerQ.trim().toLowerCase(),
  );
  const deferredProductQ = useDeferredValue(productQ.trim().toLowerCase());
  const deferredSearchQ = useDeferredValue(searchQ.trim().toLowerCase());

  const storeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of liveItems) {
      if (item.store_id && item.stores?.name) {
        map.set(item.store_id, item.stores.name);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [liveItems]);

  const quantityOptions = useMemo(() => {
    const set = new Set<number>();
    for (const item of liveItems) set.add(item.quantity);
    return [...set].sort((a, b) => a - b);
  }, [liveItems]);

  const statusOptions = useMemo(() => {
    const set = new Set<AllocationStatus>();
    for (const item of liveItems) set.add(item.status);
    return [...set].sort((a, b) =>
      ALLOCATION_STATUS_LABEL[a].localeCompare(
        ALLOCATION_STATUS_LABEL[b],
        "ko",
      ),
    );
  }, [liveItems]);

  const filtered = useMemo(() => {
    const next = liveItems.filter((item) => {
      if (storeFilterId && item.store_id !== storeFilterId) return false;
      if (status && item.status !== status) return false;

      if (simpleFilters) {
        if (!matchesUnifiedSearch(item, deferredSearchQ)) return false;
        if (hidePickedUp && item.status === "picked_up") return false;
        return true;
      }

      if (!matchesInfluencerSearch(item, deferredInfluencerQ)) return false;
      if (!matchesProductSearch(item, deferredProductQ)) return false;
      if (quantity && String(item.quantity) !== quantity) return false;
      if (visitDate && (item.visit_date || "") !== visitDate) return false;
      return true;
    });

    return sortByVisitRelativeToToday(next);
  }, [
    liveItems,
    simpleFilters,
    deferredSearchQ,
    deferredInfluencerQ,
    deferredProductQ,
    storeFilterId,
    quantity,
    visitDate,
    status,
    hidePickedUp,
  ]);

  const today = todayYmdKst();
  const monthKey = today.slice(0, 7); // YYYY-MM
  const isSearching = Boolean(deferredSearchQ);

  const periodStats = useMemo(() => {
    let total = 0;
    let scheduled = 0; // 방문예정
    let visited = 0; // 방문완료 (매장 방문 완료)
    let pickedUp = 0; // 반출완료 (수령 완료)
    for (const item of liveItems) {
      if (storeFilterId && item.store_id !== storeFilterId) continue;
      const d = visitDateKey(item);
      if (statsPeriod === "today") {
        if (d !== today) continue;
      } else if (statsPeriod === "month") {
        if (!d || !d.startsWith(monthKey)) continue;
      }
      // all: 날짜 제한 없음
      if (item.status === "cancelled") continue;
      total += 1;
      if (item.status === "picked_up") pickedUp += 1;
      else if (item.status === "visited") visited += 1;
      else scheduled += 1; // pending, ready 등
    }
    return { total, scheduled, visited, pickedUp };
  }, [liveItems, storeFilterId, today, monthKey, statsPeriod]);

  const statsPeriodLabel =
    statsPeriod === "today"
      ? "오늘 현황"
      : statsPeriod === "month"
        ? "이번달 현황"
        : "전체 현황";

  const statsTotalHint =
    statsPeriod === "today"
      ? "오늘 방문 합계"
      : statsPeriod === "month"
        ? `${Number(monthKey.slice(5))}월 방문 합계`
        : "전체 방문 합계";

  const { pastItems, todayItems, futureItems } = useMemo(() => {
    const past: AllocationWithRelations[] = [];
    const todayList: AllocationWithRelations[] = [];
    const future: AllocationWithRelations[] = [];
    for (const item of filtered) {
      const d = visitDateKey(item);
      if (d && d === today) todayList.push(item);
      else if (d && d > today) future.push(item);
      else past.push(item);
    }
    return { pastItems: past, todayItems: todayList, futureItems: future };
  }, [filtered, today]);

  const listScrollRef = useRef<HTMLDivElement>(null);
  const todaySectionRef = useRef<HTMLTableRowElement>(null);
  /** 폴링 갱신마다 오늘로 튕기지 않도록, '전체 날짜' 진입 시 1회만 자동 스크롤 */
  const didAutoScrollToTodayRef = useRef(false);

  function scrollToTodaySection() {
    const container = listScrollRef.current;
    const row = todaySectionRef.current;
    if (!container || !row) return;
    const thead = container.querySelector("thead");
    const headerH = thead instanceof HTMLElement ? thead.offsetHeight : 0;
    const containerRect = container.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    container.scrollTop = Math.max(
      0,
      container.scrollTop + (rowRect.top - containerRect.top) - headerH,
    );
  }

  useEffect(() => {
    if (todayOnly) {
      didAutoScrollToTodayRef.current = false;
      return;
    }
    if (didAutoScrollToTodayRef.current) return;
    if (todayItems.length === 0) return;

    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (cancelled) return;
        scrollToTodaySection();
        didAutoScrollToTodayRef.current = true;
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [todayOnly, todayItems.length]);

  const hasFilters = simpleFilters
    ? Boolean(searchQ.trim()) || Boolean(status)
    : Boolean(influencerQ.trim()) ||
      Boolean(productQ.trim()) ||
      (!lockedStoreId && Boolean(storeId)) ||
      Boolean(quantity) ||
      Boolean(visitDate) ||
      Boolean(status);

  const selectedItem = useMemo(
    () => liveItems.find((i) => i.id === selectedAllocId) || null,
    [liveItems, selectedAllocId],
  );

  const relatedItems = useMemo(() => {
    if (!selectedItem?.influencer_id) return [];
    return liveItems
      .filter((i) => i.influencer_id === selectedItem.influencer_id)
      .sort((a, b) => {
        const da = visitDateKey(a);
        const db = visitDateKey(b);
        if (da !== db) return db.localeCompare(da);
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
  }, [liveItems, selectedItem]);

  const visibleRows = useMemo(() => {
    // 검색 중에는 오늘만 보기를 무시하고 전체 섹션(과거·오늘·미래) 노출
    if (simpleFilters && isSearching) {
      return [...pastItems, ...todayItems, ...futureItems];
    }
    if (todayOnly) return todayItems;
    return [...pastItems, ...todayItems, ...futureItems];
  }, [
    simpleFilters,
    isSearching,
    todayOnly,
    pastItems,
    todayItems,
    futureItems,
  ]);

  useEffect(() => {
    if (!simpleFilters) return;
    searchInputRef.current?.focus();
  }, [simpleFilters]);

  /** 검색 시 오늘에 가장 가까운 결과를 바로 선택 (목록 정렬은 기존 유지) */
  useEffect(() => {
    if (!simpleFilters || !isSearching) return;
    if (filtered.length === 0) {
      setSelectedAllocId(null);
      return;
    }
    const closest = sortByClosestToToday(filtered)[0];
    setSelectedAllocId((prev) =>
      prev && filtered.some((row) => row.id === prev) ? prev : closest.id,
    );
    // 오늘 구간이 보이도록 스크롤 (있으면)
    requestAnimationFrame(() => scrollToTodaySection());
  }, [simpleFilters, isSearching, filtered]);

  /** 키보드/검색 선택 시 해당 행이 보이도록 스크롤 (가장자리 잘림 방지: 한 칸 여유) */
  useEffect(() => {
    if (!simpleFilters || !selectedAllocId) return;
    const container = listScrollRef.current;
    if (!container) return;
    const row = container.querySelector(
      `[data-alloc-id="${CSS.escape(selectedAllocId)}"]`,
    );
    if (!(row instanceof HTMLElement)) return;

    const pad = row.offsetHeight;
    const thead = container.querySelector("thead");
    const headerH =
      thead instanceof HTMLElement ? thead.offsetHeight : 0;
    const cRect = container.getBoundingClientRect();
    const rRect = row.getBoundingClientRect();
    // 아래로 갈 때 아래쪽에, 위로 갈 때 위쪽(헤더 아래)에 한 칸 여유
    const topLimit = cRect.top + headerH + pad;
    const bottomLimit = cRect.bottom - pad;

    if (rRect.bottom > bottomLimit) {
      container.scrollBy({
        top: rRect.bottom - bottomLimit,
        behavior: "smooth",
      });
    } else if (rRect.top < topLimit) {
      container.scrollBy({
        top: rRect.top - topLimit,
        behavior: "smooth",
      });
    }
  }, [simpleFilters, selectedAllocId]);

  useEffect(() => {
    if (!simpleFilters) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inField = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";

      if (e.key === "Escape") {
        if (selectedAllocId) {
          setSelectedAllocId(null);
          e.preventDefault();
          return;
        }
        if (searchQ) {
          setSearchQ("");
          e.preventDefault();
        }
        return;
      }

      if (e.key === "Enter" && inField && tag === "INPUT") {
        if (visibleRows.length === 0) return;
        const first =
          isSearching && filtered.length > 0
            ? sortByClosestToToday(filtered)[0]
            : visibleRows[0];
        if (first) {
          setSelectedAllocId(first.id);
          e.preventDefault();
        }
        return;
      }

      if (inField) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (visibleRows.length === 0) return;
        const idx = visibleRows.findIndex((r) => r.id === selectedAllocId);
        const nextIdx =
          e.key === "ArrowDown"
            ? Math.min(idx < 0 ? 0 : idx + 1, visibleRows.length - 1)
            : Math.max(idx < 0 ? 0 : idx - 1, 0);
        setSelectedAllocId(visibleRows[nextIdx].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [simpleFilters, selectedAllocId, searchQ, visibleRows, isSearching, filtered]);

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/phar/influencer/${openId}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "불러오기 실패");
        if (!cancelled) setDetail(body as DetailPayload);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "불러오기 실패");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [openId]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openId]);

  function clearFilters() {
    setInfluencerQ("");
    setProductQ("");
    setSearchQ("");
    setStoreId("");
    setQuantity("");
    setVisitDate("");
    setStatus("");
    if (simpleFilters) setHidePickedUp(true);
  }

  function selectRow(item: AllocationWithRelations) {
    if (simpleFilters) {
      setSelectedAllocId(item.id);
      return;
    }
    setOpenId(item.influencer_id);
  }

  const colSpan = simpleFilters ? 5 : 7;

  /* ── 지점 PC 카운터: 검색 + 좌목록 + 우상세 ── */
  if (simpleFilters) {
    return (
      <div
        ref={counterRootRef}
        className={`${
          fillHeight || isFullscreen ? "flex min-h-0 flex-1 flex-col" : ""
        } ${
          isFullscreen
            ? "h-dvh bg-[var(--background)] px-4 py-3 sm:px-6"
            : ""
        }`}
      >
        <div className="mb-3 shrink-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex items-baseline gap-2">
                <p className="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
                  Counter
                </p>
                <p className="text-base font-semibold tracking-wide text-[var(--ink)]">
                  {statsPeriodLabel}
                </p>
              </div>
              <div
                className="flex rounded-full border border-[var(--line)] bg-white p-0.5"
                role="group"
                aria-label="현황 기간"
              >
                {(
                  [
                    ["today", "오늘"],
                    ["month", "이번달"],
                    ["all", "전체"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={statsPeriod === value}
                    onClick={() => setStatsPeriod(value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      statsPeriod === value
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex rounded-full border border-[var(--line)] bg-white p-0.5"
                role="group"
                aria-label="목록 범위"
              >
                <button
                  type="button"
                  aria-pressed={todayOnly}
                  onClick={() => {
                    setTodayOnly(true);
                    setVisitDate("");
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    todayOnly
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  오늘만
                </button>
                <button
                  type="button"
                  aria-pressed={!todayOnly}
                  onClick={() => setTodayOnly(false)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    !todayOnly
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  전체 날짜
                </button>
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)]">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                  checked={hidePickedUp}
                  onChange={(e) => setHidePickedUp(e.target.checked)}
                />
                미수령만
              </label>
              {!todayOnly ? (
                <button
                  type="button"
                  className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                  onClick={scrollToTodaySection}
                >
                  오늘로 이동
                </button>
              ) : null}
              <button
                type="button"
                aria-pressed={isFullscreen}
                className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-[var(--accent-soft)]"
                onClick={() => void toggleCounterFullscreen()}
              >
                {isFullscreen ? "전체화면 종료" : "전체화면"}
              </button>
            </div>
          </div>

          <div
            className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-sm"
            role="group"
            aria-label={statsPeriodLabel}
          >
            <div className="grid grid-cols-2 divide-x divide-y divide-[var(--line)] sm:grid-cols-4 sm:divide-y-0">
              <div className="relative bg-[var(--accent-soft)]/55 px-4 py-2.5 sm:px-5 sm:py-3">
                <div className="absolute inset-y-2 left-0 w-1 rounded-full bg-[var(--accent)]" />
                <p className="text-xs font-medium tracking-wide text-[var(--muted)]">
                  {statsPeriod === "today"
                    ? "오늘"
                    : statsPeriod === "month"
                      ? "이번달"
                      : "전체"}
                </p>
                <p className="mt-0.5 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tabular-nums tracking-tight text-[var(--accent)]">
                    {periodStats.total}
                  </span>
                  <span className="text-sm font-medium text-[var(--muted)]">
                    건
                  </span>
                </p>
                <p className="text-[11px] leading-tight text-[var(--muted)]">
                  {statsTotalHint}
                </p>
              </div>

              <div className="px-4 py-2.5 sm:px-5 sm:py-3">
                <p className="text-xs font-medium tracking-wide text-[var(--muted)]">
                  방문예정
                </p>
                <p className="mt-0.5 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tabular-nums tracking-tight text-[var(--ink)]">
                    {periodStats.scheduled}
                  </span>
                  <span className="text-sm font-medium text-[var(--muted)]">
                    건
                  </span>
                </p>
                <p className="text-[11px] leading-tight text-[var(--muted)]">
                  아직 미방문
                </p>
              </div>

              <div className="px-4 py-2.5 sm:px-5 sm:py-3">
                <p className="text-xs font-medium tracking-wide text-[var(--muted)]">
                  방문완료
                </p>
                <p className="mt-0.5 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tabular-nums tracking-tight text-[var(--ink)]">
                    {periodStats.visited}
                  </span>
                  <span className="text-sm font-medium text-[var(--muted)]">
                    건
                  </span>
                </p>
                <p className="text-[11px] leading-tight text-[var(--muted)]">
                  매장 방문 완료
                </p>
              </div>

              <div className="px-4 py-2.5 sm:px-5 sm:py-3">
                <p className="text-xs font-medium tracking-wide text-[var(--muted)]">
                  반출완료
                </p>
                <p className="mt-0.5 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tabular-nums tracking-tight text-[var(--accent)]">
                    {periodStats.pickedUp}
                  </span>
                  <span className="text-sm font-medium text-[var(--muted)]">
                    건
                  </span>
                </p>
                <p className="text-[11px] leading-tight text-[var(--muted)]">
                  수령 완료
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 flex w-full shrink-0 items-stretch gap-2.5">
          <input
            ref={searchInputRef}
            id="phar-unified-search"
            className="h-16 min-w-0 flex-1 basis-0 rounded-2xl border border-[var(--line)] bg-white px-5 text-xl text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
            type="search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="이름 · @핸들 · 상품 검색"
            aria-label="이름, 핸들, 상품 검색"
            autoComplete="off"
          />
          <select
            className="h-16 w-48 shrink-0 appearance-none rounded-2xl border border-[var(--line)] bg-white bg-[length:12px] bg-[right_14px_center] bg-no-repeat px-4 pr-10 text-base text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
            style={{ backgroundImage: selectChevron }}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="상태 필터"
          >
            <option value="">상태 전체</option>
            {statusOptions.map((value) => (
              <option key={value} value={value}>
                {ALLOCATION_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
          {hasFilters ? (
            <button
              type="button"
              className="shrink-0 self-center px-2 text-sm text-[var(--accent)] hover:underline"
              onClick={clearFilters}
            >
              초기화
            </button>
          ) : null}
        </div>

        {liveItems.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">배정이 없습니다.</p>
        ) : (
          <div
            className={`grid min-h-0 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.95fr)] ${
              fillHeight ? "flex-1" : ""
            }`}
          >
            <div
              ref={listScrollRef}
              className={`overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm ${
                fillHeight
                  ? "min-h-0"
                  : "max-h-[min(70vh,calc(100vh-14rem))]"
              }`}
            >
              <table className="w-full border-collapse text-left text-base">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-[var(--line)] bg-[var(--accent-soft)] text-sm tracking-[0.08em] text-[var(--muted)] uppercase">
                    <th className="px-4 py-3.5 font-medium">방문일</th>
                    <th className="px-4 py-3.5 font-medium">계정</th>
                    <th className="px-4 py-3.5 font-medium">상품</th>
                    <th className="px-4 py-3.5 font-medium text-right">수량</th>
                    <th className="px-4 py-3.5 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={colSpan}
                        className="px-4 py-8 text-center text-sm text-[var(--muted)]"
                      >
                        조건에 맞는 배정이 없습니다.
                      </td>
                    </tr>
                  ) : todayOnly && !isSearching ? (
                    <>
                      <SectionHeaderRow
                        ref={todaySectionRef}
                        label={`오늘 · ${today}`}
                        count={todayItems.length}
                        tone="accent"
                        colSpan={colSpan}
                      />
                      {todayItems.length === 0 ? (
                        <tr className="border-b border-[var(--line)] bg-[var(--accent-soft)]/20">
                          <td
                            colSpan={colSpan}
                            className="px-4 py-6 text-center text-sm text-[var(--muted)]"
                          >
                            {hidePickedUp
                              ? "오늘 미수령 방문이 없습니다."
                              : "오늘 방문인이 없습니다."}
                            <button
                              type="button"
                              className="mt-2 block w-full text-xs font-medium text-[var(--accent)] hover:underline"
                              onClick={() => {
                                if (hidePickedUp) setHidePickedUp(false);
                                else setTodayOnly(false);
                              }}
                            >
                              {hidePickedUp
                                ? "완료 포함해 보기"
                                : "전체 날짜 보기"}
                            </button>
                          </td>
                        </tr>
                      ) : (
                        todayItems.map((item) => (
                          <AllocationRow
                            key={item.id}
                            item={item}
                            isToday
                            hideStore
                            counter
                            selected={item.id === selectedAllocId}
                            onOpen={() => selectRow(item)}
                          />
                        ))
                      )}
                    </>
                  ) : (
                    <>
                      {pastItems.length > 0 && (
                        <SectionHeaderRow
                          label="오늘 이전"
                          count={pastItems.length}
                          tone="muted"
                          colSpan={colSpan}
                        />
                      )}
                      {pastItems.map((item) => (
                        <AllocationRow
                          key={item.id}
                          item={item}
                          isToday={false}
                          hideStore
                          selected={item.id === selectedAllocId}
                          counter
                          onOpen={() => selectRow(item)}
                        />
                      ))}
                      <SectionHeaderRow
                        ref={todaySectionRef}
                        label={`오늘 · ${today}`}
                        count={todayItems.length}
                        tone="accent"
                        colSpan={colSpan}
                      />
                      {todayItems.length === 0 ? (
                        <tr className="border-b border-[var(--line)] bg-[var(--accent-soft)]/20">
                          <td
                            colSpan={colSpan}
                            className="px-4 py-6 text-center text-sm text-[var(--muted)]"
                          >
                            오늘 방문인이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        todayItems.map((item) => (
                          <AllocationRow
                            key={item.id}
                            item={item}
                            isToday
                            hideStore
                            counter
                            selected={item.id === selectedAllocId}
                            onOpen={() => selectRow(item)}
                          />
                        ))
                      )}
                      {futureItems.length > 0 && (
                        <SectionHeaderRow
                          label="오늘 이후"
                          count={futureItems.length}
                          tone="muted"
                          colSpan={colSpan}
                        />
                      )}
                      {futureItems.map((item) => (
                        <AllocationRow
                          key={item.id}
                          item={item}
                          isToday={false}
                          hideStore
                          selected={item.id === selectedAllocId}
                          counter
                          onOpen={() => selectRow(item)}
                        />
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            <aside
              className={`overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm ${
                fillHeight ? "min-h-0" : "max-h-[min(70vh,calc(100vh-14rem))]"
              }`}
            >
              {selectedItem ? (
                <CounterDetailPanel
                  item={selectedItem}
                  related={relatedItems}
                  today={today}
                  onClose={() => setSelectedAllocId(null)}
                  onSelectRelated={(id) => setSelectedAllocId(id)}
                />
              ) : (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
                  <p className="text-base font-medium text-[var(--ink)]">
                    행을 선택하면 상세가 여기에 표시됩니다
                  </p>
                  <p className="mt-2 text-sm leading-5 text-[var(--muted)]">
                    검색 후 Enter · ↑/↓ 이동 · Esc 선택 해제
                  </p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={fillHeight ? "flex min-h-0 flex-1 flex-col" : ""}>
      <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-[var(--muted)] uppercase">
            {todayOnly ? "Today" : "All visits"}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-wide text-[var(--accent)] sm:text-3xl">
            오늘 {todayItems.length}
            <span className="ml-1 text-base font-medium text-[var(--muted)]">
              건
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {hasFilters
              ? `필터 적용 ${todayOnly ? todayItems.length : filtered.length}건 / 전체 ${liveItems.length}건`
              : todayOnly
                ? `전체 ${liveItems.length}건 중 오늘만 표시`
                : `전체 ${filtered.length}건`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-full border border-[var(--line)] bg-white p-0.5"
            role="group"
            aria-label="목록 범위"
          >
            <button
              type="button"
              aria-pressed={todayOnly}
              onClick={() => {
                setTodayOnly(true);
                setVisitDate("");
              }}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                todayOnly
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              오늘만 보기
            </button>
            <button
              type="button"
              aria-pressed={!todayOnly}
              onClick={() => setTodayOnly(false)}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                !todayOnly
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              전체
            </button>
          </div>
          {!todayOnly ? (
            <button
              type="button"
              className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
              onClick={scrollToTodaySection}
            >
              오늘로 이동
            </button>
          ) : null}
          {hasFilters ? (
            <button
              type="button"
              className="text-xs text-[var(--accent)] hover:underline"
              onClick={clearFilters}
            >
              필터 초기화
            </button>
          ) : null}
        </div>
      </div>

      {liveItems.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">배정이 없습니다.</p>
      ) : (
        <div
          ref={listScrollRef}
          className={`overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm ${
            fillHeight
              ? "min-h-0 flex-1"
              : "max-h-[min(70vh,calc(100vh-14rem))]"
          }`}
        >
          <table className="w-full min-w-[780px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[var(--line)] bg-[var(--accent-soft)] text-xs tracking-[0.08em] text-[var(--muted)] uppercase">
                <th className="px-4 py-3 font-medium">방문일</th>
                <th className="px-4 py-3 font-medium">계정</th>
                <th className="px-4 py-3 font-medium">상품</th>
                <th className="px-4 py-3 font-medium">매장</th>
                <th className="px-4 py-3 font-medium text-right">수량</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium text-right">상세</th>
              </tr>
              <tr className="border-b border-[var(--line)] bg-[var(--surface)]">
                <th className="px-2 py-2 font-normal">
                  <input
                    className={filterControlClass}
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    aria-label="방문일 필터"
                    disabled={todayOnly}
                  />
                </th>
                <th className="px-2 py-2 font-normal">
                  <input
                    className={filterControlClass}
                    type="search"
                    value={influencerQ}
                    onChange={(e) => setInfluencerQ(e.target.value)}
                    placeholder="계정"
                    aria-label="계정 검색"
                  />
                </th>
                <th className="px-2 py-2 font-normal">
                  <input
                    className={filterControlClass}
                    type="search"
                    value={productQ}
                    onChange={(e) => setProductQ(e.target.value)}
                    placeholder="상품"
                    aria-label="상품 검색"
                  />
                </th>
                <th className="px-2 py-2 font-normal">
                  <select
                    className={filterSelectClass}
                    style={{ backgroundImage: selectChevron }}
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    aria-label="매장 필터"
                  >
                    <option value="">매장 전체</option>
                    {storeOptions.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-2 py-2 font-normal">
                  <select
                    className={filterSelectClass}
                    style={{ backgroundImage: selectChevron }}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    aria-label="수량 필터"
                  >
                    <option value="">수량 전체</option>
                    {quantityOptions.map((qty) => (
                      <option key={qty} value={qty}>
                        {qty}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-2 py-2 font-normal">
                  <select
                    className={filterSelectClass}
                    style={{ backgroundImage: selectChevron }}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    aria-label="상태 필터"
                  >
                    <option value="">상태 전체</option>
                    {statusOptions.map((value) => (
                      <option key={value} value={value}>
                        {ALLOCATION_STATUS_LABEL[value]}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-[var(--muted)]"
                  >
                    조건에 맞는 배정이 없습니다.
                  </td>
                </tr>
              ) : todayOnly ? (
                <>
                  <SectionHeaderRow
                    ref={todaySectionRef}
                    label={`오늘 · ${today}`}
                    count={todayItems.length}
                    tone="accent"
                  />
                  {todayItems.length === 0 ? (
                    <tr className="border-b border-[var(--line)] bg-[var(--accent-soft)]/20">
                      <td
                        colSpan={7}
                        className="px-4 py-6 text-center text-sm text-[var(--muted)]"
                      >
                        오늘 방문인이 없습니다.
                        <button
                          type="button"
                          className="mt-2 block w-full text-xs font-medium text-[var(--accent)] hover:underline"
                          onClick={() => setTodayOnly(false)}
                        >
                          전체 목록 보기
                        </button>
                      </td>
                    </tr>
                  ) : (
                    todayItems.map((item) => (
                      <AllocationRow
                        key={item.id}
                        item={item}
                        isToday
                        onOpen={() => selectRow(item)}
                      />
                    ))
                  )}
                </>
              ) : (
                <>
                  {pastItems.length > 0 && (
                    <SectionHeaderRow
                      label="오늘 이전"
                      count={pastItems.length}
                      tone="muted"
                    />
                  )}
                  {pastItems.map((item) => (
                    <AllocationRow
                      key={item.id}
                      item={item}
                      isToday={false}
                      onOpen={() => selectRow(item)}
                    />
                  ))}

                  <SectionHeaderRow
                    ref={todaySectionRef}
                    label={`오늘 · ${today}`}
                    count={todayItems.length}
                    tone="accent"
                  />
                  {todayItems.length === 0 ? (
                    <tr className="border-b border-[var(--line)] bg-[var(--accent-soft)]/20">
                      <td
                        colSpan={7}
                        className="px-4 py-6 text-center text-sm text-[var(--muted)]"
                      >
                        오늘 방문인이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    todayItems.map((item) => (
                      <AllocationRow
                        key={item.id}
                        item={item}
                        isToday
                        onOpen={() => selectRow(item)}
                      />
                    ))
                  )}

                  {futureItems.length > 0 && (
                    <SectionHeaderRow
                      label="오늘 이후"
                      count={futureItems.length}
                      tone="muted"
                    />
                  )}
                  {futureItems.map((item) => (
                    <AllocationRow
                      key={item.id}
                      item={item}
                      isToday={false}
                      onOpen={() => selectRow(item)}
                    />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {openId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="인플루언서 상세"
          onClick={() => setOpenId(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.2em] text-[var(--accent)] uppercase">
                  Influencer
                </p>
                <h2
                  className="mt-1 text-2xl text-[var(--ink)]"
                  style={{ fontFamily: "var(--font-display), serif" }}
                >
                  {detail
                    ? formatIgHandle(detail.influencer) || "핸들 없음"
                    : "불러오는 중…"}
                </h2>
                {detail && formatSnsUrl(detail.influencer.sns_url) && (
                  <a
                    href={formatSnsUrl(detail.influencer.sns_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--accent)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {formatSnsUrl(detail.influencer.sns_url)}
                  </a>
                )}
              </div>
              <button
                type="button"
                className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
                onClick={() => setOpenId(null)}
              >
                닫기
              </button>
            </div>

            {loading && (
              <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
            )}
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

            {detail && !loading && (
              <div className="space-y-6">
                {detail.influencer.notes && (
                  <p className="text-sm leading-6 text-[var(--muted)]">
                    {detail.influencer.notes}
                  </p>
                )}

                <dl className="grid gap-4 border border-[var(--line)] bg-white/50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs text-[var(--muted)]">SNS 핸들</dt>
                    <dd className="mt-1 text-sm font-medium">
                      {formatIgHandle(detail.influencer) || "등록된 핸들 없음"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">SNS URL</dt>
                    <dd className="mt-1 text-sm font-medium break-all">
                      {formatSnsUrl(detail.influencer.sns_url) ? (
                        <a
                          href={formatSnsUrl(detail.influencer.sns_url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--accent)] underline underline-offset-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          프로필 열기
                        </a>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">등록일</dt>
                    <dd className="mt-1 text-sm">
                      {formatKst(detail.influencer.created_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">배정 건수</dt>
                    <dd className="mt-1 text-sm">
                      {detail.allocations.length}건
                    </dd>
                  </div>
                </dl>

                <div>
                  <h3
                    className="mb-3 text-lg"
                    style={{ fontFamily: "var(--font-display), serif" }}
                  >
                    수령 배정
                  </h3>
                  {detail.allocations.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                      배정된 상품이 없습니다.
                    </p>
                  ) : (
                    <div className="overflow-x-auto border border-[var(--line)]">
                      <table className="min-w-[640px] w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-[var(--line)] bg-[var(--accent-soft)]/40 text-xs text-[var(--muted)]">
                            <th className="px-3 py-2 font-medium">상품</th>
                            <th className="px-3 py-2 font-medium">매장</th>
                            <th className="px-3 py-2 font-medium text-right">
                              수량
                            </th>
                            <th className="px-3 py-2 font-medium">방문일</th>
                            <th className="px-3 py-2 font-medium">상태</th>
                            <th className="px-3 py-2 font-medium">수령</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.allocations.map((item) => (
                            <tr
                              key={item.id}
                              className="border-b border-[var(--line)] last:border-b-0"
                            >
                              <td className="px-3 py-2.5">
                                <span className="font-medium">
                                  {item.products?.name || "상품"}
                                </span>
                                {item.products?.sku ? (
                                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                                    SKU {item.products.sku}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 text-[var(--muted)]">
                                {item.stores?.name || "매장"}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {item.quantity}
                              </td>
                              <td className="px-3 py-2.5 tabular-nums text-[var(--muted)]">
                                {item.visit_date || "—"}
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`inline-block border px-2 py-0.5 text-xs font-medium ${statusTone(item.status)}`}
                                >
                                  {allocationStatusDisplayLabel(item)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-[var(--muted)]">
                                {item.picked_up_at
                                  ? formatKst(item.picked_up_at)
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
