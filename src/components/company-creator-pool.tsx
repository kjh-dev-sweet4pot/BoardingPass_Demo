"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildCreatorPool,
  CHANNEL_LABEL,
  creatorAvatarCandidates,
  formatFollowers,
  formatKrw,
  formatMetric,
  getCreatorBrief,
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

const POOL = buildCreatorPool();

type PickMap = Record<string, "selected" | "excluded">;

export function CompanyCreatorPool() {
  const [visible, setVisible] = useState(POOL_PAGE);
  const [market, setMarket] = useState<CreatorMarket | "">("jp");
  const [channel, setChannel] = useState<CreatorChannel | "">("");
  const [q, setQ] = useState("");
  const [hideOverlap, setHideOverlap] = useState(false);
  const [postedOnly, setPostedOnly] = useState(false);
  const [requested, setRequested] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [picks, setPicks] = useState<PickMap>({});
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return POOL.filter((row) => {
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
  }, [market, channel, q, hideOverlap, postedOnly]);

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;
  const selected = openId
    ? (POOL.find((r) => r.id === openId) ?? null)
    : null;

  const selectedRows = useMemo(
    () => POOL.filter((r) => picks[r.id] === "selected"),
    [picks],
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
    setPicks((prev) => {
      const copy = { ...prev };
      if (!next) delete copy[id];
      else copy[id] = next;
      return copy;
    });
    if (next === "selected") setCartOpen(true);
  }

  function clearCart() {
    setSubmitted(false);
    setPicks((prev) => {
      const copy = { ...prev };
      for (const id of Object.keys(copy)) {
        if (copy[id] === "selected") delete copy[id];
      }
      return copy;
    });
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.9fr)_minmax(280px,0.7fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-[var(--muted)]">
                마케팅 풀 {filtered.length.toLocaleString("ko-KR")}명
                {filtered.length !== POOL.length
                  ? ` · 전체 ${POOL.length.toLocaleString("ko-KR")}`
                  : null}
              </p>
              <p className="mt-0.5 text-sm text-[var(--ink)]">
                JP 시딩 실인원 · 프로필·업로드 콘텐츠 기준으로 풀을 조율하세요
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRequested(true)}
              className="h-10 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold !text-white"
            >
              {requested ? "추가 풀 요청됨" : "리스트 더 받기"}
            </button>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <input
              className="h-10 min-w-[12rem] flex-1 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
              placeholder="이름 · 핸들 · 상품 검색"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setVisible(POOL_PAGE);
              }}
            />
            <select
              className="h-10 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
              value={market}
              onChange={(e) => {
                setMarket(e.target.value as CreatorMarket | "");
                setVisible(POOL_PAGE);
              }}
            >
              <option value="">국가 전체</option>
              {(Object.keys(MARKET_LABEL) as CreatorMarket[]).map((key) => (
                <option key={key} value={key}>
                  {MARKET_LABEL[key]}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value as CreatorChannel | "");
                setVisible(POOL_PAGE);
              }}
            >
              <option value="">채널 전체</option>
              {(
                ["instagram", "tiktok", "x"] as CreatorChannel[]
              ).map((key) => (
                <option key={key} value={key}>
                  {CHANNEL_LABEL[key]}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-pressed={postedOnly}
              onClick={() => {
                setPostedOnly((v) => !v);
                setVisible(POOL_PAGE);
              }}
              className={`h-10 rounded-xl border px-3 text-sm font-medium ${
                postedOnly
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--line)] text-[var(--muted)]"
              }`}
            >
              업로드 있음
            </button>
            <button
              type="button"
              aria-pressed={hideOverlap}
              onClick={() => {
                setHideOverlap((v) => !v);
                setVisible(POOL_PAGE);
              }}
              className={`h-10 rounded-xl border px-3 text-sm font-medium ${
                hideOverlap
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--line)] text-[var(--muted)]"
              }`}
            >
              중복 제외
            </button>
          </div>

          {replaceId ? (
            <p className="shrink-0 rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent)]">
              교체 모드: 대신 넣을 크리에이터 행을 클릭하세요 (Esc 취소)
            </p>
          ) : null}

          {requested ? (
            <p className="shrink-0 rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent)]">
              추가 풀 요청이 접수되었습니다. 운영팀이 후보를 보강한 뒤 리스트에
              반영합니다.
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
            {shown.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
                조건에 맞는 크리에이터가 없습니다.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
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

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--muted)]">
              {shown.length.toLocaleString("ko-KR")} /{" "}
              {filtered.length.toLocaleString("ko-KR")}명 표시
            </p>
            {hasMore ? (
              <button
                type="button"
                onClick={() => setVisible((n) => n + POOL_PAGE)}
                className="h-10 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-semibold"
              >
                리스트 더 보기
              </button>
            ) : filtered.length > 0 ? (
              <p className="text-xs text-[var(--muted)]">끝까지 불러왔습니다</p>
            ) : null}
          </div>
        </div>

        <aside className="min-h-[50vh] min-w-0 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm lg:min-h-0">
          {selected ? (
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
                setReplaceId((id) =>
                  id === selected.id ? null : selected.id,
                )
              }
            />
          ) : (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-4 text-center">
              <div>
                <p className="text-base font-medium text-[var(--ink)]">
                  카드를 선택하면 상세가 여기에 표시됩니다
                </p>
                <p className="mt-2 text-sm leading-5 text-[var(--muted)]">
                  콘텐츠 가이드와 방문·제작 일정을 확인할 수 있습니다
                </p>
              </div>
              <a
                href={VISIT_CONTENT_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={contentGuideLinkClass}
              >
                컨텐츠 가이드라인 보기
                <span aria-hidden>↗</span>
              </a>
            </div>
          )}
        </aside>
      </div>

      <div className="shrink-0 rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
        {submitted ? (
          <p className="border-b border-[var(--line)] bg-[var(--accent-soft)] px-4 py-2.5 text-sm text-[var(--accent)]">
            장바구니 {selectedRows.length}명 · {formatKrw(budget)}원 견적이
            제출되었습니다. 운영 확인 후 풀이 확정됩니다.
          </p>
        ) : null}

        {cartOpen ? (
          <div className="border-b border-[var(--line)] px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--ink)]">
                장바구니
              </p>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="text-xs text-[var(--muted)]"
              >
                접기
              </button>
            </div>
            {selectedRows.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--muted)]">
                아직 담은 크리에이터가 없습니다. 카드에서 선택해 주세요.
              </p>
            ) : (
              <ul className="flex max-h-40 gap-2 overflow-x-auto pb-1">
                {selectedRows.map((row) => (
                  <li
                    key={row.id}
                    className="flex w-36 shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white"
                  >
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => setOpenId(row.id)}
                    >
                      <div className="aspect-square w-full overflow-hidden bg-[#efe4d6]">
                        <CreatorPhoto creator={row} />
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="truncate text-xs font-semibold text-[var(--ink)]">
                          {row.name}
                        </p>
                        <p className="truncate text-[10px] text-[var(--accent)]">
                          {row.handle}
                        </p>
                        <p className="mt-0.5 text-[10px] font-semibold tabular-nums text-[var(--muted)]">
                          {formatKrw(row.priceKrw)}원
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPick(row.id, null)}
                      className="border-t border-[var(--line)] px-2 py-1.5 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--danger)]"
                    >
                      빼기
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCartOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold"
            >
              장바구니
              <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs tabular-nums !text-white">
                {selectedRows.length}
              </span>
            </button>
            <div className="text-sm">
              <span className="text-[var(--muted)]">담은 인원 </span>
              <strong className="tabular-nums text-[var(--accent)]">
                {selectedRows.length}
              </strong>
              <span className="text-[var(--muted)]">
                명
                {excludedCount > 0 ? ` · 제외 ${excludedCount}` : ""}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-xs text-[var(--muted)]">예상 견적 </span>
              <span className="font-semibold tabular-nums text-[var(--accent)]">
                {formatKrw(budget)}원
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={selectedRows.length === 0}
              onClick={clearCart}
              className="h-10 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-semibold disabled:opacity-40"
            >
              비우기
            </button>
            <button
              type="button"
              disabled={selectedRows.length === 0 || submitted}
              onClick={submitCart}
              className="h-10 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold !text-white disabled:opacity-40"
            >
              {submitted ? "제출 완료" : "제출하기"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatorPhoto({
  creator,
  size = "card",
}: {
  creator: PoolCreator;
  size?: "card" | "detail";
}) {
  const candidates = useMemo(
    () => creatorAvatarCandidates(creator),
    [creator],
  );
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setIdx(0);
    setFailed(false);
  }, [creator.id]);

  const exhausted = candidates.length === 0 || failed;
  const src = exhausted
    ? null
    : candidates[Math.min(idx, candidates.length - 1)];
  const box =
    size === "detail"
      ? "h-28 w-28 rounded-2xl"
      : "aspect-square w-full rounded-xl";

  return (
    <div className={`relative overflow-hidden bg-[#efe4d6] ${box}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={`${creator.name} SNS`}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (idx + 1 < candidates.length) setIdx((i) => i + 1);
            else setFailed(true);
          }}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center">
          <p className="text-xs font-semibold text-[var(--accent)]">SNS</p>
          <p className="line-clamp-2 text-[10px] text-[var(--muted)]">
            {creator.handle}
          </p>
        </div>
      )}
    </div>
  );
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
  const metrics = polishDemoMetrics({
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
