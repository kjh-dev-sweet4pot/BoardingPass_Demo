"use client";

import { useEffect, useMemo, useState } from "react";
import { secondaryBtnClass } from "@/components/ui";
import { formatManwon, parseManwon } from "@/lib/company-budget-rounds";
import {
  defaultInvoicePayload,
  type DocLine,
} from "@/lib/company-docs";
import {
  calcBurnRate,
  calcMarginRate,
  MARGIN_STATE_COLOR,
  marginState,
  type OtherCostType,
  type Tier,
} from "@/lib/types";

const TIERS: Tier[] = ["nano", "micro", "mid", "macro", "mega"];
const OTHER_COST_TYPES: OtherCostType[] = ["광고비", "상품제공가", "대행수수료", "기타"];
const TABS = ["개요", "예산·계획", "배치", "기타 소요비용"] as const;
type Tab = (typeof TABS)[number];

type BudgetPlanItem = {
  id: string;
  tier: Tier;
  content_type: string | null;
  platform: string | null;
  unit_cost: number;
  slot_count: number;
  expected_publish_per_slot: number;
  sort_order: number;
  planned_amount: number;
  filled_count: number;
  remaining_count: number;
};

type OtherCost = { id: string; cost_type: OtherCostType; amount: number; memo: string | null };

