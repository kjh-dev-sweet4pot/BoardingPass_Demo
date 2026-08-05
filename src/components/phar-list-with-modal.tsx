"use client";

import { useEffect, useState } from "react";
import {
  ALLOCATION_STATUS_LABEL,
  type AllocationWithRelations,
  type Influencer,
} from "@/lib/types";

type DetailPayload = {
  influencer: Influencer;
  allocations: AllocationWithRelations[];
};

function formatKst(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function formatIgHandle(
  influencer?: {
    instagram_handle?: string | null;
    instagram_handle_normalized?: string | null;
  } | null,
) {
  const raw =
    influencer?.instagram_handle_normalized ||
    influencer?.instagram_handle ||
    "";
  const normalized = raw.replace(/^@+/, "").trim();
  return normalized ? `@${normalized}` : null;
}

function statusTone(status: AllocationWithRelations["status"]) {
  if (status === "picked_up") {
    return "border-[#c4b79a] bg-[#efe8d8] text-[#5c4f35]";
  }
  if (status === "cancelled") {
    return "border-[var(--line)] bg-[#e8ebe9] text-[var(--muted)]";
  }
  if (status === "verified" || status === "ready") {
    return "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]";
  }
  return "border-[var(--line)] bg-white text-[var(--muted)]";
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
      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          조건에 맞는 배정이 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto border border-[var(--line)] bg-[var(--surface)]">
          <table className="min-w-[920px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--accent-soft)]/50 text-xs tracking-[0.08em] text-[var(--muted)] uppercase">
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">계정</th>
                <th className="px-4 py-3 font-medium">상품</th>
                <th className="px-4 py-3 font-medium">매장</th>
                <th className="px-4 py-3 font-medium text-right">수량</th>
                <th className="px-4 py-3 font-medium">방문일</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium text-right">상세</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const handle = formatIgHandle(item.influencers);
                return (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-[var(--line)] last:border-b-0 transition hover:bg-[var(--accent-soft)]/40"
                    onClick={() => setOpenId(item.influencer_id)}
                  >
                    <td className="px-4 py-3.5 font-medium text-[var(--ink)]">
                      {item.influencers?.name || "인플루언서"}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--accent)]">
                      {handle || "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-[var(--ink)]">
                        {item.products?.name || "상품"}
                      </span>
                      {item.products?.sku ? (
                        <span className="mt-0.5 block text-xs text-[var(--muted)]">
                          SKU {item.products.sku}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--muted)]">
                      {item.stores?.name || "매장"}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-[var(--ink)]">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-[var(--muted)]">
                      {item.visit_date || "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block border px-2.5 py-1 text-xs font-medium ${statusTone(item.status)}`}
                      >
                        {ALLOCATION_STATUS_LABEL[item.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-xs text-[var(--accent)]">
                      보기 →
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="인플루언서 상세"
          onClick={() => setOpenId(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto border border-[var(--line)] bg-[var(--surface)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
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
                {detail && (
                  <p className="mt-1 text-lg text-[var(--accent)]">
                    {formatIgHandle(detail.influencer) || "핸들 없음"}
                  </p>
                )}
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
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

            {detail && !loading && (
              <div className="space-y-6">
                {detail.influencer.notes && (
                  <p className="text-sm leading-6 text-[var(--muted)]">
                    {detail.influencer.notes}
                  </p>
                )}

                <dl className="grid gap-4 border border-[var(--line)] bg-white/50 px-4 py-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-[var(--muted)]">SNS 핸들</dt>
                    <dd className="mt-1 text-sm font-medium">
                      {formatIgHandle(detail.influencer) || "등록된 핸들 없음"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">등록일</dt>
                    <dd className="mt-1 text-sm">
                      {formatKst(detail.influencer.created_at)}
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
                  {detail.allocations.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                      배정된 상품이 없습니다.
                    </p>
                  ) : (
                    <div className="overflow-x-auto border border-[var(--line)]">
                      <table className="min-w-[640px] w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-[var(--line)] bg-[var(--accent-soft)]/40 text-xs text-[var(--muted)]">
                            <th className="px-3 py-2 font-medium">상품</th>
                            <th className="px-3 py-2 font-medium">매장</th>
                            <th className="px-3 py-2 font-medium text-right">
                              수량
                            </th>
                            <th className="px-3 py-2 font-medium">방문일</th>
                            <th className="px-3 py-2 font-medium">상태</th>
                            <th className="px-3 py-2 font-medium">수령</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.allocations.map((item) => (
                            <tr
                              key={item.id}
                              className="border-b border-[var(--line)] last:border-b-0"
                            >
                              <td className="px-3 py-2.5">
                                <span className="font-medium">
                                  {item.products?.name || "상품"}
                                </span>
                                {item.products?.sku ? (
                                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                                    SKU {item.products.sku}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 text-[var(--muted)]">
                                {item.stores?.name || "매장"}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {item.quantity}
                              </td>
                              <td className="px-3 py-2.5 tabular-nums text-[var(--muted)]">
                                {item.visit_date || "—"}
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`inline-block border px-2 py-0.5 text-xs font-medium ${statusTone(item.status)}`}
                                >
                                  {ALLOCATION_STATUS_LABEL[item.status]}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-[var(--muted)]">
                                {item.picked_up_at
                                  ? formatKst(item.picked_up_at)
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
