"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminTestVisibility } from "@/components/admin-test-visibility";
import { Field, fieldClass, secondaryBtnClass } from "@/components/ui";
import { formatDocKrw, invoiceTotals, lineAmount, type CompanyDocRow, type InvoicePayload } from "@/lib/company-docs";
import { classifyTierFromText } from "@/lib/quote-engine";
import {
  BUDGET_DEPOSIT_STATUSES,
  BUDGET_TABLE_SETUP,
  BUDGET_USAGE_STATUSES,
  displayDepositKrw,
  formatManwon,
  krwToManwon,
  MANWON,
  monthLabel,
  normalizeDepositStatus,
  normalizeUsageStatus,
  orphanUsageRounds,
  roundKind,
  shiftMonth,
  summarizeCashflow,
  usagesForDeposit,
  type BudgetDepositStatus,
  type BudgetRound,
  type BudgetUsageStatus,
} from "@/lib/company-budget-rounds";
import type { Company, Product } from "@/lib/types";

const SLAM_YEAR = "2026";

type CampaignSummary = {
  id: string;
  company_id: string;
  name: string | null;
  status: string;
  budget_amount: number | null;
  products?: { name: string } | null;
};

/** 예산 라운드는 campaign_id가 없어 회원사 단위로만 매칭할 수 있다 (근사치). */
function campaignNamesForCompany(campaigns: CampaignSummary[], companyId: string) {
  return campaigns
    .filter((c) => c.company_id === companyId && c.status !== "취소")
    .map((c) => c.name || c.products?.name || "(이름 없음)")
    .join(", ");
}

function displayName(round: BudgetRound, companies: Company[]) {
  return companies.find((c) => c.id === round.company_id)?.name || round.company_name;
}

function sameCompany(round: BudgetRound, companyId: string, companyName: string) {
  if (companyId) return round.company_id === companyId;
  const name = companyName.trim();
  if (!name) return false;
  return !round.company_id && round.company_name === name;
}

function nextPeriod(rows: { period_month: string }[]) {
  const last = [...rows].sort((a, b) => a.period_month.localeCompare(b.period_month)).at(-1);
  return last ? shiftMonth(last.period_month, 1) : `${SLAM_YEAR}-09`;
}

const TIER_LABEL: Record<string, string> = {
  mega: "메가",
  macro: "매크로",
  mid: "미들",
  micro: "마이크로",
  nano: "나노",
  unclassified: "미분류",
};

