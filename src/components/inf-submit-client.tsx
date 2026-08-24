"use client";

import { useMemo, useRef, useState } from "react";
import { InfLocaleEnsure, useInfLocale } from "@/components/inf-locale-provider";
import {
  formatVisitDateLocalized,
  translateInfApiError,
} from "@/lib/inf-i18n";
import { type AllocationWithRelations, type CreatorLink } from "@/lib/types";

function asYmd(value: string | null | undefined) {
  if (!value) return null;
  return String(value).slice(0, 10) || null;
}

function isRejected(link: CreatorLink) {
  return link.content_status === "반려" || link.status === "rejected";
}

function activeLink(links?: CreatorLink[] | null) {
  return (links || []).find((l) => !isRejected(l));
}

function needsUpload(item: AllocationWithRelations) {
  return !activeLink(item.creator_links);
}

function contentStatusLabel(
  link: CreatorLink | undefined,
  t: {
    contentReviewing: string;
    contentApproved: string;
    contentPublished: string;
    contentRejected: string;
  },
) {
  if (!link?.content_status && !link?.status) return "";
  if (link.content_status === "발행완료") return t.contentPublished;
  if (link.content_status === "승인" || link.status === "approved") return t.contentApproved;
  if (isRejected(link)) return t.contentRejected;
  if (link.content_status === "제출" || link.status === "submitted") return t.contentReviewing;
  return link.content_status || link.status;
}

function contentStatusClass(link: CreatorLink) {
  if (link.content_status === "발행완료" || link.content_status === "승인" || link.status === "approved") {
    return "text-[#2d6a4f]";
  }
  if (isRejected(link)) return "text-red-600";
  return "text-[#C4956A]";
}

function contentSummary(link: CreatorLink, fileLabel: string) {
  const raw = link.url?.trim() || "";
  if (/^https?:\/\//i.test(raw) && !raw.startsWith("content://")) {
    return raw.length > 52 ? `${raw.slice(0, 49)}…` : raw;
  }
  if (link.submitted_file_path || raw.startsWith("content://")) return fileLabel;
  return raw || fileLabel;
}

