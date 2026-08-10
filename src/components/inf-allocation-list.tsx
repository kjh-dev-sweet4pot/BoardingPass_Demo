"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useInfLocale } from "@/components/inf-locale-provider";
import {
  bilingualSheetText,
  formatVisitDateKo,
  formatVisitDateLocalized,
  formatVisitDayOfWeekKo,
  formatVisitWeekdayLocalized,
  INF_MESSAGES,
  localizeStoreName,
  translateInfApiError,
  type InfMessages,
} from "@/lib/inf-i18n";
import {
  type AllocationWithRelations,
  type Influencer,
  type Store,
} from "@/lib/types";

const SheetCloseContext = createContext<(() => void) | null>(null);

function useSheetClose() {
  const close = useContext(SheetCloseContext);
  if (!close) {
    throw new Error("useSheetClose must be used within BottomSheet");
  }
  return close;
}

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

function formatStoreName(
  store?: { name?: string | null; address?: string | null } | null,
  fallback = "매장",
) {
  const name = (store?.name || fallback).trim();
  const address = (store?.address || "").trim();
  if (address) {
    const stripped = name
      .replace(address, "")
      .trim()
      .replace(/[·,\s/-]+$/g, "")
      .trim();
    if (stripped) return stripped;
  }
  const afterBranch = name.match(/^(.+점)\s+.+/);
  if (afterBranch) return afterBranch[1];
  return name;
}

function formatIgHandle(influencer: Influencer) {
  const raw =
    influencer.instagram_handle_normalized || influencer.instagram_handle || "";
  return raw.replace(/^@+/, "").trim()
    ? `@${raw.replace(/^@+/, "").trim()}`
    : "—";
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
      if (isPickedUp(i)) return 0; // 반출완료 최상단
      if (i.status === "visited" || i.status === "ready") return 1; // 방문완료
      if (i.status === "cancelled") return 3;
      return 2; // 대기(pending 등)
    };
    const d = rank(a) - rank(b);
    return d !== 0
      ? d
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

type Step = "review" | "confirm";