type Detail = {
  campaign: {
    id: string;
    name: string | null;
    status: string;
    budget_amount: number | null;
    companies: { id: string; name: string } | { id: string; name: string }[] | null;
    products: { id: string; name: string } | { id: string; name: string }[] | null;
  };
  margin: {
    committed_margin_rate: number | null;
    realized_margin_rate: number | null;
    burn_rate: number | null;
    committed_cost: number;
    realized_cost: number;
    other_cost: number;
  } | null;
  target: { target_publish_count: number; memo: string | null } | null;
  budgetItems: BudgetPlanItem[];
  otherCosts: OtherCost[];
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

export function AdminMarginCampaignPanel({
  campaignId,
  onBack,
}: {
  campaignId: string;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<Tab>("개요");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoiceMsg, setInvoiceMsg] = useState<string | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/margin/campaign/${campaignId}`, { cache: "no-store" });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setDetail(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const company = one(detail?.campaign.companies ?? null);
  const product = one(detail?.campaign.products ?? null);

  const projectedCost = useMemo(() => {
    if (!detail) return 0;
    return detail.budgetItems.reduce((s, i) => s + i.unit_cost * i.slot_count, 0) + detail.otherCosts.reduce((s, c) => s + c.amount, 0);
  }, [detail]);

  const projectedMarginRate = useMemo(() => {
    if (!detail?.campaign.budget_amount) return null;
    return calcMarginRate(detail.campaign.budget_amount, projectedCost);
  }, [detail, projectedCost]);

  async function createInvoiceDraft() {
    if (!detail || !company) return;
    setInvoiceBusy(true);
    setInvoiceMsg(null);
    try {
      const sugRes = await fetch(`/api/admin/margin/campaign/${campaignId}/invoice-suggestion`);
      const sug = await sugRes.json();
      if (sug.error) throw new Error(sug.error);

      const payload = {
        ...defaultInvoicePayload({ name: company.name }),
        lines: sug.lines as DocLine[],
      };
      const res = await fetch("/api/admin/company-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: company.id,
          kind: "인보이스",
          title: `INVOICE ${payload.invoiceNo} (초안)`,
          status: "초안",
          payload,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInvoiceMsg(`초안 생성됨 (${sug.basis}). 회원사 › 계약·인보이스 탭에서 검토·발송하세요.`);
    } catch (e) {
      setInvoiceMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setInvoiceBusy(false);
    }
  }

  if (loading) return <p className="p-7 text-sm text-[var(--muted)]">불러오는 중…</p>;
  if (error || !detail) return <p className="p-7 text-sm text-red-600">{error || "데이터 없음"}</p>;

  const state = marginState(detail.margin?.committed_margin_rate ?? null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 sm:p-7">
      <div className="flex items-center justify-between gap-2">
        <div>
          <button type="button" onClick={onBack} className="text-xs text-[var(--muted)] hover:underline">
            ← 마진 현황으로
          </button>
          <h2 className="text-lg font-semibold">{detail.campaign.name || "(제목 없음)"}</h2>
          <p className="text-sm text-[var(--muted)]">
            {company?.name || "—"} · {product?.name || "—"}
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: MARGIN_STATE_COLOR[state] }}
        >
          집행 기준 마진 {detail.margin?.committed_margin_rate ?? "—"}%
        </span>
      </div>

      <div className="flex gap-1 border-b border-[var(--line)]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t ? "border-b-2 border-[var(--accent)] text-[var(--ink)]" : "text-[var(--muted)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "개요" ? (
          <OverviewTab detail={detail} projectedCost={projectedCost} projectedMarginRate={projectedMarginRate} />
        ) : null}
        {tab === "예산·계획" ? (
          <BudgetPlanTab campaignId={campaignId} items={detail.budgetItems} onChanged={load} />
        ) : null}
        {tab === "배치" ? <SlotFillTab items={detail.budgetItems} /> : null}
        {tab === "기타 소요비용" ? (
          <OtherCostsTab campaignId={campaignId} costs={detail.otherCosts} onChanged={load} />
        ) : null}
      </div>

      {tab === "개요" ? (
        <div className="flex items-center gap-3 border-t border-[var(--line)] pt-3">
          <button
            type="button"
            className={secondaryBtnClass}
            disabled={invoiceBusy}
            onClick={createInvoiceDraft}
          >
            {invoiceBusy ? "생성 중…" : "인보이스 초안 생성"}
          </button>
          {invoiceMsg ? <p className="text-sm text-[var(--muted)]">{invoiceMsg}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function OverviewTab({
  detail,
  projectedCost,
  projectedMarginRate,
}: {
  detail: Detail;
  projectedCost: number;
  projectedMarginRate: number | null;
}) {
  const m = detail.margin;
  const revenue = detail.campaign.budget_amount;
  const burn = calcBurnRate(revenue ?? 0, m?.committed_cost ?? 0);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Kpi label="예산(매출)" value={formatManwon(revenue)} />
      <Kpi label="계획 원가" value={formatManwon(projectedCost)} />
      <Kpi label="확정 원가(committed)" value={formatManwon(m?.committed_cost ?? 0)} />
      <Kpi label="완료 원가(realized)" value={formatManwon(m?.realized_cost ?? 0)} />
      <Kpi label="기타 소요비용" value={formatManwon(m?.other_cost ?? 0)} />
      <Kpi label="계획 기준 마진율" value={projectedMarginRate === null ? "—" : `${projectedMarginRate}%`} />
      <Kpi label="집행 기준 마진율" value={m?.committed_margin_rate === null || m?.committed_margin_rate === undefined ? "—" : `${m.committed_margin_rate}%`} />
      <Kpi label="완료 기준 마진율" value={m?.realized_margin_rate === null || m?.realized_margin_rate === undefined ? "—" : `${m.realized_margin_rate}%`} />
      <Kpi label="소진율(원가/예산 30%)" value={burn === null ? "—" : `${burn}%`} />
      <Kpi label="발행 목표" value={`${detail.target?.target_publish_count ?? "—"}건`} />
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

function BudgetPlanTab({
  campaignId,
  items,
  onChanged,
}: {
  campaignId: string;
  items: BudgetPlanItem[];
  onChanged: () => void;
}) {
  const [tier, setTier] = useState<Tier>("micro");
  const [unitCostManwon, setUnitCostManwon] = useState("");
  const [slotCount, setSlotCount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const unitCost = parseManwon(unitCostManwon);
      const res = await fetch(`/api/admin/margin/campaign/${campaignId}/budget-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, unit_cost: unitCost ?? 0, slot_count: Number(slotCount) || 0 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUnitCostManwon("");
      setSlotCount("1");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(itemId: string) {
    await fetch(`/api/admin/margin/campaign/${campaignId}/budget-items?item_id=${itemId}`, {
      method: "DELETE",
    });
    onChanged();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          티어
          <select
            className="h-10 rounded-[6px] border border-[var(--line)] px-2 text-sm"
            value={tier}
            onChange={(e) => setTier(e.target.value as Tier)}
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          단가(만원)
          <input
            className="h-10 w-28 rounded-[6px] border border-[var(--line)] px-2 text-sm"
            value={unitCostManwon}
            onChange={(e) => setUnitCostManwon(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          슬롯 수
          <input
            className="h-10 w-20 rounded-[6px] border border-[var(--line)] px-2 text-sm"
            value={slotCount}
            onChange={(e) => setSlotCount(e.target.value)}
          />
        </label>
        <button type="button" className={secondaryBtnClass} disabled={busy} onClick={add}>
          추가
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <table className="w-full text-sm">
        <thead className="text-left text-[var(--muted)]">
          <tr className="border-b border-[var(--line)]">
            <th className="px-2 py-2">티어</th>
            <th className="px-2 py-2 text-right">단가</th>
            <th className="px-2 py-2 text-right">슬롯</th>
            <th className="px-2 py-2 text-right">계획 금액</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b border-[var(--line)] last:border-0">
              <td className="px-2 py-2">{i.tier}</td>
              <td className="px-2 py-2 text-right">{formatManwon(i.unit_cost)}</td>
              <td className="px-2 py-2 text-right">{i.slot_count}</td>
              <td className="px-2 py-2 text-right">{formatManwon(i.planned_amount)}</td>
              <td className="px-2 py-2 text-right">
                <button type="button" className="text-xs text-red-600" onClick={() => remove(i.id)}>
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlotFillTab({ items }: { items: BudgetPlanItem[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-[var(--muted)]">
        <tr className="border-b border-[var(--line)]">
          <th className="px-2 py-2">티어</th>
          <th className="px-2 py-2 text-right">전체 슬롯</th>
          <th className="px-2 py-2 text-right">배치 완료</th>
          <th className="px-2 py-2 text-right">잔여</th>
        </tr>
      </thead>
      <tbody>
        {items.map((i) => (
          <tr key={i.id} className="border-b border-[var(--line)] last:border-0">
            <td className="px-2 py-2">{i.tier}</td>
            <td className="px-2 py-2 text-right">{i.slot_count}</td>
            <td className="px-2 py-2 text-right">{i.filled_count}</td>
            <td className="px-2 py-2 text-right">{i.remaining_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OtherCostsTab({
  campaignId,
  costs,
  onChanged,
}: {
  campaignId: string;
  costs: OtherCost[];
  onChanged: () => void;
}) {
  const [costType, setCostType] = useState<OtherCostType>("광고비");
  const [amountManwon, setAmountManwon] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const amount = parseManwon(amountManwon);
      const res = await fetch(`/api/admin/margin/campaign/${campaignId}/other-costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost_type: costType, amount: amount ?? 0, memo }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAmountManwon("");
      setMemo("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(costId: string) {
    await fetch(`/api/admin/margin/campaign/${campaignId}/other-costs?cost_id=${costId}`, {
      method: "DELETE",
    });
    onChanged();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          종류
          <select
            className="h-10 rounded-[6px] border border-[var(--line)] px-2 text-sm"
            value={costType}
            onChange={(e) => setCostType(e.target.value as OtherCostType)}
          >
            {OTHER_COST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          금액(만원)
          <input
            className="h-10 w-28 rounded-[6px] border border-[var(--line)] px-2 text-sm"
            value={amountManwon}
            onChange={(e) => setAmountManwon(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          메모
          <input
            className="h-10 w-40 rounded-[6px] border border-[var(--line)] px-2 text-sm"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </label>
        <button type="button" className={secondaryBtnClass} disabled={busy} onClick={add}>
          추가
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <table className="w-full text-sm">
        <thead className="text-left text-[var(--muted)]">
          <tr className="border-b border-[var(--line)]">
            <th className="px-2 py-2">종류</th>
            <th className="px-2 py-2 text-right">금액</th>
            <th className="px-2 py-2">메모</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {costs.map((c) => (
            <tr key={c.id} className="border-b border-[var(--line)] last:border-0">
              <td className="px-2 py-2">{c.cost_type}</td>
              <td className="px-2 py-2 text-right">{formatManwon(c.amount)}</td>
              <td className="px-2 py-2">{c.memo || "—"}</td>
              <td className="px-2 py-2 text-right">
                <button type="button" className="text-xs text-red-600" onClick={() => remove(c.id)}>
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
