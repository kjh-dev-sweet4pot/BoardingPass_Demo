"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ALLOCATION_STATUS_LABEL,
  type AllocationWithRelations,
  type Influencer,
  type Store,
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

function formatStoreName(
  store?: { name?: string | null; address?: string | null } | null,
) {
  const name = (store?.name || "매장").trim();
  const address = (store?.address || "").trim();
  if (address) {
    const stripped = name.replace(address, "").trim().replace(/[·,\s/-]+$/g, "").trim();
    if (stripped) return stripped;
  }
  const afterBranch = name.match(/^(.+점)\s+.+/);
  if (afterBranch) return afterBranch[1];
  return name;
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

type Step = "review" | "confirm";

/* ─── 개별 할당 카드 ─────────────────────────────────── */
function AllocationCard({
  item,
  onOpen,
}: {
  item: AllocationWithRelations;
  onOpen: (item: AllocationWithRelations) => void;
}) {
  const done = isPickedUp(item);
  const isCancelled = item.status === "cancelled";
  const today = isVisitToday(item);
  const visitYmd = visitDateYmd(item);
  const storeName = formatStoreName(item.stores);

  const statusLabel = isCancelled ? "취소됨" : done ? "수령 완료" : "수령 가능";
  const statusChipClass = isCancelled
    ? "bg-[#f0f0f0] text-[#aaa]"
    : done
      ? "bg-[#f3eee3] text-[#8a7a5c]"
      : "bg-[#F5EDE3] text-[#6B3B1F]";

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="relative w-full overflow-hidden rounded-3xl border border-[#e8e8e8] bg-white text-left shadow-sm transition active:brightness-95"
    >
      {/* 우측 상단 상태 뱃지 */}
      <div className="absolute right-4 top-4 flex items-center gap-1.5">
        {today && !done && !isCancelled && (
          <span className="rounded-full bg-[#6B3B1F] px-2 py-0.5 text-[10px] font-bold text-white">
            오늘
          </span>
        )}
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusChipClass}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="space-y-4 px-5 pb-5 pt-5">
        {/* 방문 지점 */}
        <div className="pr-24">
          <p className="text-[0.6rem] font-bold tracking-[0.18em] text-[#bbb] uppercase">
            방문 지점
          </p>
          <p className="mt-1 text-[1.55rem] font-bold leading-tight text-[#1a1a2e]">
            {storeName}
          </p>
        </div>

        <div className="h-px bg-[#f2f2f2]" />

        {/* 정보 그리드 */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <dt className="text-[0.62rem] font-semibold tracking-wide text-[#bbb] uppercase">
              방문 일정
            </dt>
            <dd
              className={`mt-1 text-base font-bold ${
                today && !done && !isCancelled ? "text-[#6B3B1F]" : "text-[#333]"
              }`}
            >
              {formatVisitDateKo(visitYmd)}
              {visitYmd && (
                <span className="ml-1 text-sm font-normal text-[#999]">
                  ({formatVisitDayOfWeek(visitYmd)})
                </span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-[0.62rem] font-semibold tracking-wide text-[#bbb] uppercase">
              수량
            </dt>
            <dd className="mt-1 text-base font-bold text-[#333]">
              {item.quantity}개
            </dd>
          </div>

          <div className="col-span-2">
            <dt className="text-[0.62rem] font-semibold tracking-wide text-[#bbb] uppercase">
              상품
            </dt>
            <dd className="mt-1 text-base font-semibold text-[#333]">
              {item.products?.name || "상품"}
            </dd>
          </div>
        </dl>

        {!done && !isCancelled && (
          <div className="rounded-2xl bg-[#F5EDE3] py-3.5 text-center text-sm font-semibold text-[#6B3B1F]">
            수령 정보 확인하기 →
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
}: {
  influencer: Influencer;
  initialAllocations: AllocationWithRelations[];
}) {
  const router = useRouter();
  const [allocations, setAllocations] = useState(() =>
    sortItems(USE_MOCK_DATA ? [...initialAllocations, ...buildMockAllocations()] : initialAllocations),
  );
  const [cardsReady, setCardsReady] = useState(false);
  const [introPlayed, setIntroPlayed] = useState(false);

  const [selected, setSelected] = useState<AllocationWithRelations | null>(null);
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

  /* 카드 피드 진입 타이밍 */
  useEffect(() => {
    if (introPlayed) {
      setCardsReady(true);
      return;
    }

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
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
      // 목업 데이터는 API 호출 없이 로컬 상태만 업데이트
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

      const res = await fetch(`/api/inf/allocations/${selected.id}/pickup`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "수령 확인 실패");
      const updated = body.allocation as AllocationWithRelations;
      setAllocations((prev) =>
        sortItems(prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))),
      );
      setSelected((prev) =>
        prev && prev.id === updated.id ? { ...prev, ...updated } : prev,
      );
      setStep("review");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "수령 확인 중 오류가 발생했습니다.");
    } finally {
      setConfirming(false);
    }
  }

  const alreadyPickedUp = selected ? isPickedUp(selected) : false;
  const cancelled = selected?.status === "cancelled";

  /* 오늘 수령 가능한 수량 요약 */
  const todayActive = allocations.filter(
    (a) => isVisitToday(a) && !isPickedUp(a) && a.status !== "cancelled",
  );

  return (
    <div className="flex flex-1 flex-col">
      {/* ── 그리팅 섹션 ── */}
      <div className="flex flex-col items-center px-6 pb-4 pt-8 text-center">
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

        <div className={introPlayed ? undefined : "inf-greet-text"}>
          <h1 className="text-xl font-bold text-[#1a1a2e]">
            안녕하세요, {influencer.name}님!
          </h1>
          {todayActive.length > 0 ? (
            <p className="mt-1.5 text-sm text-[#6B3B1F] font-medium">
              오늘 수령 가능한 상품이 {todayActive.length}건 있습니다
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-[#999]">본인 확인이 완료되었습니다.</p>
          )}
          {influencer.sns_url && (
            <a
              href={formatSnsUrl(influencer.sns_url)!}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs text-[#6B3B1F] underline underline-offset-2"
            >
              SNS 프로필
            </a>
          )}
        </div>
      </div>

      {/* ── 구분선 ── */}
      <div className="mx-5 h-px bg-[#f0f0f0]" />

      {/* ── 카드 피드 ── */}
      <div
        className="flex-1 overflow-y-auto px-5 py-5"
        style={{
          opacity: cardsReady ? 1 : 0,
          transform: cardsReady ? "translateY(0)" : "translateY(14px)",
          transition: "opacity 0.5s ease 0.1s, transform 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s",
        }}
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
            <p className="text-sm text-[#ccc]">배정된 상품이 없습니다.</p>
          </div>
        ) : (
          <ul className="space-y-4 pb-10">
            {allocations.map((item) => (
              <li key={item.id}>
                <AllocationCard item={item} onOpen={openItem} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 바텀 네비 ── */}
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
  return (
    <nav className="border-t border-[#f0f0f0] bg-white px-6 pb-12 pt-5">
      <div className="flex items-center justify-center">
        <form action="/api/inf/clear" method="post">
          <button type="submit" className="flex flex-col items-center gap-1">
            <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="7" stroke="#ccc" strokeWidth="1.5" />
              <path d="M11 8v3l2 2" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-xs font-medium text-[#bbb]">다시 확인</span>
          </button>
        </form>
      </div>
    </nav>
  );
}

/* ─── 수령 정보 확인 시트 ───────────────────────────── */
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
  return (
    <BottomSheet
      onClose={onClose}
      label={step === "confirm" ? "수령 최종 확인" : "수령 정보 확인"}
      tall
    >
      <div className="inf-sheet-content flex min-h-[calc(82vh-5rem)] flex-col space-y-5">
        <div>
          <p className="text-xs font-medium tracking-widest text-[#6B3B1F] uppercase">
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

        <div className="flex flex-1 flex-col justify-center space-y-5 rounded-2xl bg-[#f9f9f9] px-5 py-8">
          {/* 핵심 정보 */}
          <div className="space-y-6 text-center">
            <div>
              <p className="text-[11px] font-medium tracking-wide text-[#aaa]">상품</p>
              <p className="mt-1.5 text-2xl font-bold leading-snug text-[#1a1a2e]">
                {selected.products?.name || "상품"}
              </p>
              {selected.products?.description && (
                <p className="mt-1 text-sm text-[#999]">{selected.products.description}</p>
              )}
            </div>

            <div className="mx-auto h-px w-12 bg-[#e8e8e8]" />

            <div>
              <p className="text-[11px] font-medium tracking-wide text-[#aaa]">매장</p>
              <p className="mt-1.5 text-xl font-bold text-[#1a1a2e]">
                {formatStoreName(selected.stores)}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-medium tracking-wide text-[#aaa]">방문 예정일</p>
              <p className="mt-1.5 text-xl font-bold tabular-nums text-[#6B3B1F]">
                {selected.visit_date
                  ? formatVisitDateKo(String(selected.visit_date).slice(0, 10))
                  : "날짜 미정"}
                {selected.visit_date ? (
                  <span className="ml-1.5 text-base font-semibold text-[#999]">
                    ({formatVisitDayOfWeek(String(selected.visit_date).slice(0, 10))}요일)
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          {/* 보조 정보 */}
          <div className="mt-2 space-y-2 border-t border-[#eee] pt-5 text-left">
            <InfoRow label="인플루언서">
              {influencer.name}{" "}
              <span className="text-[#6B3B1F]">{formatIgHandle(influencer)}</span>
            </InfoRow>
            <InfoRow label="수량">{selected.quantity}개</InfoRow>
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
                      : "text-[#6B3B1F]"
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
        </div>

        {error && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-500">{error}</p>
        )}

        <div className="mt-auto pt-2">
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
                onClick={onClose}
                className="flex-1 rounded-2xl border border-[#e8e8e8] py-4 text-sm font-semibold text-[#666]"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => onStep("confirm")}
                className="flex-1 rounded-2xl bg-[#6B3B1F] py-4 text-sm font-semibold text-white"
              >
                수령 확인
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="rounded-2xl bg-[#F5EDE3] px-4 py-3 text-center text-sm text-[#6B3B1F]">
                수령 확정 후에는 취소할 수 없습니다.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={confirming}
                  onClick={() => {
                    onStep("review");
                    onClearError();
                  }}
                  className="flex-1 rounded-2xl border border-[#e8e8e8] py-4 text-sm font-semibold text-[#666] disabled:opacity-50"
                >
                  이전
                </button>
                <button
                  type="button"
                  disabled={confirming}
                  onClick={onConfirm}
                  className="flex-1 rounded-2xl bg-[#6B3B1F] py-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {confirming ? "확인 중…" : "최종 수령 확인"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
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
  tall = false,
}: {
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  tall?: boolean;
}) {
  return (
    <div
      className="inf-sheet-backdrop fixed inset-0 z-50 flex items-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div
        className={`inf-sheet-panel w-full overflow-y-auto rounded-t-3xl bg-white px-5 pb-10 pt-5 shadow-2xl ${
          tall ? "min-h-[86vh] max-h-[96vh]" : "max-h-[88vh]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-[#e8e8e8]" />
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-[#ccc]">{label}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[#aaa] hover:text-[#666]"
          >
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