/* ─── 개별 할당 카드 ─────────────────────────────────── */
function AllocationCard({
  item,
  onOpen,
  t,
  locale,
}: {
  item: AllocationWithRelations;
  onOpen: (item: AllocationWithRelations) => void;
  t: InfMessages;
  locale: "ko" | "en" | "ja" | "zh";
}) {
  const done = isPickedUp(item);
  const isCancelled = item.status === "cancelled";
  const today = isVisitToday(item);
  /** 오늘 수령 가능 — 브랜드 웜톤 / 그 외는 스톤 톤으로 구분 */
  const isTodayPickup = today && !done && !isCancelled;
  const visitYmd = visitDateYmd(item);
  const storeNameKo = formatStoreName(item.stores, INF_MESSAGES.ko.storeFallback);
  const storeName = bilingualSheetText(
    locale,
    localizeStoreName(storeNameKo, locale),
    storeNameKo,
  );

  const statusLabel = isCancelled
    ? t.cancelled
    : done
      ? t.pickupDone
      : t.pickupAvailable;
  const statusChipClass = isCancelled
    ? "bg-[#ebe8e3] text-[#a39e96]"
    : done
      ? "bg-[#ebe8e3] text-[#8a7a5c]"
      : isTodayPickup
        ? "bg-[#F5EDE3] text-[#6B3B1F]"
        : "bg-[#e8e6e2] text-[#6b6862]";

  const weekday = formatVisitWeekdayLocalized(visitYmd, locale);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`relative w-full overflow-hidden rounded-3xl border text-left shadow-sm transition active:brightness-95 ${
        isTodayPickup
          ? "border-[#e8e8e8] bg-white"
          : "border-[#ddd9d3] bg-[#F6F5F3]"
      }`}
    >
      <div className="absolute right-4 top-4 flex items-center gap-1.5">
        {isTodayPickup ? (
          <span className="rounded-full bg-[#6B3B1F] px-2 py-0.5 text-[10px] font-bold text-white">
            {t.today}
          </span>
        ) : null}
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusChipClass}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="space-y-4 px-5 pb-5 pt-5">
        <div className="pr-24">
          <p
            className={`text-[0.6rem] font-bold tracking-[0.18em] uppercase ${
              isTodayPickup ? "text-[#bbb]" : "text-[#b0aaa2]"
            }`}
          >
            {t.visitStore}
          </p>
          <p
            className={`mt-1 text-[1.55rem] font-bold leading-tight ${
              isTodayPickup ? "text-[#1a1a2e]" : "text-[#5c5a56]"
            }`}
          >
            {storeName}
          </p>
        </div>

        <div
          className={`h-px ${isTodayPickup ? "bg-[#f2f2f2]" : "bg-[#e8e4de]"}`}
        />

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <dt
              className={`text-[0.62rem] font-semibold tracking-wide uppercase ${
                isTodayPickup ? "text-[#bbb]" : "text-[#b0aaa2]"
              }`}
            >
              {t.visitSchedule}
            </dt>
            <dd
              className={`mt-1 text-base font-bold ${
                isTodayPickup ? "text-[#6B3B1F]" : "text-[#6b6862]"
              }`}
            >
              {formatVisitDateLocalized(visitYmd, locale, t.dateUndecided)}
              {visitYmd && weekday ? (
                <span
                  className={`ml-1 text-sm font-normal ${
                    isTodayPickup ? "text-[#999]" : "text-[#a39e96]"
                  }`}
                >
                  ({weekday})
                </span>
              ) : null}
            </dd>
          </div>

          <div>
            <dt
              className={`text-[0.62rem] font-semibold tracking-wide uppercase ${
                isTodayPickup ? "text-[#bbb]" : "text-[#b0aaa2]"
              }`}
            >
              {t.quantity}
            </dt>
            <dd
              className={`mt-1 text-base font-bold ${
                isTodayPickup ? "text-[#333]" : "text-[#6b6862]"
              }`}
            >
              {t.quantityUnit(item.quantity)}
            </dd>
          </div>

          <div className="col-span-2">
            <dt
              className={`text-[0.62rem] font-semibold tracking-wide uppercase ${
                isTodayPickup ? "text-[#bbb]" : "text-[#b0aaa2]"
              }`}
            >
              {t.product}
            </dt>
            <dd
              className={`mt-1 text-base font-semibold ${
                isTodayPickup ? "text-[#333]" : "text-[#6b6862]"
              }`}
            >
              {item.products?.name || t.productFallback}
            </dd>
          </div>
        </dl>

        {!done && !isCancelled && (
          <div className="rounded-2xl bg-[#F5EDE3] py-3.5 text-center text-sm font-semibold text-[#6B3B1F]">
            {t.openPickupInfo}
          </div>
        )}
      </div>
    </button>
  );
}

/* ─── 목업 데이터 (로컬 미리보기용) ────────────────── */
const USE_MOCK_DATA = false;

function buildMockAllocations(): AllocationWithRelations[] {
  const todayIso = todayYmdKst();
  const nowIso = new Date().toISOString();
  const baseStore: Store = {
    id: "mock-store-1",
    name: "OWM 강남점",
    address: "서울 강남구",
    created_at: nowIso,
  };
  const baseStore2: Store = {
    id: "mock-store-2",
    name: "OWM 성수점",
    address: "서울 성동구",
    created_at: nowIso,
  };

  return [
    {
      id: "mock-alloc-1",
      influencer_id: "mock-inf",
      product_id: "mock-prod-1",
      store_id: baseStore.id,
      quantity: 2,
      status: "ready",
      visit_code: "V-8821",
      visit_date: todayIso,
      verified_at: nowIso,
      last_visited_at: nowIso,
      picked_up_at: null,
      created_at: nowIso,
      updated_at: nowIso,
      products: {
        id: "mock-prod-1",
        name: "웰니스 콜라겐 세럼",
        sku: "OWM-SR-01",
        description: "고농축 콜라겐 앰플",
        created_at: nowIso,
      },
      stores: baseStore,
      influencers: null,
    },
    {
      id: "mock-alloc-2",
      influencer_id: "mock-inf",
      product_id: "mock-prod-2",
      store_id: baseStore2.id,
      quantity: 1,
      status: "ready",
      visit_code: "V-8822",
      visit_date: todayIso,
      verified_at: nowIso,
      last_visited_at: nowIso,
      picked_up_at: null,
      created_at: nowIso,
      updated_at: nowIso,
      products: {
        id: "mock-prod-2",
        name: "옵티마 비타민 부스터",
        sku: "OWM-VT-02",
        description: "매일 한 포",
        created_at: nowIso,
      },
      stores: baseStore2,
      influencers: null,
    },
  ];
}

