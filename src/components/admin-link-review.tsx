"use client";

import { useEffect, useState } from "react";
import {
  CREATOR_LINK_STATUS_LABEL,
  CREATOR_PLATFORM_LABEL,
  type CreatorPlatform,
} from "@/lib/creator-link";
import { type CreatorLink } from "@/lib/types";

type ReviewRow = CreatorLink & {
  allocations?: {
    visit_date?: string | null;
    products?: { name?: string | null } | null;
    stores?: { name?: string | null } | null;
    influencers?: {
      name?: string | null;
      instagram_handle?: string | null;
    } | null;
    companies?: { name?: string | null } | null;
  } | null;
};

export function AdminLinkReview() {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ReviewRow[]>([]);
  const [memoById, setMemoById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/links", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "불러오기 실패");
      setLinks(body.links || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void load();
  }, [open]);

  async function review(id: string, status: "approved" | "rejected") {
    const memo = memoById[id] || "";
    const res = await fetch(`/api/admin/links/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, memo }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "처리 실패");
      return;
    }
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] shadow-sm">
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
          링크 검수
        </h2>
        <span className="text-xs font-medium text-[var(--muted)]">
          {open ? "접기 ▲" : "펼치기 ▼"}
        </span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-[var(--line)] px-5 pb-5 pt-4">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
          ) : null}
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          {links.length === 0 && !loading ? (
            <p className="text-sm text-[var(--muted)]">검수 대기 링크가 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {links.map((link) => {
                const alloc = link.allocations;
                return (
                  <li
                    key={link.id}
                    className="rounded-xl border border-[var(--line)] px-3 py-3 text-sm"
                  >
                    <p className="font-semibold">
                      {alloc?.influencers?.name || "인플루언서"} ·{" "}
                      {alloc?.products?.name || "상품"}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {alloc?.companies?.name || "회원사 미지정"} ·{" "}
                      {alloc?.stores?.name || "매장"} · {alloc?.visit_date || "미정"}
                    </p>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block break-all text-[var(--accent)] underline"
                    >
                      {link.url}
                    </a>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {CREATOR_PLATFORM_LABEL[link.platform as CreatorPlatform] ||
                        link.platform}{" "}
                      · {CREATOR_LINK_STATUS_LABEL[link.status]}
                    </p>
                    <input
                      className="mt-2 h-9 w-full rounded-lg border border-[var(--line)] px-2 text-xs"
                      placeholder="반려 사유"
                      value={memoById[link.id] || ""}
                      onChange={(e) =>
                        setMemoById((prev) => ({
                          ...prev,
                          [link.id]: e.target.value,
                        }))
                      }
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white"
                        onClick={() => void review(link.id, "approved")}
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs"
                        onClick={() => void review(link.id, "rejected")}
                      >
                        반려
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
