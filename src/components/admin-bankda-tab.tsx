"use client";

import { useState } from "react";
import type { BankdaTransaction } from "@/lib/bankda";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function monthAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}
function toYMD(iso: string) {
  return iso.replace(/-/g, "");
}
function fmt(n: number) {
  return n === 0 ? "-" : n.toLocaleString("ko-KR") + "원";
}

export function AdminBankdaTab() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<BankdaTransaction[] | null>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/bankda/transactions?from=${toYMD(from)}&to=${toYMD(to)}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setRows(json.transactions ?? []);
      setRaw(json.raw);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 px-4 pb-4 pt-5 sm:px-7">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Beta</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight text-[var(--ink)]">
            Bankda
          </h1>
        </div>
      </div>

      {/* Controls */}
      <div className="shrink-0 px-4 pb-4 sm:px-7">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <span className="text-sm text-[var(--muted)]">~</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-[6px] bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "조회 중…" : "조회"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-500">{error}</p>
        )}
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto px-4 sm:px-7">
        {rows === null ? (
          <p className="text-sm text-[var(--muted)]">기간을 선택하고 조회하세요.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">거래 내역이 없음.</p>
        ) : (
          <>
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  <th className="py-2 pr-4">거래일시</th>
                  <th className="py-2 pr-4">적요</th>
                  <th className="py-2 pr-4 text-right">입금</th>
                  <th className="py-2 pr-4 text-right">출금</th>
                  <th className="py-2 text-right">잔액</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-hover)]"
                  >
                    <td className="py-2 pr-4 text-[var(--muted)]">{r.tran_date}</td>
                    <td className="py-2 pr-4 text-[var(--ink)]">{r.remark || "-"}</td>
                    <td className="py-2 pr-4 text-right text-blue-600">{fmt(r.in_amt)}</td>
                    <td className="py-2 pr-4 text-right text-red-500">{fmt(r.out_amt)}</td>
                    <td className="py-2 text-right text-[var(--ink)]">{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* 원본 응답 디버그 — 스키마 확인용 */}
            {raw && (
              <details className="mt-6">
                <summary className="cursor-pointer text-xs text-[var(--muted)]">원본 응답 (beta 디버그)</summary>
                <pre className="mt-2 max-h-60 overflow-auto rounded-[6px] bg-[var(--surface)] p-3 text-[11px] text-[var(--muted)]">
                  {JSON.stringify(raw, null, 2)}
                </pre>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
