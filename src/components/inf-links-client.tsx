"use client";

import { useMemo, useState } from "react";
import { useInfLocale } from "@/components/inf-locale-provider";
import {
  CREATOR_PLATFORM_LABEL,
  summarizeAllocationLinks,
  type CreatorPlatform,
} from "@/lib/creator-link";
import { translateInfApiError } from "@/lib/inf-i18n";
import {
  type AllocationWithRelations,
  type CreatorLink,
} from "@/lib/types";

function rank(item: AllocationWithRelations) {
  const sum = summarizeAllocationLinks(item.creator_links || []);
  if (sum === "none") return 0;
  if (sum === "rejected") return 1;
  if (sum === "reviewing") return 2;
  return 3;
}

export function InfLinksClient({
  initialAllocations,
}: {
  initialAllocations: AllocationWithRelations[];
}) {
  const { t } = useInfLocale();
  const [items, setItems] = useState(initialAllocations);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...items].sort((a, b) => rank(a) - rank(b)),
    [items],
  );

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
                (l) => l.id !== linkId,
              ),
            }
          : row,
      ),
    );
  }

  if (sorted.length === 0) {
    return (
      <p className="mt-10 text-center text-sm text-[#999]">
        {t.noPickedUpProducts}
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4 pb-6">
      <h1 className="pt-2 text-xl font-bold text-[#1a1a2e]">{t.contentLinks}</h1>
      {sorted.map((item) => {
        const links = item.creator_links || [];
        return (
          <article
            key={item.id}
            className="rounded-3xl border border-[#e8e8e8] bg-white p-5 shadow-sm"
          >
            <p className="text-lg font-bold text-[#1a1a2e]">
              {item.products?.name || t.productFallback}
            </p>
            <p className="mt-1 text-sm text-[#8a6a4a]">
              {item.stores?.name || t.storeFallback}
              {item.picked_up_at
                ? ` · ${t.receivedOn} ${new Date(item.picked_up_at).toLocaleDateString("ko-KR")}`
                : ""}
            </p>
            <ul className="mt-3 space-y-2">
              {links.map((link) => (
                <li key={link.id} className="rounded-2xl bg-[#f9f9f9] px-3 py-2.5">
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
                      {link.status === "submitted"
                        ? t.linkReviewing
                        : link.status === "approved"
                          ? t.linkApproved
                          : t.linkRejected}
                      {link.status === "rejected" && link.memo
                        ? ` · ${link.memo}`
                        : ""}
                    </span>
                    {link.status !== "approved" ? (
                      <button
                        type="button"
                        className="font-semibold text-[#999]"
                        onClick={() => void remove(item.id, link.id)}
                      >
                        {t.linkDelete}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <input
                className="h-11 min-w-0 flex-1 rounded-2xl border border-[#e8e8e8] px-3 text-sm"
                type="url"
                placeholder="https://"
                value={drafts[item.id] || ""}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                }
              />
              <button
                type="button"
                disabled={savingId === item.id}
                onClick={() => void submit(item.id)}
                className="rounded-2xl bg-[#6B3B1F] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t.linkSubmit}
              </button>
            </div>
            {errorById[item.id] ? (
              <p className="mt-2 text-xs text-red-400">{errorById[item.id]}</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
