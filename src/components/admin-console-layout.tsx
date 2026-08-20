"use client";

import { useMemo, useState } from "react";
import { createManualAllocation } from "@/app/actions/admin";
import { AdminCampaignCastingPanel } from "@/components/admin-campaign-casting-panel";
import { AdminCompanyPanel } from "@/components/admin-company-panel";
import { AdminImportPanel } from "@/components/admin-import-panel";
import { AdminLinkReview } from "@/components/admin-link-review";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminReviewQueue } from "@/components/admin-review-queue";
import { AdminSidebarNav, type AdminSection } from "@/components/admin-sidebar-nav";
import { AdminStoreOverview } from "@/components/admin-store-overview";
import { PharListWithModal } from "@/components/phar-list-with-modal";
import {
  Field,
  Notice,
  fieldClass,
  primaryBtnClass,
} from "@/components/ui";
import {
  type AllocationWithRelations,
  type Company,
  type Product,
  type Store,
} from "@/lib/types";

export function AdminConsoleLayout({
  storeList,
  companyList,
  productList,
  list,
  isManager,
  error,
  message,
}: {
  storeList: Store[];
  companyList: Company[];
  productList: Product[];
  list: AllocationWithRelations[];
  isManager: boolean;
  error?: string;
  message?: string;
}) {
  const [section, setSection] = useState<AdminSection>("dashboard");
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

      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start">
        <AdminSidebarNav section={section} onSectionChange={setSection} />

        <div className="min-w-0">
          {section === "dashboard" ? (
            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
              <aside className="flex flex-col gap-4">
                <AdminDashboard companies={companyList} />

                <AdminStoreOverview
                  storeList={storeList}
                  list={list}
                  selectedStoreId={selectedStoreId}
                  onSelectStore={setSelectedStoreId}
                />

                <AdminCompanyPanel companies={companyList} />

                <AdminLinkReview />

                <AdminImportPanel compact companies={companyList} />
              </aside>

              <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
                <h2
                  className="text-lg text-[var(--ink)]"
                  style={{ fontFamily: "var(--font-display), serif" }}
                >
                  처리 대기 요약
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  좌측 패널에서 큐·성과·예산을 확인하세요. 배정 목록은 「배정·매장」
                  메뉴에서 볼 수 있습니다.
                </p>
              </section>
            </div>
          ) : null}

          {section === "campaigns" ? (
            <AdminCampaignCastingPanel
              companies={companyList}
              products={productList}
              stores={storeList}
              isManager={isManager}
            />
          ) : null}

          {section === "review" ? <AdminReviewQueue /> : null}

          {section === "allocations" ? (
            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
              <aside className="flex flex-col gap-4">
                <AdminStoreOverview
                  storeList={storeList}
                  list={list}
                  selectedStoreId={selectedStoreId}
                  onSelectStore={setSelectedStoreId}
                />

                {isManager ? (
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
                        <Field label="회원사">
                          <select className={fieldClass} name="company_id" required>
                            <option value="">회원사 선택</option>
                            {companyList
                              .filter((c) => c.is_active)
                              .map((company) => (
                                <option key={company.id} value={company.id}>
                                  {company.name}
                                </option>
                              ))}
                          </select>
                        </Field>
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
                        <button className={primaryBtnClass} type="submit">
                          등록
                        </button>
                      </form>
                    ) : null}
                  </section>
                ) : null}
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
                    companyList={companyList}
                  />
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
