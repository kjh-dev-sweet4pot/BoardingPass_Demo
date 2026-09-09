"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  effectiveProfileStatus,
  type ImportBatchInfluencerRow,
  type ImportBatchRow,
  type ImportProfileFetchStatus,
} from "@/lib/import-batch-log";
import { InfluencerAvatar } from "@/components/influencer-avatar";
import { primaryBtnClass, secondaryBtnClass } from "@/components/ui";
import { type Company } from "@/lib/types";

type BatchListItem = ImportBatchRow & {
  uploaded_at_label: string;
  influencer_count: number;
};

const PROFILE_STATUS_LABEL: Record<ImportProfileFetchStatus, string> = {
  pending: "진행중…",
  ok: "완료",
  failed: "실패",
  skipped: "기존 프로필",
};

function ImportTips() {
  return (
    <div
      className="rounded-[6px] border-2 border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--ink)]"
      role="note"
    >
      <p className="text-[11px] font-bold tracking-[0.16em] text-[var(--accent)] uppercase">
        꼭 확인
      </p>
      <ul className="mt-2 list-disc space-y-2 pl-5 font-semibold leading-snug">
        <li>
          여러 회원사는{" "}
          <mark className="bg-transparent font-extrabold text-[var(--accent)] underline decoration-2 underline-offset-2">
            콤마로 나란히
          </mark>{" "}
          쓰면 행이 나뉩니다.
        </li>
        <li>
          회원사가 일치하지 않으면 업로드 과정에서 회사를 고르면{" "}
          <mark className="bg-transparent font-extrabold text-[var(--accent)] underline decoration-2 underline-offset-2">
            별칭으로 추가
          </mark>
          됩니다.
        </li>
        <li>
          나중에 올린 콘텐츠는 같은 파일의{" "}
          <mark className="bg-transparent font-extrabold text-[var(--accent)] underline decoration-2 underline-offset-2">
            content_url
          </mark>{" "}
          칸에 넣으면 기존 배정에 붙습니다. 여러 주소는 콤마나 줄바꿈으로 구분합니다.
        </li>
      </ul>
    </div>
  );
}

function profileStatusClass(status: ImportProfileFetchStatus) {
  if (status === "ok") return "text-[var(--accent)]";
  if (status === "failed") return "text-[var(--danger)]";
  if (status === "pending") return "text-[var(--muted)]";
  return "text-[var(--muted)]";
}

