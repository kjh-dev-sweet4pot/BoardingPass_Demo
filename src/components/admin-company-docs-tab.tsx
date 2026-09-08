"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, fieldClass, primaryBtnClass, secondaryBtnClass } from "@/components/ui";
import {
  BRANDSLAM,
  applyInvoiceToContract,
  contractHtml,
  defaultContractPayload,
  defaultInvoicePayload,
  docHtml,
  emptyLine,
  formatBizNo,
  formatDocKrw,
  invoiceHtml,
  invoiceTotals,
  lineAmount,
  type CompanyDocKind,
  type CompanyDocRow,
  type ContractPayload,
  type DocLine,
  type InvoicePayload,
} from "@/lib/company-docs";
import type { Company } from "@/lib/types";

function openPrint(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.document.title = "";
}

const QUOTE_PRESETS = [
  "약사 콘텐츠",
  "메가 인플루언서",
  "미들 인플루언서",
  "나노 인플루언서",
  "운영·기획",
];

function LineEditor({
  lines,
  onChange,
  disabled,
  ko,
  presets,
}: {
  lines: DocLine[];
  onChange: (next: DocLine[]) => void;
  disabled?: boolean;
  ko?: boolean;
  presets?: string[];
}) {
  const t = invoiceTotals(lines);
  return (
    <div className="overflow-x-auto">
      {presets?.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {presets.map((name) => (
            <button
              key={name}
              type="button"
              className="rounded-[6px] border border-[var(--line)] px-2 py-1 text-[11px] text-[var(--ink)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
              disabled={disabled}
              onClick={() => onChange([...lines, { ...emptyLine(), description: name }])}
            >
              + {name}
            </button>
          ))}
        </div>
      ) : null}
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead className="text-[11px] text-[var(--muted)]">
          <tr>
            <th className="py-1 font-medium">{ko ? "항목" : "Description"}</th>
            <th className="w-16 py-1 font-medium">{ko ? "수량" : "Qty"}</th>
            <th className="w-32 py-1 font-medium">{ko ? "단가" : "단가"}</th>
            <th className="w-28 py-1 font-medium">금액</th>
            <th className="w-28 py-1 font-medium">비고</th>
            <th className="w-10 py-1" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              <td className="py-1 pr-1">
                <input
                  className={fieldClass}
                  value={line.description}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...lines];
                    next[i] = { ...line, description: e.target.value };
                    onChange(next);
                  }}
                />
              </td>
              <td className="py-1 pr-1">
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  value={line.qty}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...lines];
                    next[i] = { ...line, qty: Number(e.target.value) || 0 };
                    onChange(next);
                  }}
                />
              </td>
              <td className="py-1 pr-1">
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  value={line.unitPrice || ""}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...lines];
                    next[i] = { ...line, unitPrice: Number(e.target.value) || 0 };
                    onChange(next);
                  }}
                />
              </td>
              <td className="py-1 pr-1 tabular-nums">{formatDocKrw(lineAmount(line))}</td>
              <td className="py-1 pr-1">
                <input
                  className={fieldClass}
                  value={line.remark}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...lines];
                    next[i] = { ...line, remark: e.target.value };
                    onChange(next);
                  }}
                />
              </td>
              <td className="py-1">
                <button
                  type="button"
                  className="text-xs text-[var(--danger)]"
                  disabled={disabled || lines.length <= 1}
                  onClick={() => onChange(lines.filter((_, j) => j !== i))}
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className={secondaryBtnClass}
          disabled={disabled}
          onClick={() => onChange([...lines, emptyLine()])}
        >
          항목 추가
        </button>
        <p className="text-[13px] tabular-nums text-[var(--ink)]">
          TOTAL {formatDocKrw(t.subtotal)} · VAT {formatDocKrw(t.vat)} ·{" "}
          <b>GRAND {formatDocKrw(t.grand)}</b>
        </p>
      </div>
    </div>
  );
}

