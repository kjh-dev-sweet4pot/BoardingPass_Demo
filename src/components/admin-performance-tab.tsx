"use client";

import { useMemo, useState } from "react";
import { CompanyPerformanceLookupTab } from "@/components/company-performance-lookup-tab";
import { CompanyPerformanceTab } from "@/components/company-performance-tab";
import type { ContentPeriod } from "@/lib/content-insights";
import type { Company } from "@/lib/types";

function useAdminInsights(companies: Company[]) {
  const [companyId, setCompanyId] = useState("");
  const [period, setPeriod] = useState<ContentPeriod>("all");
  const activeCompanies = useMemo(
    () => companies.filter((c) => c.is_active !== false),
    [companies],
  );
  const insightsUrl = companyId
    ? `/api/admin/insights?company_id=${encodeURIComponent(companyId)}`
    : "/api/admin/insights";
  const companySelect = (
    <select
      aria-label="회원사"
      className="h-[38px] min-w-[160px] rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13px] text-[#5b4130]"
      value={companyId}
      onChange={(e) => setCompanyId(e.target.value)}
    >
      <option value="">회원사 전체</option>
      {activeCompanies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
  return { insightsUrl, period, setPeriod, companySelect };
}

export function AdminPerformanceTab({
  companies,
  onMetaChange,
}: {
  companies: Company[];
  onMetaChange?: (meta: {
    asOf: string;
    lastCollected: string | null;
    nextCollectAt: string | null;
  }) => void;
}) {
  const { insightsUrl, period, setPeriod, companySelect } = useAdminInsights(companies);
  return (
    <CompanyPerformanceTab
      key={insightsUrl}
      companyId="all"
      insightsUrl={insightsUrl}
      enableRecollect={false}
      period={period}
      onPeriodChange={setPeriod}
      onMetaChange={onMetaChange}
      toolbarExtra={companySelect}
    />
  );
}

export function AdminPerformanceLookupTab({
  companies,
  onMetaChange,
}: {
  companies: Company[];
  onMetaChange?: (meta: {
    asOf: string;
    lastCollected: string | null;
    nextCollectAt: string | null;
  }) => void;
}) {
  const { insightsUrl, period, setPeriod, companySelect } = useAdminInsights(companies);
  return (
    <CompanyPerformanceLookupTab
      key={insightsUrl}
      insightsUrl={insightsUrl}
      period={period}
      onPeriodChange={setPeriod}
      onMetaChange={onMetaChange}
      toolbarExtra={companySelect}
    />
  );
}
