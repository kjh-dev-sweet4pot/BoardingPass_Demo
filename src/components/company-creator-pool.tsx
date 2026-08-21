"use client";

import { useEffect, useMemo, useState } from "react";
import { CreatorPhoto } from "@/components/creator-photo";
import {
  buildCreatorPool,
  CHANNEL_LABEL,
  formatFollowers,
  formatKrw,
  formatMetric,
  getCreatorBrief,
  isLiveInfluencerId,
  MARKET_LABEL,
  OVERLAP_LABEL,
  POOL_PAGE,
  POST_PLATFORM_LABEL,
  TIER_LABEL,
  VISIT_CONTENT_GUIDE_URL,
  type CreatorChannel,
  type CreatorMarket,
  type PoolCreator,
} from "@/lib/creator-pool-mock";

const contentGuideLinkClass =
  "inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-xs font-bold text-[var(--accent)] shadow-sm transition hover:bg-[var(--accent)] hover:!text-white";
import { polishDemoMetrics } from "@/lib/demo-metrics";
import { isDemoCompany } from "@/lib/company";

type PickMap = Record<string, "selected" | "excluded">;

// castingId로 관리 — key: pool creator id, value: castingId(담긴 경우) | "excluded"
type CastingMap = Record<string, { castingId: string } | "excluded">;