/* ─── 메인 컴포넌트 ──────────────────────────────────── */
export function InfAllocationList({
  influencer,
  initialAllocations,
  skipIntro = false,
  fromWelcome = false,
}: {
  influencer: Influencer;
  initialAllocations: AllocationWithRelations[];
  /** 로그인 환영 화면을 이미 본 경우 인트로 스킵 (하위 호환) */
  skipIntro?: boolean;
  /** 환영 화면 직후 진입 — 카드 스태거 + 컴팩트 헤더 */
  fromWelcome?: boolean;
}) {
  const { t, locale } = useInfLocale();
  const softEnter = skipIntro || fromWelcome;
  const [allocations, setAllocations] = useState(() =>
    sortItems(
      USE_MOCK_DATA
        ? [...initialAllocations, ...buildMockAllocations()]
        : initialAllocations,
    ),
  );
  const [cardsReady, setCardsReady] = useState(false);
  const [introPlayed, setIntroPlayed] = useState(softEnter);

  const [selected, setSelected] = useState<AllocationWithRelations | null>(
    null,
  );
  const [step, setStep] = useState<Step>("review");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAllocations(
      sortItems(
        USE_MOCK_DATA
          ? [...initialAllocations, ...buildMockAllocations()]
          : initialAllocations,
      ),
    );
  }, [initialAllocations]);

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (softEnter) {
      if (reduceMotion) {
        setCardsReady(true);
        return;
      }
      const id = window.requestAnimationFrame(() => {
        window.setTimeout(() => setCardsReady(true), 40);
      });
      return () => window.cancelAnimationFrame(id);
    }

    if (introPlayed) {
      setCardsReady(true);
      return;
    }

    if (reduceMotion) {
      setCardsReady(true);
      setIntroPlayed(true);
      return;
    }

    setCardsReady(false);
    const timer = window.setTimeout(() => {
      setCardsReady(true);
      setIntroPlayed(true);
    }, 1100);

    return () => window.clearTimeout(timer);
  }, [softEnter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selected]);

  function closeModal() {
    setSelected(null);
    setStep("review");
    setError(null);
  }

  function openItem(item: AllocationWithRelations) {
    setSelected(item);
    setStep("review");
    setError(null);
  }

  async function confirmPickup() {
    if (!selected) return;
    setConfirming(true);
    setError(null);
    try {
      if (selected.id.startsWith("mock-")) {
        const nowIso = new Date().toISOString();
        const updated: AllocationWithRelations = {
          ...selected,
          status: "picked_up",
          picked_up_at: nowIso,
          updated_at: nowIso,
        };
        setAllocations((prev) =>
          sortItems(prev.map((a) => (a.id === updated.id ? updated : a))),
        );
        setSelected(updated);
        setStep("review");
        return;
      }

      const res = await fetch(`/api/inf/allocations/${selected.id}/pickup`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || t.pickupFailed);
      const updated = body.allocation as AllocationWithRelations;
      setAllocations((prev) =>
        sortItems(
          prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)),
        ),
      );
      setSelected((prev) =>
        prev && prev.id === updated.id ? { ...prev, ...updated } : prev,
      );
      setStep("review");
    } catch (err: unknown) {
      setError(
        translateInfApiError(
          err instanceof Error ? err.message : t.pickupError,
          t,
        ),
      );
    } finally {
      setConfirming(false);
    }
  }

  const alreadyPickedUp = selected ? isPickedUp(selected) : false;
  const cancelled = selected?.status === "cancelled";

  const todayActive = allocations.filter(
    (a) => isVisitToday(a) && !isPickedUp(a) && a.status !== "cancelled",
  );

  const displayName =
    (influencer.name || "").trim() ||
    (influencer.instagram_handle || "").replace(/^@+/, "").trim() ||
    t.guest;

  return (
    <div className="flex flex-1 flex-col">
      <div
        className={`flex flex-col items-center px-6 text-center ${
          fromWelcome ? "pb-3 pt-4" : "pb-4 pt-8"
        }`}
        style={
          fromWelcome
            ? {
                opacity: cardsReady ? 1 : 0,
                transform: cardsReady ? "translateY(0)" : "translateY(10px)",
                transition:
                  "opacity 0.45s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1)",
              }
            : undefined
        }
      >
        {fromWelcome ? null : (
          <div className={introPlayed ? undefined : "inf-check-wrap"}>
            <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#6B3B1F]/10" />
              <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
                <circle
                  className={introPlayed ? undefined : "inf-check-ring"}
                  cx="20"
                  cy="20"
                  r="16"
                  stroke="#6B3B1F"
                  strokeWidth="2"
                  strokeOpacity=".45"
                  fill="none"
                />
                <path
                  className={introPlayed ? undefined : "inf-check-mark"}
                  d="M13 20l5.5 5.5 9.5-10"
                  stroke="#6B3B1F"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
          </div>
        )}

        <div
          className={
            introPlayed && !fromWelcome
              ? undefined
              : fromWelcome
                ? undefined
                : "inf-greet-text"
          }
        >
          <h1
            className={`font-bold text-[#1a1a2e] ${
              fromWelcome ? "text-lg" : "text-xl"
            }`}
          >
            {fromWelcome
              ? t.allocationListTitle(displayName)
              : t.helloName(influencer.name || displayName)}
          </h1>
          {todayActive.length > 0 ? (
            <p className="mt-1.5 text-sm font-medium text-[#6B3B1F]">
              {t.todayPickupCount(todayActive.length)}
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-[#999]">
              {fromWelcome ? t.checkProductsBelow : t.verifiedDone}
            </p>
          )}
          {influencer.sns_url && (
            <a
              href={formatSnsUrl(influencer.sns_url)!}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs text-[#6B3B1F] underline underline-offset-2"
            >
              {t.snsProfile}
            </a>
          )}
        </div>
      </div>

      <div
        className="mx-5 h-px bg-[#f0f0f0]"
        style={
          fromWelcome
            ? {
                opacity: cardsReady ? 1 : 0,
                transition: "opacity 0.4s ease 0.08s",
              }
            : undefined
        }
      />

      <div
        className="flex-1 overflow-y-auto px-5 py-5"
        style={
          fromWelcome
            ? undefined
            : {
                opacity: cardsReady ? 1 : 0,
                transform: cardsReady ? "translateY(0)" : "translateY(14px)",
                transition:
                  "opacity 0.5s ease 0.1s, transform 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s",
              }
        }
      >
        {allocations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f5f5]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 9h18M3 9l2-4h14l2 4M3 9v10h18V9"
                  stroke="#ccc"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="text-sm text-[#ccc]">{t.noAllocations}</p>
          </div>
        ) : (
          <ul className="space-y-4 pb-10">
            {allocations.map((item, index) => (
              <li
                key={item.id}
                className={
                  fromWelcome && cardsReady ? "inf-card-rise" : undefined
                }
                style={
                  fromWelcome && cardsReady
                    ? { animationDelay: `${60 + index * 75}ms` }
                    : fromWelcome
                      ? { opacity: 0 }
                      : undefined
                }
              >
                <AllocationCard
                  item={item}
                  onOpen={openItem}
                  t={t}
                  locale={locale}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />

      {selected && (
        <PickupSheet
          influencer={influencer}
          selected={selected}
          step={step}
          confirming={confirming}
          error={error}
          alreadyPickedUp={alreadyPickedUp}
          cancelled={cancelled}
          onClose={closeModal}
          onStep={setStep}
          onConfirm={confirmPickup}
          onClearError={() => setError(null)}
        />
      )}
    </div>
  );
}

/* ─── 하단 네비 ──────────────────────────────────────── */
function BottomNav() {
  const { t } = useInfLocale();
  return (
    <nav className="border-t border-[#f0f0f0] bg-white px-6 pb-12 pt-5">
      <div className="flex items-center justify-center">
        <form action="/api/inf/clear" method="post">
          <button type="submit" className="flex flex-col items-center gap-1">
            <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="7" stroke="#ccc" strokeWidth="1.5" />
              <path
                d="M11 8v3l2 2"
                stroke="#ccc"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-xs font-medium text-[#bbb]">{t.recheck}</span>
          </button>
        </form>
      </div>
    </nav>
  );
}

/* ─── 수령 정보 확인 시트 ─────────────────────────────
 * 안내/버튼은 사용자 언어, 약사용 본문 라벨·날짜는 한국어 고정
 */
function PickupSheet({
  influencer,
  selected,
  step,
  confirming,
  error,
  alreadyPickedUp,
  cancelled,
  onClose,
  onStep,
  onConfirm,
  onClearError,
}: {
  influencer: Influencer;
  selected: AllocationWithRelations;
  step: Step;
  confirming: boolean;
  error: string | null;
  alreadyPickedUp: boolean;
  cancelled: boolean;
  onClose: () => void;
  onStep: (step: Step) => void;
  onConfirm: () => void;
  onClearError: () => void;
}) {
  const { t } = useInfLocale();
  const title =
    step === "confirm" ? t.pickupConfirmTitle : t.pickupReviewTitle;

  return (
    <BottomSheet onClose={onClose} label={title}>
      <PickupSheetBody
        influencer={influencer}
        selected={selected}
        step={step}
        confirming={confirming}
        error={error}
        alreadyPickedUp={alreadyPickedUp}
        cancelled={cancelled}
        onStep={onStep}
        onConfirm={onConfirm}
        onClearError={onClearError}
      />
    </BottomSheet>
  );
}

function PickupSheetBody({
  influencer,
  selected,
  step,
  confirming,
  error,
  alreadyPickedUp,
  cancelled,
  onStep,
  onConfirm,
  onClearError,
}: {
  influencer: Influencer;
  selected: AllocationWithRelations;
  step: Step;
  confirming: boolean;
  error: string | null;
  alreadyPickedUp: boolean;
  cancelled: boolean;
  onStep: (step: Step) => void;
  onConfirm: () => void;
  onClearError: () => void;
}) {
  const { t, locale } = useInfLocale();
  const requestClose = useSheetClose();
  const sheet = t.sheet;
  const ko = t.koSheet;
  const bl = (local: string, korean: string) =>
    bilingualSheetText(locale, local, korean);
  const title =
    step === "confirm" ? t.pickupConfirmTitle : t.pickupReviewTitle;
  const visitYmd = selected.visit_date
    ? String(selected.visit_date).slice(0, 10)
    : null;

  const visitDateLocal = visitYmd
    ? formatVisitDateLocalized(visitYmd, locale, sheet.dateUndecided)
    : sheet.dateUndecided;
  const visitWeekLocal = visitYmd
    ? formatVisitWeekdayLocalized(visitYmd, locale)
    : "";
  const visitDateKo = visitYmd
    ? formatVisitDateKo(visitYmd)
    : ko.dateUndecided;
  const visitWeekKo = visitYmd ? formatVisitDayOfWeekKo(visitYmd) : "";

  const storeNameKo = formatStoreName(selected.stores, ko.store);
  const storeName = bilingualSheetText(
    locale,
    localizeStoreName(storeNameKo, locale),
    storeNameKo,
  );

  const statusLocal = alreadyPickedUp
    ? sheet.pickupDone
    : cancelled
      ? sheet.cancelled
      : sheet.pickupWaiting;
  const statusKo = alreadyPickedUp
    ? ko.pickupDone
    : cancelled
      ? ko.cancelled
      : ko.pickupWaiting;

  return (
      <div className="inf-sheet-content flex h-full min-h-0 flex-1 flex-col gap-[clamp(0.5rem,1.6vh,1.25rem)] overflow-hidden">
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="[font-size:clamp(0.65rem,1.4vh,0.75rem)] font-medium tracking-widest text-[#6B3B1F] uppercase">
              {step === "confirm" ? "Confirm" : "Review"}
            </p>
            <h3 className="mt-[clamp(0.15rem,0.6vh,0.35rem)] [font-size:clamp(1.05rem,2.8vh,1.25rem)] font-bold text-[#1a1a2e]">
              {title}
            </h3>
            <p className="mt-[clamp(0.15rem,0.5vh,0.35rem)] [font-size:clamp(0.75rem,1.8vh,0.875rem)] text-[#999]">
              {step === "confirm" ? t.pickupConfirmHint : t.pickupReviewHint}
            </p>
          </div>

          {/* 약사님 안내 — Pickup info 오른쪽 */}
          <div className="w-[min(42%,11.5rem)] shrink-0 rounded-2xl border border-[#6B3B1F]/25 bg-[#F5EDE3] px-2.5 py-[clamp(0.45rem,1.2vh,0.7rem)] text-center">
            <p className="[font-size:clamp(0.7rem,1.7vh,0.8rem)] font-bold leading-snug tracking-wide text-[#6B3B1F]">
              {t.showToPharmacist}
            </p>
            {locale !== "ko" ? (
              <p className="mt-0.5 [font-size:clamp(0.6rem,1.3vh,0.68rem)] leading-snug text-[#8a6a4a]">
                약사님께 보여주세요
              </p>
            ) : null}
          </div>
        </div>

        {/* 약사용 본문 — 공간 부족 시 이 박스만 줄어듦 (스크롤 없음) */}
        <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-[clamp(0.35rem,1.2vh,1rem)] overflow-hidden rounded-2xl bg-[#f9f9f9] px-5 py-[clamp(0.75rem,2vh,1.5rem)]">
          <div className="flex min-h-0 flex-col justify-start gap-[clamp(0.35rem,1.1vh,0.75rem)] text-center">
            <div className="min-h-0 shrink-0">
              <p className="[font-size:clamp(0.8rem,1.8vh,0.9rem)] font-medium tracking-wide text-[#aaa]">
                {bl(sheet.product, ko.product)}
              </p>
              <p className="mt-[clamp(0.25rem,0.7vh,0.45rem)] [font-size:clamp(1.7rem,5vh,2.35rem)] font-bold leading-snug text-[#1a1a2e]">
                {selected.products?.name || bl(sheet.product, ko.product)}
              </p>
              {selected.products?.description ? (
                <p className="mt-[clamp(0.2rem,0.5vh,0.35rem)] line-clamp-3 [font-size:clamp(0.9rem,2.1vh,1.1rem)] leading-snug text-[#777]">
                  {selected.products.description}
                </p>
              ) : null}
            </div>

            <div className="mx-auto my-[clamp(0.05rem,0.3vh,0.2rem)] h-px w-10 shrink-0 bg-[#e8e8e8]" />

            <div className="min-h-0 shrink">
              <p className="[font-size:clamp(0.72rem,1.5vh,0.8rem)] font-medium tracking-wide text-[#aaa]">
                {bl(sheet.store, ko.store)}
              </p>
              <p className="mt-[clamp(0.15rem,0.5vh,0.35rem)] [font-size:clamp(1.15rem,3.1vh,1.4rem)] font-bold text-[#1a1a2e]">
                {storeName}
              </p>
            </div>

            <div className="min-h-0 shrink">
              <p className="[font-size:clamp(0.72rem,1.5vh,0.8rem)] font-medium tracking-wide text-[#aaa]">
                {bl(sheet.visitDate, ko.visitDate)}
              </p>
              {locale === "ko" ? (
                <p className="mt-[clamp(0.15rem,0.5vh,0.35rem)] [font-size:clamp(1.15rem,3.1vh,1.4rem)] font-bold tabular-nums text-[#6B3B1F]">
                  {visitDateKo}
                  {visitWeekKo ? (
                    <span className="ml-1.5 [font-size:clamp(0.85rem,2.2vh,1.05rem)] font-semibold text-[#999]">
                      ({visitWeekKo}요일)
                    </span>
                  ) : null}
                </p>
              ) : (
                <div className="mt-[clamp(0.15rem,0.5vh,0.35rem)] space-y-0.5">
                  <p className="[font-size:clamp(1.15rem,3.1vh,1.4rem)] font-bold tabular-nums text-[#6B3B1F]">
                    {visitDateLocal}
                    {visitWeekLocal ? (
                      <span className="ml-1.5 [font-size:clamp(0.85rem,2.2vh,1.05rem)] font-semibold text-[#999]">
                        ({visitWeekLocal})
                      </span>
                    ) : null}
                  </p>
                  <p className="[font-size:clamp(0.85rem,2vh,1rem)] font-semibold tabular-nums text-[#8a6a4a]">
                    {visitDateKo}
                    {visitWeekKo ? ` (${visitWeekKo}요일)` : ""}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 space-y-[clamp(0.25rem,0.9vh,0.55rem)] border-t border-[#eee] pt-[clamp(0.5rem,1.4vh,1rem)] text-left">
            <InfoRow label={bl(sheet.influencer, ko.influencer)}>
              {influencer.name}{" "}
              <span className="text-[#6B3B1F]">
                {formatIgHandle(influencer)}
              </span>
            </InfoRow>
            <InfoRow label={bl(sheet.quantity, ko.quantity)}>
              {bl(
                sheet.quantityUnit(selected.quantity),
                ko.quantityUnit(selected.quantity),
              )}
            </InfoRow>
            {selected.visit_code ? (
              <InfoRow label={bl(sheet.visitCode, ko.visitCode)}>
                {selected.visit_code}
              </InfoRow>
            ) : null}
            <InfoRow label={bl(sheet.pickupStatus, ko.pickupStatus)}>
              <span
                className={
                  alreadyPickedUp
                    ? "text-[#8a7a5c]"
                    : cancelled
                      ? "text-[#aaa]"
                      : "text-[#6B3B1F]"
                }
              >
                {bl(statusLocal, statusKo)}
              </span>
            </InfoRow>
            {selected.picked_up_at ? (
              <InfoRow label={bl(sheet.pickupTime, ko.pickupTime)}>
                {formatKst(selected.picked_up_at)}
              </InfoRow>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="shrink-0 rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-500">
            {error}
          </p>
        ) : null}

        <div className="shrink-0 pb-1">
          {alreadyPickedUp ? (
            <div className="rounded-2xl bg-[#f3eee3] px-4 py-[clamp(0.6rem,1.6vh,0.75rem)] text-center text-sm font-semibold text-[#8a7a5c]">
              {t.pickupDoneBanner}
              {selected.picked_up_at
                ? ` · ${formatKst(selected.picked_up_at)}`
                : ""}
            </div>
          ) : cancelled ? (
            <p className="text-center text-sm text-[#aaa]">
              {t.cancelledCannotPickup}
            </p>
          ) : step === "review" ? (
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={requestClose}
                className="w-[28%] shrink-0 rounded-2xl border border-[#e8e8e8] py-[clamp(0.75rem,2vh,1rem)] text-sm font-semibold text-[#666]"
              >
                {t.close}
              </button>
              <button
                type="button"
                onClick={() => onStep("confirm")}
                className="min-w-0 flex-1 rounded-2xl bg-[#6B3B1F] px-3 py-[clamp(0.65rem,1.8vh,0.9rem)] text-sm font-semibold text-white"
              >
                <BilingualActionLabel
                  locale={locale}
                  local={t.pickupConfirmBtn}
                  korean={INF_MESSAGES.ko.pickupConfirmBtn}
                />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-2xl bg-[#F5EDE3] px-4 py-[clamp(0.5rem,1.4vh,0.75rem)] text-center text-sm leading-snug text-[#6B3B1F]">
                <BilingualActionLabel
                  locale={locale}
                  local={t.pickupIrreversible}
                  korean={INF_MESSAGES.ko.pickupIrreversible}
                  muted
                />
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  disabled={confirming}
                  onClick={() => {
                    onStep("review");
                    onClearError();
                  }}
                  className="w-[28%] shrink-0 rounded-2xl border border-[#e8e8e8] py-[clamp(0.75rem,2vh,1rem)] text-sm font-semibold text-[#666] disabled:opacity-50"
                >
                  {t.previous}
                </button>
                <button
                  type="button"
                  disabled={confirming}
                  onClick={onConfirm}
                  className="min-w-0 flex-1 rounded-2xl bg-[#6B3B1F] px-3 py-[clamp(0.65rem,1.8vh,0.9rem)] text-sm font-semibold text-white disabled:opacity-50"
                >
                  <BilingualActionLabel
                    locale={locale}
                    local={confirming ? t.confirming : t.finalPickupConfirm}
                    korean={
                      confirming
                        ? INF_MESSAGES.ko.confirming
                        : INF_MESSAGES.ko.finalPickupConfirm
                    }
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}

/* ─── InfoRow ────────────────────────────────────────── */
function BilingualActionLabel({
  locale,
  local,
  korean,
  muted = false,
}: {
  locale: "ko" | "en" | "ja" | "zh";
  local: string;
  korean: string;
  muted?: boolean;
}) {
  if (locale === "ko" || local === korean) {
    return <span className="block whitespace-nowrap">{korean}</span>;
  }
  return (
    <span className="flex flex-col items-center gap-0.5 leading-tight">
      <span className="whitespace-nowrap">{local}</span>
      <span
        className={`whitespace-nowrap text-[0.82em] font-medium ${
          muted ? "opacity-80" : "opacity-90"
        }`}
      >
        {korean}
      </span>
    </span>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2.5">
      <dt className="w-[min(42%,9.5rem)] shrink-0 [font-size:clamp(0.72rem,1.55vh,0.82rem)] leading-snug text-[#aaa]">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 [font-size:clamp(0.95rem,2.1vh,1.1rem)] leading-snug text-[#1a1a2e]">
        {children}
      </dd>
    </div>
  );
}

/* ─── 수령정보 바텀시트 (현재 뷰포트 하단 · 화면 높이 맞춤) ─ */
function BottomSheet({
  onClose,
  label,
  children,
}: {
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [settled, setSettled] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [swipeClosing, setSwipeClosing] = useState(false);
  const dragYRef = useRef(0);
  const dragStartY = useRef(0);
  const dragStartOffset = useRef(0);
  const lastMoveY = useRef(0);
  const lastMoveAt = useRef(0);
  const velocityY = useRef(0);
  const closedRef = useRef(false);

  const DISMISS_DISTANCE = 120;
  const DISMISS_VELOCITY = 0.55; // px/ms

  useEffect(() => {
    setMounted(true);
  }, []);

  function finishClose() {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  }

  function updateDragY(next: number) {
    dragYRef.current = next;
    setDragY(next);
  }

  function requestClose() {
    if (closing || swipeClosing || closedRef.current) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      finishClose();
      return;
    }

    setClosing(true);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closing, swipeClosing]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePanelAnimationEnd(e: React.AnimationEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (closing && !swipeClosing) {
      finishClose();
      return;
    }
    // 입장 애니메이션 종료 → 이후 재실행 방지
    if (!settled) setSettled(true);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (closing || swipeClosing) return;
    const tag = (e.target as HTMLElement | null)?.closest(
      "button, a, input, select, textarea",
    );
    if (tag) return;

    dragStartY.current = e.clientY;
    dragStartOffset.current = dragYRef.current;
    lastMoveY.current = e.clientY;
    lastMoveAt.current = performance.now();
    velocityY.current = 0;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || closing || swipeClosing) return;
    const now = performance.now();
    const dy = e.clientY - lastMoveY.current;
    const dt = Math.max(now - lastMoveAt.current, 1);
    velocityY.current = dy / dt;
    lastMoveY.current = e.clientY;
    lastMoveAt.current = now;

    const next = Math.max(
      0,
      dragStartOffset.current + (e.clientY - dragStartY.current),
    );
    updateDragY(next);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    const current = dragYRef.current;
    const shouldDismiss =
      current > DISMISS_DISTANCE || velocityY.current > DISMISS_VELOCITY;

    if (shouldDismiss) {
      setSettled(true);
      setSwipeClosing(true);
      // 현재 위치에서 화면 밖으로만 이어서 이동 (입장 애니 재실행 없음)
      updateDragY(
        typeof window !== "undefined" ? window.innerHeight : Math.max(current, 800),
      );
      // transitionend 미발생 대비
      window.setTimeout(() => finishClose(), 320);
      return;
    }
    updateDragY(0);
  }

  function onPanelTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== "transform") return;
    if (!swipeClosing) return;
    finishClose();
  }

  if (!mounted) return null;

  const backdropOpacity = swipeClosing
    ? 0
    : Math.max(0.08, 0.4 * (1 - dragY / 420));

  const panelStyle: React.CSSProperties = {
    height: "min(96dvh, 98vh)",
    maxHeight: "min(96dvh, 98vh)",
    transform:
      dragging || dragY > 0 || swipeClosing
        ? `translateY(${dragY}px)`
        : undefined,
    transition: dragging
      ? "none"
      : swipeClosing
        ? "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s ease"
        : closing
          ? undefined
          : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
    opacity: swipeClosing ? 0.92 : 1,
    touchAction: "none",
  };

  return createPortal(
    <div
      className={`inf-sheet-backdrop fixed inset-0 z-[100] flex items-end justify-center${
        closing && !swipeClosing ? " is-closing" : ""
      }`}
      style={{
        backgroundColor: `rgba(0,0,0,${backdropOpacity})`,
        transition: dragging ? "none" : "background-color 0.28s ease",
        pointerEvents: swipeClosing ? "none" : undefined,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={requestClose}
    >
      <div
        className={`inf-sheet-panel flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white px-5 pb-[max(1.75rem,calc(env(safe-area-inset-bottom)+0.75rem))] pt-3 shadow-2xl${
          settled ? " is-settled" : ""
        }${closing && !swipeClosing ? " is-closing" : ""}${
          dragging ? " is-dragging" : ""
        }${swipeClosing ? " is-swipe-closing" : ""}`}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={handlePanelAnimationEnd}
        onTransitionEnd={onPanelTransitionEnd}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="mx-auto mb-2 flex h-6 w-full shrink-0 cursor-grab items-start justify-center active:cursor-grabbing"
          aria-hidden
        >
          <div className="mt-1 h-1 w-12 rounded-full bg-[#e8e8e8]" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SheetCloseContext.Provider value={requestClose}>
            {children}
          </SheetCloseContext.Provider>
        </div>
      </div>
    </div>,
    document.body,
  );
}