export function AdminCompanyDocsPanel({
  companies,
  isManager,
}: {
  companies: Company[];
  isManager: boolean;
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.id || "");
  const [docs, setDocs] = useState<CompanyDocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<CompanyDocKind>("인보이스");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"초안" | "발행">("초안");
  const [invoice, setInvoice] = useState<InvoicePayload>(() =>
    defaultInvoicePayload(companies[0] || { name: "" }),
  );
  const [contract, setContract] = useState<ContractPayload>(() =>
    defaultContractPayload(companies[0] || { name: "" }),
  );
  const [importInvoiceId, setImportInvoiceId] = useState("");

  const company = useMemo(
    () => companies.find((c) => c.id === companyId) || null,
    [companies, companyId],
  );

  const previewHtml = useMemo(
    () => (kind === "인보이스" ? invoiceHtml(invoice, false) : contractHtml(contract, false)),
    [kind, invoice, contract],
  );

  const savedInvoices = useMemo(
    () => docs.filter((d) => d.kind === "인보이스"),
    [docs],
  );

  function resetForm(nextKind: CompanyDocKind, c: Company | null) {
    setEditingId(null);
    setKind(nextKind);
    setStatus("초안");
    const name = c?.name || "";
    if (nextKind === "인보이스") {
      const p = defaultInvoicePayload({
        name,
        contact: c?.contact,
        contact_email: c?.contact_email,
        login_id: c?.login_id,
      });
      setInvoice(p);
      setTitle(`INVOICE ${p.invoiceNo}`);
    } else {
      const p = defaultContractPayload({ name });
      setContract(p);
      setTitle(`마케팅 대행 계약서 ${name}`);
      setImportInvoiceId("");
    }
  }

  async function load(id: string) {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/company-docs?company_id=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "목록을 불러오지 못했습니다.");
      setDocs(Array.isArray(body.docs) ? body.docs : []);
    } catch (e) {
      setDocs([]);
      setError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!companyId) return;
    void load(companyId);
    const c = companies.find((x) => x.id === companyId) || null;
    resetForm(kind, c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  function openDoc(doc: CompanyDocRow) {
    setEditingId(doc.id);
    setKind(doc.kind);
    setTitle(doc.title);
    setStatus(doc.status);
    if (doc.kind === "인보이스") setInvoice(doc.payload as InvoicePayload);
    else setContract(doc.payload as ContractPayload);
  }

  async function save() {
    if (!isManager || !companyId) return;
    setSaving(true);
    setError(null);
    if (kind === "계약서" && status === "발행" && !contract.partyABizNo.trim()) {
      setError("발행하려면 상대방(갑) 사업자등록번호를 입력하세요.");
      return;
    }
    const payload =
      kind === "인보이스"
        ? invoice
        : {
            ...contract,
            amountExVat: contract.amountExVat || invoiceTotals(contract.lines).subtotal,
          };
    const issuedOn =
      kind === "인보이스" ? invoice.issuedOn : contract.issuedOn;
    const body = {
      company_id: companyId,
      kind,
      title: title.trim() || kind,
      status,
      issued_on: issuedOn || null,
      payload,
    };
    try {
      const res = await fetch(
        editingId ? `/api/admin/company-docs/${editingId}` : "/api/admin/company-docs",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "저장 실패");
      setEditingId(json.id);
      await load(companyId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!isManager || !confirm("이 문서를 삭제할까요?")) return;
    const res = await fetch(`/api/admin/company-docs/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "삭제 실패");
      return;
    }
    if (editingId === id) resetForm(kind, company);
    await load(companyId);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--ink)]">계약서 · 인보이스</h2>
        <p className="mt-1 text-[12.5px] text-[var(--muted)]">
          브랜드슬램 양식. 미리보기에서 인쇄 → PDF 저장. B({BRANDSLAM.legalName})·계좌는
          고정입니다.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Field label="회원사">
          <select
            className={fieldClass}
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          className={secondaryBtnClass}
          onClick={() => resetForm("인보이스", company)}
        >
          새 인보이스
        </button>
        <button
          type="button"
          className={secondaryBtnClass}
          onClick={() => resetForm("계약서", company)}
        >
          새 계약서
        </button>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="overflow-hidden rounded-[6px] border border-[var(--line)]">
        {loading ? (
          <p className="px-4 py-6 text-sm text-[var(--muted)]">불러오는 중…</p>
        ) : docs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--muted)]">저장된 문서가 없습니다.</p>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[var(--surface-hover)] text-[11px] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">종류</th>
                <th className="px-3 py-2 font-medium">제목</th>
                <th className="px-3 py-2 font-medium">일자</th>
                <th className="px-3 py-2 font-medium">상태</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2">{d.kind}</td>
                  <td className="px-3 py-2">{d.title}</td>
                  <td className="px-3 py-2 tabular-nums">{d.issued_on || "—"}</td>
                  <td className="px-3 py-2">{d.status}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="mr-2 text-[var(--accent)]"
                      onClick={() => openDoc(d)}
                    >
                      열기
                    </button>
                    <button
                      type="button"
                      className="mr-2 text-[var(--accent)]"
                      onClick={() => openPrint(docHtml(d.kind, d.payload))}
                    >
                      인쇄
                    </button>
                    {isManager ? (
                      <button
                        type="button"
                        className="text-[var(--danger)]"
                        onClick={() => void remove(d.id)}
                      >
                        삭제
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(420px,1fr)]">
      <div className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="mb-3 text-sm font-semibold text-[var(--ink)]">
          {editingId ? "문서 수정" : `새 ${kind}`}
        </p>
        {!isManager ? (
          <p className="mb-3 text-sm text-[var(--muted)]">작성은 운영관리자만 할 수 있습니다.</p>
        ) : null}
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <Field label="제목">
            <input
              className={fieldClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!isManager}
            />
          </Field>
          <Field label="상태">
            <select
              className={fieldClass}
              value={status}
              disabled={!isManager}
              onChange={(e) => setStatus(e.target.value as "초안" | "발행")}
            >
              <option value="초안">초안</option>
              <option value="발행">발행</option>
            </select>
          </Field>
        </div>

        {kind === "인보이스" ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="INVOICE NO">
                <input
                  className={fieldClass}
                  value={invoice.invoiceNo}
                  disabled={!isManager}
                  onChange={(e) => setInvoice({ ...invoice, invoiceNo: e.target.value })}
                />
              </Field>
              <Field label="DATE">
                <input
                  className={fieldClass}
                  type="date"
                  value={invoice.issuedOn}
                  disabled={!isManager}
                  onChange={(e) => setInvoice({ ...invoice, issuedOn: e.target.value })}
                />
              </Field>
              <Field label="TO">
                <input
                  className={fieldClass}
                  value={invoice.toName}
                  disabled={!isManager}
                  onChange={(e) => setInvoice({ ...invoice, toName: e.target.value })}
                />
              </Field>
              <Field label="EMAIL">
                <input
                  className={fieldClass}
                  value={invoice.toEmail}
                  disabled={!isManager}
                  onChange={(e) => setInvoice({ ...invoice, toEmail: e.target.value })}
                />
              </Field>
              <Field label="ADD">
                <input
                  className={fieldClass}
                  value={invoice.toAddress}
                  disabled={!isManager}
                  onChange={(e) => setInvoice({ ...invoice, toAddress: e.target.value })}
                />
              </Field>
              <Field label="TELP">
                <input
                  className={fieldClass}
                  value={invoice.toTel}
                  disabled={!isManager}
                  onChange={(e) => setInvoice({ ...invoice, toTel: e.target.value })}
                />
              </Field>
            </div>
            <LineEditor
              presets={QUOTE_PRESETS}
              lines={invoice.lines}
              disabled={!isManager}
              onChange={(lines) => setInvoice({ ...invoice, lines })}
            />
          </div>
        ) : (
          <div className="space-y-5">
            <section className="space-y-3">
              <p className="text-[12px] font-semibold text-[var(--ink)]">1. 상대방 (갑 · 회원사)</p>
              <p className="text-[11px] text-[var(--muted)]">
                계약서 첫 문장·서명란·견적 TO에 그대로 들어갑니다. 사업자등록번호는 필수입니다.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="법인명">
                  <input
                    className={fieldClass}
                    placeholder="예: 주식회사 클리어디어"
                    value={contract.partyAName}
                    disabled={!isManager}
                    onChange={(e) => setContract({ ...contract, partyAName: e.target.value })}
                  />
                </Field>
                <Field label="브랜드">
                  <input
                    className={fieldClass}
                    placeholder="예: 클리어디어"
                    value={contract.partyABrand}
                    disabled={!isManager}
                    onChange={(e) => setContract({ ...contract, partyABrand: e.target.value })}
                  />
                </Field>
                <Field label="사업자등록번호">
                  <input
                    className={fieldClass}
                    placeholder="000-00-00000"
                    inputMode="numeric"
                    value={contract.partyABizNo}
                    disabled={!isManager}
                    onChange={(e) =>
                      setContract({ ...contract, partyABizNo: formatBizNo(e.target.value) })
                    }
                  />
                </Field>
                <Field label="대표자">
                  <input
                    className={fieldClass}
                    placeholder="대표 성명"
                    value={contract.partyACeo}
                    disabled={!isManager}
                    onChange={(e) => setContract({ ...contract, partyACeo: e.target.value })}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="주소">
                    <input
                      className={fieldClass}
                      placeholder="본점 주소"
                      value={contract.partyAAddress}
                      disabled={!isManager}
                      onChange={(e) =>
                        setContract({ ...contract, partyAAddress: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-[12px] font-semibold text-[var(--ink)]">2. 프로젝트</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="계약일">
                  <input
                    className={fieldClass}
                    type="date"
                    value={contract.issuedOn}
                    disabled={!isManager}
                    onChange={(e) => setContract({ ...contract, issuedOn: e.target.value })}
                  />
                </Field>
                <Field label="프로젝트명">
                  <input
                    className={fieldClass}
                    placeholder="마케팅 협업 프로젝트"
                    value={contract.projectTitle}
                    disabled={!isManager}
                    onChange={(e) =>
                      setContract({ ...contract, projectTitle: e.target.value })
                    }
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="상품·업무 범위">
                    <input
                      className={fieldClass}
                      placeholder="예: 스킨케어 3종 인플루언서 시딩"
                      value={contract.projectProducts}
                      disabled={!isManager}
                      onChange={(e) =>
                        setContract({ ...contract, projectProducts: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-[12px] font-semibold text-[var(--ink)]">3. 견적 (계약서 마지막 별첨)</p>
              <p className="text-[11px] text-[var(--muted)]">
                저장된 인보이스를 불러오면 계약서 맨 마지막에 그 내용이 그대로 붙습니다. 합계가
                계약금액(VAT별도)이 됩니다.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="저장된 인보이스">
                  <select
                    className={fieldClass}
                    value={importInvoiceId}
                    disabled={!isManager}
                    onChange={(e) => setImportInvoiceId(e.target.value)}
                  >
                    <option value="">선택</option>
                    {savedInvoices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {(d.issued_on || "") + " " + d.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <button
                  type="button"
                  className={secondaryBtnClass}
                  disabled={!isManager || !importInvoiceId}
                  onClick={() => {
                    const doc = savedInvoices.find((d) => d.id === importInvoiceId);
                    if (!doc) return;
                    setContract(
                      applyInvoiceToContract(contract, doc.payload as InvoicePayload),
                    );
                  }}
                >
                  인보이스 불러오기
                </button>
              </div>
              {savedInvoices.length === 0 ? (
                <p className="text-[11px] text-[var(--muted)]">
                  이 회원사에 저장된 인보이스가 없습니다. 먼저 인보이스를 저장하세요.
                </p>
              ) : null}
              {contract.attachedInvoice?.invoiceNo ? (
                <p className="text-[12px] text-[var(--ink)]">
                  별첨: {contract.attachedInvoice.invoiceNo}
                </p>
              ) : null}
              <LineEditor
                ko
                presets={QUOTE_PRESETS}
                lines={contract.lines}
                disabled={!isManager}
                onChange={(lines) =>
                  setContract({
                    ...contract,
                    lines,
                    amountExVat: invoiceTotals(lines).subtotal,
                    attachedInvoice: contract.attachedInvoice
                      ? { ...contract.attachedInvoice, lines }
                      : contract.attachedInvoice,
                  })
                }
              />
              <Field label="계약금액 (VAT별도)">
                <input
                  className={fieldClass}
                  type="number"
                  min={0}
                  value={contract.amountExVat || ""}
                  disabled={!isManager}
                  onChange={(e) =>
                    setContract({ ...contract, amountExVat: Number(e.target.value) || 0 })
                  }
                />
              </Field>
            </section>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={primaryBtnClass}
            disabled={!isManager || saving}
            onClick={() => void save()}
          >
            {saving ? "저장 중…" : "저장"}
          </button>
          <button
            type="button"
            className={secondaryBtnClass}
            onClick={() =>
              openPrint(
                kind === "인보이스" ? invoiceHtml(invoice) : contractHtml(contract),
              )
            }
          >
            미리보기 · 인쇄
          </button>
        </div>
      </div>
        <div className="lg:sticky lg:top-3">
          <p className="mb-2 text-[12px] font-medium text-[var(--muted)]">실시간 미리보기</p>
          <iframe
            title="문서 미리보기"
            className="h-[min(88vh,1100px)] w-full rounded-[6px] border border-[var(--line)] bg-[#d8d2c8]"
            srcDoc={previewHtml}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}
