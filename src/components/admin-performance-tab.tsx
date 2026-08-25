"use client";

import { useMemo, useState } from "react";
import { CompanyPerformanceTab } from "@/components/company-performance-tab";
import type { Company } from "@/lib/types";
import type { ContentPeriod } from "@/lib/content-insights";

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
  const [companyId, setCompanyId] = useState("");
  const [period, setPeriod] = useState<ContentPeriod>("all");

  const activeCompanies = useMemo(
    () => companies.filter((c) => c.is_active !== false),
    [companies],
  );

  const insightsUrl = companyId
    ? `/api/admin/insights?company_id=${encodeURIComponent(companyId)}`
    : "/api/admin/insights";

  return (
    <CompanyPerformanceTab
      key={insightsUrl}
      companyId={companyId || "all"}
      insightsUrl={insightsUrl}
      enableRecollect={false}
      period={period}
      onPeriodChange={setPeriod}
      onMetaChange={onMetaChange}
      toolbarExtra={
        <select
          id="admin-perf-company"
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
      }
    />
  );
}
