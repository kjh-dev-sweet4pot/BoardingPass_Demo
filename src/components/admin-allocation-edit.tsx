"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ALLOCATION_STATUS_LABEL,
  type AllocationStatus,
  type AllocationWithRelations,
  type Store,
} from "@/lib/types";

const compactFieldClass =
  "h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]";

const STATUSES: AllocationStatus[] = [
  "pending",
  "visited",
  "ready",
  "picked_up",
  "cancelled",
];

function visitDateInputValue(item: AllocationWithRelations) {
  return item.visit_date ? String(item.visit_date).slice(0, 10) : "";
}

export function AdminAllocationEditForm({
  item,
  storeList,
  compact = false,
  onUpdated,
}: {
  item: AllocationWithRelations;
  storeList: Store[];
  compact?: boolean;
  onUpdated: (next: AllocationWithRelations) => void;
}) {
  const [visitDate, setVisitDate] = useState(visitDateInputValue(item));
  const [storeId, setStoreId] = useState(item.store_id);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [visitCode, setVisitCode] = useState(item.visit_code || "");
  const [status, setStatus] = useState<AllocationStatus>(item.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const stores = useMemo(() => {
    if (storeList.some((store) => store.id === item.store_id)) return storeList;
    if (item.stores) return [item.stores, ...storeList];
    return storeList;
  }, [storeList, item.store_id, item.stores]);

  useEffect(() => {
    setVisitDate(visitDateInputValue(item));
    setStoreId(item.store_id);
    setQuantity(String(item.quantity));
    setVisitCode(item.visit_code || "");
    setStatus(item.status);
    setError(null);
    setSaved(false);
  }, [item]);

  const dirty =
    visitDate !== visitDateInputValue(item) ||
    storeId !== item.store_id ||
    Number(quantity) !== item.quantity ||
    visitCode !== (item.visit_code || "") ||
    status !== item.status;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !dirty) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/allocations/${item.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visit_date: visitDate,
          store_id: storeId,
          quantity: Number(quantity),
          visit_code: visitCode,
          status,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "수정에 실패했습니다.");
      }
      onUpdated(body.allocation as AllocationWithRelations);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={
        compact
          ? "space-y-3"
          : "space-y-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-4"
      }
    >
      {!compact ? (
        <p className="text-xs font-medium tracking-wide text-[var(--muted)]">
          방문 정보 수정
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          방문 예정일
          <input
            className={compactFieldClass}
            type="date"
            value={visitDate}
            onChange={(e) => {
              setVisitDate(e.target.value);
              setSaved(false);
            }}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          방문 지점
          <select
            className={compactFieldClass}
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value);
              setSaved(false);
            }}
            required
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          수량
          <input
            className={compactFieldClass}
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setSaved(false);
            }}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          상태
          <select
            className={compactFieldClass}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as AllocationStatus);
              setSaved(false);
            }}
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {ALLOCATION_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)] sm:col-span-2">
          방문 코드
          <input
            className={compactFieldClass}
            value={visitCode}
            onChange={(e) => {
              setVisitCode(e.target.value);
              setSaved(false);
            }}
            placeholder="선택"
          />
        </label>
      </div>
      {error ? (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      ) : saved ? (
        <p className="text-sm text-[var(--accent)]">저장되었습니다.</p>
      ) : null}
      <button
        type="submit"
        disabled={saving || !dirty}
        className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
      >
        {saving ? "저장 중…" : "방문 정보 저장"}
      </button>
    </form>
  );
}
