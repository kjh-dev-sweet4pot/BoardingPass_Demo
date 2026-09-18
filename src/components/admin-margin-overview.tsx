"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState, Field, fieldClass, primaryBtnClass } from "@/components/ui";
import { formatManwon, parseManwon } from "@/lib/company-budget-rounds";
import { MARGIN_STATE_COLOR, type Company, type Product } from "@/lib/types";

type MarginRow = {
  campaign_id: string;
  campaign_name: string | null;
  campaign_status: string;
  company_id: string;
  company_name: string | null;
  revenue: number | null;
  committed_margin_rate: number | null;
  realized_margin_rate: number | null;
  burn_rate: number | null;
  spend_pct: number | null;
  target_publish_count: number | null;
  published_count: number;
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
  lockCompanyId,
}: {
  companies: Company[];
  products: Product[];
  onSelectCampaign: (campaignId: string) => void;
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

      <div className="min-h-0 flex-1 overflow-auto rounded-[8px] border border-[var(--line)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[var(--surface)] text-[var(--muted)]">
            <tr className="border-b border-[var(--line)] text-left">
              <th className="px-3 py-2">캠페인</th>
              <th className="px-3 py-2">회원사</th>
              <th className="px-3 py-2 text-right">예산</th>
              <th className="px-3 py-2 text-right">집행 기준 마진</th>
              <th className="px-3 py-2 text-right">완료 기준 마진</th>
              <th className="px-3 py-2 text-right">소진율</th>
              <th className="px-3 py-2">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.campaign_id}
                className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-hover)]"
                onClick={() => onSelectCampaign(r.campaign_id)}
              >
                <td className="px-3 py-2">{r.campaign_name || "(제목 없음)"}</td>
                <td className="px-3 py-2">{r.company_name || "—"}</td>
                <td className="px-3 py-2 text-right">{formatManwon(r.revenue)}</td>
                <td className="px-3 py-2 text-right">{rateText(r.committed_margin_rate)}</td>
                <td className="px-3 py-2 text-right">{rateText(r.realized_margin_rate)}</td>
                <td className="px-3 py-2 text-right">{rateText(r.burn_rate)}</td>
                <td className="px-3 py-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: MARGIN_STATE_COLOR[r.margin_state] }}
                  >
                    {MARGIN_STATE_LABEL[r.margin_state]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 ? (
          <EmptyState title="조건에 맞는 캠페인이 없습니다." positive />
        ) : null}
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
