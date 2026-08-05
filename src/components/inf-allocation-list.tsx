"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ALLOCATION_STATUS_LABEL,
  type AllocationWithRelations,
} from "@/lib/types";
import { primaryBtnClass, secondaryBtnClass } from "@/components/ui";

function formatKst(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export function InfAllocationList({
  initialAllocations,
}: {
  initialAllocations: AllocationWithRelations[];
}) {
  const router = useRouter();
  const [allocations, setAllocations] = useState(initialAllocations);
  const [selected, setSelected] = useState<AllocationWithRelations | null>(
    null,
  );
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAllocations(initialAllocations);
  }, [initialAllocations]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        setError(null);
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [selected]);

  async function confirmPickup() {
    if (!selected) return;
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
        prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)),
      );
      setSelected((prev) =>
        prev && prev.id === updated.id ? { ...prev, ...updated } : prev,
      );
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

  return (
    <>
      <p className="mb-3 text-sm text-[var(--muted)]">
        상품을 누르면 약사가 수령을 확인할 수 있습니다.
      </p>
      <ul className="space-y-3">
        {allocations.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                setSelected(item);
                setError(null);
              }}
              className="grid w-full gap-2 border border-[var(--line)] bg-[var(--surface)] p-5 text-left transition hover:border-[var(--accent)] md:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="text-lg font-medium">
                  {item.products?.name || "상품"}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {item.stores?.name || "매장"} · 수량 {item.quantity}
                  {item.products?.sku ? ` · SKU ${item.products.sku}` : ""}
                </p>
                {item.picked_up_at && (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    수령 {formatKst(item.picked_up_at)}
                  </p>
                )}
              </div>
              <div className="text-sm text-[var(--accent)]">
                {ALLOCATION_STATUS_LABEL[item.status]}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="수령 확인"
          onClick={() => {
            setSelected(null);
            setError(null);
          }}
        >
          <div
            className="w-full max-w-md border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.2em] text-[var(--accent)] uppercase">
                  Pickup
                </p>
                <h3
                  className="mt-1 text-2xl text-[var(--ink)]"
                  style={{ fontFamily: "var(--font-display), serif" }}
                >
                  {selected.products?.name || "상품"}
                </h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {selected.stores?.name || "매장"} · 수량 {selected.quantity}
                  {selected.products?.sku
                    ? ` · SKU ${selected.products.sku}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
                onClick={() => {
                  setSelected(null);
                  setError(null);
                }}
              >
                닫기
              </button>
            </div>

            <dl className="mb-5 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--muted)]">상태</dt>
                <dd className="mt-1 text-sm font-medium text-[var(--accent)]">
                  {ALLOCATION_STATUS_LABEL[selected.status]}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">수령 시간</dt>
                <dd className="mt-1 text-sm">
                  {formatKst(selected.picked_up_at)}
                </dd>
              </div>
            </dl>

            {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

            {selected.status === "picked_up" ? (
              <p className="border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent)]">
                수령 확인 완료
                {selected.picked_up_at
                  ? ` · ${formatKst(selected.picked_up_at)}`
                  : ""}
              </p>
            ) : selected.status === "cancelled" ? (
              <p className="text-sm text-[var(--muted)]">
                취소된 배정은 수령 확인할 수 없습니다.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={primaryBtnClass}
                  disabled={confirming}
                  onClick={confirmPickup}
                >
                  {confirming ? "확인 중…" : "약사 수령 확인"}
                </button>
                <button
                  type="button"
                  className={secondaryBtnClass}
                  disabled={confirming}
                  onClick={() => {
                    setSelected(null);
                    setError(null);
                  }}
                >
                  취소
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
