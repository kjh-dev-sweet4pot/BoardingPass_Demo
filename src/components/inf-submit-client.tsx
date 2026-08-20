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

function activeLink(item: AllocationWithRelations) {
  return (item.creator_links || []).find((l) => l.status !== "rejected");
}

function needsUpload(item: AllocationWithRelations) {
  const link = activeLink(item);
  return !link || link.content_status === "반려";
}

function contentStatusLabel(
  link: CreatorLink | undefined,
  t: { contentReviewing: string; contentApproved: string; contentPublished: string },
) {
  if (!link?.content_status) return "";
  if (link.content_status === "제출") return t.contentReviewing;
  if (link.content_status === "승인") return t.contentApproved;
  if (link.content_status === "발행완료") return t.contentPublished;
  return link.content_status;
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
  const fileRef = useRef<HTMLInputElement>(null);

  const pending = useMemo(() => items.filter(needsUpload), [items]);
  const submitted = useMemo(() => items.filter((i) => !needsUpload(i)), [items]);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  async function upload(allocationId: string, file: File) {
    setUploadingId(allocationId);
    setError(null);
    try {
      const form = new FormData();
      form.set("allocation_id", allocationId);
      form.set("file", file);
      const res = await fetch("/api/inf/content", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || t.pickupFailed);
      }
      const link = body.link as CreatorLink;
      setItems((prev) =>
        prev.map((row) =>
          row.id === allocationId
            ? { ...row, creator_links: [link] }
            : row,
        ),
      );
      setSelectedId(null);
    } catch (err) {
      setError(
        translateInfApiError(err instanceof Error ? err.message : "", t),
      );
    } finally {
      setUploadingId(null);
      if (fileRef.current) fileRef.current.value = "";
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
          <label className="mt-6 flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#d8c0ab] bg-[#faf7f2] px-4 py-8">
            <span className="text-sm font-semibold text-[#6B3B1F]">
              {t.submitFilePick}
            </span>
            <span className="mt-1 text-xs text-[#999]">{t.submitFileTypes}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*,application/pdf"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(selected.id, file);
              }}
            />
          </label>
          <button
            type="button"
            disabled={uploadingId === selected.id}
            onClick={() => fileRef.current?.click()}
            className="mt-4 w-full rounded-2xl bg-[#6B3B1F] py-4 text-base font-semibold text-white disabled:opacity-50"
          >
            {uploadingId === selected.id ? t.submitFileUploading : t.submitFileBtn}
          </button>
          <button
            type="button"
            className="mt-3 w-full rounded-2xl py-3 text-sm font-semibold text-[#999]"
            onClick={() => setSelectedId(null)}
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
              onClick={() => setSelectedId(item.id)}
              className="flex w-full items-center justify-between rounded-2xl border border-[#f0e6d8] bg-[#faf7f2] px-4 py-4 text-left"
            >
              <span>
                <span className="block text-sm font-bold text-[#1a1a2e]">
                  {item.products?.name || t.productFallback}
                </span>
                <span className="mt-0.5 block text-xs text-[#999]">
                  {item.stores?.name || t.storeFallback}
                </span>
              </span>
              <span className="text-xs font-semibold text-[#6B3B1F]">{t.submitFileBtn}</span>
            </button>
          ))}
        </section>
      ) : (
        <p className="rounded-2xl bg-[#f3eee3] px-4 py-3 text-center text-sm font-semibold text-[#8a7a5c]">
          {t.submitAllDone}
        </p>
      )}

      {submitted.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-[#999]">{t.submitDoneSection}</h2>
          {submitted.map((item) => {
            const link = activeLink(item);
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-[#eee] bg-[#fafafa] px-4 py-3"
              >
                <p className="text-sm font-semibold text-[#1a1a2e]">
                  {item.products?.name || t.productFallback}
                </p>
                <p className="mt-1 text-xs text-[#C4956A]">
                  {contentStatusLabel(link, t)}
                </p>
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