export function AdminCompanyBudgetPanel({
  companies,
  products,
  isManager,
  onBudgetsApplied,
  presetCompanyId = "",
  presetInvoiceDocId = "",
}: {
  companies: Company[];
  products: Product[];
  isManager: boolean;
  onBudgetsApplied: (patches: {
    company_id: string;
    budget_amount: number | null;
    contract_stage?: string | null;
  }[]) => void;
  presetCompanyId?: string;
  presetInvoiceDocId?: string;
}) {
  const { includeCompany } = useAdminTestVisibility();
  const [rounds, setRounds] = useState<BudgetRound[]>([]);
  const [productList, setProductList] = useState(products);
  useEffect(() => setProductList(products), [products]);
  const liveCompanies = useMemo(
    () => companies.filter(includeCompany),
    [companies, includeCompany],
  );
  const liveRounds = useMemo(
    () =>
      rounds.filter((round) =>
        includeCompany({ id: round.company_id, name: round.company_name }),
      ),
    [rounds, includeCompany],
  );
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState(presetCompanyId);
  const [companyName, setCompanyName] = useState("");
  const [picked, setPicked] = useState(Boolean(presetCompanyId));
  const [openRows, setOpenRows] = useState<
    { key: string; period: string; amountManwon?: number; label?: string }[]
  >([]);

  const sortedCompanies = useMemo(
    () => [...liveCompanies].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [liveCompanies],
  );
  const nameOnly = companyId === "__name";
  const activeCompanyId = nameOnly ? "" : companyId;
  const scoped = useMemo(
    () =>
      picked ? liveRounds.filter((r) => sameCompany(r, activeCompanyId, companyName)) : [],
    [liveRounds, picked, activeCompanyId, companyName],
  );
  const deposits = scoped
    .filter((r) => roundKind(r) === "입금")
    .sort((a, b) => a.period_month.localeCompare(b.period_month) || (a.label || "").localeCompare(b.label || ""));
  const orphanUsage = orphanUsageRounds(scoped);

  const sheets = useMemo(() => {
    const source = picked ? scoped : liveRounds;
    const groups = new Map<string, BudgetRound[]>();
    for (const round of source) {
      const key = round.company_id || `name:${round.company_name}`;
      const list = groups.get(key) || [];
      list.push(round);
      groups.set(key, list);
    }
    return [...groups.values()].sort((a, b) =>
      displayName(a[0], companies).localeCompare(displayName(b[0], companies), "ko"),
    );
  }, [picked, scoped, liveRounds, companies]);

  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [companyInvoices, setCompanyInvoices] = useState<CompanyDocRow[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(presetInvoiceDocId);

  useEffect(() => setSelectedInvoiceId(presetInvoiceDocId), [presetInvoiceDocId]);

  useEffect(() => {
    if (!picked || !activeCompanyId) {
      setCompanyInvoices([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/admin/company-docs?company_id=${encodeURIComponent(activeCompanyId)}`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const docs = ((data.docs || []) as CompanyDocRow[]).filter((d) => d.kind === "인보이스");
        setCompanyInvoices(docs);
      })
      .catch(() => setCompanyInvoices([]));
    return () => {
      cancelled = true;
    };
  }, [picked, activeCompanyId]);

  const refInvoice = companyInvoices.find((d) => d.id === selectedInvoiceId) || null;

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/company-budgets");
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "예산을 불러오지 못했습니다.");
      return [];
    }
    const next = (data.rounds || []) as BudgetRound[];
    setRounds(next);
    return next;
  }

  async function loadCampaigns() {
    const res = await fetch("/api/admin/campaigns");
    const data = await res.json().catch(() => ({}));
    if (res.ok) setCampaigns((data.campaigns || []) as CampaignSummary[]);
  }

  useEffect(() => {
    void load();
    void loadCampaigns();
  }, []);

  function applyBudgets(data: {
    budgets?: { company_id: string; budget_amount: number | null }[];
    warning?: string;
  }) {
    if (data.budgets?.length) onBudgetsApplied(data.budgets);
    setWarning(data.warning || null);
  }

  function companyPayload() {
    return {
      company_id: activeCompanyId || null,
      company_name: activeCompanyId
        ? sortedCompanies.find((c) => c.id === activeCompanyId)?.name || ""
        : companyName.trim(),
      label: "",
    };
  }

  function addRow(prefill?: { amountManwon: number; label: string }) {
    if (!picked || (!activeCompanyId && !companyName.trim())) {
      setError("회원사를 선택하거나 이름을 입력하세요.");
      return;
    }
    const period = nextPeriod([
      ...deposits,
      ...openRows.map((row) => ({ period_month: `${row.period}-01` })),
    ]);
    setOpenRows((prev) => [
      ...prev,
      { key: `입금-${period}-${Date.now()}`, period, ...prefill },
    ]);
    setError(null);
  }

  function addRowFromInvoice(doc: CompanyDocRow) {
    const invoice = doc.payload as InvoicePayload;
    const { subtotal, vat } = invoiceTotals(invoice.lines || []);
    const amountManwon = krwToManwon(subtotal) ?? 0;
    const label = invoice.invoiceNo || doc.title;
    const alreadyAdded = deposits.some((d) => d.label === label);
    const message = alreadyAdded
      ? `이미 등록된 예산입니다. 그래도 등록하시겠습니까?\n공급가액 ${formatManwon(subtotal)} (VAT ${formatManwon(vat)} 별도)`
      : `인보이스 공급가액 ${formatManwon(subtotal)} (VAT ${formatManwon(vat)} 별도)으로 예산 입금을 추가할까요?\n다음 화면에서 금액을 수정할 수 있습니다.`;
    if (!window.confirm(message)) return;
    addRow({ amountManwon, label });
  }

  async function onDelete(round: BudgetRound) {
    if (!window.confirm(`${displayName(round, companies)} ${monthLabel(round.period_month)}을 삭제할까요?`)) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/admin/company-budgets/${round.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "삭제에 실패했습니다.");
      return;
    }
    applyBudgets(data);
    await load();
  }

  return (
    <div className="space-y-3">
      <style>{`@keyframes budget-open{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}`}</style>
      <p className="text-xs text-[var(--muted)]">
        입금 행 아래에 사용 분할을 여러 개 붙일 수 있습니다. 값을 바꾼 뒤 적용을 눌러야
        저장됩니다. 입금 상태 흐름은 입점 논의중·협의중 → 입금 지연 → 입금 완료이며, 하나라도
        입금 지연이면 전체가 입금 지연입니다. 오른쪽 전체 예산은 입금 완료만 합산합니다. 단위는
        만원.
      </p>

      <div className="grid gap-3 sm:grid-cols-[minmax(220px,280px)_1fr] sm:items-end">
        <Field label="회원사">
          <select
            className={fieldClass}
            value={companyId}
            onChange={(e) => {
              const value = e.target.value;
              setOpenRows([]);
              setCompanyName("");
              if (!value) {
                setCompanyId("");
                setPicked(false);
                return;
              }
              setCompanyId(value);
              setPicked(true);
            }}
          >
            <option value="">전체</option>
            <option value="__name">미등록 — 이름만</option>
            {sortedCompanies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {nameOnly ? (
          <Field label="미등록 이름">
            <input
              className={fieldClass}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="달바"
              disabled={!isManager}
            />
          </Field>
        ) : (
          <p className="pb-2 text-xs text-[var(--muted)]">
            {picked ? "이 회원사 입금·사용이 아래에 채워집니다." : "회원사를 고르면 입력칸이 채워집니다."}
          </p>
        )}
      </div>

      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      {warning ? <p className="text-xs text-[var(--accent)]">{warning}</p> : null}

      <div className="space-y-3">
        <section className="flex flex-col items-start gap-3">
          {loading ? (
            <p className="text-xs text-[var(--muted)]">불러오는 중…</p>
          ) : sheets.length === 0 ? (
            <p className="w-full max-w-xl rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 py-6 text-xs text-[var(--muted)]">
              {error?.includes("예산 테이블") ? BUDGET_TABLE_SETUP : "등록된 예산이 없습니다."}
            </p>
          ) : picked ? (
            sheets.map((group) => (
              <CashflowSheet
                key={group[0].company_id || group[0].company_name}
                title={displayName(group[0], companies)}
                rounds={group}
                campaigns={campaigns.filter((c) => c.company_id === group[0].company_id)}
              />
            ))
          ) : (
            <AllCashflowSheet
              rounds={liveRounds}
              companies={liveCompanies}
              onPickCompany={(id, name) => {
                setOpenRows([]);
                if (id) {
                  setCompanyName("");
                  setCompanyId(id);
                } else {
                  setCompanyId("__name");
                  setCompanyName(name);
                }
                setPicked(true);
              }}
            />
          )}
        </section>

        {picked ? (
          <div className="flex flex-wrap items-start gap-3">
            {companyInvoices.length ? (
              <InvoiceReferencePanel
                invoices={companyInvoices}
                selectedId={selectedInvoiceId}
                onSelect={setSelectedInvoiceId}
                doc={refInvoice}
                isManager={isManager}
                onAddBudget={() => refInvoice && addRowFromInvoice(refInvoice)}
              />
            ) : null}
            <DepositList
              items={deposits}
              allRounds={scoped}
              campaignName={campaignNamesForCompany(campaigns, activeCompanyId)}
              products={productList.filter((p) => p.company_id === activeCompanyId)}
              onProductCreated={(p) => setProductList((prev) => [...prev, p])}
              isManager={isManager}
              openRows={openRows}
              onRemoveOpen={(key) => setOpenRows((prev) => prev.filter((row) => row.key !== key))}
              onAdd={addRow}
              onDelete={onDelete}
              onSaved={async (data) => {
                applyBudgets(data);
                await load();
                await loadCampaigns();
              }}
              onError={setError}
              companyPayload={companyPayload}
            />
            {orphanUsage.length ? (
              <p className="max-w-sm text-[11px] text-[var(--muted)]">
                연결되지 않은 사용 행 {orphanUsage.length}건이 있습니다.{" "}
                <code className="text-[10px]">scripts/sql/company-budget-usage-splits.sql</code> 을
                실행하면 입금에 붙습니다.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InvoiceReferencePanel({
  invoices,
  selectedId,
  onSelect,
  doc,
  isManager,
  onAddBudget,
}: {
  invoices: CompanyDocRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  doc: CompanyDocRow | null;
  isManager: boolean;
  onAddBudget: () => void;
}) {
  return (
    <section className="w-fit max-w-full rounded-[6px] border border-[var(--accent)] bg-[var(--surface)] p-3">
      <Field label="참고할 인보이스">
        <select
          className={fieldClass}
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="">선택</option>
          {invoices.map((d) => (
            <option key={d.id} value={d.id}>
              {(d.issued_on || "") + " " + d.title}
            </option>
          ))}
        </select>
      </Field>
      {doc ? <InvoiceLineTable doc={doc} /> : null}
      {isManager && doc ? (
        <div className="mt-2 flex justify-end">
          <button type="button" className={secondaryBtnClass} onClick={onAddBudget}>
            예산 추가
          </button>
        </div>
      ) : null}
    </section>
  );
}

function InvoiceLineTable({ doc }: { doc: CompanyDocRow }) {
  const invoice = doc.payload as InvoicePayload;
  const lines = invoice.lines || [];
  const total = invoiceTotals(lines);
  return (
    <div className="mt-2">
      <table className="text-left text-[12px]">
        <thead className="text-[10px] text-[var(--muted)]">
          <tr>
            <th className="pr-3 font-medium">항목</th>
            <th className="pr-3 font-medium">등급</th>
            <th className="pr-3 font-medium">수량</th>
            <th className="pr-3 font-medium">단가</th>
            <th className="font-medium">금액</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="border-t border-[var(--line)]">
              <td className="py-1 pr-3">{line.description || "—"}</td>
              <td className="py-1 pr-3">{TIER_LABEL[classifyTierFromText(line.description)]}</td>
              <td className="py-1 pr-3 tabular-nums">{line.qty}</td>
              <td className="py-1 pr-3 tabular-nums">{formatDocKrw(line.unitPrice)}</td>
              <td className="py-1 tabular-nums">{formatDocKrw(lineAmount(line))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] font-semibold">
        {formatDocKrw(total.subtotal)}{" "}
        <span className="font-normal text-[var(--muted)]">(VAT {formatDocKrw(total.vat)})</span>
      </p>
    </div>
  );
}

function DepositList({
  items,
  allRounds,
  campaignName,
  products,
  onProductCreated,
  isManager,
  openRows = [],
  onRemoveOpen,
  onAdd,
  onDelete,
  onSaved,
  onError,
  companyPayload,
}: {
  items: BudgetRound[];
  allRounds: BudgetRound[];
  campaignName?: string;
  products: Product[];
  onProductCreated: (product: Product) => void;
  isManager: boolean;
  openRows?: { key: string; period: string; amountManwon?: number; label?: string }[];
  onRemoveOpen?: (key: string) => void;
  onAdd: () => void;
  onDelete: (round: BudgetRound) => Promise<void>;
  onSaved: (data: {
    budgets?: { company_id: string; budget_amount: number | null }[];
    warning?: string;
  }) => Promise<void>;
  onError: (message: string) => void;
  companyPayload: () => { company_id: string | null; company_name: string; label: string };
}) {
  return (
    <section className="w-fit max-w-full rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-3">
      <p className="text-base font-semibold">입금 예산</p>
      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
        입금마다 사용 분할을 여러 개 둘 수 있습니다. 금액·월을 나눈 뒤 적용하세요.
      </p>
      <div className="mt-2 space-y-3">
        {items.length === 0 ? (
          <p className="text-[11px] text-[var(--muted)]">아직 없습니다. 추가로 칸을 붙입니다.</p>
        ) : (
          items.map((round) => (
            <DepositCard
              key={round.id}
              round={round}
              usages={usagesForDeposit(allRounds, round.id)}
              campaignName={campaignName}
              copy={false}
              fresh={false}
              isManager={isManager}
              onDelete={() => void onDelete(round)}
              onDeleteUsage={(u) => void onDelete(u)}
              onSaved={onSaved}
              onError={onError}
              companyPayload={companyPayload}
            />
          ))
        )}
        {isManager ? (
          <button type="button" className={secondaryBtnClass} onClick={onAdd}>
            입금 추가
          </button>
        ) : null}
        {openRows.map((row) => (
          <div key={row.key} style={{ animation: "budget-open 180ms ease-out" }}>
            <DepositCard
              round={{
                id: row.key,
                company_id: null,
                company_name: "",
                label: row.label || "",
                period_month: `${row.period}-01`,
                amount_krw: row.amountManwon ? row.amountManwon * MANWON : null,
                deposit_status: "입점 논의중",
                usage_status: "협의중",
                kind: "입금",
              }}
              usages={[]}
              copy
              fresh
              products={products}
              onProductCreated={onProductCreated}
              isManager={isManager}
              onDelete={() => onRemoveOpen?.(row.key)}
              onDeleteUsage={() => undefined}
              onSaved={async (data) => {
                onRemoveOpen?.(row.key);
                await onSaved(data);
              }}
              onError={onError}
              companyPayload={companyPayload}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function DepositCard({
  round,
  usages,
  campaignName,
  copy,
  fresh,
  products = [],
  onProductCreated,
  isManager,
  onDelete,
  onDeleteUsage,
  onSaved,
  onError,
  companyPayload,
}: {
  round: BudgetRound;
  usages: BudgetRound[];
  campaignName?: string;
  copy: boolean;
  fresh: boolean;
  products?: Product[];
  onProductCreated?: (product: Product) => void;
  isManager: boolean;
  onDelete: () => void;
  onDeleteUsage: (round: BudgetRound) => void;
  onSaved: (data: {
    budgets?: { company_id: string; budget_amount: number | null }[];
    warning?: string;
  }) => Promise<void>;
  onError: (message: string) => void;
  companyPayload: () => { company_id: string | null; company_name: string; label: string };
}) {
  const [period, setPeriod] = useState(round.period_month.slice(0, 7));
  const [amount, setAmount] = useState(krwToManwon(round.amount_krw)?.toString() ?? "");
  const [label, setLabel] = useState(round.label || "");
  const [status, setStatus] = useState(normalizeDepositStatus(round.deposit_status));
  const [productId, setProductId] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [openUsages, setOpenUsages] = useState<
    { key: string; period: string; amountManwon?: number }[]
  >([]);

  async function createProduct() {
    const name = newProductName.trim();
    if (!name || busy) return;
    setBusy(true);
    onError("");
    try {
      const { company_id } = companyPayload();
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company_id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "상품 추가에 실패했습니다.");
      onProductCreated?.(data.product as Product);
      setProductId((data.product as Product).id);
      setCreatingProduct(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "상품 추가에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setPeriod(round.period_month.slice(0, 7));
    setAmount(krwToManwon(round.amount_krw)?.toString() ?? "");
    setLabel(round.label || "");
    setStatus(normalizeDepositStatus(round.deposit_status));
  }, [round.id, round.period_month, round.amount_krw, round.label, round.deposit_status]);

  const dirty =
    period !== round.period_month.slice(0, 7) ||
    amount !== (krwToManwon(round.amount_krw)?.toString() ?? "") ||
    label !== (round.label || "") ||
    status !== normalizeDepositStatus(round.deposit_status);

  useEffect(() => {
    if (dirty) setJustSaved(false);
  }, [dirty]);

  const usedSum = usages.reduce((s, u) => s + (u.amount_krw || 0), 0);
  const depositKrw = round.amount_krw || 0;
  const overSplit = depositKrw > 0 && usedSum > depositKrw;

  async function commit() {
    if (!isManager || busy || !dirty) return;
    if (fresh && !productId) {
      onError("새 입금은 캠페인 개설을 위해 상품을 선택해야 합니다.");
      return;
    }
    setBusy(true);
    onError("");
    try {
      const body = {
        ...companyPayload(),
        kind: "입금" as const,
        label,
        period_month: period,
        usage_period_month: null,
        amount_manwon: amount,
        deposit_status: status,
        usage_status: "협의중",
        ...(fresh ? { product_id: productId } : {}),
      };
      const url = copy ? "/api/admin/company-budgets" : `/api/admin/company-budgets/${round.id}`;
      const res = await fetch(url, {
        method: copy ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "저장에 실패했습니다.");
      await onSaved(data);
      setJustSaved(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function addUsage() {
    if (copy || fresh) {
      onError("입금을 먼저 적용한 뒤 사용 분할을 추가하세요.");
      return;
    }
    const periodNext = nextPeriod([
      ...usages,
      ...openUsages.map((row) => ({ period_month: `${row.period}-01` })),
      { period_month: round.period_month },
    ]);
    const openSum = openUsages.reduce((s, row) => s + (row.amountManwon || 0) * MANWON, 0);
    const remainingKrw = Math.max(depositKrw - usedSum - openSum, 0);
    setOpenUsages((prev) => [
      ...prev,
      {
        key: `use-${periodNext}-${Date.now()}`,
        period: periodNext,
        amountManwon: krwToManwon(remainingKrw) ?? undefined,
      },
    ]);
  }

  const depositOptions = [...BUDGET_DEPOSIT_STATUSES] as string[];
  if (status && !depositOptions.includes(status)) depositOptions.unshift(status);
  const lineField = `${fieldClass} h-9 w-auto shrink-0 px-2`;

  return (
    <div
      className={`w-fit max-w-full rounded-[6px] border px-2 py-2 ${
        fresh ? "border-[var(--accent)]" : "border-[var(--line)]"
      }`}
    >
      {!fresh && !copy && campaignName ? (
        <p className="mb-1 text-[10px] text-[var(--muted)]">캠페인: {campaignName}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="shrink-0 text-[10px] font-semibold text-[var(--muted)]">입금</span>
        <input
          className={`${lineField} w-[11.5rem]`}
          type="month"
          value={period}
          disabled={!isManager || busy}
          onChange={(e) => setPeriod(e.target.value)}
          aria-label="입금 월"
        />
        <input
          className={`${lineField} w-24`}
          inputMode="decimal"
          value={amount}
          placeholder="만원"
          disabled={!isManager || busy}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="입금 금액"
        />
        <input
          className={`${lineField} w-16`}
          value={label}
          placeholder="차수"
          disabled={!isManager || busy}
          onChange={(e) => setLabel(e.target.value)}
          aria-label="차수"
        />
        <select
          className={`${lineField} w-[9.5rem]`}
          value={status}
          disabled={!isManager || busy}
          onChange={(e) => setStatus(e.target.value as BudgetDepositStatus)}
          aria-label="입금 상태"
        >
          {depositOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {fresh ? (
          <select
            className={`${lineField} w-[9.5rem]`}
            value={productId}
            disabled={!isManager || busy}
            onChange={(e) => {
              if (e.target.value === "__new") {
                setCreatingProduct(true);
                setNewProductName(companyPayload().company_name);
                setProductId("");
                return;
              }
              setProductId(e.target.value);
            }}
            aria-label="캠페인 상품"
          >
            <option value="">상품 선택 (캠페인 개설)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="__new">+ 새 상품 추가</option>
          </select>
        ) : null}
        {fresh && creatingProduct ? (
          <>
            <input
              className={`${lineField} w-40`}
              value={newProductName}
              disabled={!isManager || busy}
              onChange={(e) => setNewProductName(e.target.value)}
              placeholder="상품명"
              aria-label="새 상품명"
            />
            <button
              type="button"
              className="shrink-0 px-2 text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
              disabled={busy || !newProductName.trim()}
              onClick={() => void createProduct()}
            >
              추가
            </button>
            <button
              type="button"
              className="shrink-0 px-1 text-xs text-[var(--muted)]"
              onClick={() => setCreatingProduct(false)}
            >
              취소
            </button>
          </>
        ) : null}
        {isManager ? (
          <button
            type="button"
            className="shrink-0 px-2 text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
            disabled={busy || !dirty}
            onClick={() => void commit()}
          >
            {busy ? "…" : "적용"}
          </button>
        ) : null}
        {isManager && justSaved ? (
          <span className="shrink-0 text-[11px] text-[var(--accent)]">적용되었습니다</span>
        ) : null}
        {isManager && (!copy || fresh) ? (
          <button type="button" className="shrink-0 px-1 text-xs text-[var(--muted)]" onClick={onDelete}>
            삭제
          </button>
        ) : null}
      </div>

      {!copy && !fresh ? (
        <div className="mt-2 space-y-1.5 border-t border-[var(--line)] pt-2">
          <div className="flex flex-wrap items-baseline gap-2 px-0.5">
            <p className="text-[10px] font-semibold text-[var(--muted)]">사용 분할</p>
            <p className={`text-[10px] ${overSplit ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
              {formatManwon(usedSum)} / {formatManwon(round.amount_krw)}
              {overSplit ? " · 입금보다 큼" : ""}
            </p>
          </div>
          {usages.map((u) => (
            <UsageSplitLine
              key={u.id}
              round={u}
              deposit={round}
              copy={false}
              fresh={false}
              isManager={isManager}
              onDelete={() => onDeleteUsage(u)}
              onSaved={onSaved}
              onError={onError}
              companyPayload={companyPayload}
            />
          ))}
          {openUsages.map((row) => (
            <div key={row.key} style={{ animation: "budget-open 180ms ease-out" }}>
              <UsageSplitLine
                round={{
                  id: row.key,
                  company_id: round.company_id,
                  company_name: round.company_name,
                  label: round.label,
                  period_month: `${row.period}-01`,
                  amount_krw: row.amountManwon ? row.amountManwon * MANWON : null,
                  deposit_status: "협의중",
                  usage_status: "가용",
                  kind: "사용",
                  source_deposit_id: round.id,
                }}
                deposit={round}
                copy
                fresh
                isManager={isManager}
                onDelete={() => setOpenUsages((prev) => prev.filter((x) => x.key !== row.key))}
                onSaved={async (data) => {
                  setOpenUsages((prev) => prev.filter((x) => x.key !== row.key));
                  await onSaved(data);
                }}
                onError={onError}
                companyPayload={companyPayload}
              />
            </div>
          ))}
          {isManager ? (
            <button type="button" className="px-1 text-[11px] text-[var(--accent)]" onClick={addUsage}>
              사용 추가
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-[10px] text-[var(--muted)]">입금 적용 후 사용 분할을 추가할 수 있습니다.</p>
      )}
    </div>
  );
}

function UsageSplitLine({
  round,
  deposit,
  copy,
  fresh,
  isManager,
  onDelete,
  onSaved,
  onError,
  companyPayload,
}: {
  round: BudgetRound;
  deposit: BudgetRound;
  copy: boolean;
  fresh: boolean;
  isManager: boolean;
  onDelete: () => void;
  onSaved: (data: {
    budgets?: { company_id: string; budget_amount: number | null }[];
    warning?: string;
  }) => Promise<void>;
  onError: (message: string) => void;
  companyPayload: () => { company_id: string | null; company_name: string; label: string };
}) {
  const [period, setPeriod] = useState(round.period_month.slice(0, 7));
  const [amount, setAmount] = useState(krwToManwon(round.amount_krw)?.toString() ?? "");
  const [status, setStatus] = useState(normalizeUsageStatus(round.usage_status));
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setPeriod(round.period_month.slice(0, 7));
    setAmount(krwToManwon(round.amount_krw)?.toString() ?? "");
    setStatus(normalizeUsageStatus(round.usage_status));
  }, [round.id, round.period_month, round.amount_krw, round.usage_status]);

  const dirty =
    period !== round.period_month.slice(0, 7) ||
    amount !== (krwToManwon(round.amount_krw)?.toString() ?? "") ||
    status !== normalizeUsageStatus(round.usage_status);

  useEffect(() => {
    if (dirty) setJustSaved(false);
  }, [dirty]);

  async function commit() {
    if (!isManager || busy || !dirty) return;
    setBusy(true);
    onError("");
    try {
      const base = companyPayload();
      const body = {
        company_id: deposit.company_id || base.company_id,
        company_name: deposit.company_name || base.company_name,
        kind: "사용" as const,
        label: deposit.label || "",
        period_month: period,
        amount_manwon: amount,
        deposit_status: "협의중",
        usage_status: status,
        source_deposit_id: deposit.id,
      };
      const url = copy ? "/api/admin/company-budgets" : `/api/admin/company-budgets/${round.id}`;
      const res = await fetch(url, {
        method: copy ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "저장에 실패했습니다.");
      await onSaved(data);
      setJustSaved(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const usageOptions = [...BUDGET_USAGE_STATUSES] as string[];
  if (status && !usageOptions.includes(status)) usageOptions.unshift(status);
  const lineField = `${fieldClass} h-9 w-auto shrink-0 px-2`;

  return (
    <div
      className={`ml-3 flex w-fit max-w-full flex-wrap items-center gap-1.5 rounded-[6px] border px-2 py-1.5 ${
        fresh ? "border-[var(--accent)]" : "border-[var(--line)]"
      }`}
    >
      <span className="shrink-0 text-[10px] text-[var(--muted)]">사용</span>
      <input
        className={`${lineField} w-[11.5rem]`}
        type="month"
        value={period}
        disabled={!isManager || busy}
        onChange={(e) => setPeriod(e.target.value)}
        aria-label="사용 월"
      />
      <input
        className={`${lineField} w-24`}
        inputMode="decimal"
        value={amount}
        placeholder="만원"
        disabled={!isManager || busy}
        onChange={(e) => setAmount(e.target.value)}
        aria-label="사용 금액"
      />
      <select
        className={`${lineField} w-[6.5rem]`}
        value={status}
        disabled={!isManager || busy}
        onChange={(e) => setStatus(e.target.value as BudgetUsageStatus)}
        aria-label="사용 상태"
      >
        {usageOptions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {isManager ? (
        <button
          type="button"
          className="shrink-0 px-2 text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
          disabled={busy || !dirty}
          onClick={() => void commit()}
        >
          {busy ? "…" : "적용"}
        </button>
      ) : null}
      {isManager && justSaved ? (
        <span className="shrink-0 text-[11px] text-[var(--accent)]">적용되었습니다</span>
      ) : null}
      {isManager ? (
        <button type="button" className="shrink-0 px-1 text-xs text-[var(--muted)]" onClick={onDelete}>
          삭제
        </button>
      ) : null}
    </div>
  );
}

function AllCashflowSheet({
  rounds,
  companies,
  onPickCompany,
}: {
  rounds: BudgetRound[];
  companies: Company[];
  onPickCompany: (companyId: string | null, companyName: string) => void;
}) {
  const flow = summarizeCashflow(rounds);
  const months = [...new Set(rounds.map((r) => r.period_month.slice(0, 7)))].sort();
  const monthGroups = months.map((month) => {
    const inMonth = rounds.filter((r) => r.period_month.slice(0, 7) === month);
    const groups = new Map<string, BudgetRound[]>();
    for (const round of inMonth) {
      const key = round.company_id || `name:${round.company_name}`;
      const list = groups.get(key) || [];
      list.push(round);
      groups.set(key, list);
    }
    const rows = [...groups.entries()]
      .map(([key, list]) => {
        const summary = summarizeCashflow(list);
        const depositDelayed = list.some(
          (r) => roundKind(r) === "입금" && r.deposit_status === "입금 지연",
        );
        return {
          key,
          companyId: list[0].company_id,
          companyName: list[0].company_name,
          name: displayName(list[0], companies),
          deposited: summary.deposited,
          shownDeposit: displayDepositKrw(summary),
          used: summary.used,
          depositDelayed,
        };
      })
      .sort((a, b) => {
        const paid = Number(b.deposited > 0) - Number(a.deposited > 0);
        const delayed = Number(b.depositDelayed) - Number(a.depositDelayed);
        return paid || delayed || a.name.localeCompare(b.name, "ko");
      });
    const summary = summarizeCashflow(inMonth);
    return { month, rows, deposited: summary.deposited, used: summary.used };
  });

  return (
    <article className="w-full max-w-xl overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--surface)]">
      <header className="border-b border-[var(--line)] px-3 py-2">
        <p className="text-sm font-semibold">전체</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <FlowTotal label="전체 예산" value={formatManwon(flow.deposited)} hint="입금 완료" />
          <FlowTotal label="사용 예산" value={formatManwon(flow.used)} />
          <FlowTotal label="잔액" value={formatManwon(flow.balance)} />
        </div>
      </header>
      <div className="grid grid-cols-2">
        <p className="border-b border-[var(--line)] px-3 py-2 text-sm font-semibold">입금 예산</p>
        <p className="border-b border-l border-[var(--line)] px-3 py-2 text-sm font-semibold">사용 예산</p>
      </div>
      {monthGroups.map((group, index) => (
        <div key={group.month} className={index > 0 ? "border-t-2 border-[var(--ink)]" : undefined}>
          <p className="px-3 py-1.5 text-[11px] font-semibold">{monthLabel(`${group.month}-01`)}</p>
          <div className="grid grid-cols-2">
            <div>
              {group.rows.map((row) => (
                <LedgerRow
                  key={row.key}
                  month={row.name}
                  note={row.depositDelayed ? "입금 지연" : ""}
                  amount={formatManwon(row.shownDeposit)}
                  dim={row.shownDeposit === 0 && !row.depositDelayed}
                  alert={row.depositDelayed}
                  onPick={() => onPickCompany(row.companyId, row.companyName)}
                />
              ))}
            </div>
            <div className="border-l border-[var(--line)]">
              {group.rows.map((row) => (
                <LedgerRow
                  key={row.key}
                  month={row.name}
                  note={row.depositDelayed ? "입금 지연" : ""}
                  amount={formatManwon(row.used)}
                  alert={row.depositDelayed}
                  onPick={() => onPickCompany(row.companyId, row.companyName)}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 border-t-2 border-[var(--ink)] font-semibold">
        <LedgerRow month="합계" note="입금 완료" amount={formatManwon(flow.deposited)} />
        <div className="border-l border-[var(--line)]">
          <LedgerRow month="합계" note="" amount={formatManwon(flow.used)} />
        </div>
      </div>
    </article>
  );
}

function CashflowSheet({
  title,
  rounds,
  campaigns = [],
}: {
  title: string;
  rounds: BudgetRound[];
  campaigns?: CampaignSummary[];
}) {
  const flow = summarizeCashflow(rounds);
  const deposits = [...flow.deposits].sort((a, b) => a.period_month.localeCompare(b.period_month));
  const usage = [...flow.usage].sort((a, b) => a.period_month.localeCompare(b.period_month));
  return (
    <article className="w-full max-w-xl overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--surface)]">
      <header className="border-b border-[var(--line)] px-3 py-2">
        <p className="text-sm font-semibold">{title}</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <FlowTotal label="전체 예산" value={formatManwon(flow.deposited)} hint="입금 완료" />
          <FlowTotal label="사용 예산" value={formatManwon(flow.used)} />
          <FlowTotal label="잔액" value={formatManwon(flow.balance)} />
        </div>
        {campaigns.length ? (
          <p className="mt-1.5 text-[11px] text-[var(--muted)]">
            캠페인:{" "}
            {campaigns
              .map((c) => `${c.products?.name || "(상품 없음)"} · ${formatManwon(c.budget_amount)} · ${c.status}`)
              .join(" / ")}
          </p>
        ) : null}
      </header>
      <div className="grid grid-cols-2">
        <Ledger title="입금 예산" empty="입금 없음" count={deposits.length}>
          {deposits.map((row) => (
            <LedgerRow
              key={row.id}
              month={monthLabel(row.period_month)}
              note={[row.label, row.deposit_status].filter(Boolean).join(" · ")}
              amount={formatManwon(row.amount_krw)}
              dim={row.deposit_status !== "입금 완료"}
              alert={row.deposit_status === "입금 지연"}
            />
          ))}
          <LedgerRow month="합계" note="입금 완료" amount={formatManwon(flow.deposited)} strong />
        </Ledger>
        <Ledger title="사용 예산" empty="사용 계획 없음" divider count={usage.length}>
          {usage.map((row) => (
            <LedgerRow
              key={`use-${row.id}-${row.period_month}`}
              month={monthLabel(row.period_month)}
              note={[row.label, row.usage_status].filter(Boolean).join(" · ")}
              amount={formatManwon(row.amount_krw)}
            />
          ))}
          <LedgerRow month="합계" note="" amount={formatManwon(flow.used)} strong />
        </Ledger>
      </div>
    </article>
  );
}

function FlowTotal({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--muted)]">
        {label}
        {hint ? <span className="ml-1">{hint}</span> : null}
      </p>
      <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Ledger({
  title,
  empty,
  divider,
  count,
  children,
}: {
  title: string;
  empty: string;
  divider?: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className={divider ? "border-l border-[var(--line)]" : undefined}>
      <p className="border-b border-[var(--line)] px-3 py-2 text-sm font-semibold">{title}</p>
      {count === 0 ? <p className="px-3 py-3 text-[11px] text-[var(--muted)]">{empty}</p> : children}
    </div>
  );
}

function LedgerRow({
  month,
  note,
  amount,
  strong,
  dim,
  alert,
  onPick,
}: {
  month: string;
  note: string;
  amount: string;
  strong?: boolean;
  dim?: boolean;
  alert?: boolean;
  onPick?: () => void;
}) {
  const label = (
    <>
      {month}
      {note ? (
        <span className={`ml-1 text-[11px] ${alert ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
          {note}
        </span>
      ) : null}
    </>
  );
  return (
    <div
      className={`flex items-baseline justify-between gap-2 px-3 py-1.5 text-xs ${
        strong ? "border-t border-[var(--line)] font-semibold" : ""
      } ${alert ? "text-[var(--danger)]" : dim ? "text-[var(--muted)]" : ""}`}
    >
      {onPick ? (
        <button type="button" className="text-left hover:underline" onClick={onPick}>
          {label}
        </button>
      ) : (
        <span>{label}</span>
      )}
      <span className="tabular-nums">{amount}</span>
    </div>
  );
}
