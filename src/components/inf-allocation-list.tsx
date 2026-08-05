"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ALLOCATION_STATUS_LABEL,
  type AllocationWithRelations,
  type Influencer,
} from "@/lib/types";
import { primaryBtnClass, secondaryBtnClass } from "@/components/ui";

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
  const visit = visitDateYmd(item);
  return Boolean(visit && visit === todayYmdKst());
}

function formatVisitDateKo(ymd: string | null) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return `${m}월 ${d}일`;
}

function visitBlockedMessage(item: AllocationWithRelations) {
  const label = formatVisitDateKo(visitDateYmd(item));
  if (!label) return "방문 예정일이 등록되지 않아 수령할 수 없습니다.";
  return `${label} 방문시 수령할 수 있습니다!`;
}

function formatIgHandle(influencer: Influencer) {
  const raw =
    influencer.instagram_handle_normalized ||
    influencer.instagram_handle ||
    "";
  const normalized = raw.replace(/^@+/, "").trim();
  return normalized ? `@${normalized}` : "—";
}

function formatSnsUrl(url?: string | null) {
  const raw = (url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function isPickedUp(item: AllocationWithRelations) {
  return item.status === "picked_up" || Boolean(item.picked_up_at);
}

function sortByPickup(items: AllocationWithRelations[]) {
  return [...items].sort((a, b) => {
    const rank = (item: AllocationWithRelations) => {
      if (isPickedUp(item)) return 2;
      if (item.status === "cancelled") return 3;
      if (isVisitToday(item)) return 0;
      return 1;
    };
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

type Step = "review" | "confirm";
type ModalMode = "pickup" | "blocked";

export function InfAllocationList({
  influencer,
  initialAllocations,
}: {
  influencer: Influencer;
  initialAllocations: AllocationWithRelations[];
}) {
  const router = useRouter();
  const [allocations, setAllocations] = useState(() =>
    sortByPickup(initialAllocations),
  );
  const [selected, setSelected] = useState<AllocationWithRelations | null>(
    null,
  );
  const [modalMode, setModalMode] = useState<ModalMode>("pickup");
  const [step, setStep] = useState<Step>("review");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAllocations(sortByPickup(initialAllocations));
  }, [initialAllocations]);

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
  }, [selected]);

  function closeModal() {
    setSelected(null);
    setModalMode("pickup");
    setStep("review");
    setError(null);
  }

  function openItem(item: AllocationWithRelations) {
    const done = isPickedUp(item);
    const blocked =
      !done && item.status !== "cancelled" && !isVisitToday(item);

    setSelected(item);
    setModalMode(blocked ? "blocked" : "pickup");
    setStep("review");
    setError(null);
  }

  async function confirmPickup() {
    if (!selected) return;
    if (!isVisitToday(selected)) {
      setError(visitBlockedMessage(selected));
      return;
    }

    setConfirming(true);
    setError(null);

    try {
      const res = await fetch(`/api/inf/allocations/${selected.id}/pickup`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "수령 확인 실패");

      const updated = body.allocation as AllocationWithRelations;
      setAllocations((prev) =>
        sortByPickup(
          prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)),
        ),
      );
      setSelected((prev) =>
        prev && prev.id === updated.id ? { ...prev, ...updated } : prev,
      );
      setStep("review");
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "수령 확인 중 오류가 발생했습니다.",
      );
    } finally {
      setConfirming(false);
    }
  }

  if (allocations.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">배정된 상품이 없습니다.</p>
    );
  }

  const alreadyPickedUp = selected ? isPickedUp(selected) : false;
  const cancelled = selected?.status === "cancelled";
  const pendingCount = allocations.filter(
    (a) => !isPickedUp(a) && a.status !== "cancelled" && isVisitToday(a),
  ).length;
  const pickedCount = allocations.filter((a) => isPickedUp(a)).length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-2 border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-[var(--accent)]">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          오늘 수령 가능 {pendingCount}
        </span>
        <span className="inline-flex items-center gap-2 border border-[#8a7a5c] bg-[#efe8d8] px-3 py-1.5 text-[#5c4f35]">
          <span className="h-2 w-2 rounded-full bg-[#8a7a5c]" />
          수령 완료 {pickedCount}
        </span>
      </div>
      <p className="mb-3 text-sm text-[var(--muted)]">
        오늘 방문 예정인 상품만 수령 확인할 수 있습니다. 수령 확인 후에는
        취소할 수 없습니다.
      </p>
      <ul className="space-y-3">
        {allocations.map((item) => {
          const done = isPickedUp(item);
          const isCancelled = item.status === "cancelled";
          const notToday =
            !done && !isCancelled && !isVisitToday(item);

          const cardClass = done
            ? "border-[#c4b79a] bg-[#f3eee3] hover:border-[#8a7a5c]"
            : isCancelled || notToday
              ? "cursor-pointer border-[#cfd4d1] bg-[#e8ebe9] text-[var(--muted)] hover:border-[#b5bbb8]"
              : "border-[var(--accent)] bg-[var(--accent-soft)] hover:brightness-[0.98]";

          const badgeClass = done
            ? "border border-[#8a7a5c] bg-[#efe8d8] text-[#5c4f35]"
            : isCancelled || notToday
              ? "border border-[#c5cbc7] bg-[#dfe3e1] text-[#6b736e]"
              : "border border-[var(--accent)] bg-white/70 text-[var(--accent)]";

          const statusLabel = done
            ? "수령 완료"
            : isCancelled
              ? ALLOCATION_STATUS_LABEL.cancelled
              : notToday
                ? "방문 예정"
                : "수령 대기";

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openItem(item)}
                className={`grid w-full gap-2 border p-5 text-left transition md:grid-cols-[1fr_auto] ${cardClass}`}
              >
                <div>
                  <p
                    className={`text-xs font-medium tracking-[0.14em] uppercase ${
                      done
                        ? "text-[#8a7a5c]"
                        : isCancelled || notToday
                          ? "text-[#6b736e]"
                          : "text-[var(--accent)]"
                    }`}
                  >
                    {statusLabel}
                  </p>
                  <p
                    className={`mt-1 text-lg font-medium ${
                      notToday || isCancelled
                        ? "text-[#5d6660]"
                        : "text-[var(--ink)]"
                    }`}
                  >
                    {item.products?.name || "상품"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {item.stores?.name || "매장"} · 수량 {item.quantity}
                    {item.products?.sku ? ` · SKU ${item.products.sku}` : ""}
                    {item.visit_date ? ` · 방문 ${item.visit_date}` : ""}
                  </p>
                  {notToday && (
                    <p className="mt-1 text-xs text-[#6b736e]">
                      {visitBlockedMessage(item)}
                    </p>
                  )}
                  {item.picked_up_at && (
                    <p className="mt-1 text-xs text-[#5c4f35]">
                      수령 {formatKst(item.picked_up_at)}
                    </p>
                  )}
                </div>
                <div
                  className={`self-start px-3 py-1.5 text-sm font-medium ${badgeClass}`}
                >
                  {statusLabel}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && modalMode === "blocked" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="방문 예정 안내"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs tracking-[0.2em] text-[var(--muted)] uppercase">
              Notice
            </p>
            <h3
              className="mt-1 text-2xl text-[var(--ink)]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              오늘은 수령할 수 없습니다
            </h3>
            <p className="mt-4 border border-[#cfd4d1] bg-[#e8ebe9] px-4 py-3 text-sm text-[#5d6660]">
              {visitBlockedMessage(selected)}
            </p>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {selected.products?.name || "상품"} ·{" "}
              {selected.stores?.name || "매장"} · 수량 {selected.quantity}
            </p>
            <button
              type="button"
              className={`${secondaryBtnClass} mt-5`}
              onClick={closeModal}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {selected && modalMode === "pickup" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={step === "confirm" ? "수령 최종 확인" : "수령 정보 확인"}
          onClick={closeModal}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.2em] text-[var(--accent)] uppercase">
                  {step === "confirm" ? "Confirm" : "Review"}
                </p>
                <h3
                  className="mt-1 text-2xl text-[var(--ink)]"
                  style={{ fontFamily: "var(--font-display), serif" }}
                >
                  {step === "confirm" ? "수령 최종 확인" : "수령 정보 확인"}
                </h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {step === "confirm"
                    ? "아래 내용이 맞는지 다시 확인한 뒤 수령을 확정하세요."
                    : "관계자에게 제시 후 상품을 수령하세요."}
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
                onClick={closeModal}
              >
                닫기
              </button>
            </div>

            <div className="mb-5 border border-[var(--line)] bg-white/60 p-4">
              <p className="mb-3 text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
                요약
              </p>
              <dl className="grid gap-3">
                <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:items-baseline">
                  <dt className="text-xs text-[var(--muted)]">인플루언서</dt>
                  <dd className="text-sm font-medium">
                    {influencer.name}
                    <span className="ml-2 font-normal text-[var(--accent)]">
                      {formatIgHandle(influencer)}
                    </span>
                    {formatSnsUrl(influencer.sns_url) ? (
                      <a
                        href={formatSnsUrl(influencer.sns_url)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-xs font-normal text-[var(--muted)] underline underline-offset-2 hover:text-[var(--accent)]"
                      >
                        프로필
                      </a>
                    ) : null}
                  </dd>
                </div>
                <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:items-baseline">
                  <dt className="text-xs text-[var(--muted)]">상품</dt>
                  <dd className="text-sm font-medium">
                    {selected.products?.name || "상품"}
                  </dd>
                </div>
                
                {selected.products?.description && (
                  <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:items-baseline">
                    <dt className="text-xs text-[var(--muted)]">설명</dt>
                    <dd className="text-sm text-[var(--muted)]">
                      {selected.products.description}
                    </dd>
                  </div>
                )}
                <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:items-baseline">
                  <dt className="text-xs text-[var(--muted)]">수량</dt>
                  <dd className="text-sm font-medium">{selected.quantity}</dd>
                </div>
                <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:items-baseline">
                  <dt className="text-xs text-[var(--muted)]">매장</dt>
                  <dd className="text-sm">
                    {selected.stores?.name || "매장"}
                    {selected.stores?.address
                      ? ` · ${selected.stores.address}`
                      : ""}
                  </dd>
                </div>
                {selected.visit_date && (
                  <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:items-baseline">
                    <dt className="text-xs text-[var(--muted)]">방문 예정일</dt>
                    <dd className="text-sm font-medium">{selected.visit_date}</dd>
                  </div>
                )}
                {selected.visit_code && (
                  <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:items-baseline">
                    <dt className="text-xs text-[var(--muted)]">방문 코드</dt>
                    <dd className="text-sm font-medium">{selected.visit_code}</dd>
                  </div>
                )}
                <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:items-baseline">
                  <dt className="text-xs text-[var(--muted)]">수령 여부</dt>
                  <dd
                    className={`text-sm font-medium ${
                      alreadyPickedUp
                        ? "text-[#5c4f35]"
                        : cancelled
                          ? "text-[var(--muted)]"
                          : "text-[var(--accent)]"
                    }`}
                  >
                    {alreadyPickedUp
                      ? "수령 완료"
                      : cancelled
                        ? ALLOCATION_STATUS_LABEL.cancelled
                        : "수령 대기"}
                  </dd>
                </div>
                {selected.picked_up_at && (
                  <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:items-baseline">
                    <dt className="text-xs text-[var(--muted)]">수령 시간</dt>
                    <dd className="text-sm">
                      {formatKst(selected.picked_up_at)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

            {alreadyPickedUp ? (
              <p className="border border-[#8a7a5c] bg-[#efe8d8] px-4 py-3 text-sm text-[#5c4f35]">
                수령 확인 완료
                {selected.picked_up_at
                  ? ` · ${formatKst(selected.picked_up_at)}`
                  : ""}
              </p>
            ) : cancelled ? (
              <p className="text-sm text-[var(--muted)]">
                취소된 배정은 수령 확인할 수 없습니다.
              </p>
            ) : step === "review" ? (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={primaryBtnClass}
                  onClick={() => setStep("confirm")}
                >
                  다음 : 수령확인
                </button>
                <button
                  type="button"
                  className={secondaryBtnClass}
                  onClick={closeModal}
                >
                  닫기
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent)]">
                  수령 확정 후에는 취소할 수 없습니다. 위 내용이 맞다면 최종
                  확인을 눌러 주세요.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={primaryBtnClass}
                    disabled={confirming}
                    onClick={confirmPickup}
                  >
                    {confirming ? "확인 중…" : "최종 수령 확인"}
                  </button>
                  <button
                    type="button"
                    className={secondaryBtnClass}
                    disabled={confirming}
                    onClick={() => {
                      setStep("review");
                      setError(null);
                    }}
                  >
                    뒤로
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
