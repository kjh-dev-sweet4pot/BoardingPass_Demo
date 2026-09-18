"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminTestVisibility } from "@/components/admin-test-visibility";
import { Field, fieldClass, secondaryBtnClass } from "@/components/ui";
import type { Company, Product } from "@/lib/types";

export function AdminCompanyProductsPanel({
  companies,
  products,
  isManager,
  presetCompanyId = "",
}: {
  companies: Company[];
  products: Product[];
  isManager: boolean;
  presetCompanyId?: string;
}) {
  const { includeCompany } = useAdminTestVisibility();
  const liveCompanies = useMemo(
    () => companies.filter(includeCompany).sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [companies, includeCompany],
  );
  const companyName = useMemo(
    () => new Map(liveCompanies.map((c) => [c.id, c.name])),
    [liveCompanies],
  );
  const [list, setList] = useState(products);
  const [companyFilter, setCompanyFilter] = useState(presetCompanyId);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openRows, setOpenRows] = useState<{ key: string }[]>([]);

  useEffect(() => setList(products), [products]);

  const filtered = useMemo(() => {
    const rows = (companyFilter ? list.filter((p) => p.company_id === companyFilter) : list).filter(
      (p) => showArchived || p.is_active !== false,
    );
    return [...rows].sort((a, b) => {
      const an = (a.company_id && companyName.get(a.company_id)) || "";
      const bn = (b.company_id && companyName.get(b.company_id)) || "";
      return an.localeCompare(bn, "ko") || a.name.localeCompare(b.name, "ko");
    });
  }, [list, companyFilter, companyName]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted)]">
        전체 제품 목록입니다. 이름·SKU·설명·소속 회사를 바로 수정하거나 삭제할 수 있고, 아래에서
        새 제품을 추가할 수 있습니다.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="max-w-xs">
          <Field label="회원사로 좁히기">
            <select
              className={fieldClass}
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <option value="">전체</option>
              {liveCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-1.5 pb-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          보관된 상품 포함
        </label>
      </div>

      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}

      <section className="w-fit max-w-full rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-3">
        <p className="text-base font-semibold">제품 {filtered.length}개</p>
        <div className="mt-2 space-y-2">
          {filtered.length === 0 && openRows.length === 0 ? (
            <p className="text-[11px] text-[var(--muted)]">제품이 없습니다.</p>
          ) : (
            filtered.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                companies={liveCompanies}
                isManager={isManager}
                onSaved={(next) => {
                  setList((prev) => prev.map((x) => (x.id === next.id ? next : x)));
                }}
                onDeleted={(id) => setList((prev) => prev.filter((x) => x.id !== id))}
                onError={setError}
              />
            ))
          )}
          {openRows.map((row) => (
            <ProductRow
              key={row.key}
              product={{
                id: row.key,
                name: companyFilter ? companyName.get(companyFilter) || "" : "",
                sku: null,
                description: null,
                company_id: companyFilter || null,
                created_at: new Date().toISOString(),
              }}
              companies={liveCompanies}
              fresh
              isManager={isManager}
              onSaved={(next) => {
                setOpenRows((prev) => prev.filter((r) => r.key !== row.key));
                setList((prev) => [...prev, next]);
              }}
              onDeleted={() => setOpenRows((prev) => prev.filter((r) => r.key !== row.key))}
              onError={setError}
            />
          ))}
          {isManager ? (
            <button
              type="button"
              className={secondaryBtnClass}
              onClick={() => setOpenRows((prev) => [...prev, { key: `new-${Date.now()}` }])}
            >
              제품 추가
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ProductRow({
  product,
  companies,
  fresh,
  isManager,
  onSaved,
  onDeleted,
  onError,
}: {
  product: Product;
  companies: Company[];
  fresh?: boolean;
  isManager: boolean;
  onSaved: (product: Product) => void;
  onDeleted: (id: string) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku || "");
  const [description, setDescription] = useState(product.description || "");
  const [companyId, setCompanyId] = useState(product.company_id || "");
  const [busy, setBusy] = useState(false);

  const dirty =
    fresh ||
    name !== product.name ||
    sku !== (product.sku || "") ||
    description !== (product.description || "") ||
    companyId !== (product.company_id || "");

  async function commit() {
    if (!isManager || busy || !dirty || !name.trim()) return;
    setBusy(true);
    onError("");
    try {
      const url = fresh ? "/api/admin/products" : `/api/admin/products/${product.id}`;
      const res = await fetch(url, {
        method: fresh ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sku, description, company_id: companyId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "저장에 실패했습니다.");
      onSaved(data.product as Product);
    } catch (err) {
      onError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!isManager || busy) return;
    if (fresh) {
      onDeleted(product.id);
      return;
    }
    if (!window.confirm(`${product.name} 제품을 삭제할까요?`)) return;
    setBusy(true);
    onError("");
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "삭제에 실패했습니다.");
      if (data.archived && data.product) {
        onSaved(data.product as Product);
      } else {
        onDeleted(product.id);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    if (!isManager || busy) return;
    setBusy(true);
    onError("");
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !(product.is_active !== false) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "저장에 실패했습니다.");
      onSaved(data.product as Product);
    } catch (err) {
      onError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const lineField = `${fieldClass} h-9 w-auto shrink-0 px-2`;

  const archived = !fresh && product.is_active === false;

  return (
    <div
      className={`flex w-fit max-w-full flex-wrap items-center gap-1.5 rounded-[6px] border px-2 py-2 ${
        fresh ? "border-[var(--accent)]" : "border-[var(--line)]"
      } ${archived ? "opacity-60" : ""}`}
    >
      {archived ? (
        <span className="shrink-0 rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
          보관됨
        </span>
      ) : null}
      <select
        className={`${lineField} w-32`}
        value={companyId}
        disabled={!isManager || busy}
        onChange={(e) => setCompanyId(e.target.value)}
        aria-label="소속 회사"
      >
        <option value="">미배정</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        className={`${lineField} w-40`}
        value={name}
        placeholder="상품명"
        disabled={!isManager || busy}
        onChange={(e) => setName(e.target.value)}
        aria-label="상품명"
      />
      <input
        className={`${lineField} w-28`}
        value={sku}
        placeholder="SKU"
        disabled={!isManager || busy}
        onChange={(e) => setSku(e.target.value)}
        aria-label="SKU"
      />
      <input
        className={`${lineField} w-48`}
        value={description}
        placeholder="설명"
        disabled={!isManager || busy}
        onChange={(e) => setDescription(e.target.value)}
        aria-label="설명"
      />
      {isManager && dirty ? (
        <button
          type="button"
          className="shrink-0 rounded-[4px] px-1.5 py-0.5 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--surface-hover)] active:scale-[0.95] disabled:opacity-50"
          disabled={busy || !name.trim()}
          onClick={() => void commit()}
        >
          {busy ? "…" : "적용"}
        </button>
      ) : null}
      {isManager && archived ? (
        <button
          type="button"
          className="shrink-0 rounded-[4px] px-1.5 py-0.5 text-xs text-[var(--accent)] transition hover:bg-[var(--surface-hover)] active:scale-[0.95] disabled:opacity-50"
          disabled={busy}
          onClick={() => void toggleActive()}
        >
          {busy ? "…" : "복원"}
        </button>
      ) : null}
      {isManager ? (
        <button
          type="button"
          className="shrink-0 rounded-[4px] px-1.5 py-0.5 text-xs text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] active:scale-[0.95] disabled:opacity-50"
          disabled={busy}
          onClick={() => void remove()}
        >
          {busy ? "…" : "삭제"}
        </button>
      ) : null}
    </div>
  );
}