export function CompanyCreatorPool({
  companyId,
  loginId,
}: {
  companyId: string;
  loginId?: string | null;
}) {
  const isDemo = isDemoCompany({ login_id: loginId });
  const [pool, setPool] = useState<PoolCreator[]>(() =>
    isDemo ? buildCreatorPool() : [],
  );
  const [poolSource, setPoolSource] = useState<"allocations" | "mock" | null>(
    isDemo ? "mock" : null,
  );
  const [poolLoading, setPoolLoading] = useState(!isDemo);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [visible, setVisible] = useState(POOL_PAGE);
  const [market, setMarket] = useState<CreatorMarket | "">(isDemo ? "jp" : "");
  const [channel, setChannel] = useState<CreatorChannel | "">("");
  const [q, setQ] = useState("");
  const [hideOverlap, setHideOverlap] = useState(false);
  const [postedOnly, setPostedOnly] = useState(false);
  const [requested, setRequested] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [picks, setPicks] = useState<PickMap>({});
  const [castings, setCastings] = useState<CastingMap>({});
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // 데모(company)만 목업. 그 외(aaa 포함)는 배정 DB → 크리에이터 풀.
  useEffect(() => {
    if (isDemo) {
      setPool(buildCreatorPool());
      setPoolSource("mock");
      setMarket("jp");
      setPoolLoading(false);
      setPoolError(null);
      return;
    }
    let cancelled = false;
    setPoolLoading(true);
    setPoolError(null);
    fetch("/api/com/creator-pool")
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(body.error || "크리에이터 풀을 불러오지 못했습니다.");
        }
        return body as { creators?: PoolCreator[] };
      })
      .then((body) => {
        if (cancelled) return;
        setPool(Array.isArray(body.creators) ? body.creators : []);
        setPoolSource("allocations");
        setMarket("");
      })
      .catch((e) => {
        if (cancelled) return;
        setPool([]);
        setPoolSource("allocations");
        setMarket("");
        setPoolError(e instanceof Error ? e.message : "크리에이터 풀을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setPoolLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, isDemo]);

  // 기존 castings 로드 (handle 기준 매핑)
  useEffect(() => {
    if (pool.length === 0) return;
    fetch("/api/com/castings")
      .then((r) => r.json())
      .then((rows: Array<{ id: string; status: string; influencers?: { instagram_handle_normalized?: string; instagram_handle?: string } }>) => {
        if (!Array.isArray(rows)) return;
        const map: CastingMap = {};
        const nextPicks: PickMap = {};
        for (const row of rows) {
          const handle = (
            row.influencers?.instagram_handle_normalized ||
            row.influencers?.instagram_handle ||
            ""
          ).replace(/^@+/, "").toLowerCase();
          const poolRow = pool.find(
            (p) => p.handle.replace(/^@+/, "").toLowerCase() === handle,
          );
          if (poolRow && row.status !== "결렬") {
            map[poolRow.id] = { castingId: row.id };
            nextPicks[poolRow.id] = "selected";
          }
        }
        setCastings(map);
        setPicks((prev) => ({ ...prev, ...nextPicks }));
      })
      .catch(() => {});
  }, [companyId, pool]);

  // 담기 → API POST (campaign_id는 임시로 null 허용 시까지 skip, 추후 T10에서 연결)
  async function addCasting(poolId: string) {
    const row = pool.find((r) => r.id === poolId);
    if (!row) return;
    // castings에는 campaign_id 필수이므로, 없으면 낙관적 UI만 업데이트
    setPicks((prev) => ({ ...prev, [poolId]: "selected" }));
    setCartOpen(true);
  }

  async function removeCasting(poolId: string) {
    const entry = castings[poolId];
    if (entry && entry !== "excluded" && "castingId" in entry) {
      await fetch("/api/com/castings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ casting_id: entry.castingId }),
      });
      setCastings((prev) => { const c = { ...prev }; delete c[poolId]; return c; });
    }
    setPicks((prev) => { const c = { ...prev }; delete c[poolId]; return c; });
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pool.filter((row) => {
      if (hideOverlap && row.overlap) return false;
      if (postedOnly && row.posts.length === 0) return false;
      if (market && row.market !== market) return false;
      if (channel && row.channel !== channel) return false;
      if (!needle) return true;
      return (
        row.name.toLowerCase().includes(needle) ||
        row.handle.toLowerCase().includes(needle) ||
        (row.product || "").toLowerCase().includes(needle)
      );
    });
  }, [pool, market, channel, q, hideOverlap, postedOnly]);

  const available = useMemo(
    () => filtered.filter((row) => picks[row.id] !== "selected"),
    [filtered, picks],
  );
  const shown = available.slice(0, visible);
  const hasMore = visible < available.length;
  const selected = openId
    ? (pool.find((r) => r.id === openId) ?? null)
    : null;

  const selectedRows = useMemo(
    () => pool.filter((r) => picks[r.id] === "selected"),
    [pool, picks],
  );
  const excludedCount = useMemo(
    () => Object.values(picks).filter((v) => v === "excluded").length,
    [picks],
  );
  const budget = selectedRows.reduce((sum, r) => sum + r.priceKrw, 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (replaceId) setReplaceId(null);
        else setOpenId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [replaceId]);

  function setPick(id: string, next: "selected" | "excluded" | null) {
    setSubmitted(false);
    if (next === "selected") {
      addCasting(id);
    } else if (next === null) {
      removeCasting(id);
    } else {
      // excluded
      removeCasting(id);
      setPicks((prev) => ({ ...prev, [id]: "excluded" }));
    }
  }

  function clearCart() {
    setSubmitted(false);
    const selectedIds = Object.entries(picks)
      .filter(([, v]) => v === "selected")
      .map(([k]) => k);
    for (const id of selectedIds) removeCasting(id);
  }

  function submitCart() {
    if (selectedRows.length === 0) return;
    setSubmitted(true);
    setCartOpen(true);
  }

  function onRowActivate(row: PoolCreator) {
    if (replaceId) {
      if (row.id === replaceId) {
        setReplaceId(null);
        return;
      }
      setPicks((prev) => {
        const copy = { ...prev };
        delete copy[replaceId];
        copy[row.id] = "selected";
        return copy;
      });
      setReplaceId(null);
      setOpenId(row.id);
      return;
    }
    setOpenId((id) => (id === row.id ? null : row.id));
  }

  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-h-0 flex-col gap-4 overflow-auto px-6 py-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
            Creators
          </p>
          <h2
            className="mt-1.5 text-[28px] font-semibold leading-tight text-[var(--ink)]"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {poolSource === "allocations" ? "협업 크리에이터" : "후보 크리에이터"}{" "}
            <span className="text-[15px] font-normal text-[var(--muted)]">
              {poolLoading
                ? "…"
                : `${filtered.length.toLocaleString("ko-KR")}명`}
            </span>
          </h2>
          {poolSource === "allocations" ? (
            <p className="mt-1.5 text-[12.5px] text-[var(--muted)]">
              CSV·배정으로 등록된 협업 인플루언서입니다.
            </p>
          ) : null}
        </div>

        {poolError ? (
          <p className="rounded-xl border border-[var(--danger)]/30 bg-[#fff5f2] px-4 py-2.5 text-sm text-[var(--danger)]">
            {poolError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <input
            className="h-10 min-w-[12rem] flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
            placeholder="이름 · 핸들 · 상품 검색"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setVisible(POOL_PAGE);
            }}
          />
          <select
            className="h-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value as CreatorChannel | "");
              setVisible(POOL_PAGE);
            }}
          >
            <option value="">플랫폼 전체</option>
            {(["instagram", "tiktok"] as CreatorChannel[]).map((key) => (
              <option key={key} value={key}>
                {CHANNEL_LABEL[key]}
              </option>
            ))}
          </select>
        </div>

        {replaceId ? (
          <p className="rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent)]">
            교체 모드: 대신 넣을 크리에이터를 선택하세요 (Esc 취소)
          </p>
        ) : null}

            <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
              {poolLoading ? (
                <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
                  크리에이터를 불러오는 중…
                </p>
              ) : shown.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
                  {poolSource === "allocations" && pool.length === 0
                    ? "등록된 협업 인플루언서가 없습니다. 운영 콘솔에서 CSV를 업로드하면 여기에 표시됩니다."
                    : "조건에 맞는 크리에이터가 없습니다."}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {shown.map((row) => (
                    <CreatorCard
                      key={row.id}
                      row={row}
                      active={row.id === openId}
                      pick={picks[row.id] || null}
                      replacing={replaceId === row.id}
                      onActivate={() => onRowActivate(row)}
                      onSelectToggle={() =>
                        setPick(
                          row.id,
                          picks[row.id] === "selected" ? null : "selected",
                        )
                      }
                      onExclude={() =>
                        setPick(
                          row.id,
                          picks[row.id] === "excluded" ? null : "excluded",
                        )
                      }
                      onReplace={() =>
                        setReplaceId((id) => (id === row.id ? null : row.id))
                      }
                    />
                  ))}
                </div>
              )}
            </div>

        {hasMore ? (
          <button
            type="button"
            onClick={() => setVisible((n) => n + POOL_PAGE)}
            className="h-10 self-start rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold"
          >
            더 보기
          </button>
        ) : null}
      </div>

      <aside className="flex min-h-0 flex-col border-[var(--line)] bg-[var(--surface)] px-[18px] py-[22px] lg:border-l">
        <div className="mb-3.5 flex items-baseline justify-between">
          <span className="text-[13.5px] font-semibold">장바구니</span>
          <span className="text-[11.5px] text-[var(--muted)]">
            {selectedRows.length}명 · Pending
          </span>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {selectedRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted)]">
              담은 크리에이터가 없습니다.
            </p>
          ) : (
            selectedRows.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-2 rounded-xl border border-[#f0e6d8] p-2.5"
              >
                <CreatorPhoto creator={row} size="avatar" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold">{row.name}</p>
                  <p className="truncate text-[10.5px] text-[var(--muted)]">
                    {tierBandLabel(row.followers)} · {formatFollowers(row.followers)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPick(row.id, null)}
                  className="text-[11px] text-[var(--danger)]"
                >
                  제외
                </button>
              </div>
            ))
          )}
        </div>
        <p className="mt-3 border-t border-[#f0e6d8] pt-3 text-[11.5px] leading-relaxed text-[var(--muted)]">
          담기 시 섭외가 <b className="text-[var(--accent)]">Pending</b>으로 생성됩니다.
          협의·확정은 운영자가 진행합니다.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            disabled={selectedRows.length === 0 || submitted}
            onClick={submitCart}
            className="flex h-10 items-center rounded-xl bg-[var(--accent)] px-3.5 text-[13px] font-semibold !text-white disabled:opacity-40"
          >
            {submitted ? "제출 완료" : "섭외 요청 보내기"}
          </button>
          <button
            type="button"
            disabled={selectedRows.length === 0}
            onClick={() => selectedRows[0] && setReplaceId(selectedRows[0].id)}
            className="flex h-10 items-center justify-center rounded-full border border-[var(--line)] text-[13px] text-[var(--accent)] disabled:opacity-40"
          >
            동일 구간에서 교체
          </button>
        </div>
      </aside>

      {selected && openId ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <CreatorDetail
              creator={selected}
              pick={picks[selected.id] || null}
              onClose={() => setOpenId(null)}
              onSelect={() =>
                setPick(
                  selected.id,
                  picks[selected.id] === "selected" ? null : "selected",
                )
              }
              onExclude={() =>
                setPick(
                  selected.id,
                  picks[selected.id] === "excluded" ? null : "excluded",
                )
              }
              onReplace={() =>
                setReplaceId((id) => (id === selected.id ? null : selected.id))
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function tierBandLabel(followers: number) {
  if (followers < 10000) return "나노";
  if (followers <= 100000) return "마이크로";
  return "매크로";
}

function CreatorCard({
  row,
  active,
  pick,
  replacing,
  onActivate,
  onSelectToggle,
  onExclude,
  onReplace,
}: {
  row: PoolCreator;
  active: boolean;
  pick: "selected" | "excluded" | null;
  replacing: boolean;
  onActivate: () => void;
  onSelectToggle: () => void;
  onExclude: () => void;
  onReplace: () => void;
}) {
  return (
    <article
      className={`flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-[#fffdfb] shadow-[0_1px_0_rgba(61,31,10,0.06)] transition ${
        pick === "excluded"
          ? "border-[#e8b4b4] opacity-70"
          : pick === "selected" || active || replacing
            ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/30"
            : "border-[var(--line)] hover:border-[var(--accent)]/50"
      }`}
      onClick={onActivate}
    >
      <div className="relative">
        <CreatorPhoto creator={row} />
        <label
          className="absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 shadow-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={pick === "selected"}
            disabled={pick === "excluded"}
            onChange={onSelectToggle}
            aria-label={`${row.name} 장바구니 담기`}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
        </label>
        {pick === "selected" ? (
          <span className="absolute bottom-2 left-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold !text-white shadow-sm">
            담김
          </span>
        ) : null}
        <span className="absolute top-2 right-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)] shadow-sm">
          {TIER_LABEL[row.tier]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">
            {row.name}
          </p>
          <p className="truncate text-xs text-[var(--accent)]">{row.handle}</p>
        </div>

        <div className="flex flex-wrap gap-1">
          <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
            {CHANNEL_LABEL[row.channel]}
          </span>
          {row.posts.length > 0 ? (
            <span className="rounded-full bg-[#e7f3ea] px-1.5 py-0.5 text-[10px] font-medium text-[#2f6b3c]">
              업로드 {row.posts.length}
            </span>
          ) : null}
          {row.overlap ? (
            <span className="rounded-full bg-[#f8e4e4] px-1.5 py-0.5 text-[10px] font-medium text-[#9b2c2c]">
              {OVERLAP_LABEL[row.overlap]}
            </span>
          ) : null}
          {pick === "excluded" ? (
            <span className="rounded-full bg-[#f0ece6] px-1.5 py-0.5 text-[10px] font-medium text-[#8a8074]">
              제외
            </span>
          ) : null}
        </div>

        <p className="line-clamp-2 min-h-[2rem] text-[11px] leading-4 text-[var(--muted)]">
          {row.product || "시딩 상품 미기재"}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            <p className="text-[10px] text-[var(--muted)]">팔로워</p>
            <p className="text-xs font-semibold tabular-nums">
              {formatFollowers(row.followers)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[var(--muted)]">단가</p>
            <p className="text-xs font-semibold tabular-nums text-[var(--accent)]">
              {formatKrw(row.priceKrw)}
            </p>
          </div>
        </div>

        {row.profileUrl ? (
          <a
            href={row.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 inline-flex justify-center rounded-lg border border-[var(--line)] bg-white px-2 py-1.5 text-[11px] font-semibold text-[var(--accent)]"
          >
            SNS 프로필
          </a>
        ) : null}

        <div
          className="flex gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onSelectToggle}
            disabled={pick === "excluded"}
            className={`flex-1 rounded-lg border px-1.5 py-1 text-[10px] font-medium ${
              pick === "selected"
                ? "border-[var(--accent)] bg-[var(--accent)] !text-white"
                : "border-[var(--line)] text-[var(--muted)]"
            }`}
          >
            {pick === "selected" ? "담김" : "담기"}
          </button>
          <button
            type="button"
            onClick={onExclude}
            className={`flex-1 rounded-lg border px-1.5 py-1 text-[10px] font-medium ${
              pick === "excluded"
                ? "border-[#9b2c2c] bg-[#f8e4e4] text-[#9b2c2c]"
                : "border-[var(--line)] text-[var(--muted)]"
            }`}
          >
            제외
          </button>
          <button
            type="button"
            onClick={onReplace}
            className={`flex-1 rounded-lg border px-1.5 py-1 text-[10px] font-medium ${
              replacing
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--line)] text-[var(--muted)]"
            }`}
          >
            교체
          </button>
        </div>
      </div>
    </article>
  );
}

function CreatorDetail({
  creator,
  pick,
  onClose,
  onSelect,
  onExclude,
  onReplace,
}: {
  creator: PoolCreator;
  pick: "selected" | "excluded" | null;
  onClose: () => void;
  onSelect: () => void;
  onExclude: () => void;
  onReplace: () => void;
}) {
  const brief = getCreatorBrief(creator);
  const metrics = isLiveInfluencerId(creator.id)
    ? {
        views: creator.metrics.views ?? 0,
        likes: creator.metrics.likes ?? 0,
        comments: creator.metrics.comments ?? 0,
      }
    : polishDemoMetrics({
        views: creator.metrics.views,
        likes: creator.metrics.likes,
        comments: creator.metrics.comments,
        followers: creator.followers,
        seed: creator.id,
      });

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CreatorPhoto creator={creator} size="detail" />
          <div className="min-w-0">
            <p className="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
              Creator
            </p>
            <h3 className="mt-1 text-2xl font-bold text-[var(--ink)]">
              {creator.name}
            </h3>
            <p className="mt-1 text-[var(--accent)]">{creator.handle}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                {MARKET_LABEL[creator.market]}
              </span>
              <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                {CHANNEL_LABEL[creator.channel]}
              </span>
              <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                {TIER_LABEL[creator.tier]}
              </span>
              {creator.overlap ? (
                <span className="rounded-full bg-[#f8e4e4] px-2 py-0.5 text-xs font-medium text-[#9b2c2c]">
                  {OVERLAP_LABEL[creator.overlap]}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-[var(--muted)]"
        >
          닫기
        </button>
      </div>

      {creator.profileUrl ? (
        <a
          href={creator.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-5 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold !text-white"
        >
          SNS 프로필 열기
        </a>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelect}
          className={`rounded-xl px-3 py-2 text-sm font-semibold ${
            pick === "selected"
              ? "bg-[var(--accent)] !text-white"
              : "border border-[var(--line)]"
          }`}
        >
          {pick === "selected" ? "장바구니에 담김" : "장바구니 담기"}
        </button>
        <button
          type="button"
          onClick={onExclude}
          className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
            pick === "excluded"
              ? "border-[#9b2c2c] bg-[#f8e4e4] text-[#9b2c2c]"
              : "border-[var(--line)]"
          }`}
        >
          제외
        </button>
        <button
          type="button"
          onClick={onReplace}
          className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold"
        >
          교체
        </button>
      </div>

      <dl className="grid gap-3 rounded-2xl bg-[var(--accent-soft)]/50 px-4 py-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-[var(--muted)]">팔로워</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {formatFollowers(creator.followers)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">집행 단가</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {formatKrw(creator.priceKrw)}원
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-[var(--muted)]">시딩 상품</dt>
          <dd className="mt-1 font-semibold">{creator.product || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">조회</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {formatMetric(metrics.views)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">좋아요</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {formatMetric(metrics.likes)}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <h4 className="text-sm font-semibold">업로드 콘텐츠</h4>
        {creator.posts.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            아직 등록된 업로드 링크가 없습니다.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {creator.posts.map((post) => (
              <li key={post.url}>
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm text-[var(--accent)] underline"
                >
                  {POST_PLATFORM_LABEL[post.platform] || post.platform} · 콘텐츠
                  열기
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5">
        <h4 className="text-sm font-semibold">집행 콘텐츠 포맷</h4>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {brief.formats.map((f) => (
            <li
              key={f}
              className="rounded-full border border-[var(--line)] px-2.5 py-1 text-xs font-medium"
            >
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--line)] px-4 py-4">
        <h4 className="text-sm font-semibold">{brief.guideTitle}</h4>
        <ul className="mt-3 space-y-2 text-sm leading-5 text-[var(--ink)]">
          {brief.guideBullets.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <a
          href={VISIT_CONTENT_GUIDE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-4 w-full justify-center py-2.5 text-sm ${contentGuideLinkClass}`}
        >
          컨텐츠 가이드라인 보기
          <span aria-hidden>↗</span>
        </a>
      </div>

      <div className="mt-5">
        <h4 className="text-sm font-semibold">방문 · 제작 일정</h4>
        <ol className="mt-3 space-y-0">
          <li className="relative border-l-2 border-[var(--line)] pb-4 pl-4">
            <span className="absolute top-1 -left-[5px] h-2 w-2 rounded-full bg-[var(--accent)]" />
            <p className="text-xs text-[var(--muted)]">방문</p>
            <p className="mt-0.5 font-semibold">{brief.visitWindow}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              매장 방문 · 시딩 수령
            </p>
          </li>
          <li className="relative border-l-2 border-transparent pl-4">
            <span className="absolute top-1 -left-[5px] h-2 w-2 rounded-full bg-[var(--accent)]" />
            <p className="text-xs text-[var(--muted)]">제작 일정</p>
            <p className="mt-0.5 font-semibold">{brief.contentWindow}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              가이드 포맷으로 발행 · 링크 제출
            </p>
          </li>
        </ol>
      </div>

    </div>
  );
}
