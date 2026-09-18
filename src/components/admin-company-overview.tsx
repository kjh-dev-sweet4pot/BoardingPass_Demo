"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, fieldClass, primaryBtnClass, secondaryBtnClass } from "@/components/ui";
import {
  COMPANY_CONTRACT_STAGES,
  CONTRACT_STAGES_AFTER_DEPOSIT,
  canEditContractStageIndependently,
} from "@/lib/company";
import { formatKrw } from "@/lib/creator-pool-mock";
import type { Company } from "@/lib/types";

export type CompanyManageDest = "companiesBudget" | "companiesDocs" | "companiesMail" | "companiesCampaigns";

function money(n: number | null | undefined) {
  return n != null ? `${formatKrw(n)}원` : "—";
}

function ymd(v: string | null | undefined) {
  return v?.slice(0, 10) || "";
}

export function AdminCompanyOverview({
  companies,
  isManager,
  onChanged,
  onManage,
}: {
  companies: Company[];
  isManager: boolean;
  onChanged: (company: Company) => void;
  onManage: (companyId: string, dest: CompanyManageDest) => void;
}) {
  const sorted = useMemo(
    () => [...companies].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [companies],
  );
  const [companyId, setCompanyId] = useState("");
  const selected = sorted.find((c) => c.id === companyId) || null;

  const activeCount = sorted.filter((c) => c.is_active !== false).length;
  const budgetSum = sorted.reduce((s, c) => s + (c.budget_amount || 0), 0);
  const stageCounts = COMPANY_CONTRACT_STAGES.map((stage) => ({
    stage,
    n: sorted.filter((c) => c.contract_stage === stage).length,
  })).filter((row) => row.n > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <Stat label="회원사" value={`${sorted.length}`} unit="곳" sub={`활성 ${activeCount}`} />
        <Stat label="배정 예산 합" value={sorted.length ? formatKrw(budgetSum) : "—"} unit={sorted.length ? "원" : undefined} />
        <Stat
          label="계약 단계"
          value={stageCounts[0] ? `${stageCounts[0].n}` : "—"}
          unit={stageCounts[0]?.stage}
          sub={stageCounts.slice(1).map((r) => `${r.stage} ${r.n}`).join(" · ") || "기록 없음"}
        />
      </div>

      <div className="overflow-x-auto rounded-[6px] border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-[var(--line)] text-[11px] font-medium text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">회원사</th>
              <th className="px-3 py-2">로그인</th>
              <th className="px-3 py-2">계약 단계</th>
              <th className="px-3 py-2">배정 예산</th>
              <th className="px-3 py-2">담당</th>
              <th className="px-3 py-2">상태</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-[var(--muted)]" colSpan={6}>
                  표시할 회원사가 없습니다.
                </td>
              </tr>
            ) : (
              sorted.map((c) => (
                <tr
                  key={c.id}
                  className={`cursor-pointer border-b border-[var(--line)] last:border-0 ${
                    c.id === companyId ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-hover)]"
                  }`}
                  onClick={() => setCompanyId(c.id)}
                >
                  <td className="px-3 py-2.5 font-semibold">{c.name}</td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">{c.login_id}</td>
                  <td className="px-3 py-2.5">{c.contract_stage || "—"}</td>
                  <td className="px-3 py-2.5 tabular-nums text-[var(--muted)]">{money(c.budget_amount)}</td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">{c.contact || c.contact_email || "—"}</td>
                  <td className="px-3 py-2.5">{c.is_active === false ? "비활성" : "활성"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className="owm-panel space-y-3 border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Field label="회원사">
            <select
              className={`${fieldClass} min-w-[220px]`}
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">선택</option>
              {sorted.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          {selected ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={secondaryBtnClass} onClick={() => onManage(selected.id, "companiesBudget")}>
                예산
              </button>
              <button type="button" className={secondaryBtnClass} onClick={() => onManage(selected.id, "companiesCampaigns")}>
                캠페인
              </button>
              <button type="button" className={secondaryBtnClass} onClick={() => onManage(selected.id, "companiesDocs")}>
                계약·인보이스
              </button>
              <button type="button" className={secondaryBtnClass} onClick={() => onManage(selected.id, "companiesMail")}>
                메일
              </button>
            </div>
          ) : (
            <p className="pb-2 text-xs text-[var(--muted)]">회원사를 고르면 정보를 수정할 수 있습니다.</p>
          )}
        </div>
        {selected ? (
          <CompanyEditForm
            key={selected.id}
            company={selected}
            isManager={isManager}
            onSaved={(next) => {
              onChanged(next);
              setCompanyId(next.id);
            }}
          />
        ) : null}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-[var(--ink)]">
        {value}
        {unit ? <span className="ml-1 text-xs font-normal text-[var(--muted)]">{unit}</span> : null}
      </p>
      {sub ? <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{sub}</p> : null}
    </div>
  );
}

function CompanyEditForm({
  company,
  isManager,
  onSaved,
}: {
  company: Company;
  isManager: boolean;
  onSaved: (company: Company) => void;
}) {
  const [name, setName] = useState(company.name);
  const [loginId, setLoginId] = useState(company.login_id);
  const [password, setPassword] = useState("");
  const [contact, setContact] = useState(company.contact || "");
  const [contactEmail, setContactEmail] = useState(company.contact_email || "");
  const [aliases, setAliases] = useState((company.aliases || []).join(", "));
  const [firstMeetOn, setFirstMeetOn] = useState(ymd(company.first_meet_on));
  const [plannedStartOn, setPlannedStartOn] = useState(ymd(company.planned_start_on));
  const [plannedEndOn, setPlannedEndOn] = useState(ymd(company.planned_end_on));
  const [contractStage, setContractStage] = useState(company.contract_stage || "");
  const [budgetAmount, setBudgetAmount] = useState(
    company.budget_amount != null ? String(company.budget_amount) : "",
  );
  const [spentAmount, setSpentAmount] = useState(
    company.spent_amount != null ? String(company.spent_amount) : "",
  );
  const [guidelineUrl, setGuidelineUrl] = useState(company.guideline_url || "");
  const [isActive, setIsActive] = useState(company.is_active !== false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const stageUnlocked = canEditContractStageIndependently(company.contract_stage);

  useEffect(() => {
    setName(company.name);
    setLoginId(company.login_id);
    setPassword("");
    setContact(company.contact || "");
    setContactEmail(company.contact_email || "");
    setAliases((company.aliases || []).join(", "));
    setFirstMeetOn(ymd(company.first_meet_on));
    setPlannedStartOn(ymd(company.planned_start_on));
    setPlannedEndOn(ymd(company.planned_end_on));
    setContractStage(company.contract_stage || "");
    setBudgetAmount(company.budget_amount != null ? String(company.budget_amount) : "");
    setSpentAmount(company.spent_amount != null ? String(company.spent_amount) : "");
    setGuidelineUrl(company.guideline_url || "");
    setIsActive(company.is_active !== false);
  }, [company]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isManager) return;
    setSaving(true);
    setError(null);
    setWarning(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          login_id: loginId,
          password: password || undefined,
          contact,
          contact_email: contactEmail,
          aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean),
          first_meet_on: firstMeetOn || null,
          planned_start_on: plannedStartOn || null,
          planned_end_on: plannedEndOn || null,
          ...(stageUnlocked ? { contract_stage: contractStage || null } : {}),
          budget_amount: budgetAmount || null,
          spent_amount: spentAmount || null,
          guideline_url: guidelineUrl || null,
          is_active: isActive,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "저장 실패");
      if (typeof body.warning === "string") setWarning(body.warning);
      const next = body.company as Company;
      onSaved(next);
      setPassword("");
      setSuccess(`${next.name} 회원사 정보를 수정했습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-[var(--line)] pt-3">
      {!isManager ? (
        <p className="text-xs text-[var(--muted)]">수정은 운영관리자만 할 수 있습니다.</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="표시명">
          <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required disabled={!isManager} />
        </Field>
        <Field label="로그인 아이디">
          <input className={fieldClass} value={loginId} onChange={(e) => setLoginId(e.target.value)} required disabled={!isManager} />
        </Field>
        <Field label="비밀번호 재설정 (선택)">
          <input className={fieldClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={!isManager} />
        </Field>
        <Field label="상태">
          <select
            className={fieldClass}
            value={isActive ? "1" : "0"}
            onChange={(e) => setIsActive(e.target.value === "1")}
            disabled={!isManager}
          >
            <option value="1">활성</option>
            <option value="0">비활성</option>
          </select>
        </Field>
        <Field label="수신 메일">
          <input className={fieldClass} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} disabled={!isManager} />
        </Field>
        <Field label="담당자 연락처">
          <input className={fieldClass} value={contact} onChange={(e) => setContact(e.target.value)} disabled={!isManager} />
        </Field>
        <Field label="별칭 (쉼표)">
          <input className={fieldClass} value={aliases} onChange={(e) => setAliases(e.target.value)} disabled={!isManager} />
        </Field>
        <Field label="계약 진행 단계">
          <select
            className={fieldClass}
            value={contractStage}
            onChange={(e) => setContractStage(e.target.value)}
            disabled={!isManager || !stageUnlocked}
          >
            {stageUnlocked ? <option value="">선택</option> : null}
            {(stageUnlocked ? CONTRACT_STAGES_AFTER_DEPOSIT : COMPANY_CONTRACT_STAGES)
              .filter((s) => stageUnlocked || s === contractStage)
              .map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            {!stageUnlocked && contractStage && !(COMPANY_CONTRACT_STAGES as readonly string[]).includes(contractStage) ? (
              <option value={contractStage}>{contractStage}</option>
            ) : null}
          </select>
          {!stageUnlocked ? (
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              입금 완료 전에는 예산 입금 상태와 같습니다. 예산 탭에서 바꿔 주세요.
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              입금 완료 후입니다. 캠페인 진행 이후 단계만 직접 조정할 수 있습니다.
            </p>
          )}
        </Field>
        <Field label="최초 미팅 일자">
          <input className={fieldClass} type="date" value={firstMeetOn} onChange={(e) => setFirstMeetOn(e.target.value)} disabled={!isManager} />
        </Field>
        <Field label="소요예정 시작">
          <input className={fieldClass} type="date" value={plannedStartOn} onChange={(e) => setPlannedStartOn(e.target.value)} disabled={!isManager} />
        </Field>
        <Field label="소요예정 종료">
          <input className={fieldClass} type="date" value={plannedEndOn} onChange={(e) => setPlannedEndOn(e.target.value)} disabled={!isManager} />
        </Field>
        <Field label="배정 예산 (원)">
          <input className={fieldClass} inputMode="numeric" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} disabled={!isManager} />
        </Field>
        <Field label="소요 비용 (원)">
          <input className={fieldClass} inputMode="numeric" value={spentAmount} onChange={(e) => setSpentAmount(e.target.value)} disabled={!isManager} />
        </Field>
      </div>
      <Field label="콘텐츠 가이드라인 URL">
        <input className={fieldClass} type="url" value={guidelineUrl} onChange={(e) => setGuidelineUrl(e.target.value)} disabled={!isManager} />
      </Field>
      <p className="text-[11px] text-[var(--muted)]">
        배정 예산은 예산 탭의 입금 완료 합이 있으면 그 값으로 덮어씁니다. 소요 비용은 운영 기록용입니다.
      </p>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      {warning ? <p className="text-xs text-[var(--accent)]">{warning}</p> : null}
      {success ? <p className="text-xs text-[var(--accent)]">{success}</p> : null}
      <button className={primaryBtnClass} type="submit" disabled={saving || !isManager}>
        {saving ? "저장 중…" : "수정 저장"}
      </button>
    </form>
  );
}
