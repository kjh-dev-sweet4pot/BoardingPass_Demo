"use client";

import { useState, type ReactNode } from "react";
import { AdminAllocSchedule } from "@/components/admin-alloc-schedule";
import { AdminCampaignCastingPanel } from "@/components/admin-campaign-casting-panel";
import { AdminCompaniesTab } from "@/components/admin-companies-tab";
import { AdminCompanyPanel } from "@/components/admin-company-panel";
import { AdminImportPanel } from "@/components/admin-import-panel";
import { AdminDashboard, type AdminQueueKey } from "@/components/admin-dashboard";
import { AdminPerformanceLookupTab, AdminPerformanceTab } from "@/components/admin-performance-tab";
import { AdminReviewQueue, type AdminReviewTab } from "@/components/admin-review-queue";
import { AdminConsoleShell, type AdminSection } from "@/components/admin-sidebar-nav";
import { Notice } from "@/components/ui";
import {
  formatMd,
  type AllocationWithRelations,
  type Company,
  type Product,
  type Store,
} from "@/lib/types";

const PAGE: Record<
  Exclude<
    AdminSection,
    | "performance"
    | "performanceLookup"
    | "companies"
    | "companiesRegister"
    | "companiesMail"
  >,
  { eyebrow: string; title: string }
> = {
  dashboard: { eyebrow: "Overview", title: "대시보드" },
  campaigns: { eyebrow: "Campaigns", title: "캠페인·섭외" },
  review: { eyebrow: "Review", title: "검수" },
  allocations: { eyebrow: "Allocations", title: "배정·매장" },
};

function fmtCollectedKst(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PageHeader({
  section,
  extra,
}: {
  section: Exclude<
    AdminSection,
    | "performance"
    | "performanceLookup"
    | "companies"
    | "companiesRegister"
    | "companiesMail"
  >;
  extra?: ReactNode;
}) {
  const meta = PAGE[section];
  return (
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 px-4 pb-4 pt-5 sm:px-7">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
          {meta.eyebrow}
        </p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight text-[var(--ink)] sm:text-[30px]">
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
  const [reviewQueue, setReviewQueue] = useState<AdminReviewTab>("reviewPending");
  const [castingStale, setCastingStale] = useState(false);
  const [performanceMeta, setPerformanceMeta] = useState<{
    asOf: string;
    lastCollected: string | null;
    nextCollectAt: string | null;
  } | null>(null);

  function openQueue(queue: AdminQueueKey) {
    if (queue === "castingStale") {
      setCastingStale(true);
      setSection("campaigns");
      return;
    }
    if (queue === "published") {
      setSection("performance");
      return;
    }
    const tab: AdminReviewTab =
      queue === "verifyFailed" || queue === "collectFailed"
        ? "collectResults"
        : queue;
    setReviewQueue(tab);
    setSection("review");
  }

  const headerFooter =
    (section === "performance" || section === "performanceLookup") && performanceMeta ? (
      <>
        <p>
          {performanceMeta.asOf} 조회 시점 기준
          {performanceMeta.lastCollected
            ? ` / 최종 수집: ${fmtCollectedKst(performanceMeta.lastCollected)}`
            : ""}
        </p>
        {performanceMeta.nextCollectAt ? (
          <p>
            갱신 예정 {formatMd(performanceMeta.nextCollectAt.slice(0, 10))} 00:00
          </p>
        ) : null}
      </>
    ) : null;

  return (
    <AdminConsoleShell
      section={section}
      onSectionChange={(next) => {
        if (next !== "campaigns") setCastingStale(false);
        if (next !== "review") setReviewQueue("reviewPending");
        if (next !== "performance" && next !== "performanceLookup") setPerformanceMeta(null);
        setSection(next);
      }}
      sidebarActions={sidebarActions}
      headerFooter={headerFooter}
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
            <AdminDashboard companies={companyList} onOpenQueue={openQueue} />
            <div className="grid gap-4 lg:grid-cols-2">
              <AdminCompanyPanel companies={companyList} />
              <AdminImportPanel compact companies={companyList} />
            </div>
          </div>
        </div>
      ) : null}

      {section === "performance" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AdminPerformanceTab
            companies={companyList}
            onMetaChange={setPerformanceMeta}
          />
        </div>
      ) : null}

      {section === "performanceLookup" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AdminPerformanceLookupTab
            companies={companyList}
            onMetaChange={setPerformanceMeta}
          />
        </div>
      ) : null}

      {section === "companies" ||
      section === "companiesRegister" ||
      section === "companiesMail" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AdminCompaniesTab
            companies={companyList}
            isManager={isManager}
            sub={section}
            onSubChange={setSection}
          />
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
              staleCastings={castingStale}
            />
          </div>
        </div>
      ) : null}

      {section === "review" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PageHeader section="review" />
          <div className="min-h-0 flex-1 overflow-auto px-4 pb-8 sm:px-7">
            <AdminReviewQueue
              queue={reviewQueue}
              onQueueChange={setReviewQueue}
            />
          </div>
        </div>
      ) : null}

      {section === "allocations" ? (
        <div className="min-h-0 flex-1 overflow-auto pt-5">
          <AdminAllocSchedule
            list={list}
            storeList={storeList}
            companyList={companyList}
          />
        </div>
      ) : null}
    </AdminConsoleShell>
  );
}
