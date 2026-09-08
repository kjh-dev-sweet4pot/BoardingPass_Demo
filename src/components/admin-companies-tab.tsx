"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Field, fieldClass, primaryBtnClass, secondaryBtnClass } from "@/components/ui";
import { COMPANY_CONTRACT_STAGES } from "@/lib/company";
import {
  companyCsvTemplate,
  parseCompanyImportRows,
  type CompanyCsvRow,
} from "@/lib/company-csv";
import { buildCompanyExcelTemplate } from "@/lib/company-xlsx-template";
import {
  COMPANY_MAIL_KINDS,
  buildCompanyMailTemplate,
  resolveCompanyMailTo,
  type CompanyMailKind,
} from "@/lib/company-mail";
import { AdminCompanyDocsPanel } from "@/components/admin-company-docs-tab";
import { formatKrw } from "@/lib/creator-pool-mock";
import { docHtml, type CompanyDocRow } from "@/lib/company-docs";
import { type Company } from "@/lib/types";

export type CompaniesSub = "companies" | "companiesRegister" | "companiesMail" | "companiesDocs";

type MailLog = {
  id: string;
  company_id: string;
  kind: string;
  to_emails: string[];
  subject: string;
  attachment_names: string[];
  sent_at: string | null;
  error: string | null;
  created_by: string | null;
  created_at: string;
};

