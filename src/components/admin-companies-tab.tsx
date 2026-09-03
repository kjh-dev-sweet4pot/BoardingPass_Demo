"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Field, fieldClass, primaryBtnClass, secondaryBtnClass } from "@/components/ui";
import {
  COMPANY_MAIL_KINDS,
  buildCompanyMailTemplate,
  resolveCompanyMailTo,
  type CompanyMailKind,
} from "@/lib/company-mail";
import { type Company } from "@/lib/types";

export type CompaniesSub = "companies" | "companiesRegister" | "companiesMail";

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
  const [error, setError] = useState<string | null>(null);
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
  }

  function startEdit(company: Company) {
    setEditingId(company.id);
    setName(company.name);
    setLoginId(company.login_id);
    setPassword("");
    setContact(company.contact || "");
    setContactEmail(company.contact_email || "");
    setAliases((company.aliases || []).join(", "));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isManager) return;
    setSaving(true);
    setError(null);
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
      const next = body.company as Company;
      setList((prev) => {
        const exists = prev.some((c) => c.id === next.id);
        return exists
          ? prev.map((c) => (c.id === next.id ? next : c))
          : [...prev, next].sort((a, b) => a.name.localeCompare(b.name, "ko"));
      });
      onSaved(next);
      reset();
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
        <Field label="수신 메일">
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
        {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
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
      [c.name, c.login_id, c.contact, c.contact_email, ...(c.aliases || [])]
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
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[var(--line)] text-[11px] font-medium text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">회원사</th>
              <th className="px-3 py-2">로그인</th>
              <th className="px-3 py-2">수신 메일</th>
              <th className="px-3 py-2">연락처</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-[var(--muted)]" colSpan={6}>
                  등록된 회원사가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-3 py-2.5 font-semibold">{c.name}</td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">{c.login_id}</td>
                  <td className="px-3 py-2.5">
                    {c.contact_email || resolveCompanyMailTo(c) || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">{c.contact || "—"}</td>
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

  const applyTemplate = useCallback(
    (nextKind: CompanyMailKind, nextCompany: Company | null, nextCampaign: string) => {
      const t = buildCompanyMailTemplate({
        kind: nextKind,
        companyName: nextCompany?.name || "",
        campaignName: nextCampaign,
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
    applyTemplate(kind, c, campaignName);
  }, [companyId, companies, kind, campaignName, applyTemplate]);

  useEffect(() => {
    if (!companyId) {
      setCampaigns([]);
      setCampaignId("");
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
      for (const f of files) fd.append("files", f);
      const res = await fetch("/api/admin/companies/mail", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "발송 실패");
      setOk(j.warning ? `발송됨 · ${j.warning}` : "발송했습니다.");
      setFiles([]);
      await loadLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "발송 실패");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={send} className="owm-panel space-y-3 border border-[var(--line)] bg-[var(--surface)] p-5">
        <p className="text-sm font-semibold">메일 발송</p>
        <p className="text-[12.5px] leading-relaxed text-[var(--muted)]">
          종류를 고르면 제목·본문이 채워집니다. 컨텐츠 가이드라인은 해당 캠페인 파일이 있으면 함께 첨부합니다.
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
        <Field label="첨부 (PDF·이미지, 8MB 이하)">
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
        <ul className="max-h-[520px] space-y-2 overflow-auto text-sm">
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
        ) : null}
        {sub === "companiesMail" ? (
          <MailPanel companies={list} isManager={isManager} presetCompanyId={mailCompanyId} />
        ) : null}
      </div>
    </div>
  );
}
