"use client";

import { useEffect, useState } from "react";
import {
  ALLOCATION_STATUS_LABEL,
  SNS_PLATFORM_LABEL,
  type AllocationWithRelations,
  type Influencer,
  type SnsIdentity,
} from "@/lib/types";

type DetailPayload = {
  influencer: Influencer;
  identities: SnsIdentity[];
  allocations: AllocationWithRelations[];
};

function formatKst(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export function PharListWithModal({
  items,
}: {
  items: AllocationWithRelations[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/phar/influencer/${openId}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "불러오기 실패");
        if (!cancelled) setDetail(body as DetailPayload);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "불러오기 실패");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [openId]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openId]);

  return (
    <>
      <ul className="space-y-3">
        {items.length === 0 && (
          <li className="text-sm text-[var(--muted)]">
            조건에 맞는 배정이 없습니다.
          </li>
        )}
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setOpenId(item.influencer_id)}
              className="grid w-full gap-2 border border-[var(--line)] bg-[var(--surface)] p-5 text-left transition hover:border-[var(--accent)] md:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="text-lg font-medium">
                  {item.influencers?.name || "인플루언서"} ·{" "}
                  {item.products?.name || "상품"}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {item.stores?.name || "매장"} · 수량 {item.quantity}
                  {item.visit_code ? ` · code ${item.visit_code}` : ""}
                  {" · "}
                  {formatKst(item.created_at)}
                </p>
                <p className="mt-2 text-xs text-[var(--accent)]">상세 보기</p>
              </div>
              <div className="text-sm text-[var(--accent)]">
                {ALLOCATION_STATUS_LABEL[item.status]}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {openId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="인플루언서 상세"
          onClick={() => setOpenId(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-xl overflow-y-auto border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.2em] text-[var(--accent)] uppercase">
                  Influencer
                </p>
                <h2
                  className="mt-1 text-2xl text-[var(--ink)]"
                  style={{ fontFamily: "var(--font-display), serif" }}
                >
                  {detail?.influencer.name || "불러오는 중…"}
                </h2>
              </div>
              <button
                type="button"
                className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
                onClick={() => setOpenId(null)}
              >
                닫기
              </button>
            </div>

            {loading && (
              <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
            )}
            {error && (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            )}

            {detail && !loading && (
              <div className="space-y-6">
                {detail.influencer.notes && (
                  <p className="text-sm leading-6 text-[var(--muted)]">
                    {detail.influencer.notes}
                  </p>
                )}

                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-[var(--muted)]">SNS</dt>
                    <dd className="mt-1 text-sm">
                      {detail.identities.length === 0
                        ? "등록된 핸들 없음"
                        : detail.identities
                            .map(
                              (s) =>
                                `${SNS_PLATFORM_LABEL[s.platform]} @${s.handle_normalized}`,
                            )
                            .join(" · ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">등록일</dt>
                    <dd className="mt-1 text-sm">
                      {formatKst(detail.influencer.created_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">계정 연결</dt>
                    <dd className="mt-1 text-sm">
                      {detail.influencer.profile_id ? "연결됨" : "미연결"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">배정 건수</dt>
                    <dd className="mt-1 text-sm">
                      {detail.allocations.length}건
                    </dd>
                  </div>
                </dl>

                <div>
                  <h3
                    className="mb-3 text-lg"
                    style={{ fontFamily: "var(--font-display), serif" }}
                  >
                    수령 배정
                  </h3>
                  <ul className="space-y-2">
                    {detail.allocations.length === 0 && (
                      <li className="text-sm text-[var(--muted)]">
                        배정된 상품이 없습니다.
                      </li>
                    )}
                    {detail.allocations.map((item) => (
                      <li
                        key={item.id}
                        className="border border-[var(--line)] bg-white/60 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-medium">
                            {item.products?.name || "상품"}
                          </p>
                          <span className="text-sm text-[var(--accent)]">
                            {ALLOCATION_STATUS_LABEL[item.status]}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {item.stores?.name || "매장"} · 수량 {item.quantity}
                          {item.products?.sku
                            ? ` · SKU ${item.products.sku}`
                            : ""}
                          {item.visit_code ? ` · code ${item.visit_code}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          배정 {formatKst(item.created_at)}
                          {item.verified_at
                            ? ` · 확인 ${formatKst(item.verified_at)}`
                            : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
