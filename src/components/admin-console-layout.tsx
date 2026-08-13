"use client";

import { useMemo, useState } from "react";
import { createManualAllocation } from "@/app/actions/admin";
import { AdminImportPanel } from "@/components/admin-import-panel";
import { AdminStoreOverview } from "@/components/admin-store-overview";
import { PharListWithModal } from "@/components/phar-list-with-modal";
import {
  Field,
  Notice,
  fieldClass,
  primaryBtnClass,
} from "@/components/ui";
import { type AllocationWithRelations, type Store } from "@/lib/types";

export function AdminConsoleLayout({
  storeList,
  list,
  error,
  message,
}: {
  storeList: Store[];
  list: AllocationWithRelations[];
  error?: string;
  message?: string;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const filteredList = useMemo(() => {
    if (!selectedStoreId) return list;
    return list.filter((item) => item.store_id === selectedStoreId);
  }, [list, selectedStoreId]);

  const selectedStoreName = selectedStoreId
    ? storeList.find((s) => s.id === selectedStoreId)?.name ||
      filteredList[0]?.stores?.name ||
      null
    : null;

  return (
    <div className="flex flex-col gap-6">
      <Notice error={error} message={message} />

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <aside className="flex flex-col gap-4">
          <AdminStoreOverview
            storeList={storeList}
            list={list}
            selectedStoreId={selectedStoreId}
            onSelectStore={setSelectedStoreId}
          />

          <AdminImportPanel compact />

          <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] shadow-sm">
            <button
              type="button"
              onClick={() => setManualOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              aria-expanded={manualOpen}
            >
              <h2
                className="text-lg text-[var(--ink)]"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                수동 등록
              </h2>
              <span className="text-xs font-medium text-[var(--muted)]">
                {manualOpen ? "접기 ▲" : "펼치기 ▼"}
              </span>
            </button>

            {manualOpen ? (
              <form
                action={createManualAllocation}
                className="grid gap-3 border-t border-[var(--line)] px-5 pb-5 pt-4"
              >
                <Field label="이름">
                  <input
                    className={fieldClass}
                    name="name"
                    placeholder="김미나"
                  />
                </Field>
                <Field label="SNS_handle">
                  <input
                    className={fieldClass}
                    name="snsid"
                    placeholder="@velyMina"
                    required
                  />
                </Field>
                <Field label="snsurl (선택)">
                  <input
                    className={fieldClass}
                    name="snsurl"
                    placeholder="https://instagram.com/..."
                  />
                </Field>
                <Field label="방문 예정일">
                  <input
                    className={fieldClass}
                    name="visit_date"
                    type="date"
                    required
                  />
                </Field>
                <Field label="방문지점">
                  <select className={fieldClass} name="store_id" required>
                    <option value="">지점 선택</option>
                    {storeList.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {storeList.length === 0 && (
                  <p className="text-xs text-[var(--danger)]">
                    등록된 지점이 없습니다. DB stores 테이블에 지점을 먼저 추가해
                    주세요.
                  </p>
                )}
                <Field label="상품">
                  <input
                    className={fieldClass}
                    name="product"
                    placeholder="OO뷰티 클렌징폼"
                    required
                  />
                </Field>
                <Field label="수량">
                  <input
                    className={fieldClass}
                    name="quantity"
                    type="number"
                    min={1}
                    defaultValue={1}
                  />
                </Field>
                <Field label="방문 코드 (선택)">
                  <input className={fieldClass} name="visit_code" />
                </Field>
                <button
                  className={primaryBtnClass}
                  type="submit"
                  disabled={storeList.length === 0}
                >
                  등록
                </button>
              </form>
            ) : null}
          </section>
        </aside>

        <section className="flex min-h-[min(70vh,calc(100dvh-12rem))] min-w-0 flex-col lg:sticky lg:top-4 lg:h-[calc(100dvh-6.5rem)] lg:min-h-0">
          <div className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-2">
            <div>
              <h2
                className="text-lg"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                배정 현황
              </h2>
              <p className="mt-1 text-sm text-[var(--accent)]">
                {selectedStoreName
                  ? `${selectedStoreName}만 표시 중`
                  : "전체 지점 표시중"}
              </p>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <PharListWithModal
              items={filteredList}
              fillHeight
              lockedStoreId={selectedStoreId || undefined}
              allowAdminEdit
              storeList={storeList}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
