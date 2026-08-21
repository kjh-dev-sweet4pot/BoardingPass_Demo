"use client";

import { useMemo, useState } from "react";
import { CompanyPerformanceTab } from "@/components/company-performance-tab";
import type { Company } from "@/lib/types";
import type { ContentPeriod } from "@/lib/content-insights";

export function AdminPerformanceTab({ companies }: { companies: Company[] }) {
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <label className="text-[12.5px] text-[var(--muted)]" htmlFor="admin-perf-company">
          회원사
        </label>
        <select
          id="admin-perf-company"
          className="h-[38px] min-w-[200px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13px] text-[#5b4130]"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          <option value="">전체 회원사</option>
          {activeCompanies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <CompanyPerformanceTab
        key={insightsUrl}
        companyId={companyId || "all"}
        insightsUrl={insightsUrl}
        enableRecollect={false}
        embedded
        period={period}
        onPeriodChange={setPeriod}
      />
    </div>
  );
}
