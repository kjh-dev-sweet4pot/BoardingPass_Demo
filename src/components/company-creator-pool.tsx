"use client";

import { useEffect, useMemo, useState } from "react";
import { CreatorPhoto } from "@/components/creator-photo";
import {
  buildCreatorPool,
  CHANNEL_LABEL,
  formatFollowers,
  formatMetric,
  getCreatorBrief,
  isLiveInfluencerId,
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
  "inline-flex items-center gap-1.5 rounded-[6px] border-2 border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-xs font-bold text-[var(--accent)] shadow-sm transition hover:bg-[var(--accent)] hover:!text-white";
import { polishDemoMetrics } from "@/lib/demo-metrics";
import { isDemoCompany } from "@/lib/company";
import { regionBadgeText } from "@/lib/region-display";

type PoolSort =
  | "followers-desc"
  | "visit-desc"
  | "followers-asc"
  | "name"
  | "views-desc"
  | "likes-desc";

const POOL_SORT_LABEL: Record<PoolSort, string> = {
  "followers-desc": "팔로워 많은순",
  "visit-desc": "최신 방문 순",
  "followers-asc": "팔로워 적은순",
  name: "이름순",
  "views-desc": "조회수 많은순",
  "likes-desc": "좋아요 많은순",
};

function visitKey(row: PoolCreator) {
  return (row.visitYmd || "").slice(0, 10);
}

function sortPool(rows: PoolCreator[], sort: PoolSort) {
  const copy = [...rows];
  const byName = (a: PoolCreator, b: PoolCreator) =>
    a.name.localeCompare(b.name, "ko");
  copy.sort((a, b) => {
    if (sort === "followers-desc") return b.followers - a.followers || byName(a, b);
    if (sort === "visit-desc") {
      return visitKey(b).localeCompare(visitKey(a)) || byName(a, b);
    }
    if (sort === "followers-asc") return a.followers - b.followers || byName(a, b);
    if (sort === "name") return byName(a, b);
    if (sort === "views-desc") {
      return (b.metrics.views ?? 0) - (a.metrics.views ?? 0) || byName(a, b);
    }
    return (b.metrics.likes ?? 0) - (a.metrics.likes ?? 0) || byName(a, b);
  });
  return copy;
}

export function CompanyCreatorPool({
  companyId,
  companyName,
  loginId,
}: {
  companyId: string;
  companyName: string;
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
  const [sort, setSort] = useState<PoolSort>("followers-desc");
  const [openId, setOpenId] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = pool.filter((row) => {
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
    return sortPool(rows, sort);
  }, [pool, market, channel, q, hideOverlap, postedOnly, sort]);

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;
  const selected = openId
    ? (pool.find((r) => r.id === openId) ?? null)
    : null;

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (channel) {
      chips.push({
        key: "channel",
        label: CHANNEL_LABEL[channel],
        clear: () => {
          setChannel("");
          setVisible(POOL_PAGE);
        },
      });
    }
    if (hideOverlap) {
      chips.push({
        key: "overlap",
        label: "중복 제외",
        clear: () => {
          setHideOverlap(false);
          setVisible(POOL_PAGE);
        },
      });
    }
    if (postedOnly) {
      chips.push({
        key: "posted",
        label: "업로드 있음",
        clear: () => {
          setPostedOnly(false);
          setVisible(POOL_PAGE);
        },
      });
    }
    return chips;
  }, [channel, hideOverlap, postedOnly]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-col gap-4 overflow-auto px-6 py-6">
        <div>
          <h2 className="text-[32px] font-bold leading-tight tracking-[-0.04em] text-[var(--ink)]">
            {poolSource === "mock" ? "후보 크리에이터" : "협업 크리에이터"}{" "}
            <span className="text-[15px] font-normal text-[var(--muted)]">
              {poolLoading
                ? "…"
                : `전체 ${filtered.length.toLocaleString("ko-KR")}명`}
            </span>
          </h2>
          {poolSource === "allocations" ? (
            <p className="mt-1.5 text-[12.5px] text-[var(--muted)]">
              {companyName}와 협업중인 인플루언서입니다.
            </p>
          ) : null}
        </div>

        {poolError ? (
          <p className="rounded-[6px] border border-[var(--danger)]/30 bg-[#fff5f2] px-4 py-2.5 text-sm text-[var(--danger)]">
            {poolError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <input
            className="h-10 min-w-[12rem] flex-1 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
            placeholder="이름 · 핸들 · 상품 검색"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setVisible(POOL_PAGE);
            }}
          />
          <select
            aria-label="정렬"
            className="h-10 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as PoolSort);
              setVisible(POOL_PAGE);
            }}
          >
            {(Object.keys(POOL_SORT_LABEL) as PoolSort[]).map((key) => (
              <option key={key} value={key}>
                {POOL_SORT_LABEL[key]}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value as CreatorChannel | "");
              setVisible(POOL_PAGE);
            }}
          >
            <option value="">플랫폼 전체</option>
            {(["xiaohongshu", "instagram", "tiktok"] as CreatorChannel[]).map((key) => (
              <option key={key} value={key}>
                {CHANNEL_LABEL[key]}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-pressed={hideOverlap}
            onClick={() => {
              setHideOverlap((v) => !v);
              setVisible(POOL_PAGE);
            }}
            className={`h-10 rounded-[6px] border px-3 text-sm font-medium ${
              hideOverlap
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"
            }`}
          >
            중복 제외
          </button>
          <button
            type="button"
            aria-pressed={postedOnly}
            onClick={() => {
              setPostedOnly((v) => !v);
              setVisible(POOL_PAGE);
            }}
            className={`h-10 rounded-[6px] border px-3 text-sm font-medium ${
              postedOnly
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"
            }`}
          >
            업로드 있음
          </button>
          <span className="inline-flex h-10 items-center rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)]">
            필터 {activeFilterChips.length}
          </span>
        </div>

        {activeFilterChips.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--ink)]"
              >
                {chip.label}
                <span aria-hidden className="text-[var(--muted)]">
                  ×
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-3">
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((row) => (
                <CreatorCard
                  key={row.id}
                  row={row}
                  active={row.id === openId}
                  onActivate={() =>
                    setOpenId((id) => (id === row.id ? null : row.id))
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
            className="h-10 self-start rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold"
          >
            더 보기
          </button>
        ) : null}
      </div>

      {selected && openId ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-5">
            <CreatorDetail
              creator={selected}
              onClose={() => setOpenId(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CreatorCard({
  row,
  active,
  onActivate,
}: {
  row: PoolCreator;
  active: boolean;
  onActivate: () => void;
}) {
  const countryBadge = regionBadgeText(row.region);
  return (
    <article
      className={`flex cursor-pointer flex-col overflow-hidden rounded-[6px] border bg-[var(--surface)] transition ${
        active
          ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/30"
          : "border-[var(--line)] hover:border-[var(--accent)]/40"
      }`}
      onClick={onActivate}
    >
      <div className="relative">
        <CreatorPhoto creator={row} />
        <span className="absolute top-2 right-2 max-w-[calc(100%-0.75rem)] truncate rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)] shadow-sm">
          {countryBadge
            ? `${TIER_LABEL[row.tier]} · ${countryBadge}`
            : TIER_LABEL[row.tier]}
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
        </div>

        {row.profileUrl ? (
          <a
            href={row.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 inline-flex justify-center rounded-[6px] border border-[var(--line)] bg-white px-2 py-1.5 text-[11px] font-semibold text-[var(--accent)]"
          >
            SNS 프로필
          </a>
        ) : null}
      </div>
    </article>
  );
}

function CreatorDetail({
  creator,
  onClose,
}: {
  creator: PoolCreator;
  onClose: () => void;
}) {
  const brief = getCreatorBrief(creator);
  const countryBadge = regionBadgeText(creator.region);
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
              {countryBadge ? (
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                  {countryBadge}
                </span>
              ) : null}
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
          className="mb-5 inline-flex rounded-[6px] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold !text-white"
        >
          SNS 프로필 열기
        </a>
      ) : null}

      <dl className="mb-0 grid gap-3 rounded-[6px] bg-[var(--accent-soft)]/50 px-4 py-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-[var(--muted)]">팔로워</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {formatFollowers(creator.followers)}
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
                  className="block rounded-[6px] border border-[var(--line)] px-3 py-2.5 text-sm text-[var(--accent)] underline"
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

      <div className="mt-5 rounded-[6px] border border-[var(--line)] px-4 py-4">
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
