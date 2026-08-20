"use client";

import { useMemo, useState, type ReactNode } from "react";
import { createManualAllocation } from "@/app/actions/admin";
import { AdminCampaignCastingPanel } from "@/components/admin-campaign-casting-panel";
import { AdminCompanyPanel } from "@/components/admin-company-panel";
import { AdminImportPanel } from "@/components/admin-import-panel";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminReviewQueue } from "@/components/admin-review-queue";
import { AdminConsoleShell, type AdminSection } from "@/components/admin-sidebar-nav";
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

const PAGE: Record<AdminSection, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: "Overview", title: "대시보드" },
  campaigns: { eyebrow: "Campaigns", title: "캠페인·섭외" },
  review: { eyebrow: "Review", title: "검수" },
  allocations: { eyebrow: "Allocations", title: "배정·매장" },
};

function PageHeader({
  section,
  extra,
}: {
  section: AdminSection;
  extra?: ReactNode;
}) {
  const meta = PAGE[section];
  return (
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 px-4 pb-4 pt-5 sm:px-7">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
          {meta.eyebrow}
        </p>
        <h1
          className="mt-1 text-[28px] font-semibold leading-tight text-[var(--ink)] sm:text-[30px]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          {meta.title}
        </h1>
      </div>
      {extra}
    </div>
  );
}

export function AdminConsoleLayout({
  storeList,
  companyList,
  productList,
  list,
  isManager,
  error,
  message,
  sidebarActions,
}: {
  storeList: Store[];
  companyList: Company[];
  productList: Product[];
  list: AllocationWithRelations[];
  isManager: boolean;
  error?: string;
  message?: string;
  sidebarActions?: ReactNode;
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
    <AdminConsoleShell
      section={section}
      onSectionChange={setSection}
      sidebarActions={sidebarActions}
    >
      {error || message ? (
        <div className="shrink-0 px-4 pt-4 sm:px-7">
          <Notice error={error} message={message} />
        </div>
      ) : null}

      {section === "dashboard" ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <PageHeader section="dashboard" />
          <div className="space-y-6 px-4 pb-8 sm:px-7">
            <AdminDashboard companies={companyList} />
            <div className="grid gap-4 lg:grid-cols-2">
              <AdminCompanyPanel companies={companyList} />
              <AdminImportPanel compact companies={companyList} />
            </div>
          </div>
        </div>
      ) : null}

      {section === "campaigns" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PageHeader section="campaigns" />
          <div className="min-h-0 flex-1 overflow-auto px-4 pb-8 sm:px-7">
            <AdminCampaignCastingPanel
              companies={companyList}
              products={productList}
              stores={storeList}
              isManager={isManager}
            />
          </div>
        </div>
      ) : null}

      {section === "review" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PageHeader section="review" />
          <div className="min-h-0 flex-1 overflow-auto px-4 pb-8 sm:px-7">
            <AdminReviewQueue />
          </div>
        </div>
      ) : null}

      {section === "allocations" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PageHeader
            section="allocations"
            extra={
              <p className="text-sm text-[var(--accent)]">
                {selectedStoreName
                  ? `${selectedStoreName}만 표시 중`
                  : "전체 지점 표시중"}
              </p>
            }
          />
          <div className="grid min-h-0 flex-1 gap-4 overflow-hidden px-4 pb-6 sm:px-7 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col gap-4 overflow-auto">
              <AdminStoreOverview
                storeList={storeList}
                list={list}
                selectedStoreId={selectedStoreId}
                onSelectStore={setSelectedStoreId}
              />
              {isManager ? (
                <section className="owm-panel border border-[var(--line)] bg-[var(--surface)]">
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
                        <input className={fieldClass} name="name" placeholder="김미나" />
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
                        <input className={fieldClass} name="visit_date" type="date" required />
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
            <section className="flex min-h-0 min-w-0 flex-col">
              <PharListWithModal
                items={filteredList}
                fillHeight
                lockedStoreId={selectedStoreId || undefined}
                allowAdminEdit
                storeList={storeList}
                companyList={companyList}
              />
            </section>
          </div>
        </div>
      ) : null}
    </AdminConsoleShell>
  );
}
