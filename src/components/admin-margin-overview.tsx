"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, fieldClass, primaryBtnClass } from "@/components/ui";
import { SpreadsheetTable, type SpreadsheetColumn } from "@/components/spreadsheet-table";
import { formatManwon, parseManwon } from "@/lib/company-budget-rounds";
import { MARGIN_STATE_COLOR, type Company, type Product } from "@/lib/types";

type MarginRow = {
  campaign_id: string;
  campaign_name: string | null;
  campaign_status: string;
  company_id: string;
  company_name: string | null;
  revenue: number | null;
  planned_cost: number;
  committed_cost: number;
  realized_cost: number;
  other_cost: number;
  committed_margin_rate: number | null;
  realized_margin_rate: number | null;
  burn_rate: number | null;
  spend_pct: number | null;
  target_publish_count: number | null;
  published_count: number;
  slot_total: number;
  slot_filled: number;
  margin_state: "over" | "ok" | "caution" | "risk" | "unknown";
};

const MARGIN_STATE_LABEL: Record<MarginRow["margin_state"], string> = {
  over: "과다 마진",
  ok: "정상",
  caution: "주의",
  risk: "위험",
  unknown: "산정 불가",
};

function rateText(v: number | null) {
  return v === null ? "—" : `${v}%`;
}

function buildMarginOverviewColumns(
  onManageBudget: (companyId: string) => void,
): SpreadsheetColumn<MarginRow>[] {
  return [
  { key: "company", label: "회원사", width: 120, render: (r) => r.company_name || "—" },
  {
    key: "campaign",
    label: "캠페인",
    width: 180,
    render: (r) => r.campaign_name || "(제목 없음)",
    edit: { kind: "text", getValue: (r) => r.campaign_name ?? "" },
  },
  { key: "status", label: "상태", width: 90, render: (r) => r.campaign_status },
  {
    key: "revenue",
    label: "예산(매출)",
    width: 110,
    align: "right",
    render: (r) => (
      <button
        type="button"
        className="underline decoration-dotted underline-offset-2 hover:text-[var(--accent)]"
        title="회원사 예산 관리에서만 수정할 수 있습니다"
        onClick={(e) => {
          e.stopPropagation();
          window.alert("회원사 예산 관리 페이지로 이동합니다.");
          onManageBudget(r.company_id);
        }}
      >
        {formatManwon(r.revenue)}
      </button>
    ),
  },
  { key: "planned_cost", label: "계획 원가", width: 110, align: "right", render: (r) => formatManwon(r.planned_cost) },
  { key: "committed_cost", label: "확정 원가", width: 110, align: "right", render: (r) => formatManwon(r.committed_cost) },
  { key: "realized_cost", label: "완료 원가", width: 110, align: "right", render: (r) => formatManwon(r.realized_cost) },
  { key: "other_cost", label: "기타 소요비용", width: 120, align: "right", render: (r) => formatManwon(r.other_cost) },
  { key: "committed_margin_rate", label: "집행 기준 마진", width: 110, align: "right", render: (r) => rateText(r.committed_margin_rate) },
  { key: "realized_margin_rate", label: "완료 기준 마진", width: 110, align: "right", render: (r) => rateText(r.realized_margin_rate) },
  { key: "burn_rate", label: "소진율", width: 90, align: "right", render: (r) => rateText(r.burn_rate) },
  { key: "spend_pct", label: "노출가 소진율", width: 110, align: "right", render: (r) => rateText(r.spend_pct) },
  {
    key: "target_publish_count",
    label: "발행 목표",
    width: 90,
    align: "right",
    render: (r) => r.target_publish_count ?? "—",
    edit: { kind: "number", getValue: (r) => String(r.target_publish_count ?? 0) },
  },
  { key: "published_count", label: "발행 완료", width: 90, align: "right", render: (r) => r.published_count },
  { key: "slot_total", label: "슬롯 전체", width: 90, align: "right", render: (r) => r.slot_total },
  { key: "slot_filled", label: "슬롯 채움", width: 90, align: "right", render: (r) => r.slot_filled },
  {
    key: "margin_state",
    label: "마진 상태",
    width: 100,
    render: (r) => (
      <span
        className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
        style={{ backgroundColor: MARGIN_STATE_COLOR[r.margin_state] }}
      >
        {MARGIN_STATE_LABEL[r.margin_state]}
      </span>
    ),
  },
  ];
}