export function AdminImportPanel({
  compact = false,
  companies = [],
  onSuccess,
}: {
  compact?: boolean;
  companies?: Company[];
  onSuccess?: () => void;
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
  const [aliasSource, setAliasSource] = useState<Record<number, string>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyHint, setHistoryHint] = useState<string | null>(null);
  const [refetchingId, setRefetchingId] = useState<string | null>(null);
  const [avatarKeys, setAvatarKeys] = useState<Record<string, number>>({});
  const [avatarBroken, setAvatarBroken] = useState<Record<string, boolean>>({});
  const hasCompanies = companyList.some((c) => c.is_active);

  const loadBatches = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/import/batches?limit=30");
      const body = await res.json();
      if (!res.ok) {
        const msg = [body.error, body.hint].filter(Boolean).join(" — ");
        throw new Error(msg || "업로드 이력 조회 실패");
      }
      setBatches((body.batches || []) as BatchListItem[]);
      setHistoryHint(body.tableMissing ? body.hint || null : null);
    } catch (err: unknown) {
      setHistoryHint(
        err instanceof Error ? err.message : "업로드 이력을 불러오지 못했습니다.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (historyOpen) void loadBatches();
  }, [historyOpen, loadBatches]);

  useEffect(() => {
    if (!historyOpen) return;
    const hasPending =
      importing ||
      batches.some((batch) =>
        (batch.import_batch_influencers || []).some(
          (item) => effectiveProfileStatus(item) === "pending",
        ),
      );
    if (!hasPending) return;
    const timer = window.setInterval(() => void loadBatches(), 5000);
    return () => window.clearInterval(timer);
  }, [historyOpen, batches, loadBatches, importing]);

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
    setAliasTarget({});
    setAliasSource({});
  }

  function assignCompany(index: number, companyId: string) {
    const company = companyList.find((c) => c.id === companyId);
    const current = rows[index];
    setAliasTarget((prev) => ({ ...prev, [index]: companyId }));
    if (current?.company_raw) {
      setAliasSource((prev) => ({
        ...prev,
        [index]: prev[index] || current.company_raw,
      }));
    }
    if (!company) return;
    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? applyCompanyMatch({ ...r, company_raw: company.name }, companyList)
          : r,
      ),
    );
    setConfirmed(false);
    const alias = aliasSource[index] || current.company_raw;
    if (alias && alias !== company.name) {
      void addAliasFor(companyId, alias);
    }
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
    if (valid.length === 0 || !confirmed || importing) return;

    const payload = {
      rows: valid.map((r) => ({
        company: r.company_raw,
        snsid: r.snsid,
        snsurl: r.snsurl || "",
        name: r.name,
        visit_date: r.visit_date,
        store: r.store,
        product: r.product,
        quantity: r.quantity,
        display_price: r.display_price ?? "",
        cost_amount: r.cost_amount ?? "",
        content_url: (r.content_urls || []).join("\n"),
      })),
    };

    setReviewOpen(false);
    resetFileState();
    setHistoryOpen(true);
    setImporting(true);
    setResultMessage(`DB 반영 진행중… (${valid.length}건)`);
    setResultError(null);

    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "가져오기 실패");
      }

      const s = body.summary as {
        created: number;
        skipped: number;
        failed: number;
        linked?: number;
        total: number;
      };
      setResultMessage(
        `완료: ${s.total}행 중 생성 ${s.created} · 콘텐츠 ${s.linked ?? 0} · 중복 건너뜀 ${s.skipped} · 실패 ${s.failed}`,
      );
      void loadBatches();
      router.refresh();
      onSuccess?.();
    } catch (err: unknown) {
      setResultError(
        err instanceof Error ? err.message : "가져오기 중 오류가 발생했습니다.",
      );
      setResultMessage(null);
    } finally {
      setImporting(false);
    }
  }

  async function addAliasFor(companyId: string, alias: string) {
    if (!companyId || !alias) return;
    const res = await fetch(`/api/admin/companies/${companyId}/aliases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias }),
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

  async function addAlias(index: number) {
    const row = rows[index];
    const companyId = aliasTarget[index];
    const alias = aliasSource[index] || row?.company_raw;
    if (!row || !companyId || !alias) return;
    await addAliasFor(companyId, alias);
  }

  async function refreshProfile(item: ImportBatchInfluencerRow, refetchFromApify: boolean) {
    setRefetchingId(item.id);
    setAvatarBroken((prev) => {
      const next = { ...prev };
      delete next[item.influencer_id];
      return next;
    });

    try {
      if (refetchFromApify) {
        const res = await fetch(`/api/admin/influencers/${item.influencer_id}/avatar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchInfluencerId: item.id }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "프로필 수집 실패");
      }

      setAvatarKeys((prev) => ({
        ...prev,
        [item.influencer_id]: (prev[item.influencer_id] || 0) + 1,
      }));
      await loadBatches();
    } catch (err: unknown) {
      setResultError(
        err instanceof Error ? err.message : "프로필 조회 중 오류가 발생했습니다.",
      );
      await loadBatches();
    } finally {
      setRefetchingId(null);
    }
  }

  function renderBatchInfluencer(item: ImportBatchInfluencerRow) {
    const status = effectiveProfileStatus(item);
    const cacheBust = avatarKeys[item.influencer_id] || 0;
    const imageMissing = avatarBroken[item.influencer_id];
    const busy = refetchingId === item.id;

    return (
      <li
        key={item.id}
        className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 text-sm"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <InfluencerAvatar
            key={`${item.influencer_id}-${cacheBust}`}
            influencerId={item.influencer_id}
            name={item.name}
            size="thumb"
            cacheBust={cacheBust}
            onLoadError={() =>
              setAvatarBroken((prev) => ({ ...prev, [item.influencer_id]: true }))
            }
          />
          <div className="min-w-0">
            <p className="font-medium text-[var(--ink)]">{item.name || "—"}</p>
            <p className="text-xs text-[var(--muted)]">
              @{item.instagram_handle}
              {item.is_new ? " · 신규" : " · 기존"}
            </p>
            {status === "ok" && imageMissing ? (
              <p className="text-xs text-[var(--danger)]">
                수집 완료로 표시됐지만 이미지가 보이지 않습니다.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-medium ${profileStatusClass(status)}`}>
            프로필 {PROFILE_STATUS_LABEL[status]}
          </span>
          {item.profile_fetch_error && status === "failed" ? (
            <span
              className="max-w-[220px] truncate text-xs text-[var(--danger)]"
              title={item.profile_fetch_error}
            >
              {item.profile_fetch_error}
            </span>
          ) : null}
          {status !== "skipped" ? (
            <button
              type="button"
              className={`${secondaryBtnClass} !px-2.5 !py-1 text-xs`}
              disabled={busy}
              onClick={() => void refreshProfile(item, false)}
            >
              {busy ? "조회 중…" : "다시 조회"}
            </button>
          ) : null}
          <button
            type="button"
            className={`${secondaryBtnClass} !px-2.5 !py-1 text-xs`}
            disabled={busy}
            onClick={() => void refreshProfile(item, true)}
          >
            {busy ? "수집 중…" : "Apify 재수집"}
          </button>
        </div>
      </li>
    );
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
            >
              Excel / CSV 업로드
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              업로드 → 내용 확인 → 확인 체크. 회원사(`company`) 필수.
            </p>
            <div className="mt-3">
              <ImportTips />
            </div>
          </div>
        )}

        {open ? (
          <div
            className={`px-5 pb-5 ${compact ? "border-t border-[var(--line)] pt-4" : "pt-4"}`}
          >
            {compact ? (
              <div className="mb-4 space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  업로드 → 내용 확인 → 확인 체크.
                </p>
                <ImportTips />
              </div>
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
              : "border-[var(--line)] bg-[var(--surface)]/50 hover:border-[var(--accent)]"
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

      <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] shadow-sm">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
          aria-expanded={historyOpen}
        >
          <div>
            <h2
              className="text-lg text-[var(--ink)]"
            >
              업로드 이력
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              업로드 시각 · 인플루언서 수 · 프로필 수집 상태
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-[var(--muted)]">
            {historyOpen ? "접기 ▲" : "펼치기 ▼"}
          </span>
        </button>

        {historyOpen ? (
          <div className="border-t border-[var(--line)] px-5 pb-5 pt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[var(--muted)]">
                최근 {batches.length}건
              </p>
              <button
                type="button"
                className={`${secondaryBtnClass} !px-3 !py-1.5 text-xs`}
                disabled={historyLoading}
                onClick={() => void loadBatches()}
              >
                {historyLoading ? "조회 중…" : "다시 조회"}
              </button>
            </div>

            {historyHint ? (
              <p className="mb-3 text-sm text-[var(--danger)]">{historyHint}</p>
            ) : null}

            {batches.length === 0 && !historyLoading ? (
              <p className="py-6 text-center text-sm text-[var(--muted)]">
                업로드 이력이 없습니다.
              </p>
            ) : null}

            <ul className="space-y-2">
              {batches.map((batch) => {
                const expanded = expandedBatchId === batch.id;
                const profileFailed = (batch.import_batch_influencers || []).filter(
                  (item) => effectiveProfileStatus(item) === "failed",
                ).length;
                const profilePending = (batch.import_batch_influencers || []).filter(
                  (item) => effectiveProfileStatus(item) === "pending",
                ).length;

                return (
                  <li
                    key={batch.id}
                    className="border border-[var(--line)] bg-[var(--surface)]/40"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm"
                      onClick={() =>
                        setExpandedBatchId((prev) =>
                          prev === batch.id ? null : batch.id,
                        )
                      }
                    >
                      <div>
                        <p className="font-medium text-[var(--ink)]">
                          {batch.uploaded_at_label}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          인플루언서 {batch.influencer_count}명 · 배정 생성{" "}
                          {batch.created_count} · 중복 {batch.skipped_count} · 실패{" "}
                          {batch.failed_count}
                          {profileFailed > 0
                            ? ` · 프로필 실패 ${profileFailed}`
                            : ""}
                          {profilePending > 0
                            ? ` · 프로필 진행중 ${profilePending}`
                            : ""}
                        </p>
                      </div>
                      <span className="text-xs text-[var(--muted)]">
                        {expanded ? "▲" : "▼"}
                      </span>
                    </button>

                    {expanded ? (
                      <ul className="border-t border-[var(--line)] bg-[var(--surface)]">
                        {(batch.import_batch_influencers || []).length === 0 ? (
                          <li className="px-4 py-4 text-xs text-[var(--muted)]">
                            이 배치에 기록된 인플루언서가 없습니다.
                          </li>
                        ) : (
                          batch.import_batch_influencers.map(renderBatchInfluencer)
                        )}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
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
                >
                  업로드 내용 확인
                </h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {fileName} · 전체 {stats.total} · 유효{" "}
                  <span className="text-[var(--accent)]">{stats.ok}</span> · 오류{" "}
                  <span className="text-[var(--danger)]">{stats.bad}</span>
                </p>
                <div className="mt-3">
                  <ImportTips />
                </div>
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
                <table className="min-w-[1040px] w-full border-collapse text-left text-sm">
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
                      <th className="px-3 py-2 font-medium text-right">노출가</th>
                      <th className="px-3 py-2 font-medium text-right">원가</th>
                      <th className="px-3 py-2 font-medium">콘텐츠</th>
                      <th className="px-3 py-2 font-medium">오류</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr
                        key={`${row.rowNumber}-${row.snsid}-${row.company_raw}-${idx}`}
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
                          {row.unmatchedCompany || aliasSource[idx] ? (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              <select
                                className="h-7 rounded border border-[var(--line)] px-1 text-xs"
                                value={aliasTarget[idx] || ""}
                                onChange={(e) => assignCompany(idx, e.target.value)}
                              >
                                <option value="">회원사 선택</option>
                                {companyList.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              {aliasTarget[idx] ? (
                              <button
                                type="button"
                                className="text-xs font-semibold text-[var(--accent)]"
                                onClick={() => void addAlias(idx)}
                              >
                                별칭 추가
                                {aliasSource[idx]
                                  ? ` (${aliasSource[idx]})`
                                  : ""}
                              </button>
                              ) : null}
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
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.display_price != null
                            ? row.display_price.toLocaleString("ko-KR")
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.cost_amount != null
                            ? row.cost_amount.toLocaleString("ko-KR")
                            : "—"}
                        </td>
                        <td className="max-w-[220px] px-3 py-2 text-xs text-[var(--accent)]">
                          {(row.content_urls || []).length
                            ? (row.content_urls || [])
                                .map((u) =>
                                  u.length > 42 ? `${u.slice(0, 40)}…` : u,
                                )
                                .join(" · ")
                            : "—"}
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
