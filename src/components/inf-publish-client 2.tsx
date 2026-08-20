"use client";

import { useMemo, useState } from "react";
import { InfLocaleEnsure, useInfLocale } from "@/components/inf-locale-provider";
import {
  CREATOR_PLATFORM_LABEL,
  validateCreatorUrl,
  type CreatorPlatform,
} from "@/lib/creator-link";
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

/** 승인됐고 발행 URL 미등록 */
function needsPublish(item: AllocationWithRelations) {
  const link = activeLink(item);
  return (
    Boolean(link) &&
    link!.content_status === "승인" &&
    link!.status === "approved" &&
    !link!.publish_url
  );
}

function isPublished(item: AllocationWithRelations) {
  const link = activeLink(item);
  return link?.content_status === "발행완료";
}

export function InfPublishClient({
  initialAllocations,
}: {
  initialAllocations: AllocationWithRelations[];
}) {
  return (
    <InfLocaleEnsure>
      <InfPublishClientInner initialAllocations={initialAllocations} />
    </InfLocaleEnsure>
  );
}

function InfPublishClientInner({
  initialAllocations,
}: {
  initialAllocations: AllocationWithRelations[];
}) {
  const { t, locale } = useInfLocale();
  const [items, setItems] = useState(initialAllocations);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(
    initialAllocations.find(needsPublish)?.id ?? null,
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = useMemo(() => items.filter(needsPublish), [items]);
  const done = useMemo(() => items.filter(isPublished), [items]);
  const selected = items.find((i) => i.id === selectedId) ?? null;
  const selectedLink = selected ? activeLink(selected) : null;

  async function publish(allocationId: string, linkId: string) {
    const url = (drafts[allocationId] || "").trim();
    const urlError = validateCreatorUrl(url);
    if (urlError) {
      setError(urlError);
      return;
    }
    setSavingId(allocationId);
    setError(null);
    try {
      const res = await fetch(`/api/inf/links/${linkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish_url: url }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t.pickupFailed);
      const updated = body.link as CreatorLink;
      setItems((prev) =>
        prev.map((row) =>
          row.id === allocationId
            ? {
                ...row,
                creator_links: (row.creator_links || []).map((l) =>
                  l.id === linkId ? { ...l, ...updated } : l,
                ),
              }
            : row,
        ),
      );
      setSelectedId(null);
      setDrafts((prev) => ({ ...prev, [allocationId]: "" }));
    } catch (err) {
      setError(
        translateInfApiError(err instanceof Error ? err.message : "", t),
      );
    } finally {
      setSavingId(null);
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
        <h1 className="text-xl font-bold text-[#1a1a2e]">{t.contentPublishTab}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#8a6a4a]">{t.publishUrlHint}</p>
      </header>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {selected && selectedLink ? (
        <section className="rounded-3xl border border-[#e8e8e8] bg-white p-5 shadow-sm">
          <p className="text-lg font-bold text-[#1a1a2e]">
            {selected.products?.name || t.productFallback}
          </p>
          <p className="mt-1 text-xs text-[#999]">
            {formatVisitDateLocalized(
              asYmd(selected.visit_date) || asYmd(selected.picked_up_at),
              locale,
              t.dateUndecided,
            )}
          </p>
          <input
            className="mt-6 h-14 w-full rounded-2xl border border-[#e8e8e8] px-4 text-base"
            type="url"
            placeholder={t.linkPlaceholder}
            value={drafts[selected.id] || ""}
            onChange={(e) =>
              setDrafts((prev) => ({ ...prev, [selected.id]: e.target.value }))
            }
          />
          <button
            type="button"
            disabled={savingId === selected.id || !(drafts[selected.id] || "").trim()}
            onClick={() => void publish(selected.id, selectedLink.id)}
            className="mt-4 w-full rounded-2xl bg-[#6B3B1F] py-4 text-base font-semibold text-white disabled:opacity-50"
          >
            {savingId === selected.id ? t.publishUrlSaving : t.publishUrlSubmit}
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
          <h2 className="text-sm font-bold text-[#3D1F0A]">{t.publishNeedSection}</h2>
          {pending.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className="flex w-full items-center justify-between rounded-2xl border border-[#f0e6d8] bg-[#faf7f2] px-4 py-4 text-left"
            >
              <span className="text-sm font-bold text-[#1a1a2e]">
                {item.products?.name || t.productFallback}
              </span>
              <span className="text-xs font-semibold text-[#6B3B1F]">
                {t.publishUrlSubmit}
              </span>
            </button>
          ))}
        </section>
      ) : (
        <p className="rounded-2xl bg-[#f3eee3] px-4 py-3 text-center text-sm font-semibold text-[#8a7a5c]">
          {t.publishAllDone}
        </p>
      )}

      {done.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-[#999]">{t.publishDoneSection}</h2>
          {done.map((item) => {
            const link = activeLink(item);
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-[#eee] bg-[#fafafa] px-4 py-3"
              >
                <p className="text-sm font-semibold text-[#1a1a2e]">
                  {item.products?.name || t.productFallback}
                </p>
                {link?.publish_url ? (
                  <a
                    href={link.publish_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block break-all text-xs text-[#6B3B1F] underline"
                  >
                    {link.publish_url}
                  </a>
                ) : null}
                {link?.platform && link.platform !== "etc" ? (
                  <p className="mt-1 text-xs text-[#999]">
                    {CREATOR_PLATFORM_LABEL[link.platform as CreatorPlatform]}
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