function CreateCampaignForm({
  companies,
  products,
  onCreated,
}: {
  companies: Company[];
  products: Product[];
  onCreated: (campaignId: string) => void;
}) {
  const [companyId, setCompanyId] = useState("");
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [budgetManwon, setBudgetManwon] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localProducts, setLocalProducts] = useState<Product[]>(products);
  const [newProductName, setNewProductName] = useState("");
  const [addingProduct, setAddingProduct] = useState(false);

  useEffect(() => setLocalProducts(products), [products]);

  const companyProducts = useMemo(
    () => localProducts.filter((p) => p.company_id === companyId && p.is_active !== false),
    [localProducts, companyId],
  );

  async function addProduct() {
    if (!companyId || !newProductName.trim()) return;
    setAddingProduct(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProductName.trim(), company_id: companyId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLocalProducts((prev) => [...prev, data.product as Product]);
      setProductId(data.product.id as string);
      setNewProductName("");
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setAddingProduct(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          product_id: productId,
          name: name || null,
          budget_amount: parseManwon(budgetManwon),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setName("");
      setBudgetManwon("");
      onCreated(data.campaign.id as string);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-[8px] border border-[var(--line)] p-3">
      <Field label="회원사">
        <select
          className={fieldClass}
          value={companyId}
          onChange={(e) => {
            setCompanyId(e.target.value);
            setProductId("");
          }}
          required
        >
          <option value="">선택</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="상품">
        <div className="flex items-center gap-1.5">
          <select
            className={fieldClass}
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            required={companyProducts.length > 0}
            disabled={!companyId}
          >
            <option value="">{companyId ? "선택" : "회원사를 먼저 선택하세요"}</option>
            {companyProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {companyId ? (
            <>
              <input
                className={`${fieldClass} w-32`}
                placeholder="새 상품명"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
              />
              <button
                type="button"
                className="shrink-0 px-2 text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
                disabled={addingProduct || !newProductName.trim()}
                onClick={addProduct}
              >
                {addingProduct ? "추가 중…" : "+ 추가"}
              </button>
            </>
          ) : null}
        </div>
      </Field>
      <Field label="캠페인명 (선택)">
        <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="예산 (만원)">
        <input className={fieldClass} value={budgetManwon} onChange={(e) => setBudgetManwon(e.target.value)} />
      </Field>
      <button className={primaryBtnClass} type="submit" disabled={busy}>
        캠페인 생성
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

export function AdminMarginOverviewPanel({
  companies,
  products,
  onSelectCampaign,
  onManageBudget,
  lockCompanyId,
}: {
  companies: Company[];
  products: Product[];
  onSelectCampaign: (campaignId: string) => void;
  /** "예산(매출)" 클릭 시 이 회사의 예산 관리 화면으로 이동 — 예산은 거기서만 바꿀 수 있다. */
  onManageBudget: (companyId: string) => void;
  /** 지정하면 이 회원사로 고정하고 회원사 선택 드롭다운을 숨긴다 (회원사 탭용) */
  lockCompanyId?: string;
}) {
  const [rows, setRows] = useState<MarginRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [companyId, setCompanyId] = useState(lockCompanyId || "");
  const [marginStateFilter, setMarginStateFilter] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (companyId) params.set("company_id", companyId);
    if (marginStateFilter) params.set("margin_state", marginStateFilter);
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/admin/margin/overview?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        setRows(data.rows || []);
        setTotal(data.total || 0);
        setError(null);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, companyId, marginStateFilter, q, reloadTick]);

  async function saveEdits(edits: { row: MarginRow; rowKey: string; values: Record<string, string> }[]) {
    for (const { row, values } of edits) {
      if (values.campaign !== undefined) {
        const res = await fetch(`/api/admin/campaigns/${row.campaign_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: values.campaign }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
      }
      if (values.target_publish_count !== undefined) {
        const res = await fetch(`/api/admin/margin/campaign/${row.campaign_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_publish_count: Number(values.target_publish_count) || 0 }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
      }
    }
    setReloadTick((t) => t + 1);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 sm:p-7">
      <CreateCampaignForm
        companies={lockCompanyId ? companies.filter((c) => c.id === lockCompanyId) : companies}
        products={products}
        onCreated={(campaignId) => {
          setReloadTick((t) => t + 1);
          onSelectCampaign(campaignId);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        {lockCompanyId ? null : (
          <select
            className="h-10 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"
            value={companyId}
            onChange={(e) => {
              setPage(1);
              setCompanyId(e.target.value);
            }}
          >
            <option value="">전체 회원사</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <select
          className="h-10 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"
          value={marginStateFilter}
          onChange={(e) => {
            setPage(1);
            setMarginStateFilter(e.target.value);
          }}
        >
          <option value="">전체 상태</option>
          {(["over", "ok", "caution", "risk", "unknown"] as const).map((s) => (
            <option key={s} value={s}>
              {MARGIN_STATE_LABEL[s]}
            </option>
          ))}
        </select>
        <input
          className="h-10 flex-1 min-w-[160px] rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
          placeholder="캠페인명 검색"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <SpreadsheetTable
          storageKey="admin-margin-overview"
          columns={useMemo(() => buildMarginOverviewColumns(onManageBudget), [onManageBudget])}
          rows={rows}
          rowKey={(r) => r.campaign_id}
          rowLabel={(r) => r.campaign_name || "(제목 없음)"}
          onRowClick={(r) => onSelectCampaign(r.campaign_id)}
          onSave={saveEdits}
          emptyText="조건에 맞는 캠페인이 없습니다."
        />
      </div>

      <div className="flex items-center justify-end gap-2 text-sm text-[var(--muted)]">
        <button
          type="button"
          disabled={page <= 1}
          className="disabled:opacity-40"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          이전
        </button>
        <span>
          {page} / {Math.max(1, Math.ceil(total / 20))}
        </span>
        <button
          type="button"
          disabled={page * 20 >= total}
          className="disabled:opacity-40"
          onClick={() => setPage((p) => p + 1)}
        >
          다음
        </button>
      </div>
    </div>
  );
}
