"use client";

import { useMemo, useState } from "react";
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
function toNum(val: unknown): number {
  if (val === undefined || val === null || val === "") return 0;
  const n = Number(String(val).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}
function fmtWon(n: number) {
  return n === 0 ? "-" : n.toLocaleString("ko-KR") + "원";
}

function formatTranDate(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return "-";
  const d = String(dateStr).trim();
  const t = String(timeStr || "").trim();
  const formattedDate = d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d;
  if (!t) return formattedDate;
  const formattedTime = t.length === 6 ? `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}` : t;
  return `${formattedDate} ${formattedTime}`.trim();
}

/** 뱅크다 실제 응답 필드 매핑 */
function normalizeRow(r: BankdaTransaction, idx: number) {
  const inAmt = toNum(r.bkinput ?? r.in_amt ?? r.inamt);
  const outAmt = toNum(r.bkoutput ?? r.out_amt ?? r.outamt);
  const balance = toNum(r.bkjango ?? r.balance ?? r.remain);
  const dateStr = formatTranDate(r.bkdate, r.bktime) || String(r.tran_date || r.trandate || "-");
  const remarkParts = [r.bkjukyo, r.bkcontent, r.bketc].filter(Boolean);
  const remarkStr = remarkParts.length > 0 ? remarkParts.join(" ") : String(r.remark || "-");
  const accountStr = [r.bkname, r.accountnum].filter(Boolean).join(" ") || "-";
  const bkcode = String(r.bkcode ?? idx + 1);
  const type: "입금" | "출금" | "기타" = inAmt > 0 ? "입금" : outAmt > 0 ? "출금" : "기타";

  return {
    id: bkcode,
    idx: idx + 1,
    date: dateStr,
    type,
    inAmt,
    outAmt,
    balance,
    remark: remarkStr,
    account: accountStr,
    raw: r,
  };
}

export function AdminBankdaTab() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [accountNum, setAccountNum] = useState("");
  const [isTest, setIsTest] = useState(true); // 5분 제한 회피용 기본값 true
  const [rows, setRows] = useState<BankdaTransaction[] | null>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 스프레드시트 뷰 필터 상태
  const [filterType, setFilterType] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  async function load(source: "api" | "db" = "api") {
    setLoading(true);
    setError(null);
    setSavedCount(null);
    setDbError(null);
    try {
      const q = new URLSearchParams({
        from: toYMD(from),
        to: toYMD(to),
      });
      if (accountNum.trim()) q.set("accountnum", accountNum.trim());
      if (isTest) q.set("istest", "y");
      if (source === "db") q.set("source", "db");

      const res = await fetch(`/api/bankda/transactions?${q.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setRows(json.transactions ?? []);
      setRaw(json.raw);
      if (typeof json.savedToDbCount === "number") {
        setSavedCount(json.savedToDbCount);
      }
      if (json.dbError) {
        setDbError(json.dbError);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // 정규화된 행 리스트
  const normalizedRows = useMemo(() => {
    if (!rows) return [];
    return rows.map((r, i) => normalizeRow(r, i));
  }, [rows]);

  // 필터링 및 검색 적용된 행 리스트
  const filteredRows = useMemo(() => {
    return normalizedRows.filter((r) => {
      if (filterType === "IN" && r.type !== "입금") return false;
      if (filterType === "OUT" && r.type !== "출금") return false;
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchRemark = r.remark.toLowerCase().includes(query);
        const matchAccount = r.account.toLowerCase().includes(query);
        const matchCode = r.id.toLowerCase().includes(query);
        const matchDate = r.date.toLowerCase().includes(query);
        if (!matchRemark && !matchAccount && !matchCode && !matchDate) return false;
      }
      return true;
    });
  }, [normalizedRows, filterType, searchQuery]);

  // 상단 요약 통계 계산
  const summary = useMemo(() => {
    const totalCount = filteredRows.length;
    const totalIn = filteredRows.reduce((acc, r) => acc + r.inAmt, 0);
    const totalOut = filteredRows.reduce((acc, r) => acc + r.outAmt, 0);
    const netChange = totalIn - totalOut;
    return { totalCount, totalIn, totalOut, netChange };
  }, [filteredRows]);

  // CSV / Spreadsheet 내보내기 (UTF-8 BOM 포함)
  function downloadCsv() {
    if (filteredRows.length === 0) return;
    const headers = [
      "순번",
      "거래일시",
      "구분",
      "입금액",
      "출금액",
      "잔액",
      "적요/거래내용",
      "계좌번호",
      "고유번호(bkcode)",
    ];
    const csvLines = filteredRows.map((r) => [
      r.idx,
      `"${r.date.replace(/"/g, '""')}"`,
      r.type,
      r.inAmt,
      r.outAmt,
      r.balance,
      `"${r.remark.replace(/"/g, '""')}"`,
      `"${r.account.replace(/"/g, '""')}"`,
      `"${r.id.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...csvLines.map((line) => line.join(","))].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bankda_transactions_${toYMD(from)}_${toYMD(to)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--surface-canvas,#fbfaf8)]">
      {/* 1. Header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-4 sm:px-7">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
              Admin Exclusive (Beta)
            </span>
            <span className="text-[11px] text-[var(--muted)]">Bankda 계좌 거래내역 스프레드시트</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
              Bankda 원장 스프레드시트
            </h1>
            {savedCount !== null && savedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                DB 동기화 완료 ({savedCount.toLocaleString()}건)
              </span>
            )}
          </div>
        </div>

        {/* CSV 내보내기 버튼 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadCsv}
            disabled={filteredRows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] shadow-sm transition hover:bg-[var(--surface-hover)] disabled:opacity-40"
          >
            <svg
              className="h-3.5 w-3.5 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Excel / CSV 다운로드
          </button>
        </div>
      </div>

      {/* 2. Controls & Search Bar */}
      <div className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* 조회 조건 그룹 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-2 py-1 shadow-sm">
              <span className="text-xs font-medium text-[var(--muted)]">기간:</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="bg-transparent text-xs text-[var(--ink)] focus:outline-none"
              />
              <span className="text-xs text-[var(--muted)]">~</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-transparent text-xs text-[var(--ink)] focus:outline-none"
              />
            </div>

            <input
              type="text"
              placeholder="계좌번호 (선택)"
              value={accountNum}
              onChange={(e) => setAccountNum(e.target.value)}
              className="w-32 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--ink)] shadow-sm placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />

            <label className="flex items-center gap-1.5 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--muted)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isTest}
                onChange={(e) => setIsTest(e.target.checked)}
                className="rounded border-[var(--line)] text-[var(--accent)]"
              />
              <span>테스트 모드 (5분 제한 해제)</span>
            </label>

            <button
              type="button"
              onClick={() => load("api")}
              disabled={loading}
              className="rounded-[6px] bg-[var(--accent)] px-4 py-1 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "데이터 조회 중…" : "원장 조회"}
            </button>
            <button
              type="button"
              onClick={() => load("db")}
              disabled={loading}
              title="뱅크다 API를 다시 호출하지 않고, 이미 DB에 저장된 데이터만 불러옵니다"
              className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-4 py-1 text-xs font-semibold text-[var(--ink)] shadow-sm transition hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              {loading ? "불러오는 중…" : "DB에서 불러오기"}
            </button>
          </div>

          {/* 테이블 내부 필터 & 검색 */}
          {rows !== null && (
            <div className="flex flex-wrap items-center gap-2">
              {/* 구분 필터 탭 */}
              <div className="flex rounded-[6px] border border-[var(--line)] bg-[var(--surface-hover)] p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFilterType("ALL")}
                  className={`rounded-[4px] px-2.5 py-0.5 transition ${
                    filterType === "ALL"
                      ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                      : "text-[var(--muted)]"
                  }`}
                >
                  전체
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("IN")}
                  className={`rounded-[4px] px-2.5 py-0.5 transition ${
                    filterType === "IN"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-[var(--muted)]"
                  }`}
                >
                  입금만
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("OUT")}
                  className={`rounded-[4px] px-2.5 py-0.5 transition ${
                    filterType === "OUT"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-[var(--muted)]"
                  }`}
                >
                  출금만
                </button>
              </div>

              {/* 검색창 */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="적요 / 계좌 / 고유번호 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] pl-7 pr-2.5 py-1 text-xs text-[var(--ink)] shadow-sm placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                <svg
                  className="absolute left-2 top-1.5 h-3.5 w-3.5 text-[var(--muted)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-2.5 rounded-[6px] border border-red-200 bg-red-50/50 p-2 text-xs font-medium text-red-600">
            ⚠ {error}
          </div>
        )}

        {dbError && (
          <div className="mt-2.5 rounded-[6px] border border-amber-300 bg-amber-50/80 p-2 text-xs font-medium text-amber-900">
            ⚠ <strong>DB 자동 저장 대기:</strong> {dbError} (Supabase SQL Editor에서 GRANT 권한 SQL 실행 필요)
          </div>
        )}
      </div>

      {/* 3. Summary Stats Ribbon */}
      {rows !== null && (
        <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3 sm:grid-cols-4 sm:px-7">
          <div className="rounded-[6px] border border-[var(--line)] bg-[var(--surface-hover)] p-2.5">
            <p className="text-[11px] font-medium text-[var(--muted)]">조회 거래건수</p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-[var(--ink)]">
              {summary.totalCount.toLocaleString()}
              <span className="text-xs font-normal text-[var(--muted)] ml-1">건</span>
            </p>
          </div>
          <div className="rounded-[6px] border border-blue-100 bg-blue-50/40 p-2.5">
            <p className="text-[11px] font-medium text-blue-700">총 입금 합계</p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-blue-600">
              +{summary.totalIn.toLocaleString()}
              <span className="text-xs font-normal text-blue-700/70 ml-1">원</span>
            </p>
          </div>
          <div className="rounded-[6px] border border-rose-100 bg-rose-50/40 p-2.5">
            <p className="text-[11px] font-medium text-rose-700">총 출금 합계</p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-rose-600">
              -{summary.totalOut.toLocaleString()}
              <span className="text-xs font-normal text-rose-700/70 ml-1">원</span>
            </p>
          </div>
          <div className="rounded-[6px] border border-[var(--line)] bg-[var(--surface-hover)] p-2.5">
            <p className="text-[11px] font-medium text-[var(--muted)]">순변동액 (입금 - 출금)</p>
            <p
              className={`mt-0.5 text-base font-bold tabular-nums ${
                summary.netChange >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {summary.netChange >= 0 ? "+" : ""}
              {summary.netChange.toLocaleString()}
              <span className="text-xs font-normal text-[var(--muted)] ml-1">원</span>
            </p>
          </div>
        </div>
      )}

      {/* 4. Spreadsheet Table Container */}
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-7">
        {rows === null ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-[8px] border border-dashed border-[var(--line)] bg-[var(--surface)] text-center">
            <svg
              className="h-10 w-10 text-[var(--muted)] opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-3 text-sm font-semibold text-[var(--ink)]">원장 조회 대기 중</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              원하는 기간을 설정하고 상단의 [원장 조회] 버튼을 눌러주세요.
            </p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-[8px] border border-dashed border-[var(--line)] bg-[var(--surface)] text-center">
            <p className="text-sm font-semibold text-[var(--ink)]">조건에 일치하는 거래내역이 없습니다.</p>
            <p className="mt-1 text-xs text-[var(--muted)]">검색어나 필터 조건을 변경해 보세요.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[8px] border border-[var(--line)] bg-[var(--surface)] shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--surface-hover)] font-semibold text-[var(--muted)]">
                    <th className="w-12 border-r border-[var(--line)] px-3 py-2.5 text-center">No</th>
                    <th className="w-36 border-r border-[var(--line)] px-3 py-2.5">거래일시</th>
                    <th className="w-20 border-r border-[var(--line)] px-3 py-2.5 text-center">구분</th>
                    <th className="w-32 border-r border-[var(--line)] px-3 py-2.5 text-right">입금액</th>
                    <th className="w-32 border-r border-[var(--line)] px-3 py-2.5 text-right">출금액</th>
                    <th className="w-36 border-r border-[var(--line)] px-3 py-2.5 text-right">거래후 잔액</th>
                    <th className="border-r border-[var(--line)] px-3 py-2.5">적요 / 거래내용</th>
                    <th className="w-32 border-r border-[var(--line)] px-3 py-2.5">계좌번호</th>
                    <th className="w-24 px-3 py-2.5 text-center">고유번호</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)] font-normal text-[var(--ink)]">
                  {filteredRows.map((r) => (
                    <tr
                      key={r.id + "_" + r.idx}
                      className="transition-colors hover:bg-[var(--surface-hover)]/70"
                    >
                      {/* No */}
                      <td className="border-r border-[var(--line)] px-3 py-2 text-center text-[11px] tabular-nums text-[var(--muted)]">
                        {r.idx}
                      </td>

                      {/* 거래일시 */}
                      <td className="border-r border-[var(--line)] px-3 py-2 font-mono text-[11px] text-[var(--muted)] whitespace-nowrap">
                        {r.date}
                      </td>

                      {/* 구분 */}
                      <td className="border-r border-[var(--line)] px-3 py-2 text-center">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            r.type === "입금"
                              ? "bg-blue-100 text-blue-700"
                              : r.type === "출금"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {r.type}
                        </span>
                      </td>

                      {/* 입금액 */}
                      <td className="border-r border-[var(--line)] px-3 py-2 text-right font-medium tabular-nums text-blue-600">
                        {fmtWon(r.inAmt)}
                      </td>

                      {/* 출금액 */}
                      <td className="border-r border-[var(--line)] px-3 py-2 text-right font-medium tabular-nums text-rose-600">
                        {fmtWon(r.outAmt)}
                      </td>

                      {/* 거래후 잔액 */}
                      <td className="border-r border-[var(--line)] px-3 py-2 text-right font-medium tabular-nums text-[var(--ink)]">
                        {fmtWon(r.balance)}
                      </td>

                      {/* 적요 / 거래내용 */}
                      <td className="border-r border-[var(--line)] px-3 py-2 font-medium text-[var(--ink)]">
                        <div className="truncate max-w-[280px]" title={r.remark}>
                          {r.remark}
                        </div>
                      </td>

                      {/* 계좌번호 */}
                      <td className="border-r border-[var(--line)] px-3 py-2 font-mono text-[11px] text-[var(--muted)]">
                        {r.account}
                      </td>

                      {/* 고유번호 */}
                      <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--muted)]">
                        {r.id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 원본 응답 (Beta 디버그 창) */}
        {raw !== null && (
          <details className="mt-6">
            <summary className="cursor-pointer text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
              API 원본 응답 JSON (Beta 디버그)
            </summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-3 text-[11px] text-[var(--muted)]">
              {JSON.stringify(raw, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