function contentHref(link: CreatorLink) {
  const raw = link.url?.trim() || "";
  if (/^https?:\/\//i.test(raw) && !raw.startsWith("content://")) return raw;
  return null;
}

export function InfSubmitClient({
  initialAllocations,
}: {
  initialAllocations: AllocationWithRelations[];
}) {
  return (
    <InfLocaleEnsure>
      <InfSubmitClientInner initialAllocations={initialAllocations} />
    </InfLocaleEnsure>
  );
}

function InfSubmitClientInner({
  initialAllocations,
}: {
  initialAllocations: AllocationWithRelations[];
}) {
  const { t, locale } = useInfLocale();
  const [items, setItems] = useState(initialAllocations);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialAllocations.find(needsUpload)?.id ?? null,
  );
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snsUrl, setSnsUrl] = useState("");
  const [pickedName, setPickedName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pending = useMemo(() => items.filter(needsUpload), [items]);
  const history = useMemo(
    () =>
      items
        .flatMap((allocation) =>
          (allocation.creator_links || []).map((link) => ({ link, allocation })),
        )
        .sort((a, b) =>
          String(b.link.submitted_at || "").localeCompare(String(a.link.submitted_at || "")),
        ),
    [items],
  );
  const selected = items.find((i) => i.id === selectedId) ?? null;
  const rejected = selected
    ? (selected.creator_links || []).find(isRejected)
    : null;

  function selectItem(id: string | null) {
    setSelectedId(id);
    setSnsUrl("");
    setPickedName(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(allocationId: string) {
    const file = fileRef.current?.files?.[0] ?? null;
    const url = snsUrl.trim();
    if (!file && !url) {
      setError(t.submitNeedFileOrUrl);
      return;
    }
    setUploadingId(allocationId);
    setError(null);
    try {
      const form = new FormData();
      form.set("allocation_id", allocationId);
      if (url) form.set("url", url);
      if (file) form.set("file", file);
      const res = await fetch("/api/inf/content", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || t.pickupFailed);
      }
      const link = body.link as CreatorLink;
      setItems((prev) =>
        prev.map((row) =>
          row.id === allocationId
            ? { ...row, creator_links: [...(row.creator_links || []), link] }
            : row,
        ),
      );
      selectItem(null);
    } catch (err) {
      setError(
        translateInfApiError(err instanceof Error ? err.message : "", t),
      );
    } finally {
      setUploadingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="mt-10 text-center text-sm text-[#999]">{t.noPickedUpProducts}</p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 pb-6">
      <header className="pt-2">
        <h1 className="text-xl font-bold text-[#1a1a2e]">{t.contentSubmitTab}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#8a6a4a]">{t.submitFileHint}</p>
      </header>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {selected ? (
        <section className="rounded-3xl border border-[#e8e8e8] bg-white p-5 shadow-sm">
          <p className="text-lg font-bold text-[#1a1a2e]">
            {selected.products?.name || t.productFallback}
          </p>
          <p className="mt-1 text-xs text-[#999]">
            {formatVisitDateLocalized(
              asYmd(selected.visit_date) || asYmd(selected.picked_up_at),
              locale,
              t.dateUndecided,
            )}{" "}
            · {selected.stores?.name || t.storeFallback}
          </p>
          {rejected ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-red-700">{t.contentRejected}</p>
              <p className="rounded-xl bg-[#faf7f2] px-3 py-2 text-xs font-medium text-[#6B3B1F]">
                {contentSummary(rejected, t.submitHistoryFile)}
              </p>
              {rejected.memo ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
                  <span className="font-semibold">{t.submitRejectedReason}: </span>
                  {rejected.memo}
                </p>
              ) : null}
            </div>
          ) : null}
          <label className="mt-6 flex min-h-[100px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#d8c0ab] bg-[#faf7f2] px-4 py-6">
            <span className="text-sm font-semibold text-[#6B3B1F]">
              {pickedName || t.submitFilePick}
            </span>
            <span className="mt-1 text-xs text-[#999]">{t.submitFileTypes}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*,application/pdf"
              className="sr-only"
              onChange={(e) => setPickedName(e.target.files?.[0]?.name || null)}
            />
          </label>
          <p className="mt-4 text-xs font-semibold text-[#8a6a4a]">{t.submitUrlLabel}</p>
          <input
            className="mt-2 h-14 w-full rounded-2xl border border-[#e8e8e8] px-4 text-base"
            type="url"
            inputMode="url"
            placeholder={t.submitUrlPlaceholder}
            value={snsUrl}
            onChange={(e) => setSnsUrl(e.target.value)}
          />
          <button
            type="button"
            disabled={uploadingId === selected.id}
            onClick={() => void submit(selected.id)}
            className="mt-4 w-full rounded-2xl bg-[#6B3B1F] py-4 text-base font-semibold text-white disabled:opacity-50"
          >
            {uploadingId === selected.id ? t.submitFileUploading : t.submitFileBtn}
          </button>
          <button
            type="button"
            className="mt-3 w-full rounded-2xl py-3 text-sm font-semibold text-[#999]"
            onClick={() => selectItem(null)}
          >
            {t.close}
          </button>
        </section>
      ) : pending.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-[#3D1F0A]">{t.submitNeedSection}</h2>
          {pending.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectItem(item.id)}
              className="flex w-full flex-col rounded-2xl border border-[#f0e6d8] bg-[#faf7f2] px-4 py-4 text-left"
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span>
                  <span className="block text-sm font-bold text-[#1a1a2e]">
                    {item.products?.name || t.productFallback}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#999]">
                    {item.stores?.name || t.storeFallback}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-[#6B3B1F]">
                  {t.submitFileBtn}
                </span>
              </span>
              {(item.creator_links || []).some(isRejected) ? (
                <span className="mt-2 text-xs font-semibold text-red-600">
                  {t.contentRejected}
                </span>
              ) : null}
            </button>
          ))}
        </section>
      ) : history.length === 0 ? (
        <p className="rounded-2xl bg-[#f3eee3] px-4 py-3 text-center text-sm font-semibold text-[#8a7a5c]">
          {t.submitAllDone}
        </p>
      ) : null}

      {history.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-[#3D1F0A]">{t.submitDoneSection}</h2>
          {history.map(({ link, allocation }) => {
            const href = contentHref(link);
            const summary = contentSummary(link, t.submitHistoryFile);
            const submittedYmd = asYmd(link.submitted_at);
            return (
              <div
                key={link.id}
                className="rounded-2xl border border-[#eee] bg-[#fafafa] px-4 py-3"
              >
                <p className="text-sm font-semibold text-[#1a1a2e]">
                  {allocation.products?.name || t.productFallback}
                </p>
                <p className="mt-0.5 text-xs text-[#999]">
                  {allocation.stores?.name || t.storeFallback}
                  {submittedYmd
                    ? ` · ${formatVisitDateLocalized(submittedYmd, locale, t.dateUndecided)}`
                    : null}
                </p>
                <p className="mt-2 text-xs text-[#6B3B1F]">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all underline"
                      title={href}
                    >
                      {summary}
                    </a>
                  ) : (
                    summary
                  )}
                </p>
                <p className={`mt-1 text-xs font-semibold ${contentStatusClass(link)}`}>
                  {contentStatusLabel(link, t)}
                </p>
                {isRejected(link) && link.memo ? (
                  <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-800">
                    <span className="font-semibold">{t.submitRejectedReason}: </span>
                    {link.memo}
                  </p>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
