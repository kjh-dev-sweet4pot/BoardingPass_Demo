"use client";

import { useMemo, useState } from "react";
import { InfLocaleEnsure, useInfLocale } from "@/components/inf-locale-provider";
import {
  CREATOR_PLATFORM_LABEL,
  summarizeAllocationLinks,
  type CreatorPlatform,
} from "@/lib/creator-link";
import {
  formatVisitDateLocalized,
  translateInfApiError,
  type InfLocale,
} from "@/lib/inf-i18n";
import {
  type AllocationWithRelations,
  type CreatorLink,
} from "@/lib/types";

type VisitGroup = {
  key: string;
  storeName: string;
  visitYmd: string | null;
  items: AllocationWithRelations[];
};

type DraftPreview = {
  platform: CreatorPlatform;
  profileName: string | null;
  thumbnailUrl: string | null;
  unsupported?: boolean;
};

function asYmd(value: string | null | undefined) {
  if (!value) return null;
  return String(value).slice(0, 10) || null;
}

function visitKey(item: AllocationWithRelations) {
  const date = asYmd(item.visit_date) || asYmd(item.picked_up_at) || "undated";
  return `${item.store_id || "store"}|${date}`;
}

function groupByVisit(items: AllocationWithRelations[]): VisitGroup[] {
  const map = new Map<string, VisitGroup>();
  for (const item of items) {
    const key = visitKey(item);
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    map.set(key, {
      key,
      storeName: item.stores?.name || "",
      visitYmd: asYmd(item.visit_date) || asYmd(item.picked_up_at),
      items: [item],
    });
  }
  return [...map.values()].sort((a, b) =>
    String(b.visitYmd || "").localeCompare(String(a.visitYmd || "")),
  );
}

function needsLink(item: AllocationWithRelations) {
  const sum = summarizeAllocationLinks(item.creator_links || []);
  return sum === "none" || sum === "rejected";
}

function groupNeedsAction(group: VisitGroup) {
  return group.items.some(needsLink);
}

function statusLabel(
  status: CreatorLink["status"],
  t: {
    linkReviewing: string;
    linkApproved: string;
    linkRejected: string;
  },
) {
  if (status === "submitted") return t.linkReviewing;
  if (status === "approved") return t.linkApproved;
  return t.linkRejected;
}

export function InfLinksClient({
  initialAllocations,
}: {
  initialAllocations: AllocationWithRelations[];
}) {
  return (
    <InfLocaleEnsure>
      <InfLinksClientInner initialAllocations={initialAllocations} />
    </InfLocaleEnsure>
  );
}

