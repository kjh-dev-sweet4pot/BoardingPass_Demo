"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  applyCompanyMatch,
  buildImportCsvTemplate,
  buildImportTemplateRows,
  IMPORT_ACCEPT,
  IMPORT_TEMPLATE_HEADER_LABEL,
  parseImportFile,
  type ParsedImportRow,
} from "@/lib/csv-import";
import { primaryBtnClass, secondaryBtnClass } from "@/components/ui";
import { type Company } from "@/lib/types";

export function AdminImportPanel({
  compact = false,
  companies = [],
}: {
  compact?: boolean;
  companies?: Company[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!compact);
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [companyList, setCompanyList] = useState(companies);
  const [aliasTarget, setAliasTarget] = useState<Record<number, string>>({});
  const hasCompanies = companyList.some((c) => c.is_active);

  useEffect(() => {
    setCompanyList(companies);
  }, [companies]);

  const stats = useMemo(() => {
    const ok = rows.filter((r) => r.ok).length;
    return { total: rows.length, ok, bad: rows.length - ok };
  }, [rows]);

  function downloadCsvTemplate() {
    const csv = `\uFEFF${buildImportCsvTemplate(companyList).replace(/\n/g, "\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "boardingpass-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadExcelTemplate() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(buildImportTemplateRows(companyList)),
      "배정",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["name", "aliases", "is_active"],
        ...companyList.map((c) => [
          c.name,
          (c.aliases || []).join(", "),
          c.is_active ? "true" : "false",
        ]),
      ]),
      "회원사목록",
    );
    XLSX.writeFile(wb, "boardingpass-import-template.xlsx");
  }

  function resetFileState() {
    setRows([]);
    setFileName(null);
    setConfirmed(false);
    setReviewOpen(false);
  }

  async function onFileChange(file: File | null) {
    setResultMessage(null);
    setResultError(null);
    setParseError(null);
    resetFileState();
    if (!file) return;

    setReading(true);
    try {
      const parsed = (await parseImportFile(file)).map((row) =>
        applyCompanyMatch(row, companyList),
      );
      if (parsed.length === 0) {
        setParseError(
          "데이터 행이 없습니다. 첫 시트에 헤더와 예시 행이 있는지 확인해 주세요.",
        );
        return;
      }
      setRows(parsed);
      setFileName(file.name);
      setReviewOpen(true);
      setConfirmed(false);
    } catch (err: unknown) {
      setParseError(
        err instanceof Error ? err.message : "파일을 읽지 못했습니다.",
      );
    } finally {
      setReading(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    void onFileChange(file);
  }

  async function commitImport() {
    const valid = rows.filter((r) => r.ok);
    if (valid.length === 0 || !confirmed) return;

    setImporting(true);
    setResultMessage(null);
    setResultError(null);

    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: valid.map((r) => ({
            company: r.company_raw,
            snsid: r.snsid,
            snsurl: r.snsurl || "",
            name: r.name,
            visit_date: r.visit_date,
            store: r.store,
            product: r.product,
            quantity: r.quantity,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "가져오기 실패");
      }

      const s = body.summary as {
        created: number;
        skipped: number;
        failed: number;
        total: number;
      };
      setResultMessage(
        `완료: ${s.total}행 중 생성 ${s.created} · 중복 건너뜀 ${s.skipped} · 실패 ${s.failed}`,
      );
      resetFileState();
      router.refresh();
    } catch (err: unknown) {
      setResultError(
        err instanceof Error ? err.message : "가져오기 중 오류가 발생했습니다.",
      );
    } finally {
      setImporting(false);
    }
  }

  async function addAlias(row: ParsedImportRow) {
    const companyId = aliasTarget[row.rowNumber];
    if (!companyId || !row.company_raw) return;
    const res = await fetch(`/api/admin/companies/${companyId}/aliases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias: row.company_raw }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setResultError(body.error || "별칭 추가 실패");
      return;
    }
    const nextCompany = body.company as Company;
    const nextList = companyList.map((c) =>
      c.id === nextCompany.id ? nextCompany : c,
    );
    setCompanyList(nextList);
    setRows((prev) => prev.map((r) => applyCompanyMatch(r, nextList)));
  }

  return (
    <div className="space-y-4">
      <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] shadow-sm">
        {compact ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            aria-expanded={open}
          >
            <h2
              className="text-lg text-[var(--ink)]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Excel / CSV 업로드
            </h2>
            <span className="text-xs font-medium text-[var(--muted)]">
              {open ? "접기 ▲" : "펼치기 ▼"}
            </span>
          </button>
        ) : (
          <div className="px-5 pt-5">
            <h2
              className="text-lg"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Excel / CSV 업로드
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              업로드 → 내용 확인 → 확인 체크. 회원사(`company`) 필수.
            </p>
          </div>
        )}

        {open ? (
          <div
            className={`px-5 pb-5 ${compact ? "border-t border-[var(--line)] pt-4" : "pt-4"}`}
          >
            {compact ? (
              <p className="mb-4 text-sm text-[var(--muted)]">
                업로드 → 내용 확인 → 확인 체크. 회원사(`company`) 필수. 콘텐츠
                링크는 넣지 마세요.
              </p>
            ) : null}

        {!hasCompanies ? (
          <p className="mb-3 text-xs text-[var(--danger)]">
            등록된 회원사가 없습니다. 회원사를 먼저 추가해 주세요.
          </p>
        ) : null}

        <p className="mb-2 text-xs text-[var(--muted)]">
          컬럼: {IMPORT_TEMPLATE_HEADER_LABEL}
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={`${secondaryBtnClass} w-full`}
            onClick={downloadCsvTemplate}
          >
            CSV 템플릿 다운로드
          </button>
          <button
            type="button"
            className={`${secondaryBtnClass} w-full`}
            onClick={() => void downloadExcelTemplate()}
          >
            Excel 템플릿 다운로드
          </button>
        </div>

        <label
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDragging(false);
          }}
          onDrop={onDrop}
          className={`mt-4 flex ${compact ? "min-h-32" : "min-h-40"} cursor-pointer flex-col items-center justify-center border border-dashed px-4 py-8 text-center transition ${
            dragging
              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
              : "border-[var(--line)] bg-white/50 hover:border-[var(--accent)]"
          } ${!hasCompanies ? "pointer-events-none opacity-40" : ""}`}
        >
          <input
            type="file"
            accept={IMPORT_ACCEPT}
            className="hidden"
            disabled={!hasCompanies}
            onChange={(e) => {
              void onFileChange(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <p className="text-sm font-medium text-[var(--ink)]">
            {reading
              ? "파일 읽는 중…"
              : dragging
                ? "여기에 놓으세요"
                : "드래그 또는 클릭해서 선택"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            .csv · .xlsx · .xls · company(회원사) 컬럼 필수
          </p>
        </label>

        {fileName && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[var(--muted)]">
              {fileName} · 유효 {stats.ok}/{stats.total}
            </p>
            <button
              type="button"
              className="text-sm text-[var(--accent)] underline"
              onClick={() => setReviewOpen(true)}
            >
              미리보기 다시 열기
            </button>
          </div>
        )}
        {parseError && (
          <p className="mt-3 text-sm text-[var(--danger)]">{parseError}</p>
        )}
        {resultMessage && (
          <p className="mt-3 border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent)]">
            {resultMessage}
          </p>
        )}
        {resultError && (
          <p className="mt-3 text-sm text-[var(--danger)]">{resultError}</p>
        )}
          </div>
        ) : null}
      </section>

      {reviewOpen && rows.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="업로드 내용 확인"
          onClick={() => setReviewOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-5xl flex-col border border-[var(--line)] bg-[var(--surface)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] p-5">
              <div>
                <p className="text-xs tracking-[0.2em] text-[var(--accent)] uppercase">
                  Review
                </p>
                <h3
                  className="mt-1 text-2xl text-[var(--ink)]"
                  style={{ fontFamily: "var(--font-display), serif" }}
                >
                  업로드 내용 확인
                </h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {fileName} · 전체 {stats.total} · 유효{" "}
                  <span className="text-[var(--accent)]">{stats.ok}</span> · 오류{" "}
                  <span className="text-[var(--danger)]">{stats.bad}</span>
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
                onClick={() => setReviewOpen(false)}
              >
                닫기
              </button>
            </div>

            <div className="overflow-auto p-5">
              <div className="overflow-x-auto border border-[var(--line)]">
                <table className="min-w-[880px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--accent-soft)]/40 text-xs text-[var(--muted)]">
                      <th className="px-3 py-2 font-medium">행</th>
                      <th className="px-3 py-2 font-medium">상태</th>
                      <th className="px-3 py-2 font-medium">회원사</th>
                      <th className="px-3 py-2 font-medium">이름</th>
                      <th className="px-3 py-2 font-medium">snsid</th>
                      <th className="px-3 py-2 font-medium">방문일</th>
                      <th className="px-3 py-2 font-medium">매장</th>
                      <th className="px-3 py-2 font-medium">상품</th>
                      <th className="px-3 py-2 font-medium text-right">수량</th>
                      <th className="px-3 py-2 font-medium">오류</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={`border-b border-[var(--line)] last:border-b-0 ${
                          row.ok ? "" : "bg-red-50/60"
                        }`}
                      >
                        <td className="px-3 py-2 tabular-nums text-[var(--muted)]">
                          {row.rowNumber}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-xs font-medium ${
                              row.ok
                                ? "text-[var(--accent)]"
                                : "text-[var(--danger)]"
                            }`}
                          >
                            {row.ok ? "OK" : "오류"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div>{row.company_name || row.company_raw || "—"}</div>
                          {row.unmatchedCompany ? (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              <select
                                className="h-7 rounded border border-[var(--line)] px-1 text-xs"
                                value={aliasTarget[row.rowNumber] || ""}
                                onChange={(e) =>
                                  setAliasTarget((prev) => ({
                                    ...prev,
                                    [row.rowNumber]: e.target.value,
                                  }))
                                }
                              >
                                <option value="">회원사 선택</option>
                                {companyList.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="text-xs font-semibold text-[var(--accent)]"
                                onClick={() => void addAlias(row)}
                              >
                                별칭 추가
                              </button>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">{row.name || "—"}</td>
                        <td className="px-3 py-2 text-[var(--accent)]">
                          {row.snsid ? `@${row.snsid}` : "—"}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {row.visit_date || "—"}
                        </td>
                        <td className="px-3 py-2">{row.store || "—"}</td>
                        <td className="px-3 py-2">{row.product || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.quantity}
                        </td>
                        <td className="px-3 py-2 text-xs text-[var(--danger)]">
                          {row.errors.join(", ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4 border-t border-[var(--line)] p-5">
              <label className="flex items-start gap-3 text-sm text-[var(--ink)]">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  위 미리보기 내용이 맞는지 확인했습니다. 유효 {stats.ok}건을 DB에
                  반영합니다. (오류 행은 제외)
                </span>
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={primaryBtnClass}
                  disabled={importing || !confirmed || stats.ok === 0}
                  onClick={commitImport}
                >
                  {importing ? "반영 중…" : `확인 후 DB 반영 (${stats.ok}건)`}
                </button>
                <button
                  type="button"
                  className={secondaryBtnClass}
                  disabled={importing}
                  onClick={() => setReviewOpen(false)}
                >
                  나중에
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
