"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IMPORT_ACCEPT,
  IMPORT_CSV_TEMPLATE,
  parseImportFile,
  type ParsedImportRow,
} from "@/lib/csv-import";
import { primaryBtnClass, secondaryBtnClass } from "@/components/ui";

export function AdminImportPanel() {
  const router = useRouter();
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const ok = rows.filter((r) => r.ok).length;
    return { total: rows.length, ok, bad: rows.length - ok };
  }, [rows]);

  function downloadTemplate() {
    const blob = new Blob([IMPORT_CSV_TEMPLATE], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "boardingpass-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFileChange(file: File | null) {
    setResultMessage(null);
    setResultError(null);
    setParseError(null);
    setRows([]);
    setFileName(null);
    if (!file) return;

    setReading(true);
    try {
      const parsed = await parseImportFile(file);
      if (parsed.length === 0) {
        setParseError(
          "데이터 행이 없습니다. 첫 시트에 헤더와 예시 행이 있는지 확인해 주세요.",
        );
        return;
      }
      setRows(parsed);
      setFileName(file.name);
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
    if (valid.length === 0) return;

    setImporting(true);
    setResultMessage(null);
    setResultError(null);

    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: valid.map((r) => ({
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
      router.refresh();
    } catch (err: unknown) {
      setResultError(
        err instanceof Error ? err.message : "가져오기 중 오류가 발생했습니다.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2
          className="text-lg"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          CSV / Excel 가져오기
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          템플릿 컬럼:{" "}
          <code className="text-[var(--ink)]">
            snsid, snsurl, name, visit_date, store, product, quantity
          </code>
          . CSV 또는 Excel(.xlsx) 파일을 드래그하거나 선택하세요. 미리보기 후
          DB에 반영합니다.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className={secondaryBtnClass}
            onClick={downloadTemplate}
          >
            CSV 템플릿 다운로드
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
          className={`mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center border border-dashed px-6 py-10 text-center transition ${
            dragging
              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
              : "border-[var(--line)] bg-white/50 hover:border-[var(--accent)]"
          }`}
        >
          <input
            type="file"
            accept={IMPORT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              void onFileChange(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <p className="text-base font-medium text-[var(--ink)]">
            {reading
              ? "파일 읽는 중…"
              : dragging
                ? "여기에 놓으세요"
                : "파일을 드래그하거나 클릭해서 선택"}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            .csv · .xlsx · .xls (Excel은 첫 번째 시트 사용)
          </p>
        </label>

        {fileName && (
          <p className="mt-3 text-sm text-[var(--muted)]">파일: {fileName}</p>
        )}
        {parseError && (
          <p className="mt-3 text-sm text-[var(--danger)]">{parseError}</p>
        )}
      </section>

      {rows.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              미리보기 · 전체 {stats.total} · 유효{" "}
              <span className="text-[var(--accent)]">{stats.ok}</span> · 오류{" "}
              <span className="text-[var(--danger)]">{stats.bad}</span>
            </p>
            <button
              type="button"
              className={primaryBtnClass}
              disabled={importing || stats.ok === 0}
              onClick={commitImport}
            >
              {importing ? "반영 중…" : `유효 ${stats.ok}건 DB에 반영`}
            </button>
          </div>

          {resultMessage && (
            <p className="border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent)]">
              {resultMessage}
            </p>
          )}
          {resultError && (
            <p className="text-sm text-[var(--danger)]">{resultError}</p>
          )}

          <div className="overflow-x-auto border border-[var(--line)] bg-[var(--surface)]">
            <table className="min-w-[960px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--accent-soft)]/40 text-xs text-[var(--muted)]">
                  <th className="px-3 py-2 font-medium">행</th>
                  <th className="px-3 py-2 font-medium">상태</th>
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
        </section>
      )}
    </div>
  );
}
