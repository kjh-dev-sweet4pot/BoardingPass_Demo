"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminCompaniesTab } from "@/components/admin-companies-tab";
import { AdminCompanyPanel } from "@/components/admin-company-panel";
import { AdminImportPanel } from "@/components/admin-import-panel";
import { AdminDashboard, type AdminQueueKey } from "@/components/admin-dashboard";
import { AdminInfluencersTab } from "@/components/admin-influencers-tab";
import { AdminMarginCampaignPanel } from "@/components/admin-margin-campaign";
import { AdminMarginOverviewPanel } from "@/components/admin-margin-overview";
import { AdminMarginQuotePanel } from "@/components/admin-margin-quote";
import { AdminMarginRateCardPanel } from "@/components/admin-margin-rate-card";
import { AdminPerformanceLookupTab, AdminPerformanceTab } from "@/components/admin-performance-tab";
import { type AdminReviewTab } from "@/components/admin-review-queue";
import { ADMIN_SECTIONS, AdminConsoleShell, type AdminSection } from "@/components/admin-sidebar-nav";
import { AdminBankdaTab } from "@/components/admin-bankda-tab";
import {
  AdminTestVisibilityProvider,
  useAdminTestVisibility,
} from "@/components/admin-test-visibility";
import { EmptyState, Notice } from "@/components/ui";
import {
  formatMd,
  type AllocationWithRelations,
  type Company,
  type Product,
  type Store,
} from "@/lib/types";

const PAGE: Record<"dashboard", { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: "Overview", title: "대시보드" },
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
  section: "dashboard";
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

const REVIEW_TABS: AdminReviewTab[] = ["reviewPending", "reviewLogs", "publishStale", "collectResults"];

export function AdminConsoleLayout(props: {
  storeList: Store[];
  companyList: Company[];
  productList: Product[];
  list: AllocationWithRelations[];
  isManager: boolean;
  isSuperAdmin?: boolean;
  error?: string;
  message?: string;
  sidebarActions?: ReactNode;
  initialSection?: string;
  initialCampaignId?: string;
  initialReviewQueue?: string;
}) {
  return (
    <AdminTestVisibilityProvider companies={props.companyList}>
      <AdminConsoleLayoutBody {...props} />
    </AdminTestVisibilityProvider>
  );
}