function InfLinksClientInner({
  initialAllocations,
}: {
  initialAllocations: AllocationWithRelations[];
}) {
  const { t, locale } = useInfLocale();
  const [items, setItems] = useState(initialAllocations);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [modalPreview, setModalPreview] = useState<DraftPreview | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [openDoneKey, setOpenDoneKey] = useState<string | null>(null);

  const groups = useMemo(() => groupByVisit(items), [items]);
  const pending = groups.filter(groupNeedsAction);
  const done = groups.filter((g) => !groupNeedsAction(g));
  const remainCount = items.filter(needsLink).length;

  async function submit(allocationId: string) {
    const url = (drafts[allocationId] || "").trim();
    setSavingId(allocationId);
    setErrorById((prev) => ({ ...prev, [allocationId]: "" }));
    try {
      const res = await fetch("/api/inf/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocation_id: allocationId, url }),
      });
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
      setDrafts((prev) => ({ ...prev, [allocationId]: "" }));
    } catch (err) {
      setErrorById((prev) => ({
        ...prev,
        [allocationId]: translateInfApiError(
          err instanceof Error ? err.message : "",
          t,
        ),
      }));
    } finally {
      setSavingId(null);
    }
  }

  async function preview(allocationId: string) {
    const url = (drafts[allocationId] || "").trim();
    setPreviewingId(allocationId);
    setErrorById((prev) => ({ ...prev, [allocationId]: "" }));
    try {
      const res = await fetch("/api/inf/links/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || t.verifyError);
      }
      setModalPreview(body.preview ?? null);
    } catch (err) {
      setErrorById((prev) => ({
        ...prev,
        [allocationId]: translateInfApiError(
          err instanceof Error ? err.message : "",
          t,
        ),
      }));
    } finally {
      setPreviewingId(null);
    }
  }

  async function remove(allocationId: string, linkId: string) {
    const res = await fetch(`/api/inf/links/${linkId}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrorById((prev) => ({
        ...prev,
        [allocationId]: body.error || t.approvedCannotDelete,
      }));
      return;
    }
    setItems((prev) =>
      prev.map((row) =>
        row.id === allocationId
          ? {
              ...row,
              creator_links: (row.creator_links || []).filter(
                (link) => link.id !== linkId,
              ),
            }
          : row,
      ),
    );
  }

  if (items.length === 0) {
    return (
      <p className="mt-10 text-center text-sm text-[#999]">
        {t.noPickedUpProducts}
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 pb-6">
      {/* 프리뷰 모달 */}
      {modalPreview ? (
        <PreviewModal preview={modalPreview} onClose={() => setModalPreview(null)} />
      ) : null}
      <header className="pt-2">
        <h1 className="text-xl font-bold text-[#1a1a2e]">{t.contentLinks}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#8a6a4a]">
          {t.linksHint}
        </p>
        <p className="mt-3 text-xs font-semibold tracking-wide text-[#C4956A]">
          {t.linksRemainCount(remainCount)}
        </p>
      </header>

      {pending.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-[#3D1F0A]">
            {t.linksNeedSection}
          </h2>
          {pending.map((group) => (
            <VisitCard
              key={group.key}
              group={group}
              drafts={drafts}
              errors={errorById}
              savingId={savingId}
              onDraft={(id, value) => {
                setDrafts((prev) => ({ ...prev, [id]: value }));
              }}
              onSubmit={(id) => void submit(id)}
              onPreview={(id) => void preview(id)}
              onRemove={(id, linkId) => void remove(id, linkId)}
              previewingId={previewingId}
            />
          ))}
        </section>
      ) : (
        <p className="rounded-2xl bg-[#f3eee3] px-4 py-3 text-center text-sm font-semibold text-[#8a7a5c]">
          {t.linksAllDone}
        </p>
      )}

      {done.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-[#999]">{t.linksDoneSection}</h2>
          {done.map((group) => {
            const open = openDoneKey === group.key;
            const title = visitTitle(
              group,
              locale,
              t.dateUndecided,
              t.storeFallback,
            );
            const productNames = group.items
              .map((item) => item.products?.name || t.productFallback)
              .join(", ");
            return (
              <article
                key={group.key}
                className="overflow-hidden rounded-3xl border border-[#eee] bg-[#fafafa]"
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
                  onClick={() =>
                    setOpenDoneKey((prev) =>
                      prev === group.key ? null : group.key,
                    )
                  }
                >
                  <span>
                    <span className="block text-sm font-semibold text-[#3D1F0A]">
                      {title}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#999]">
                      {productNames}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-[#C4956A]">
                    {t.linkRegisteredShort}
                  </span>
                </button>
                {open ? (
                  <div className="space-y-3 border-t border-[#eee] px-4 pb-4 pt-3">
                    {group.items.map((item) => (
                      <ProductLinks
                        key={item.id}
                        item={item}
                        onRemove={(linkId) => void remove(item.id, linkId)}
                      />
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}

function visitTitle(
  group: VisitGroup,
  locale: InfLocale,
  undecided: string,
  storeFallback: string,
) {
  const date = formatVisitDateLocalized(group.visitYmd, locale, undecided);
  return `${date} · ${group.storeName || storeFallback}`;
}

function VisitCard({
  group,
  drafts,
  errors,
  savingId,
  previewingId,
  onDraft,
  onSubmit,
  onPreview,
  onRemove,
}: {
  group: VisitGroup;
  drafts: Record<string, string>;
  errors: Record<string, string>;
  savingId: string | null;
  previewingId: string | null;
  onDraft: (id: string, value: string) => void;
  onSubmit: (id: string) => void;
  onPreview: (id: string) => void;
  onRemove: (id: string, linkId: string) => void;
}) {
  const { t, locale } = useInfLocale();
  const title = visitTitle(group, locale, t.dateUndecided, t.storeFallback);

  return (
    <article className="rounded-3xl border border-[#e8e8e8] bg-white p-5 shadow-sm">
      <p className="text-lg font-bold text-[#1a1a2e]">{title}</p>
      <p className="mt-4 text-[11px] font-semibold tracking-wide text-[#C4956A]">
        {t.linksProductsReceived}
      </p>
      <div className="mt-3 space-y-4">
        {group.items.map((item) => {
          const missing = needsLink(item);
          const links = item.creator_links || [];
          return (
            <div
              key={item.id}
              className="rounded-2xl border border-[#f0e6d8] bg-[#faf7f2] px-3.5 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-[#1a1a2e]">
                  {item.products?.name || t.productFallback}
                  {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                </p>
                <span
                  className={`shrink-0 text-xs font-semibold ${
                    missing ? "text-[#C4956A]" : "text-[#8a7a5c]"
                  }`}
                >
                  {missing ? t.linkNotRegistered : t.linkRegisteredShort}
                </span>
              </div>

              {links.length > 0 ? (
                <div className="mt-2">
                  <LinkList
                    links={links}
                    onRemove={(linkId) => onRemove(item.id, linkId)}
                  />
                </div>
              ) : null}

              {missing ? (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <input
                      className="h-11 min-w-0 flex-1 rounded-2xl border border-[#e8e8e8] bg-white px-3 text-sm"
                      type="url"
                      placeholder={t.linkPlaceholder}
                      value={drafts[item.id] || ""}
                      onChange={(e) => onDraft(item.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onPreview(item.id);
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={
                        previewingId === item.id || !(drafts[item.id] || "").trim()
                      }
                      onClick={() => onPreview(item.id)}
                      className="rounded-2xl border border-[#d8c0ab] bg-white px-4 text-sm font-semibold text-[#6B3B1F] disabled:opacity-50"
                    >
                      {previewingId === item.id ? t.linkPreviewLoading : t.linkPreview}
                    </button>
                    <button
                      type="button"
                      disabled={savingId === item.id || !(drafts[item.id] || "").trim()}
                      onClick={() => onSubmit(item.id)}
                      className="rounded-2xl bg-[#6B3B1F] px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {t.linkSubmit}
                    </button>
                  </div>
                </div>
              ) : null}
              {errors[item.id] ? (
                <p className="mt-2 text-xs text-red-400">{errors[item.id]}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function imgProxy(url: string) {
  return `/api/inf/links/img-proxy?url=${encodeURIComponent(url)}`;
}

function PreviewModal({
  preview,
  onClose,
}: {
  preview: DraftPreview;
  onClose: () => void;
}) {
  const { t } = useInfLocale();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold text-[#1a1a2e]">{t.linkPreviewTitle}</p>
          <button
            type="button"
            onClick={onClose}
            className="text-lg text-[#aaa] leading-none"
          >
            ✕
          </button>
        </div>

        {preview.unsupported ? (
          <p className="text-sm text-[#8a7a5c]">{t.linkPreviewUnsupported}</p>
        ) : (
          <div className="space-y-3">
            {preview.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgProxy(preview.thumbnailUrl)}
                alt={preview.profileName || "thumbnail"}
                className="aspect-[9/16] w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="flex aspect-[9/16] w-full items-center justify-center rounded-2xl bg-[#f3eee3] text-sm text-[#8a7a5c]">
                No Image
              </div>
            )}
            <div className="flex items-center gap-2 px-1">
              <span className="rounded-full bg-[#f3eee3] px-2.5 py-1 text-[11px] font-semibold text-[#8a6a4a]">
                {CREATOR_PLATFORM_LABEL[preview.platform]}
              </span>
              <p className="truncate text-sm font-bold text-[#1a1a2e]">
                {preview.profileName || t.linkPreviewProfileFallback}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function ProductLinks({
  item,
  onRemove,
}: {
  item: AllocationWithRelations;
  onRemove: (linkId: string) => void;
}) {
  const { t } = useInfLocale();
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-[#1a1a2e]">
        {item.products?.name || t.productFallback}
      </p>
      <LinkList
        links={item.creator_links || []}
        onRemove={onRemove}
      />
    </div>
  );
}

function LinkList({
  links,
  onRemove,
}: {
  links: CreatorLink[];
  onRemove: (linkId: string) => void;
}) {
  const { t } = useInfLocale();
  if (links.length === 0) return null;

  return (
    <ul className="space-y-2">
      {links.map((link) => (
        <li key={link.id} className="rounded-2xl bg-white px-3 py-2.5">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-sm text-[#6B3B1F] underline"
          >
            {link.url}
          </a>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-[#999]">
            <span>
              {CREATOR_PLATFORM_LABEL[link.platform as CreatorPlatform]} ·{" "}
              {statusLabel(link.status, t)}
              {link.status === "rejected" && link.memo ? ` · ${link.memo}` : ""}
            </span>
            {link.status !== "approved" ? (
              <button
                type="button"
                className="font-semibold text-[#999]"
                onClick={() => onRemove(link.id)}
              >
                {t.linkDelete}
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
