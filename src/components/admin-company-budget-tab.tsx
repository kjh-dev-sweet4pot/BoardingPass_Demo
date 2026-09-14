"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminTestVisibility } from "@/components/admin-test-visibility";
import { Field, fieldClass, secondaryBtnClass } from "@/components/ui";
import {
  BUDGET_DEPOSIT_STATUSES,
  BUDGET_TABLE_SETUP,
  BUDGET_USAGE_STATUSES,
  formatManwon,
  krwToManwon,
  monthLabel,
  roundKind,
  shiftMonth,
  summarizeCashflow,
  type BudgetDepositStatus,
  type BudgetRound,
  type BudgetUsageStatus,
} from "@/lib/company-budget-rounds";
import type { Company } from "@/lib/types";

const SLAM_YEAR = "2026";

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

export function AdminCompanyBudgetPanel({
  companies,
  isManager,
  onBudgetsApplied,
  presetCompanyId = "",
}: {
  companies: Company[];
  isManager: boolean;
  onBudgetsApplied: (patches: { company_id: string; budget_amount: number | null }[]) => void;
  presetCompanyId?: string;
}) {
  const { includeCompany } = useAdminTestVisibility();
  const [rounds, setRounds] = useState<BudgetRound[]>([]);
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
    { key: string; kind: "입금" | "사용"; period: string }[]
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
  const usageItems = scoped
    .filter((r) => roundKind(r) === "사용")
    .map((round) => ({ round, copy: false }))
    .sort((a, b) => a.round.period_month.localeCompare(b.round.period_month));

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

  useEffect(() => {
    void load();
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

  function addRow(kind: "입금" | "사용") {
    if (!picked || (!activeCompanyId && !companyName.trim())) {
      setError("회원사를 선택하거나 이름을 입력하세요.");
      return;
    }
    const source = kind === "입금" ? deposits : usageItems.map((item) => item.round);
    const period = nextPeriod([
      ...source,
      ...openRows
        .filter((row) => row.kind === kind)
        .map((row) => ({ period_month: `${row.period}-01` })),
    ]);
    setOpenRows((prev) => [...prev, { key: `${kind}-${period}-${Date.now()}`, kind, period }]);
    setError(null);
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
        입금과 사용은 저장된 값이 채워집니다. 추가는 목록 바로 아래에 칸이 붙습니다. 오른쪽은 입금
        예산과 사용 예산을 맞춘 현금흐름입니다. 전체 예산은 입금 완료만 합산합니다. 단위는 만원.
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
            <LineList
              title="입금 예산"
              kind="입금"
              items={deposits.map((round) => ({ round, copy: false }))}
              isManager={isManager}
              openRows={openRows.filter((row) => row.kind === "입금")}
              onRemoveOpen={(key) => setOpenRows((prev) => prev.filter((row) => row.key !== key))}
              onAdd={() => addRow("입금")}
              onDelete={onDelete}
              onSaved={async (data) => {
                applyBudgets(data);
                await load();
              }}
              onError={setError}
              companyPayload={companyPayload}
            />
            <LineList
              title="사용 예산"
              kind="사용"
              items={usageItems}
              isManager={isManager}
              openRows={openRows.filter((row) => row.kind === "사용")}
              onRemoveOpen={(key) => setOpenRows((prev) => prev.filter((row) => row.key !== key))}
              onAdd={() => addRow("사용")}
              onDelete={onDelete}
              onSaved={async (data) => {
                applyBudgets(data);
                await load();
              }}
              onError={setError}
              companyPayload={companyPayload}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LineList({
  title,
  kind,
  items,
  isManager,
  openRows = [],
  onRemoveOpen,
  onAdd,
  onDelete,
  onSaved,
  onError,
  companyPayload,
}: {
  title: string;
  kind: "입금" | "사용";
  items: { round: BudgetRound; copy: boolean }[];
  isManager: boolean;
  openRows?: { key: string; period: string }[];
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
      <p className="text-base font-semibold">{title}</p>
      <div className="mt-2 space-y-2">
        {items.length === 0 ? (
          <p className="text-[11px] text-[var(--muted)]">아직 없습니다. 추가로 칸을 붙입니다.</p>
        ) : (
          items.map((item) => (
            <BudgetLine
              key={`${kind}-${item.round.id}-${item.copy ? "copy" : "own"}`}
              round={item.round}
              kind={kind}
              copy={item.copy}
              fresh={false}
              isManager={isManager}
              onDelete={() => void onDelete(item.round)}
              onSaved={onSaved}
              onError={onError}
              companyPayload={companyPayload}
            />
          ))
        )}
        {isManager ? (
          <button type="button" className={secondaryBtnClass} onClick={onAdd}>
            추가
          </button>
        ) : null}
        {openRows.map((row) => (
          <div key={row.key} style={{ animation: "budget-open 180ms ease-out" }}>
            <BudgetLine
              round={{
                id: row.key,
                company_id: null,
                company_name: "",
                label: "",
                period_month: `${row.period}-01`,
                amount_krw: null,
                deposit_status: kind === "입금" ? "입금 완료" : "협의중",
                usage_status: kind === "사용" ? "가용" : "사용 예정",
              }}
              kind={kind}
              copy
              fresh
              isManager={isManager}
              onDelete={() => onRemoveOpen?.(row.key)}
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

function BudgetLine({
  round,
  kind,
  copy,
  fresh,
  isManager,
  onDelete,
  onSaved,
  onError,
  companyPayload,
}: {
  round: BudgetRound;
  kind: "입금" | "사용";
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
  const [label, setLabel] = useState(round.label || "");
  const [status, setStatus] = useState(kind === "입금" ? round.deposit_status : round.usage_status);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPeriod(round.period_month.slice(0, 7));
    setAmount(krwToManwon(round.amount_krw)?.toString() ?? "");
    setLabel(round.label || "");
    setStatus(kind === "입금" ? round.deposit_status : round.usage_status);
  }, [
    round.id,
    round.period_month,
    round.amount_krw,
    round.label,
    round.deposit_status,
    round.usage_status,
    kind,
  ]);

  const dirty =
    period !== round.period_month.slice(0, 7) ||
    amount !== (krwToManwon(round.amount_krw)?.toString() ?? "") ||
    label !== (round.label || "") ||
    status !== (kind === "입금" ? round.deposit_status : round.usage_status);

  async function commit() {
    if (!isManager || busy || !dirty) return;
    setBusy(true);
    onError("");
    try {
      const body = {
        ...companyPayload(),
        kind,
        label,
        period_month: period,
        amount_manwon: amount,
        deposit_status: kind === "입금" ? status : "협의중",
        usage_status: kind === "사용" ? status : "사용 예정",
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
    } catch (err) {
      onError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const lineField = `${fieldClass} h-9 w-auto shrink-0 px-2`;

  return (
    <div
      className={`flex w-fit max-w-full flex-wrap items-center gap-1.5 rounded-[6px] border px-2 py-1.5 ${
        fresh ? "border-[var(--accent)]" : "border-[var(--line)]"
      }`}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void commit();
      }}
    >
      <input
        className={`${lineField} w-[11.5rem]`}
        type="month"
        value={period}
        disabled={!isManager || busy}
        onChange={(e) => setPeriod(e.target.value)}
      />
      <input
        className={`${lineField} w-24`}
        inputMode="decimal"
        value={amount}
        placeholder="만원"
        disabled={!isManager || busy}
        onChange={(e) => setAmount(e.target.value)}
      />
      <input
        className={`${lineField} w-16`}
        value={label}
        placeholder="차수"
        disabled={!isManager || busy}
        onChange={(e) => setLabel(e.target.value)}
      />
      <select
        className={`${lineField} w-[9.5rem]`}
        value={status}
        disabled={!isManager || busy}
        onChange={(e) => setStatus(e.target.value as BudgetDepositStatus & BudgetUsageStatus)}
      >
        {(kind === "입금" ? BUDGET_DEPOSIT_STATUSES : BUDGET_USAGE_STATUSES).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {isManager && (!copy || fresh) ? (
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
        return {
          key,
          companyId: list[0].company_id,
          companyName: list[0].company_name,
          name: displayName(list[0], companies),
          deposited: summary.deposited,
          used: summary.used,
        };
      })
      .sort((a, b) => {
        const paid = Number(b.deposited > 0) - Number(a.deposited > 0);
        return paid || a.name.localeCompare(b.name, "ko");
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
                  note=""
                  amount={formatManwon(row.deposited)}
                  dim={row.deposited === 0}
                  onPick={() => onPickCompany(row.companyId, row.companyName)}
                />
              ))}
            </div>
            <div className="border-l border-[var(--line)]">
              {group.rows.map((row) => (
                <LedgerRow
                  key={row.key}
                  month={row.name}
                  note=""
                  amount={formatManwon(row.used)}
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

function CashflowSheet({ title, rounds }: { title: string; rounds: BudgetRound[] }) {
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
            />
          ))}
          <LedgerRow month="합계" note="입금 완료" amount={formatManwon(flow.deposited)} strong />
        </Ledger>
        <Ledger title="사용 예산" empty="사용 없음" divider count={usage.length}>
          {usage.map((row) => (
            <LedgerRow
              key={row.id}
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
  onPick,
}: {
  month: string;
  note: string;
  amount: string;
  strong?: boolean;
  dim?: boolean;
  onPick?: () => void;
}) {
  const label = (
    <>
      {month}
      {note ? <span className="ml-1 text-[11px] text-[var(--muted)]">{note}</span> : null}
    </>
  );
  return (
    <div
      className={`flex items-baseline justify-between gap-2 px-3 py-1.5 text-xs ${
        strong ? "border-t border-[var(--line)] font-semibold" : ""
      } ${dim ? "text-[var(--muted)]" : ""}`}
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