function AdminConsoleLayoutBody({
  storeList,
  companyList,
  productList,
  list,
  isManager,
  isSuperAdmin,
  error,
  message,
  sidebarActions,
  initialSection,
  initialCampaignId,
  initialReviewQueue,
}: {
  storeList: Store[];
  companyList: Company[];
  productList: Product[];
  list: AllocationWithRelations[];
  isManager: boolean;
  isSuperAdmin?: boolean;
  error?: string;
  message?: string;
  sidebarActions?: ReactNode;
  initialSection?: string;
  initialCampaignId?: string;
  initialReviewQueue?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { includeCompany } = useAdminTestVisibility();
  const visibleCompanies = useMemo(
    () => companyList.filter(includeCompany),
    [companyList, includeCompany],
  );
  const visibleAllocations = useMemo(
    () =>
      list.filter((item) =>
        includeCompany({ id: item.company_id, name: item.companies?.name }),
      ),
    [list, includeCompany],
  );
  const [section, setSection] = useState<AdminSection>(
    initialSection && (ADMIN_SECTIONS as string[]).includes(initialSection)
      ? (initialSection as AdminSection)
      : "dashboard",
  );
  const [reviewQueue, setReviewQueue] = useState<AdminReviewTab>(
    initialReviewQueue && (REVIEW_TABS as string[]).includes(initialReviewQueue)
      ? (initialReviewQueue as AdminReviewTab)
      : "reviewPending",
  );
  const [marginCampaignId, setMarginCampaignId] = useState<string | null>(initialCampaignId || null);
  const [companiesFocusId, setCompaniesFocusId] = useState<string | null>(null);
  const [performanceMeta, setPerformanceMeta] = useState<{
    asOf: string;
    lastCollected: string | null;
    nextCollectAt: string | null;
  } | null>(null);

  // 뒤로가기/앞으로가기는 URL만 바꾸고 이 컴포넌트를 다시 마운트하지 않으므로,
  // 최초 마운트 때만 쓰이는 useState 초기값과 별개로 props가 바뀔 때마다 상태를 맞춰준다.
  useEffect(() => {
    setSection(
      initialSection && (ADMIN_SECTIONS as string[]).includes(initialSection)
        ? (initialSection as AdminSection)
        : "dashboard",
    );
    setMarginCampaignId(initialCampaignId || null);
    setReviewQueue(
      initialReviewQueue && (REVIEW_TABS as string[]).includes(initialReviewQueue)
        ? (initialReviewQueue as AdminReviewTab)
        : "reviewPending",
    );
  }, [initialSection, initialCampaignId, initialReviewQueue]);

  /** section/campaignId/reviewQueue를 상태에 반영하고 URL에 새 기록을 남긴다 —
   * 뒤로가기로 직전 화면에 돌아가고, 새로고침해도 같은 화면이 남도록 한다. */
  function navigate(next: {
    section: AdminSection;
    campaignId?: string | null;
    companyId?: string | null;
    reviewQueue?: AdminReviewTab;
  }) {
    setSection(next.section);
    if ("campaignId" in next) setMarginCampaignId(next.campaignId ?? null);
    if ("companyId" in next) setCompaniesFocusId(next.companyId ?? null);
    if (next.reviewQueue) setReviewQueue(next.reviewQueue);

    const params = new URLSearchParams();
    params.set("section", next.section);
    const campaignId = "campaignId" in next ? next.campaignId : marginCampaignId;
    if (next.section === "marginCampaign" && campaignId) params.set("campaignId", campaignId);
    const queue = next.reviewQueue ?? reviewQueue;
    if (next.section === "influencersReview" && queue !== "reviewPending") {
      params.set("reviewQueue", queue);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function openQueue(queue: AdminQueueKey) {
    if (queue === "published") {
      navigate({ section: "performance" });
      return;
    }
    const tab: AdminReviewTab =
      queue === "verifyFailed" || queue === "collectFailed"
        ? "collectResults"
        : queue;
    navigate({ section: "influencersReview", reviewQueue: tab });
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
        if (next !== "performance" && next !== "performanceLookup") setPerformanceMeta(null);
        navigate({ section: next, campaignId: null, reviewQueue: "reviewPending" });
      }}
      sidebarActions={sidebarActions}
      headerFooter={headerFooter}
      isManager={isManager}
      isSuperAdmin={isSuperAdmin}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {error || message ? (
        <div className="shrink-0 px-4 pt-4 sm:px-7">
          <Notice error={error} message={message} />
        </div>
      ) : null}

      {section === "dashboard" ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <PageHeader section="dashboard" />
          <div className="space-y-6 px-4 pb-8 sm:px-7">
            <AdminDashboard companies={visibleCompanies} onOpenQueue={openQueue} />
            <div className="grid gap-4 lg:grid-cols-2">
              <AdminCompanyPanel companies={visibleCompanies} />
              <AdminImportPanel compact companies={visibleCompanies} />
            </div>
          </div>
        </div>
      ) : null}

      {section === "performance" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AdminPerformanceTab
            companies={visibleCompanies}
            onMetaChange={setPerformanceMeta}
          />
        </div>
      ) : null}

      {section === "performanceLookup" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AdminPerformanceLookupTab
            companies={visibleCompanies}
            onMetaChange={setPerformanceMeta}
          />
        </div>
      ) : null}

      {      section === "companies" ||
      section === "companiesOverview" ||
      section === "companiesRegister" ||
      section === "companiesMail" ||
      section === "companiesDocs" ||
      section === "companiesBudget" ||
      section === "companiesProducts" ||
      section === "companiesCampaigns" ||
      section === "companiesAutoCollect" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AdminCompaniesTab
            companies={companyList}
            products={productList}
            stores={storeList}
            isManager={isManager}
            sub={section}
            onSubChange={(next) => navigate({ section: next })}
            initialFocusCompanyId={companiesFocusId}
          />
        </div>
      ) : null}

      {section === "influencersRegister" ||
      section === "influencersReview" ||
      section === "influencersAlloc" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AdminInfluencersTab
            sub={section}
            isManager={isManager}
            storeList={storeList}
            companyList={visibleCompanies}
            productList={productList}
            allocations={visibleAllocations}
            reviewQueue={reviewQueue}
            onReviewQueueChange={(next) => navigate({ section: "influencersReview", reviewQueue: next })}
          />
        </div>
      ) : null}

      {section === "marginOverview" && isManager ? (
        <AdminMarginOverviewPanel
          companies={visibleCompanies}
          products={productList}
          onSelectCampaign={(campaignId) => navigate({ section: "marginCampaign", campaignId })}
          onManageBudget={(companyId) => navigate({ section: "companiesBudget", companyId })}
        />
      ) : null}

      {section === "marginRateCard" && isManager ? <AdminMarginRateCardPanel /> : null}

      {section === "marginQuote" && isManager ? <AdminMarginQuotePanel /> : null}

      {section === "marginCampaign" && isManager ? (
        marginCampaignId ? (
          <AdminMarginCampaignPanel
            campaignId={marginCampaignId}
            stores={storeList}
            onBack={() => navigate({ section: "marginOverview", campaignId: null })}
          />
        ) : (
          <EmptyState title="캠페인을 먼저 선택하세요." message="마진 현황에서 캠페인을 클릭하면 상세로 이동합니다." positive />
        )
      ) : null}

      {section === "bankda" ? (
        isSuperAdmin ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <AdminBankdaTab />
          </div>
        ) : (
          <EmptyState
            title="접근 권한이 없습니다."
            message="Bankda 거래내역은 최고 관리자 계정만 열람할 수 있습니다."
          />
        )
      ) : null}
      </div>
    </AdminConsoleShell>
  );
}
