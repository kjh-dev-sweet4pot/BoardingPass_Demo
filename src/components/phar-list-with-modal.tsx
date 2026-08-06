"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ALLOCATION_STATUS_LABEL,
  type AllocationStatus,
  type AllocationWithRelations,
  type Influencer,
} from "@/lib/types";

type DetailPayload = {
  influencer: Influencer;
  allocations: AllocationWithRelations[];
};

const filterControlClass =
  "h-9 w-full min-w-0 appearance-none rounded-none border border-[var(--line)] bg-white px-2.5 text-xs font-normal normal-case tracking-normal text-[var(--ink)] outline-none transition focus:border-[var(--accent)]";

const filterSelectClass = `${filterControlClass} bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-7`;

const selectChevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M2.5 4.5L6 8L9.5 4.5' stroke='%235d6b63' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

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

function formatSnsUrl(url?: string | null) {
  const raw = (url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function statusTone(status: AllocationWithRelations["status"]) {
  if (status === "picked_up") {
    return "border-[#c4b79a] bg-[#efe8d8] text-[#5c4f35]";
  }
  if (status === "cancelled") {
    return "border-[var(--line)] bg-[#e8ebe9] text-[var(--muted)]";
  }
  if (status === "visited" || status === "ready") {
    return "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]";
  }
  return "border-[var(--line)] bg-white text-[var(--muted)]";
}

function matchesInfluencerSearch(item: AllocationWithRelations, q: string) {
  if (!q) return true;
  const handle = formatIgHandle(item.influencers) || "";
  const haystack = [
    item.influencers?.name || "",
    handle,
    item.influencers?.instagram_handle || "",
    item.influencers?.instagram_handle_normalized || "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function matchesProductSearch(item: AllocationWithRelations, q: string) {
  if (!q) return true;
  const haystack = [item.products?.name || "", item.products?.sku || ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function todayYmdKst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function visitDateKey(item: AllocationWithRelations) {
  return item.visit_date ? String(item.visit_date).slice(0, 10) : "";
}

/** 과거 → 오늘 → 미래
 * 초기 스크롤은 오늘. 위로=오늘 이전, 아래로=오늘 이후
 * 오늘과 맞닿는 쪽이 가까운 날짜가 되도록 과거·미래 모두 오늘 쪽으로 정렬
 */
function sortByVisitRelativeToToday(items: AllocationWithRelations[]) {
  const today = todayYmdKst();
  return [...items].sort((a, b) => {
    const da = visitDateKey(a);
    const db = visitDateKey(b);
    const rank = (d: string) => {
      if (!d || d < today) return 0; // past / missing
      if (d === today) return 1; // today
      return 2; // future
    };
    const ra = rank(da);
    const rb = rank(db);
    if (ra !== rb) return ra - rb;
    if (da !== db) {
      // past: ascending (old → recent, yesterday just above today)
      // future: ascending (tomorrow just below today → far)
      // today: tie-break by created_at only
      return da.localeCompare(db);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
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

  const [influencerQ, setInfluencerQ] = useState("");
  const [productQ, setProductQ] = useState("");
  const [storeId, setStoreId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [status, setStatus] = useState("");

  const deferredInfluencerQ = useDeferredValue(
    influencerQ.trim().toLowerCase(),
  );
  const deferredProductQ = useDeferredValue(productQ.trim().toLowerCase());

  const storeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.store_id && item.stores?.name) {
        map.set(item.store_id, item.stores.name);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [items]);

  const quantityOptions = useMemo(() => {
    const set = new Set<number>();
    for (const item of items) set.add(item.quantity);
    return [...set].sort((a, b) => a - b);
  }, [items]);

  const statusOptions = useMemo(() => {
    const set = new Set<AllocationStatus>();
    for (const item of items) set.add(item.status);
    return [...set].sort((a, b) =>
      ALLOCATION_STATUS_LABEL[a].localeCompare(
        ALLOCATION_STATUS_LABEL[b],
        "ko",
      ),
    );
  }, [items]);

  const filtered = useMemo(() => {
    const next = items.filter((item) => {
      if (!matchesInfluencerSearch(item, deferredInfluencerQ)) return false;
      if (!matchesProductSearch(item, deferredProductQ)) return false;
      if (storeId && item.store_id !== storeId) return false;
      if (quantity && String(item.quantity) !== quantity) return false;
      if (visitDate && (item.visit_date || "") !== visitDate) return false;
      if (status && item.status !== status) return false;
      return true;
    });
    return sortByVisitRelativeToToday(next);
  }, [
    items,
    deferredInfluencerQ,
    deferredProductQ,
    storeId,
    quantity,
    visitDate,
    status,
  ]);

  const today = todayYmdKst();
  const anchorRowId = useMemo(() => {
    const todayItem = filtered.find((item) => visitDateKey(item) === today);
    if (todayItem) return todayItem.id;
    const pastItem = filtered.find((item) => {
      const d = visitDateKey(item);
      return !d || d < today;
    });
    return pastItem?.id ?? null;
  }, [filtered, today]);

  const listScrollRef = useRef<HTMLDivElement>(null);
  const anchorRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    const container = listScrollRef.current;
    const row = anchorRowRef.current;
    if (!container || !row) return;

    const frame = window.requestAnimationFrame(() => {
      const thead = container.querySelector("thead");
      const headerH = thead instanceof HTMLElement ? thead.offsetHeight : 0;
      container.scrollTop = Math.max(0, row.offsetTop - headerH);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [filtered, anchorRowId]);

  const hasFilters =
    Boolean(influencerQ.trim()) ||
    Boolean(productQ.trim()) ||
    Boolean(storeId) ||
    Boolean(quantity) ||
    Boolean(visitDate) ||
    Boolean(status);

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

  function clearFilters() {
    setInfluencerQ("");
    setProductQ("");
    setStoreId("");
    setQuantity("");
    setVisitDate("");
    setStatus("");
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted)]">
        <p>
          {hasFilters
            ? `${filtered.length}건 / 전체 ${items.length}건`
            : `${items.length}건`}
        </p>
        {hasFilters ? (
          <button
            type="button"
            className="text-xs text-[var(--accent)] hover:underline"
            onClick={clearFilters}
          >
            필터 초기화
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">배정이 없습니다.</p>
      ) : (
        <div
          ref={listScrollRef}
          className="max-h-[min(70vh,calc(100vh-14rem))] overflow-auto border border-[var(--line)] bg-[var(--surface)]"
        >
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[var(--line)] bg-[var(--accent-soft)] text-xs tracking-[0.08em] text-[var(--muted)] uppercase">
                <th className="px-4 py-3 font-medium">방문일</th>
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">계정</th>
                <th className="px-4 py-3 font-medium">상품</th>
                <th className="px-4 py-3 font-medium">매장</th>
                <th className="px-4 py-3 font-medium text-right">수량</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium text-right">상세</th>
              </tr>
              <tr className="border-b border-[var(--line)] bg-[var(--surface)]">
                <th className="px-2 py-2 font-normal">
                  <input
                    className={filterControlClass}
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    aria-label="방문일 필터"
                  />
                </th>
                <th colSpan={2} className="px-2 py-2 font-normal">
                  <input
                    className={filterControlClass}
                    type="search"
                    value={influencerQ}
                    onChange={(e) => setInfluencerQ(e.target.value)}
                    placeholder="이름 · 계정"
                    aria-label="이름, 계정 통합 검색"
                  />
                </th>
                <th className="px-2 py-2 font-normal">
                  <input
                    className={filterControlClass}
                    type="search"
                    value={productQ}
                    onChange={(e) => setProductQ(e.target.value)}
                    placeholder="상품"
                    aria-label="상품 검색"
                  />
                </th>
                <th className="px-2 py-2 font-normal">
                  <select
                    className={filterSelectClass}
                    style={{ backgroundImage: selectChevron }}
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    aria-label="매장 필터"
                  >
                    <option value="">매장 전체</option>
                    {storeOptions.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-2 py-2 font-normal">
                  <select
                    className={filterSelectClass}
                    style={{ backgroundImage: selectChevron }}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    aria-label="수량 필터"
                  >
                    <option value="">수량 전체</option>
                    {quantityOptions.map((qty) => (
                      <option key={qty} value={qty}>
                        {qty}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-2 py-2 font-normal">
                  <select
                    className={filterSelectClass}
                    style={{ backgroundImage: selectChevron }}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    aria-label="상태 필터"
                  >
                    <option value="">상태 전체</option>
                    {statusOptions.map((value) => (
                      <option key={value} value={value}>
                        {ALLOCATION_STATUS_LABEL[value]}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm text-[var(--muted)]"
                  >
                    조건에 맞는 배정이 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const handle = formatIgHandle(item.influencers);
                  const dateKey = visitDateKey(item);
                  const isToday = dateKey === today;
                  const isAnchor = item.id === anchorRowId;
                  return (
                    <tr
                      key={item.id}
                      ref={isAnchor ? anchorRowRef : undefined}
                      className={`cursor-pointer border-b border-[var(--line)] last:border-b-0 transition hover:bg-[var(--accent-soft)]/40 ${
                        isToday ? "bg-[var(--accent-soft)]/35" : ""
                      }`}
                      onClick={() => setOpenId(item.influencer_id)}
                    >
                      <td className="px-4 py-3.5 tabular-nums font-medium text-[var(--ink)]">
                        {item.visit_date || "—"}
                        {isToday ? (
                          <span className="ml-2 text-[10px] font-semibold tracking-wide text-[var(--accent)] uppercase">
                            오늘
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-[var(--ink)]">
                        {item.influencers?.name || "인플루언서"}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--accent)]">
                        {formatSnsUrl(item.influencers?.sns_url) ? (
                          <a
                            href={formatSnsUrl(item.influencers?.sns_url)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {handle || "프로필"}
                          </a>
                        ) : (
                          handle || "—"
                        )}
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
                })
              )}
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
                {detail && formatSnsUrl(detail.influencer.sns_url) && (
                  <a
                    href={formatSnsUrl(detail.influencer.sns_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--accent)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {formatSnsUrl(detail.influencer.sns_url)}
                  </a>
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

                <dl className="grid gap-4 border border-[var(--line)] bg-white/50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs text-[var(--muted)]">SNS 핸들</dt>
                    <dd className="mt-1 text-sm font-medium">
                      {formatIgHandle(detail.influencer) || "등록된 핸들 없음"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">SNS URL</dt>
                    <dd className="mt-1 text-sm font-medium break-all">
                      {formatSnsUrl(detail.influencer.sns_url) ? (
                        <a
                          href={formatSnsUrl(detail.influencer.sns_url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--accent)] underline underline-offset-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          프로필 열기
                        </a>
                      ) : (
                        "—"
                      )}
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
