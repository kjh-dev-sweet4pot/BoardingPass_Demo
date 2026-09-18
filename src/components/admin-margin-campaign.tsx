"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Field, fieldClass, primaryBtnClass, secondaryBtnClass } from "@/components/ui";
import {
  combineSpreadsheetHandles,
  SpreadsheetTable,
  type SpreadsheetColumn,
  type SpreadsheetTableHandle,
} from "@/components/spreadsheet-table";
import { formatManwon, krwToManwon, parseManwon } from "@/lib/company-budget-rounds";
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
  type Store,
  type Tier,
} from "@/lib/types";

const TIERS: Tier[] = ["nano", "micro", "mid", "macro", "mega"];
const OTHER_COST_TYPES: OtherCostType[] = ["광고비", "상품제공가", "대행수수료", "기타"];
const TABS = ["개요", "예산·계획", "배치", "기타 소요비용"] as const;
type Tab = (typeof TABS)[number];

type BudgetPlanItem = {
  id: string;
  tier: Tier | "unclassified";
  content_type: string | null;
  platform: string | null;
  unit_cost: number;
  slot_count: number;
  expected_publish_per_slot: number;
  sort_order: number;
  memo?: string | null;
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
  unassignedAllocations: {
    id: string;
    influencer_name: string;
    cost_amount: number | null;
    display_price: number | null;
    quote_total_amount: number | null;
    split_company_count: number;
  }[];
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

export function AdminMarginCampaignPanel({
  campaignId,
  stores,
  onBack,
}: {
  campaignId: string;
  stores: Store[];
  onBack: () => void;
}) {
  const [tab, setTab] = useState<Tab>("개요");
  const activeTableRef = useRef<SpreadsheetTableHandle | null>(null);
  function switchTab(next: Tab) {
    if (activeTableRef.current) activeTableRef.current.confirmLeave(() => setTab(next));
    else setTab(next);
  }
  function back() {
    if (activeTableRef.current) activeTableRef.current.confirmLeave(onBack);
    else onBack();
  }
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
          <button type="button" onClick={back} className="text-xs text-[var(--muted)] hover:underline">
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
            onClick={() => switchTab(t)}
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
          <BudgetPlanTab campaignId={campaignId} items={detail.budgetItems} onChanged={load} tableRef={activeTableRef} />
        ) : null}
        {tab === "배치" ? (
          <SlotFillTab
            campaignId={campaignId}
            companyId={company?.id}
            companyName={company?.name}
            items={detail.budgetItems}
            unassignedAllocations={detail.unassignedAllocations}
            tableRef={activeTableRef}
            stores={stores}
            onChanged={load}
          />
        ) : null}
        {tab === "기타 소요비용" ? (
          <OtherCostsTab campaignId={campaignId} costs={detail.otherCosts} onChanged={load} tableRef={activeTableRef} />
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

type InvoiceOption = { id: string; title: string; issued_on: string; line_count: number; total: number };

function ImportInvoiceForm({ campaignId, onChanged }: { campaignId: string; onChanged: () => void }) {
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [docId, setDocId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/admin/margin/campaign/${campaignId}/invoices`)
      .then((res) => res.json())
      .then((data) => setInvoices(data.invoices ?? []))
      .catch(() => {});
  }, [open, campaignId]);

  async function importInvoice() {
    if (!docId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/margin/campaign/${campaignId}/budget-items/import-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: docId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOpen(false);
      setDocId("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={secondaryBtnClass} onClick={() => setOpen(true)}>
        인보이스 불러오기
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-[8px] border border-[var(--line)] p-3">
      <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
        인보이스
        <select
          className="h-10 min-w-[220px] rounded-[6px] border border-[var(--line)] px-2 text-sm"
          value={docId}
          onChange={(e) => setDocId(e.target.value)}
        >
          <option value="">선택</option>
          {invoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.issued_on} · {inv.title} · {inv.line_count}줄 · {formatManwon(inv.total)}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className={secondaryBtnClass} disabled={busy || !docId} onClick={importInvoice}>
        불러오기
      </button>
      <button type="button" className="text-xs text-[var(--muted)]" onClick={() => setOpen(false)}>
        취소
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
      {invoices.length === 0 ? (
        <p className="w-full text-xs text-[var(--muted)]">이 회원사 앞 인보이스가 없습니다.</p>
      ) : (
        <p className="w-full text-xs text-[var(--muted)]">
          인보이스에는 등급 정보가 없어 임시로 micro로 채워집니다. 필요하면 아래 목록에서 삭제 후
          알맞은 티어로 다시 추가하세요.
        </p>
      )}
    </div>
  );
}

function BudgetPlanTab({
  campaignId,
  items,
  onChanged,
  tableRef,
}: {
  campaignId: string;
  items: BudgetPlanItem[];
  onChanged: () => void;
  tableRef: React.RefObject<SpreadsheetTableHandle | null>;
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

  async function saveEdits(
    edits: { row: BudgetPlanItem; rowKey: string; values: Record<string, string> }[],
  ) {
    for (const { row, values } of edits) {
      const res = await fetch(`/api/admin/margin/campaign/${campaignId}/budget-items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          tier: values.tier ?? row.tier,
          unit_cost: values.unit_cost != null ? (parseManwon(values.unit_cost) ?? 0) : row.unit_cost,
          slot_count: values.slot_count != null ? Number(values.slot_count) || 0 : row.slot_count,
          expected_publish_per_slot: row.expected_publish_per_slot,
          sort_order: row.sort_order,
          memo: values.memo ?? row.memo,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
    }
    onChanged();
  }

  return (
    <div className="flex flex-col gap-3">
      <ImportInvoiceForm campaignId={campaignId} onChanged={onChanged} />
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

      <SpreadsheetTable
        ref={tableRef}
        storageKey="admin-margin-budget-plan"
        rowKey={(i) => i.id}
        rowLabel={(i) => (i.tier === "unclassified" ? "구분 없음" : i.tier)}
        rows={items}
        emptyText="등록된 예산 계획이 없습니다."
        onSave={saveEdits}
        columns={[
          {
            key: "tier",
            label: "티어",
            width: 100,
            render: (i) => (i.tier === "unclassified" ? "구분 없음" : i.tier),
            edit: { kind: "select", options: TIERS, getValue: (i) => i.tier },
          },
          {
            key: "unit_cost",
            label: "단가",
            width: 100,
            align: "right",
            render: (i) => formatManwon(i.unit_cost),
            edit: { kind: "number", getValue: (i) => String(krwToManwon(i.unit_cost) ?? 0), formatValue: (v) => `${v}만원` },
          },
          {
            key: "slot_count",
            label: "슬롯",
            width: 70,
            align: "right",
            render: (i) => i.slot_count,
            edit: { kind: "number", getValue: (i) => String(i.slot_count) },
          },
          { key: "planned_amount", label: "계획 금액", width: 110, align: "right", render: (i) => formatManwon(i.planned_amount) },
          {
            key: "memo",
            label: "메모",
            width: 200,
            render: (i) => i.memo || "—",
            edit: { kind: "text", getValue: (i) => i.memo ?? "" },
          },
          {
            key: "actions",
            label: "",
            width: 60,
            align: "right",
            render: (i) => (
              <button type="button" className="text-xs text-red-600" onClick={() => remove(i.id)}>
                삭제
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}

type CompanyMargin = { revenue: number; cost: number; marginRate: number | null };

/** 이 배정이 캠페인 하나가 아니라 대상회사 누적 마진에 미치는 영향을 보여준다. */
function CompanyMarginPreview({
  companyId,
  companyName,
  extraCost,
}: {
  companyId?: string;
  companyName?: string;
  extraCost: number;
}) {
  const [base, setBase] = useState<CompanyMargin | null>(null);

  useEffect(() => {
    if (!companyId) {
      setBase(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/admin/margin/company/${companyId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && !data.error) setBase(data as CompanyMargin);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (!base) return null;

  const projectedRate = calcMarginRate(base.revenue, base.cost + (extraCost || 0));
  const label = companyName ? `${companyName} 누적 마진율` : "대상회사 누적 마진율";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)] sm:col-span-2">
      <span>{label} (현재): {base.marginRate === null ? "—" : `${base.marginRate}%`}</span>
      <span>
        이 배정 포함 시(예상): {projectedRate === null ? "—" : `${projectedRate}%`}
      </span>
    </div>
  );
}

type RosterInfluencer = {
  id: string;
  name: string;
  instagram_handle: string;
  phone?: string | null;
  email?: string | null;
  /** 배정된 회원사 개수 — 운영 admin 전용 정보. 회원사(com) 사이트에는 절대 노출 금지. */
  company_count?: number;
};

/** 아직 어느 회사에도 배정되지 않은 인플루언서를 검색해 이 캠페인에 바로 배정(확정)한다. */
function DirectAssignInfluencer({
  campaignId,
  companyId,
  companyName,
  stores,
  onChanged,
}: {
  campaignId: string;
  companyId?: string;
  companyName?: string;
  stores: Store[];
  onChanged: () => void;
}) {
  const [q, setQ] = useState("");
  const [includeAssigned, setIncludeAssigned] = useState(false);
  const [roster, setRoster] = useState<RosterInfluencer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [influencerId, setInfluencerId] = useState("");
  const [applying, setApplying] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marginReason, setMarginReason] = useState("");
  const [needsMarginReason, setNeedsMarginReason] = useState(false);
  const [form, setForm] = useState({
    display_price: "",
    cost_amount: "",
    target_content_count: "1",
    phone: "",
    email: "",
    store_id: "",
    visit_date: "",
  });

  useEffect(() => {
    if (!open || !showSuggestions) {
      setRoster([]);
      return;
    }
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q });
      if (!includeAssigned) params.set("unassigned", "1");
      fetch(`/api/admin/influencers?${params}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => setRoster(data.influencers ?? []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [open, showSuggestions, q, includeAssigned]);

  function pick(r: RosterInfluencer) {
    setInfluencerId(r.id);
    setQ(`${r.name} (@${r.instagram_handle})`);
    setShowSuggestions(false);
  }

  async function applyPick() {
    if (!influencerId) return;
    setApplying(true);
    try {
      const picked = roster.find((r) => r.id === influencerId);
      setForm((f) => ({
        ...f,
        phone: picked?.phone || f.phone,
        email: picked?.email || f.email,
      }));
      const [rateRes, infRes] = await Promise.all([
        fetch(`/api/admin/margin/rate-cards?influencer_id=${influencerId}`, { cache: "no-store" }).then((r) =>
          r.json(),
        ),
        fetch(`/api/admin/influencers/${influencerId}`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      const latest = rateRes.rateCards?.[0];
      const hint = infRes.latestAllocation as { store_id: string; visit_date: string | null } | null;
      setForm((f) => ({
        ...f,
        cost_amount: latest?.standard_cost ? String(latest.standard_cost) : f.cost_amount,
        store_id: hint ? f.store_id || hint.store_id : f.store_id,
        visit_date: hint ? f.visit_date || hint.visit_date?.slice(0, 10) || f.visit_date : f.visit_date,
      }));
    } catch {
      // 자동 채우기 실패는 조용히 무시 — 직접 입력하면 된다.
    } finally {
      setApplying(false);
    }
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!influencerId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/assign-influencer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          influencer_id: influencerId,
          display_price: Number(form.display_price),
          cost_amount: Number(form.cost_amount),
          target_content_count: Number(form.target_content_count),
          phone: form.phone,
          email: form.email,
          store_id: form.store_id,
          visit_date: form.visit_date,
          margin_reason: marginReason,
        }),
      });
      const data = await res.json();
      if (data.error) {
        if (data.error.includes("경고 구간")) setNeedsMarginReason(true);
        throw new Error(data.error);
      }
      setOpen(false);
      setInfluencerId("");
      setQ("");
      setMarginReason("");
      setNeedsMarginReason(false);
      onChanged();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={secondaryBtnClass} onClick={() => setOpen(true)}>
        인플루언서 배정
      </button>
    );
  }

  return (
    <div className="rounded-[8px] border border-[var(--line)] p-3">
      <h3 className="text-sm font-semibold">인플루언서 배정</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">선택하면 협상 없이 바로 확정됩니다.</p>
      <label className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
        <input
          type="checkbox"
          checked={includeAssigned}
          onChange={(e) => setIncludeAssigned(e.target.checked)}
        />
        이미 다른 회사에 배정된 인플루언서도 포함해서 찾기
      </label>
      <form onSubmit={assign} className="mt-3 grid gap-2 sm:grid-cols-2">
        <Field label="인플루언서 검색 (핸들·이름)">
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <input
                className={`${fieldClass} w-full pr-8`}
                required
                value={q}
                placeholder="@handle 또는 이름"
                onChange={(e) => {
                  setQ(e.target.value);
                  setInfluencerId("");
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (!influencerId) setShowSuggestions(true);
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label="목록 펼치기"
                className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-[var(--muted)]"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setShowSuggestions((prev) => !prev);
                }}
              >
                ▾
              </button>
              {showSuggestions && roster.length > 0 ? (
                <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-[6px] border border-[var(--line)] bg-[var(--surface)] text-sm shadow-sm">
                  {roster.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="block w-full px-3 py-1.5 text-left hover:bg-[var(--surface-hover)]"
                        onMouseDown={() => pick(r)}
                      >
                        {r.name} (@{r.instagram_handle})
                        {r.company_count ? ` · 배정 회사 ${r.company_count}곳` : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button
              type="button"
              className={secondaryBtnClass}
              disabled={!influencerId || applying}
              onClick={() => void applyPick()}
            >
              {applying ? "적용 중…" : "적용"}
            </button>
          </div>
        </Field>
        <Field label="노출가 (원)">
          <input
            className={fieldClass}
            type="number"
            min={0}
            required
            value={form.display_price}
            onChange={(e) => setForm((f) => ({ ...f, display_price: e.target.value }))}
          />
        </Field>
        <Field label="원가 (원)">
          <input
            className={fieldClass}
            type="number"
            min={0}
            required
            value={form.cost_amount}
            onChange={(e) => setForm((f) => ({ ...f, cost_amount: e.target.value }))}
          />
        </Field>
        <Field label="목표 콘텐츠 수">
          <input
            className={fieldClass}
            type="number"
            min={1}
            required
            value={form.target_content_count}
            onChange={(e) => setForm((f) => ({ ...f, target_content_count: e.target.value }))}
          />
        </Field>
        <Field label="전화">
          <input className={fieldClass} required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </Field>
        <Field label="이메일">
          <input
            className={fieldClass}
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </Field>
        <Field label="방문 지점">
          <select
            className={fieldClass}
            required
            value={form.store_id}
            onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value }))}
          >
            <option value="">선택</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="방문 예정일">
          <input
            className={fieldClass}
            type="date"
            required
            value={form.visit_date}
            onChange={(e) => setForm((f) => ({ ...f, visit_date: e.target.value }))}
          />
        </Field>
        <CompanyMarginPreview companyId={companyId} companyName={companyName} extraCost={Number(form.cost_amount) || 0} />
        {needsMarginReason ? (
          <Field label="마진율 경고 사유 (확정하려면 필수)">
            <input
              className={fieldClass}
              required
              value={marginReason}
              onChange={(e) => setMarginReason(e.target.value)}
            />
          </Field>
        ) : null}
        <div className="flex gap-2 sm:col-span-2">
          <button className={primaryBtnClass} type="submit" disabled={busy || !influencerId}>
            배정 확정
          </button>
          <button type="button" className="text-xs text-[var(--muted)]" onClick={() => setOpen(false)}>
            취소
          </button>
        </div>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

type SlotCandidate = {
  influencer_id: string;
  name: string;
  instagram_handle: string;
  already_cast_in: { campaign_name: string | null; company_name: string | null }[];
};

function SlotFillTab({
  campaignId,
  companyId,
  companyName,
  items,
  unassignedAllocations,
  tableRef,
  stores,
  onChanged,
}: {
  campaignId: string;
  companyId?: string;
  companyName?: string;
  items: BudgetPlanItem[];
  unassignedAllocations: {
    id: string;
    influencer_name: string;
    cost_amount: number | null;
    display_price: number | null;
    quote_total_amount: number | null;
    split_company_count: number;
  }[];
  tableRef: React.RefObject<SpreadsheetTableHandle | null>;
  stores: Store[];
  onChanged: () => void;
}) {
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<SlotCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleCandidates(itemId: string) {
    if (openItemId === itemId) {
      setOpenItemId(null);
      return;
    }
    setOpenItemId(itemId);
    setLoadingCandidates(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/margin/budget-items/${itemId}/candidates`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCandidates(data.candidates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingCandidates(false);
    }
  }

  async function savePricingEdits(
    edits: {
      row: { id: string };
      rowKey: string;
      values: Record<string, string>;
    }[],
  ) {
    for (const { row, values } of edits) {
      const patch: Record<string, number> = {};
      if (values.cost_amount != null) patch.cost_amount = parseManwon(values.cost_amount) ?? 0;
      if (values.display_price != null) patch.display_price = parseManwon(values.display_price) ?? 0;
      const res = await fetch(`/api/admin/allocations/${row.id}/pricing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
    }
    onChanged();
  }

  async function saveItemEdits(
    edits: { row: BudgetPlanItem; rowKey: string; values: Record<string, string> }[],
  ) {
    for (const { row, values } of edits) {
      const res = await fetch(`/api/admin/margin/campaign/${campaignId}/budget-items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          tier: values.tier ?? row.tier,
          unit_cost: row.unit_cost,
          slot_count: values.slot_count != null ? Number(values.slot_count) || 0 : row.slot_count,
          expected_publish_per_slot: row.expected_publish_per_slot,
          sort_order: row.sort_order,
          memo: row.memo,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
    }
    onChanged();
  }

  const itemsTableRef = useRef<SpreadsheetTableHandle | null>(null);
  const allocTableRef = useRef<SpreadsheetTableHandle | null>(null);
  useEffect(() => {
    tableRef.current = combineSpreadsheetHandles(itemsTableRef.current, allocTableRef.current);
  });

  return (
    <div className="flex flex-col gap-3">
      <DirectAssignInfluencer
        campaignId={campaignId}
        companyId={companyId}
        companyName={companyName}
        stores={stores}
        onChanged={onChanged}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <SpreadsheetTable
        ref={itemsTableRef}
        storageKey="admin-margin-slots"
        rowKey={(i) => i.id}
        rowLabel={(i) => (i.tier === "unclassified" ? "구분 없음" : i.tier)}
        rows={items}
        emptyText="등록된 슬롯이 없습니다."
        onSave={saveItemEdits}
        columns={[
          {
            key: "tier",
            label: "티어",
            width: 100,
            render: (i) => (i.tier === "unclassified" ? "구분 없음" : i.tier),
            edit: { kind: "select", options: TIERS, getValue: (i) => i.tier },
          },
          {
            key: "slot_count",
            label: "전체 슬롯",
            width: 90,
            align: "right",
            render: (i) => i.slot_count,
            edit: { kind: "number", getValue: (i) => String(i.slot_count) },
          },
          { key: "filled_count", label: "배치 완료", width: 90, align: "right", render: (i) => i.filled_count },
          { key: "remaining_count", label: "잔여", width: 80, align: "right", render: (i) => i.remaining_count },
          {
            key: "actions",
            label: "",
            width: 90,
            render: (i) =>
              i.remaining_count > 0 ? (
                <button
                  type="button"
                  className="text-xs text-[var(--accent)]"
                  onClick={() => void toggleCandidates(i.id)}
                >
                  {openItemId === i.id ? "닫기" : "슬롯 추천"}
                </button>
              ) : null,
          },
        ]}
      />

      {unassignedAllocations.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-[var(--muted)]">
            예산·계획 슬롯 연결은 별개(보류)이며, 위 표의 잔여 수량에는 반영되지 않습니다.
          </p>
          <SpreadsheetTable
            ref={allocTableRef}
            storageKey="admin-margin-unassigned-allocations"
            rowKey={(a) => a.id}
            rowLabel={(a) => a.influencer_name}
            rows={unassignedAllocations}
            emptyText="확정된 배정이 없습니다."
            onSave={savePricingEdits}
            columns={[
              { key: "influencer_name", label: "인플루언서", width: 160, render: (a) => a.influencer_name },
              {
                key: "cost_amount",
                label: "원가",
                width: 110,
                align: "right",
                render: (a) => (a.cost_amount == null ? "—" : formatManwon(a.cost_amount)),
                edit: { kind: "number", getValue: (a) => String(krwToManwon(a.cost_amount ?? 0) ?? 0), formatValue: (v) => `${v}만원` },
              },
              {
                key: "quote_total_amount",
                label: "분배 전 원가",
                width: 120,
                align: "right",
                render: (a) => (a.quote_total_amount == null ? "—" : formatManwon(a.quote_total_amount)),
              },
              {
                key: "split_company_count",
                label: "분배 회사 수",
                width: 100,
                align: "right",
                render: (a) => `${a.split_company_count}개사`,
              },
              {
                key: "display_price",
                label: "노출가",
                width: 110,
                align: "right",
                render: (a) => (a.display_price == null ? "—" : formatManwon(a.display_price)),
                edit: { kind: "number", getValue: (a) => String(krwToManwon(a.display_price ?? 0) ?? 0), formatValue: (v) => `${v}만원` },
              },
            ]}
          />
        </div>
      ) : null}

      {openItemId ? (
        <div className="rounded-[8px] border border-[var(--line)] p-3">
          <p className="text-xs text-[var(--muted)]">
            다른 회원사 캠페인에 이미 Accept로 확정된 같은 등급 인플루언서 — 이 슬롯에 겹쳐 배치하면
            추가 원가를 낮출 수 있습니다.
          </p>
          {loadingCandidates ? (
            <p className="mt-2 text-sm text-[var(--muted)]">불러오는 중…</p>
          ) : (
            <div className="mt-2">
              <SpreadsheetTable
                storageKey="admin-margin-slot-candidates"
                rowKey={(c) => c.influencer_id}
                rows={candidates}
                emptyText="추천할 인플루언서가 없습니다."
                columns={[
                  { key: "name", label: "이름", width: 140, render: (c) => c.name },
                  { key: "handle", label: "핸들", width: 140, render: (c) => `@${c.instagram_handle}` },
                  {
                    key: "already_cast_in",
                    label: "확정된 회사",
                    width: 220,
                    render: (c) =>
                      c.already_cast_in.map((a) => a.company_name ?? "—").filter(Boolean).join(", "),
                  },
                ]}
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function OtherCostsTab({
  campaignId,
  costs,
  onChanged,
  tableRef,
}: {
  campaignId: string;
  costs: OtherCost[];
  onChanged: () => void;
  tableRef: React.RefObject<SpreadsheetTableHandle | null>;
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

  async function saveEdits(edits: { row: OtherCost; rowKey: string; values: Record<string, string> }[]) {
    for (const { row, values } of edits) {
      const res = await fetch(`/api/admin/margin/campaign/${campaignId}/other-costs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          cost_type: values.cost_type ?? row.cost_type,
          amount: values.amount != null ? (parseManwon(values.amount) ?? 0) : row.amount,
          memo: values.memo ?? row.memo,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
    }
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

      <SpreadsheetTable
        ref={tableRef}
        storageKey="admin-margin-other-costs"
        rowKey={(c) => c.id}
        rowLabel={(c) => c.cost_type}
        rows={costs}
        emptyText="등록된 기타 소요비용이 없습니다."
        onSave={saveEdits}
        columns={[
          {
            key: "cost_type",
            label: "종류",
            width: 110,
            render: (c) => c.cost_type,
            edit: { kind: "select", options: OTHER_COST_TYPES, getValue: (c) => c.cost_type },
          },
          {
            key: "amount",
            label: "금액",
            width: 110,
            align: "right",
            render: (c) => formatManwon(c.amount),
            edit: { kind: "number", getValue: (c) => String(krwToManwon(c.amount) ?? 0), formatValue: (v) => `${v}만원` },
          },
          {
            key: "memo",
            label: "메모",
            width: 220,
            render: (c) => c.memo || "—",
            edit: { kind: "text", getValue: (c) => c.memo ?? "" },
          },
          {
            key: "actions",
            label: "",
            width: 60,
            align: "right",
            render: (c) => (
              <button type="button" className="text-xs text-red-600" onClick={() => remove(c.id)}>
                삭제
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