type CampaignOpt = { id: string; name: string | null; company_id: string };

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function CompanyCsvImport({
  isManager,
  onImported,
}: {
  isManager: boolean;
  onImported: (companies: Company[]) => void;
}) {
  const [rows, setRows] = useState<CompanyCsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function downloadCsvTemplate() {
    const csv = `\uFEFF${companyCsvTemplate().replace(/\n/g, "\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "boardingpass-companies-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadExcelTemplate() {
    const bytes = buildCompanyExcelTemplate();
    const blob = new Blob(
      [
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
      ],
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "boardingpass-companies-template.xlsx";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onFile(file: File | undefined) {
    setError(null);
    setSuccess(null);
    setRows([]);
    setFileName("");
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0] || ""];
      if (!sheet) throw new Error("시트를 읽을 수 없습니다.");
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      });
      const parsed = parseCompanyImportRows(records).filter(
        (r) => r.name || r.login_id || r.password,
      );
      if (parsed.length === 0) throw new Error("등록할 행이 없습니다.");
      setFileName(file.name);
      setRows(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "파일을 읽지 못했습니다.");
    }
  }

  async function onImport() {
    if (!isManager) return;
    const okRows = rows.filter((r) => r.ok);
    if (okRows.length === 0) {
      setError("유효한 행이 없습니다.");
      return;
    }
    setImporting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/companies/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: okRows.map((r) => ({
            name: r.name,
            login_id: r.login_id,
            password: r.password,
            contact: r.contact,
            contact_email: r.contact_email,
            aliases: r.aliases,
            first_meet_on: r.first_meet_on,
            planned_start_on: r.planned_start_on,
            planned_end_on: r.planned_end_on,
            contract_stage: r.contract_stage,
            budget_amount: r.budget_amount,
            spent_amount: r.spent_amount,
            guideline_url: r.guideline_url,
          })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "업로드 실패");
      const created = (body.created || []) as Company[];
      const failures = (body.failures || []) as { name: string; error: string }[];
      onImported(created);
      const failText =
        failures.length > 0
          ? ` · 실패 ${failures.length}건 (${failures
              .slice(0, 3)
              .map((f) => f.name || f.error)
              .join(", ")}${failures.length > 3 ? "…" : ""})`
          : "";
      setSuccess(
        `${created.length}개 회원사를 등록했습니다.${failText}`,
      );
      if (typeof body.warning === "string") setError(body.warning);
      if (created.length > 0) setRows([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setImporting(false);
    }
  }

  const okCount = rows.filter((r) => r.ok).length;

  return (
    <div className="owm-panel space-y-3 border border-[var(--line)] bg-[var(--surface)] p-5">
      <p className="text-sm font-semibold">CSV 업로드</p>
      <p className="text-xs text-[var(--muted)]">
        name · login_id · password 필수. Excel 템플릿의 contract_stage는
        목록에서 고릅니다. .csv · .xlsx
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={secondaryBtnClass} onClick={downloadCsvTemplate}>
          CSV 템플릿
        </button>
        <button type="button" className={secondaryBtnClass} onClick={downloadExcelTemplate}>
          Excel 템플릿
        </button>
        <label className={`${secondaryBtnClass} cursor-pointer`}>
          파일 선택
          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            className="sr-only"
            disabled={!isManager}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
        {fileName ? (
          <span className="self-center text-xs text-[var(--muted)]">{fileName}</span>
        ) : null}
      </div>
      {rows.length > 0 ? (
        <div className="overflow-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="text-[var(--muted)]">
                <th className="px-2 py-1 font-medium">행</th>
                <th className="px-2 py-1 font-medium">회원사</th>
                <th className="px-2 py-1 font-medium">아이디</th>
                <th className="px-2 py-1 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rowNumber} className="border-t border-[var(--line)]">
                  <td className="px-2 py-1">{r.rowNumber}</td>
                  <td className="px-2 py-1">{r.name || "—"}</td>
                  <td className="px-2 py-1">{r.login_id || "—"}</td>
                  <td className="px-2 py-1">
                    {r.ok ? (
                      <span className="text-[var(--accent)]">가능</span>
                    ) : (
                      <span className="text-[var(--danger)]">{r.errors.join(" · ")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      {success ? (
        <p
          role="status"
          className="rounded-[6px] border border-[var(--line)] bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent)]"
        >
          {success}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <button
          type="button"
          className={primaryBtnClass}
          disabled={!isManager || importing || okCount === 0}
          onClick={() => void onImport()}
        >
          {importing ? "등록 중…" : `유효 ${okCount}건 등록`}
        </button>
      ) : null}
    </div>
  );
}

function CompanyForm({
  companies,
  onSaved,
  isManager,
}: {
  companies: Company[];
  onSaved: (c: Company) => void;
  isManager: boolean;
}) {
  const [list, setList] = useState(companies);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [contact, setContact] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [aliases, setAliases] = useState("");
  const [firstMeetOn, setFirstMeetOn] = useState("");
  const [plannedStartOn, setPlannedStartOn] = useState("");
  const [plannedEndOn, setPlannedEndOn] = useState("");
  const [contractStage, setContractStage] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [spentAmount, setSpentAmount] = useState("");
  const [guidelineUrl, setGuidelineUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setList(companies), [companies]);

  const editing = useMemo(
    () => list.find((c) => c.id === editingId) || null,
    [list, editingId],
  );

  function reset() {
    setEditingId(null);
    setName("");
    setLoginId("");
    setPassword("");
    setContact("");
    setContactEmail("");
    setAliases("");
    setFirstMeetOn("");
    setPlannedStartOn("");
    setPlannedEndOn("");
    setContractStage("");
    setBudgetAmount("");
    setSpentAmount("");
    setGuidelineUrl("");
    setSuccess(null);
  }

  function startEdit(company: Company) {
    setEditingId(company.id);
    setName(company.name);
    setLoginId(company.login_id);
    setPassword("");
    setContact(company.contact || "");
    setContactEmail(company.contact_email || "");
    setAliases((company.aliases || []).join(", "));
    setFirstMeetOn(company.first_meet_on?.slice(0, 10) || "");
    setPlannedStartOn(company.planned_start_on?.slice(0, 10) || "");
    setPlannedEndOn(company.planned_end_on?.slice(0, 10) || "");
    setContractStage(company.contract_stage || "");
    setBudgetAmount(
      company.budget_amount != null ? String(company.budget_amount) : "",
    );
    setSpentAmount(
      company.spent_amount != null ? String(company.spent_amount) : "",
    );
    setGuidelineUrl(company.guideline_url || "");
    setSuccess(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isManager) return;
    setSaving(true);
    setError(null);
    setWarning(null);
    setSuccess(null);
    try {
      const payload = {
        name,
        login_id: loginId,
        password: password || undefined,
        contact,
        contact_email: contactEmail,
        aliases: aliases
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        first_meet_on: firstMeetOn || null,
        planned_start_on: plannedStartOn || null,
        planned_end_on: plannedEndOn || null,
        contract_stage: contractStage || null,
        budget_amount: budgetAmount || null,
        spent_amount: spentAmount || null,
        guideline_url: guidelineUrl || null,
      };
      const res = await fetch(
        editingId ? `/api/admin/companies/${editingId}` : "/api/admin/companies",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "저장 실패");
      if (typeof body.warning === "string") setWarning(body.warning);
      const next = body.company as Company;
      setList((prev) => {
        const exists = prev.some((c) => c.id === next.id);
        return exists
          ? prev.map((c) => (c.id === next.id ? next : c))
          : [...prev, next].sort((a, b) => a.name.localeCompare(b.name, "ko"));
      });
      onSaved(next);
      const wasEdit = Boolean(editingId);
      reset();
      setSuccess(
        wasEdit
          ? `${next.name} 회원사 정보를 수정했습니다.`
          : `${next.name} 회원사를 등록했습니다. 로그인 아이디는 ${next.login_id}입니다.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <form onSubmit={onSubmit} className="owm-panel space-y-3 border border-[var(--line)] bg-[var(--surface)] p-5">
        <p className="text-sm font-semibold">
          {editing ? `${editing.name} 수정` : "회원사 등록"}
        </p>
        {!isManager ? (
          <p className="text-xs text-[var(--muted)]">등록·수정은 운영관리자만 할 수 있습니다.</p>
        ) : null}
        <Field label="표시명">
          <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required disabled={!isManager} />
        </Field>
        <Field label="로그인 아이디">
          <input className={fieldClass} value={loginId} onChange={(e) => setLoginId(e.target.value)} required disabled={!isManager} />
        </Field>
        <Field label={editing ? "비밀번호 재설정 (선택)" : "비밀번호"}>
          <input
            className={fieldClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!editing}
            disabled={!isManager}
          />
        </Field>
        <Field label="수신 메일 (Email)">
          <input
            className={fieldClass}
            type="email"
            placeholder="contract@company.com"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            disabled={!isManager}
          />
        </Field>
        <Field label="담당자 연락처">
          <input className={fieldClass} value={contact} onChange={(e) => setContact(e.target.value)} disabled={!isManager} />
        </Field>
        <Field label="별칭 (쉼표)">
          <input className={fieldClass} value={aliases} onChange={(e) => setAliases(e.target.value)} disabled={!isManager} />
        </Field>

        <p className="pt-2 text-xs font-semibold text-[var(--muted)]">계약 · 캠페인 진행</p>
        <Field label="최초 미팅 일자">
          <input
            className={fieldClass}
            type="date"
            value={firstMeetOn}
            onChange={(e) => setFirstMeetOn(e.target.value)}
            disabled={!isManager}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="소요예정 시작">
            <input
              className={fieldClass}
              type="date"
              value={plannedStartOn}
              onChange={(e) => setPlannedStartOn(e.target.value)}
              disabled={!isManager}
            />
          </Field>
          <Field label="소요예정 종료">
            <input
              className={fieldClass}
              type="date"
              value={plannedEndOn}
              onChange={(e) => setPlannedEndOn(e.target.value)}
              disabled={!isManager}
            />
          </Field>
        </div>
        <Field label="계약 진행 단계">
          <select
            className={fieldClass}
            value={contractStage}
            onChange={(e) => setContractStage(e.target.value)}
            disabled={!isManager}
          >
            <option value="">선택</option>
            {COMPANY_CONTRACT_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="배정 예산 (원)">
            <input
              className={fieldClass}
              inputMode="numeric"
              placeholder="예: 35000000"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
              disabled={!isManager}
            />
          </Field>
          <Field label="소요 비용 (원)">
            <input
              className={fieldClass}
              inputMode="numeric"
              placeholder="운영 기록용"
              value={spentAmount}
              onChange={(e) => setSpentAmount(e.target.value)}
              disabled={!isManager}
            />
          </Field>
        </div>
        <p className="text-[11px] text-[var(--muted)]">
          배정 예산은 홈·예산 성과의 총 예산으로 쓰입니다. 소요 비용은 운영 메모용이며 배정 노출가 합계와 별개입니다.
        </p>
        <Field label="콘텐츠 가이드라인 URL">
          <input
            className={fieldClass}
            type="url"
            placeholder="https://drive.google.com/…"
            value={guidelineUrl}
            onChange={(e) => setGuidelineUrl(e.target.value)}
            disabled={!isManager}
          />
        </Field>

        {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
        {warning ? <p className="text-xs text-[var(--accent)]">{warning}</p> : null}
        {success ? (
          <p
            role="status"
            className="rounded-[6px] border border-[var(--line)] bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent)]"
          >
            {success}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button className={primaryBtnClass} type="submit" disabled={saving || !isManager}>
            {saving ? "저장 중…" : editing ? "수정 저장" : "등록"}
          </button>
          {editing ? (
            <button type="button" className={secondaryBtnClass} onClick={reset}>
              취소
            </button>
          ) : null}
        </div>
      </form>
      <div className="owm-panel border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="mb-2 text-xs font-medium text-[var(--muted)]">기존 회원사에서 불러오기</p>
        <ul className="max-h-80 space-y-1 overflow-auto text-sm">
          {list.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full truncate rounded-[6px] px-2 py-1.5 text-left hover:bg-[var(--surface-hover)]"
                onClick={() => startEdit(c)}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CompanyList({
  companies,
  isManager,
  onChanged,
  onMail,
}: {
  companies: Company[];
  isManager: boolean;
  onChanged: (list: Company[]) => void;
  onMail: (companyId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return companies;
    return companies.filter((c) =>
      [
        c.name,
        c.login_id,
        c.contact,
        c.contact_email,
        c.contract_stage,
        ...(c.aliases || []),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(key)),
    );
  }, [companies, q]);

  async function toggleActive(company: Company) {
    const res = await fetch(`/api/admin/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !company.is_active }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "상태 변경 실패");
      return;
    }
    onChanged(companies.map((c) => (c.id === company.id ? (body.company as Company) : c)));
  }

  return (
    <div className="space-y-3">
      <input
        className={`${fieldClass} w-full max-w-sm`}
        placeholder="이름 · 아이디 · 메일 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      <div className="overflow-x-auto rounded-[6px] border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-[var(--line)] text-[11px] font-medium text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">회원사</th>
              <th className="px-3 py-2">로그인</th>
              <th className="px-3 py-2">계약 단계</th>
              <th className="px-3 py-2">배정 예산</th>
              <th className="px-3 py-2">수신 메일</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-[var(--muted)]" colSpan={7}>
                  등록된 회원사가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-3 py-2.5 font-semibold">{c.name}</td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">{c.login_id}</td>
                  <td className="px-3 py-2.5">{c.contract_stage || "—"}</td>
                  <td className="px-3 py-2.5 tabular-nums text-[var(--muted)]">
                    {c.budget_amount != null
                      ? `${formatKrw(c.budget_amount)}원`
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {c.contact_email || resolveCompanyMailTo(c) || "—"}
                  </td>
                  <td className="px-3 py-2.5">{c.is_active ? "활성" : "비활성"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      className="mr-2 text-xs text-[var(--accent)]"
                      onClick={() => onMail(c.id)}
                    >
                      메일
                    </button>
                    {isManager ? (
                      <button
                        type="button"
                        className="text-xs text-[var(--muted)]"
                        onClick={() => void toggleActive(c)}
                      >
                        {c.is_active ? "비활성" : "활성"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MailPanel({
  companies,
  isManager,
  presetCompanyId,
}: {
  companies: Company[];
  isManager: boolean;
  presetCompanyId: string;
}) {
  const [companyId, setCompanyId] = useState(presetCompanyId);
  const [campaigns, setCampaigns] = useState<CampaignOpt[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [kind, setKind] = useState<CompanyMailKind>("견적서");
  const [toEmails, setToEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [docs, setDocs] = useState<CompanyDocRow[]>([]);
  const [docIds, setDocIds] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [managerName, setManagerName] = useState("");
  const [savedManagerName, setSavedManagerName] = useState("");
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [logs, setLogs] = useState<MailLog[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [mailFrom, setMailFrom] = useState<string>("");
  const [resendHint, setResendHint] = useState<string>("");
  const [setup, setSetup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const company = companies.find((c) => c.id === companyId) || null;
  const campaignName = campaigns.find((c) => c.id === campaignId)?.name || "";
  const activePreviewId =
    previewId && docIds.includes(previewId)
      ? previewId
      : docIds[docIds.length - 1] || null;
  const previewDoc = docs.find((d) => d.id === activePreviewId) || null;
  const previewHtml = previewDoc
    ? docHtml(previewDoc.kind, previewDoc.payload, false)
    : "";

  const applyTemplate = useCallback(
    (
      nextKind: CompanyMailKind,
      nextCompany: Company | null,
      nextCampaign: string,
      nextManager: string,
    ) => {
      const t = buildCompanyMailTemplate({
        kind: nextKind,
        companyName: nextCompany?.name || "",
        campaignName: nextCampaign,
        managerName: nextManager,
      });
      setSubject(t.subject);
      setBody(t.body);
    },
    [],
  );

  useEffect(() => {
    if (presetCompanyId) setCompanyId(presetCompanyId);
  }, [presetCompanyId]);

  useEffect(() => {
    const c = companies.find((x) => x.id === companyId) || null;
    setToEmails(c ? resolveCompanyMailTo(c) : "");
    // 수신은 회원사 변경 시에만 기본값. 계약서 체크 등으로 kind가 바뀌어도 유지.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    const c = companies.find((x) => x.id === companyId) || null;
    applyTemplate(kind, c, campaignName, savedManagerName);
  }, [companyId, kind, campaignName, savedManagerName, applyTemplate, companies]);

  useEffect(() => {
    fetch("/api/admin/mail-profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const p = j.profile as
          | { displayName?: string; signatureUrl?: string | null }
          | undefined;
        const name = p?.displayName || "";
        if (name) {
          setManagerName(name);
          setSavedManagerName(name);
        }
        if (p?.signatureUrl) setSignatureUrl(p.signatureUrl);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!companyId) {
      setCampaigns([]);
      setCampaignId("");
      setDocs([]);
      setDocIds([]);
      setPreviewId(null);
      return;
    }
    fetch(`/api/admin/campaigns?company_id=${encodeURIComponent(companyId)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => {
        setCampaigns(j.campaigns || []);
        setCampaignId("");
      })
      .catch(() => setCampaigns([]));
    fetch(`/api/admin/company-docs?company_id=${encodeURIComponent(companyId)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => {
        setDocs(Array.isArray(j.docs) ? j.docs : []);
        setDocIds([]);
        setPreviewId(null);
      })
      .catch(() => {
        setDocs([]);
        setDocIds([]);
        setPreviewId(null);
      });
  }, [companyId]);

  const loadLogs = useCallback(async () => {
    const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
    const res = await fetch(`/api/admin/companies/mail${qs}`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    setLogs(j.logs || []);
    setConfigured(Boolean(j.configured));
    setSetup(j.setup || null);
    setMailFrom(typeof j.from === "string" ? j.from : "");
    const r = j.resend as
      | { error?: string | null; domains?: { name: string; status: string }[] }
      | undefined;
    if (r?.error) setResendHint(`Resend 키: ${r.error}`);
    else if (r?.domains?.length) {
      setResendHint(
        r.domains.map((d) => `${d.name} (${d.status})`).join(" · "),
      );
    } else setResendHint("");
  }, [companyId]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  async function saveMailProfile() {
    if (!isManager) return;
    setSavingProfile(true);
    setError(null);
    setOk(null);
    try {
      const fd = new FormData();
      fd.set("display_name", managerName);
      if (sigFile) fd.set("file", sigFile);
      const res = await fetch("/api/admin/mail-profile", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "서명 저장 실패");
      const p = j.profile as { displayName?: string; signatureUrl?: string | null };
      const name = p?.displayName || managerName;
      setManagerName(name);
      setSavedManagerName(name);
      if (p?.signatureUrl) setSignatureUrl(p.signatureUrl);
      setSigFile(null);
      setOk("발신 이름·서명을 저장했습니다. 이후 메일에도 사용됩니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "서명 저장 실패");
    } finally {
      setSavingProfile(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!isManager) return;
    setSending(true);
    setError(null);
    setOk(null);
    try {
      const fd = new FormData();
      fd.set("company_id", companyId);
      fd.set("campaign_id", campaignId);
      fd.set("kind", kind);
      fd.set("to_emails", toEmails);
      fd.set("subject", subject);
      fd.set("body", body);
      for (const id of docIds) fd.append("doc_ids", id);
      for (const f of files) fd.append("files", f);
      const res = await fetch("/api/admin/companies/mail", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "발송 실패");
      setOk(j.warning ? `발송됨 · ${j.warning}` : "발송했습니다.");
      setFiles([]);
      setDocIds([]);
      setPreviewId(null);
      await loadLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "발송 실패");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(440px,1.05fr)]">
      <div className="space-y-6">
      <form onSubmit={send} className="owm-panel space-y-3 border border-[var(--line)] bg-[var(--surface)] p-5">
        <p className="text-sm font-semibold">메일 발송</p>
        <p className="text-[12.5px] leading-relaxed text-[var(--muted)]">
          종류를 고르면 제목·본문이 채워집니다. 저장된 계약서·인보이스는 PDF로 첨부됩니다.
          컨텐츠 가이드라인은 해당 캠페인 파일이 있으면 함께 첨부합니다.
        </p>
        {configured === false ? (
          <p className="text-xs text-[var(--danger)]">
            RESEND_API_KEY가 없습니다. 회원사로 보내려면 Resend에서 도메인을 인증한 뒤
            COMPANY_MAIL_FROM을 그 주소로 넣으세요.
          </p>
        ) : null}
        {mailFrom || resendHint ? (
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            {mailFrom ? `발신 ${mailFrom}` : null}
            {mailFrom && resendHint ? " · " : null}
            {resendHint || null}
          </p>
        ) : null}
        {setup ? <p className="text-xs text-[var(--muted)]">{setup}</p> : null}
        {!isManager ? (
          <p className="text-xs text-[var(--muted)]">발송은 운영관리자만 할 수 있습니다.</p>
        ) : null}

        <Field label="회원사">
          <select
            className={fieldClass}
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
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
        <Field label="캠페인 (선택)">
          <select
            className={fieldClass}
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            <option value="">없음</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="메일 종류">
          <select
            className={fieldClass}
            value={kind}
            onChange={(e) => setKind(e.target.value as CompanyMailKind)}
          >
            {COMPANY_MAIL_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </Field>
        <Field label="수신">
          <input
            className={fieldClass}
            value={toEmails}
            onChange={(e) => setToEmails(e.target.value)}
            placeholder="a@b.com, c@d.com"
            required
          />
        </Field>
        <Field label="제목">
          <input className={fieldClass} value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </Field>
        <Field label="본문">
          <textarea
            className={`${fieldClass} h-40 py-2`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </Field>
        <div className="rounded-[6px] border border-[var(--line)] p-3">
          <p className="text-sm font-medium text-[var(--ink)]">발신 서명</p>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            회사명은 BrandSlam입니다. 매니저 이름·서명 사진은 한 번 저장하면 이후 메일에도
            붙습니다. 매니저 계정이 생기면 로그인한 매니저 명의로 나갑니다.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="매니저 이름">
              <input
                className={fieldClass}
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="예: 김슬램"
              />
            </Field>
            <label className="text-sm text-[var(--muted)]">
              서명 사진
              <input
                className="mt-1 block w-full text-xs"
                type="file"
                accept="image/*"
                onChange={(e) => setSigFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
          {signatureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signatureUrl}
              alt="등록된 서명"
              className="mt-2 h-16 w-auto rounded border border-[var(--line)] bg-white object-contain"
            />
          ) : (
            <p className="mt-2 text-[11px] text-[var(--muted)]">아직 서명 사진이 없습니다.</p>
          )}
          {isManager ? (
            <button
              type="button"
              className={`${secondaryBtnClass} mt-2`}
              disabled={savingProfile}
              onClick={() => void saveMailProfile()}
            >
              {savingProfile ? "저장 중…" : "서명 저장"}
            </button>
          ) : null}
        </div>
        <div>
          <p className="mb-2 text-sm text-[var(--muted)]">저장된 계약서 · 인보이스</p>
          {docs.length === 0 ? (
            <p className="text-[12px] text-[var(--muted)]">
              이 회원사에 저장된 문서가 없습니다. 계약·인보이스 탭에서 먼저 저장하세요.
            </p>
          ) : (
            <ul className="max-h-44 space-y-1 overflow-auto rounded-[6px] border border-[var(--line)] p-2">
              {docs.map((d) => (
                <li key={d.id}>
                  <label className="flex cursor-pointer items-start gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={docIds.includes(d.id)}
                      onChange={() => {
                        const on = !docIds.includes(d.id);
                        setDocIds((prev) =>
                          on ? [...prev, d.id] : prev.filter((id) => id !== d.id),
                        );
                        if (on) {
                          setPreviewId(d.id);
                          if (d.kind === "계약서") setKind("계약서");
                          else if (d.kind === "인보이스" && kind === "계약서")
                            setKind("청구서");
                        } else if (previewId === d.id) {
                          setPreviewId(null);
                        }
                      }}
                    />
                    <span>
                      <span className="font-medium">{d.kind}</span>{" "}
                      {d.title}
                      <span className="ml-1 text-[11px] text-[var(--muted)]">
                        {d.issued_on || ""} · {d.status}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {docIds.length ? (
            <p className="mt-1 text-[11px] text-[var(--muted)]">{docIds.length}건 첨부</p>
          ) : null}
        </div>
        <Field label="추가 첨부 (PDF·이미지, 8MB 이하)">
          <input
            className="text-sm"
            type="file"
            multiple
            accept="application/pdf,image/*"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
        </Field>
        {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
        {ok ? <p className="text-xs text-[var(--accent)]">{ok}</p> : null}
        <button className={primaryBtnClass} type="submit" disabled={sending || !isManager || !company}>
          {sending ? "발송 중…" : "보내기"}
        </button>
      </form>

      <div className="owm-panel border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="mb-3 text-sm font-semibold">발송 이력</p>
        <ul className="max-h-[280px] space-y-2 overflow-auto text-sm">
          {logs.length === 0 ? (
            <li className="text-[var(--muted)]">이력이 없습니다.</li>
          ) : (
            logs.map((log) => (
              <li key={log.id} className="rounded-[6px] border border-[var(--line)] px-3 py-2">
                <p className="font-medium">
                  {log.kind}
                  <span className="ml-2 text-[11px] font-normal text-[var(--muted)]">
                    {log.sent_at ? "발송" : "실패"}
                  </span>
                </p>
                <p className="truncate text-[12px] text-[var(--muted)]">{log.subject}</p>
                <p className="text-[11px] text-[var(--muted)]">
                  {log.to_emails.join(", ")} · {fmtDt(log.created_at)}
                </p>
                {log.error ? (
                  <p className="text-[11px] text-[var(--danger)]">{log.error}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
      </div>

      <div className="xl:sticky xl:top-3 xl:self-start">
        <div className="owm-panel border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="mb-2 text-sm font-semibold">첨부 미리보기</p>
          {docIds.length > 1 ? (
            <div className="mb-2 flex flex-wrap gap-1">
              {docs
                .filter((d) => docIds.includes(d.id))
                .map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setPreviewId(d.id)}
                    className={`rounded-[6px] border px-2 py-1 text-[11px] ${
                      d.id === activePreviewId
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--line)] text-[var(--muted)]"
                    }`}
                  >
                    {d.kind}
                  </button>
                ))}
            </div>
          ) : null}
          {previewHtml ? (
            <iframe
              title="첨부 문서 미리보기"
              className="h-[min(88vh,1100px)] w-full rounded-[6px] border border-[var(--line)] bg-[#d8d2c8]"
              srcDoc={previewHtml}
              sandbox="allow-same-origin"
            />
          ) : (
            <p className="px-2 py-16 text-center text-sm text-[var(--muted)]">
              왼쪽에서 계약서·인보이스를 선택하면 여기에 내용이 보입니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminCompaniesTab({
  companies,
  isManager,
  sub,
  onSubChange,
}: {
  companies: Company[];
  isManager: boolean;
  sub: CompaniesSub;
  onSubChange: (s: CompaniesSub) => void;
}) {
  const [list, setList] = useState(companies);
  const [mailCompanyId, setMailCompanyId] = useState("");

  useEffect(() => setList(companies), [companies]);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 px-4 pb-4 pt-5 sm:px-7">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
            Companies
          </p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight text-[var(--ink)] sm:text-[30px]">
            회원사
          </h1>
        </div>
      </div>
      <div className="px-4 pb-8 sm:px-7">
        {sub === "companies" ? (
          <CompanyList
            companies={list}
            isManager={isManager}
            onChanged={setList}
            onMail={(id) => {
              setMailCompanyId(id);
              onSubChange("companiesMail");
            }}
          />
        ) : null}
        {sub === "companiesRegister" ? (
          <div className="space-y-6">
            <CompanyCsvImport
              isManager={isManager}
              onImported={(added) =>
                setList((prev) => {
                  const map = new Map(prev.map((c) => [c.id, c]));
                  for (const c of added) map.set(c.id, c);
                  return [...map.values()].sort((a, b) =>
                    a.name.localeCompare(b.name, "ko"),
                  );
                })
              }
            />
            <CompanyForm
              companies={list}
              isManager={isManager}
              onSaved={(c) =>
                setList((prev) => {
                  const exists = prev.some((x) => x.id === c.id);
                  return exists
                    ? prev.map((x) => (x.id === c.id ? c : x))
                    : [...prev, c].sort((a, b) => a.name.localeCompare(b.name, "ko"));
                })
              }
            />
          </div>
        ) : null}
        {sub === "companiesMail" ? (
          <MailPanel companies={list} isManager={isManager} presetCompanyId={mailCompanyId} />
        ) : null}
        {sub === "companiesDocs" ? (
          <AdminCompanyDocsPanel companies={list} isManager={isManager} />
        ) : null}
      </div>
    </div>
  );
}
