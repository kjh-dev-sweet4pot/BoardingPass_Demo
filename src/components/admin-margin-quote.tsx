"use client";

import { useEffect, useMemo, useState } from "react";
import { secondaryBtnClass } from "@/components/ui";
import { formatManwon, parseManwon } from "@/lib/company-budget-rounds";
import { quoteSummary, type QuoteLine } from "@/lib/quote-engine";
import { MARGIN_STATE_COLOR, TARGET_MARGIN_RATE, type ContentType, type Platform, type Tier } from "@/lib/types";

const TIERS: Tier[] = ["nano", "micro", "mid", "macro", "mega"];
const CONTENT_TYPES: ContentType[] = ["carousel", "visit", "seeding"];
const PLATFORMS: Platform[] = ["instagram", "tiktok", "youtube", "naver_blog", "etc"];

type CampaignOption = {
  id: string;
  name: string | null;
  companies: { name: string } | { name: string }[] | null;
};

function emptyLine(): QuoteLine {
  return { tier: "micro", content_type: "carousel", platform: "instagram", unit_cost: 0, slot_count: 1 };
}

export function AdminMarginQuotePanel() {
  const [lines, setLines] = useState<QuoteLine[]>([emptyLine()]);
  const [targetRate, setTargetRate] = useState(TARGET_MARGIN_RATE);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    fetch("/api/admin/campaigns")
      .then((res) => res.json())
      .then((data) => setCampaigns(data.campaigns || []))
      .catch(() => {});
  }, []);

  const summary = useMemo(() => quoteSummary(lines, null, targetRate), [lines, targetRate]);

  function updateLine(i: number, patch: Partial<QuoteLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function applyToCampaign() {
    if (!campaignId) return;
    setApplying(true);
    setApplyMsg(null);
    try {
      for (const line of lines) {
        if (!line.unit_cost || !line.slot_count) continue;
        const res = await fetch(`/api/admin/margin/campaign/${campaignId}/budget-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(line),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
      }
      setApplyMsg("선택한 캠페인의 예산·계획에 반영했습니다. 캠페인 마진 화면에서 확인하세요.");
    } catch (e) {
      setApplyMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 sm:p-7">
      <div className="rounded-[8px] border border-[var(--line)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <p className="text-sm text-[var(--muted)]">목표 마진율</p>
          <input
            type="number"
            className="h-9 w-20 rounded-[6px] border border-[var(--line)] px-2 text-sm"
            value={targetRate}
            onChange={(e) => setTargetRate(Number(e.target.value) || 0)}
          />
          <span className="text-sm text-[var(--muted)]">%</span>
        </div>

        <table className="w-full text-sm">
          <thead className="text-left text-[var(--muted)]">
            <tr className="border-b border-[var(--line)]">
              <th className="px-2 py-2">티어</th>
              <th className="px-2 py-2">콘텐츠</th>
              <th className="px-2 py-2">플랫폼</th>
              <th className="px-2 py-2 text-right">단가(만원)</th>
              <th className="px-2 py-2 text-right">슬롯 수</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-b border-[var(--line)] last:border-0">
                <td className="px-2 py-2">
                  <select
                    className="h-9 rounded-[6px] border border-[var(--line)] px-2 text-sm"
                    value={line.tier}
                    onChange={(e) => updateLine(i, { tier: e.target.value as Tier })}
                  >
                    {TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <select
                    className="h-9 rounded-[6px] border border-[var(--line)] px-2 text-sm"
                    value={line.content_type}
                    onChange={(e) => updateLine(i, { content_type: e.target.value as ContentType })}
                  >
                    {CONTENT_TYPES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <select
                    className="h-9 rounded-[6px] border border-[var(--line)] px-2 text-sm"
                    value={line.platform}
                    onChange={(e) => updateLine(i, { platform: e.target.value as Platform })}
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2 text-right">
                  <input
                    className="h-9 w-24 rounded-[6px] border border-[var(--line)] px-2 text-right text-sm"
                    defaultValue={line.unit_cost ? String(line.unit_cost / 10_000) : ""}
                    onBlur={(e) => updateLine(i, { unit_cost: parseManwon(e.target.value) ?? 0 })}
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  <input
                    className="h-9 w-16 rounded-[6px] border border-[var(--line)] px-2 text-right text-sm"
                    value={line.slot_count}
                    onChange={(e) => updateLine(i, { slot_count: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    className="text-xs text-red-600"
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className={`${secondaryBtnClass} mt-3`}
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
        >
          슬롯 추가
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="총 원가" value={formatManwon(summary.cost)} />
        <Kpi label={`제안 매출(목표 ${targetRate}%)`} value={formatManwon(summary.suggestedRevenue)} />
        <Kpi label="예상 마진율" value={summary.marginRate === null ? "—" : `${summary.marginRate}%`} />
        <div className="rounded-[8px] border border-[var(--line)] p-3">
          <p className="text-xs text-[var(--muted)]">상태</p>
          <span
            className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: MARGIN_STATE_COLOR[summary.state] }}
          >
            {summary.state}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--line)] pt-3">
        <select
          className="h-10 rounded-[6px] border border-[var(--line)] px-2 text-sm"
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
        >
          <option value="">캠페인 선택 (예산·계획에 반영)</option>
          {campaigns.map((c) => {
            const company = Array.isArray(c.companies) ? c.companies[0] : c.companies;
            return (
              <option key={c.id} value={c.id}>
                {company?.name ? `${company.name} · ` : ""}
                {c.name || "(제목 없음)"}
              </option>
            );
          })}
        </select>
        <button
          type="button"
          className={secondaryBtnClass}
          disabled={!campaignId || applying}
          onClick={applyToCampaign}
        >
          {applying ? "반영 중…" : "캠페인에 반영"}
        </button>
        {applyMsg ? <p className="text-sm text-[var(--muted)]">{applyMsg}</p> : null}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[var(--line)] p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
