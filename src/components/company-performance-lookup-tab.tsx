"use client";

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { CreatorPhoto } from "@/components/creator-photo";
import { EmptyState } from "@/components/empty-state";
import { formatMetric, formatViews, type ContentPeriod } from "@/lib/content-insights";
import {
  creatorPlatformLabelOf,
  creatorSnsChannelOf,
  resolveCreatorPlatform,
} from "@/lib/creator-link";
import { findPoolCreator, type PoolCreator } from "@/lib/creator-pool-mock";
import { formatMd, ymdKst } from "@/lib/types";

type LinkRow = {
  id: string;
  link_url: string | null;
  published_at: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  allocations: {
    influencer_id: string;
    influencers: {
      id: string;
      name: string;
      instagram_handle_normalized?: string;
      instagram_handle?: string;
    } | null;
    products: { id: string; name: string } | null;
  } | null;
};

type InfluencerRow = {
  id: string;
  name: string;
  handle: string;
  views: number;
  likes: number;
  comments: number;
  posts: number;
  products: string[];
  links: LinkRow[];
};

function er(v: number, l: number, c: number) {
  return v > 0 ? ((l + c) / v) * 100 : 0;
}

function photoOf(row: InfluencerRow): PoolCreator {
  const channel = creatorSnsChannelOf(row.links[0]?.link_url);
  return (
    findPoolCreator({ id: row.id, handle: row.handle, name: row.name }) || {
      id: row.id,
      name: row.name,
      handle: row.handle,
      market: "jp",
      channel,
      profileUrl: null,
      followers: 0,
      priceKrw: 0,
      overlap: null,
      tier: "micro",
      product: row.products[0] || null,
      posts: [],
      uploadYmd: null,
      metrics: { views: 0, likes: 0, comments: 0, saves: 0, shares: 0 },
      category: null,
    }
  );
}

function aggregate(links: LinkRow[]): InfluencerRow[] {
  const map = new Map<string, InfluencerRow>();
  for (const link of links) {
    const inf = link.allocations?.influencers;
    const id = link.allocations?.influencer_id || inf?.id;
    if (!id) continue;
    const bare = (
      inf?.instagram_handle_normalized ||
      inf?.instagram_handle ||
      ""
    )
      .replace(/^@+/, "")
      .trim();
    let row = map.get(id);
    if (!row) {
      row = {
        id,
        name: inf?.name || "—",
        handle: bare ? `@${bare}` : "—",
        views: 0,
        likes: 0,
        comments: 0,
        posts: 0,
        products: [],
        links: [],
      };
      map.set(id, row);
    }
    row.views += link.views ?? 0;
    row.likes += link.likes ?? 0;
    row.comments += link.comments ?? 0;
    row.posts += 1;
    const pn = link.allocations?.products?.name;
    if (pn && !row.products.includes(pn)) row.products.push(pn);
    row.links.push(link);
  }
  return [...map.values()].sort((a, b) => b.views - a.views);
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-5 py-4">
      <span className="text-[15px] font-bold text-[var(--muted)]">{label}</span>
      <p className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.02em] text-[var(--ink)]">
        {value}
        {unit ? (
          <span className="ml-1 text-[13px] font-normal text-[var(--muted)]">{unit}</span>
        ) : null}
      </p>
    </div>
  );
}

export function CompanyPerformanceLookupTab({
  initialData,
  period = "all",
  onPeriodChange,
  onMetaChange,
  insightsUrl = "/api/com/insights",
  toolbarExtra,
}: {
  initialData?: {
    links: LinkRow[];
    collectedAt: string | null;
    nextCollectAt?: string | null;
    source?: "mock" | "apify";
  };
  period?: ContentPeriod;
  onPeriodChange?: (p: ContentPeriod) => void;
  onMetaChange?: (meta: {
    asOf: string;
    lastCollected: string | null;
    nextCollectAt: string | null;
  }) => void;
  insightsUrl?: string;
  toolbarExtra?: ReactNode;
}) {
  const [allLinks, setAllLinks] = useState<LinkRow[]>(initialData?.links ?? []);
  const [collectedAt, setCollectedAt] = useState(initialData?.collectedAt ?? null);
  const [nextCollectAt, setNextCollectAt] = useState(initialData?.nextCollectAt ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [productId, setProductId] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const deferredQ = useDeferredValue(searchQ);
  const asOfYmd = ymdKst(new Date());

  async function reload() {
    setRefreshing(true);
    try {
      if (initialData?.source === "mock") {
        setAllLinks(initialData.links ?? []);
        setCollectedAt(initialData.collectedAt ?? null);
        setNextCollectAt(initialData.nextCollectAt ?? null);
        return;
      }
      const res = await fetch(insightsUrl);
      const data = await res.json();
      if (!res.ok) return;
      setAllLinks(Array.isArray(data.links) ? data.links : []);
      setCollectedAt(data.collectedAt ?? null);
      setNextCollectAt(data.nextCollectAt ?? null);
    } catch {
      /* keep */
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialData) return;
    setLoading(true);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, insightsUrl]);

  useEffect(() => {
    onMetaChange?.({
      asOf: formatMd(asOfYmd),
      lastCollected: collectedAt,
      nextCollectAt,
    });
  }, [asOfYmd, collectedAt, nextCollectAt, onMetaChange]);

  const periodLinks = useMemo(() => {
    if (period !== "month") return allLinks;
    const mk = asOfYmd.slice(0, 7);
    return allLinks.filter((l) => l.published_at?.slice(0, 7) === mk);
  }, [allLinks, period, asOfYmd]);

  const links = useMemo(
    () =>
      productId
        ? periodLinks.filter((l) => l.allocations?.products?.id === productId)
        : periodLinks,
    [periodLinks, productId],
  );

  const products = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of periodLinks) {
      const p = l.allocations?.products;
      if (p) map.set(p.id, p.name);
    }
    return [...map.entries()];
  }, [periodLinks]);

  const influencers = useMemo(() => aggregate(links), [links]);
  const filtered = useMemo(() => {
    const q = deferredQ.trim().toLowerCase();
    if (!q) return influencers;
    return influencers.filter((r) =>
      [r.name, r.handle, ...r.products].join(" ").toLowerCase().includes(q),
    );
  }, [influencers, deferredQ]);

  const selected =
    filtered.find((r) => r.id === selectedId) ||
    (filtered.length === 1 ? filtered[0] : null);

  useEffect(() => {
    if (selectedId && !filtered.some((r) => r.id === selectedId)) setSelectedId(null);
  }, [filtered, selectedId]);

  if (loading) {
    return (
      <div className="space-y-3 px-4 py-4 lg:px-[28px] lg:py-[26px]">
        <div className="h-10 animate-pulse rounded-[6px] bg-[var(--surface-hover)]" />
        <div className="h-64 animate-pulse rounded-[6px] bg-[var(--surface-hover)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 py-4 lg:px-[28px] lg:py-[26px]">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <h2 className="text-[22px] font-bold leading-tight tracking-[-0.04em] text-[var(--ink)] lg:text-[32px]">
          성과 조회
        </h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void reload()}
            disabled={refreshing}
            className="h-[38px] rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13px] font-semibold text-[var(--ink)] disabled:opacity-50"
          >
            {refreshing ? "조회 중…" : "다시 조회"}
          </button>
          {toolbarExtra}
          <select
            className="h-[38px] rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13px] text-[#5b4130]"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">상품 전체</option>
            {products.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          {onPeriodChange ? (
            <div className="flex h-[38px] items-center gap-1 rounded-full border border-[var(--line)] bg-[#f5ede3] p-1">
              {(["month", "all"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPeriodChange(p)}
                  className={`flex h-[30px] items-center rounded-full px-3.5 text-[12.5px] ${
                    period === p
                      ? "bg-[var(--accent)] font-medium !text-white"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {p === "month" ? "이번달" : "전체"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <input
        className="h-11 w-full max-w-md shrink-0 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
        placeholder="이름 · 핸들 · 상품 검색"
        value={searchQ}
        onChange={(e) => setSearchQ(e.target.value)}
      />

      {links.length === 0 ? (
        <EmptyState
          title="발행된 콘텐츠가 없습니다"
          message="성과는 발행완료 건만 집계합니다."
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="검색 결과가 없습니다" message="다른 이름·핸들로 검색해 보세요." />
      ) : (
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--surface)]">
            <div className="shrink-0 border-b border-[#f0e6d8] px-[18px] py-3.5">
              <p className="text-[13.5px] font-semibold text-[var(--ink)]">
                인플루언서 {filtered.length}명
              </p>
            </div>
            <ul className="min-h-0 flex-1 divide-y divide-[#f4ece2] overflow-y-auto">
              {filtered.map((row, idx) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={`flex w-full items-center gap-3 px-[18px] py-3 text-left transition ${
                      selected?.id === row.id
                        ? "bg-[var(--accent-soft)]"
                        : "hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    <span className="w-5 shrink-0 text-[11px] font-semibold tabular-nums text-[var(--muted)]">
                      {idx + 1}
                    </span>
                    <CreatorPhoto creator={photoOf(row)} size="thumb" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[var(--ink)]">
                        {row.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-[var(--muted)]">
                        {row.handle}
                        {row.products.length ? ` · ${row.products.join(", ")}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[13px] font-semibold tabular-nums text-[var(--accent)]">
                        {formatMetric(row.views)}
                      </span>
                      <span className="text-[10.5px] text-[var(--muted)]">조회</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
            {selected ? (
              <>
                <div className="flex shrink-0 items-center gap-3 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-[18px] py-4">
                  <CreatorPhoto creator={photoOf(selected)} size="detail" />
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-[var(--ink)]">{selected.name}</p>
                    <p className="text-sm text-[var(--accent)]">{selected.handle}</p>
                    {selected.products.length ? (
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">
                        {selected.products.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
                  <Stat label="총 조회수" value={formatMetric(selected.views)} />
                  <Stat label="좋아요" value={formatMetric(selected.likes)} />
                  <Stat label="콘텐츠" value={`${selected.posts}`} unit="건" />
                  <Stat
                    label="ER"
                    value={er(selected.views, selected.likes, selected.comments).toLocaleString(
                      "ko-KR",
                      { maximumFractionDigits: 1 },
                    )}
                    unit="%"
                  />
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--surface)]">
                  <div className="shrink-0 border-b border-[#f0e6d8] px-[18px] py-3.5">
                    <p className="text-[13.5px] font-semibold text-[var(--ink)]">콘텐츠 목록</p>
                  </div>
                  <ul className="min-h-0 flex-1 divide-y divide-[#f4ece2] overflow-y-auto">
                    {[...selected.links]
                      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
                      .map((link) => {
                        const url = link.link_url || "";
                        const plat = creatorPlatformLabelOf(url);
                        return (
                          <li key={link.id}>
                            <a
                              href={url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 px-[18px] py-3 transition hover:bg-[var(--surface-hover)]"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-semibold text-[var(--ink)]">
                                  {link.allocations?.products?.name || "상품"}
                                </span>
                                <span className="mt-0.5 block truncate text-[11.5px] text-[var(--muted)]">
                                  {plat}
                                  {link.published_at
                                    ? ` · ${formatMd(link.published_at.slice(0, 10))}`
                                    : ""}
                                </span>
                              </span>
                              <span className="shrink-0 text-right text-[12px] tabular-nums">
                                <span className="block font-semibold text-[var(--accent)]">
                                  {formatViews(
                                    link.views ?? 0,
                                    resolveCreatorPlatform(url) === "xiaohongshu",
                                  )}
                                </span>
                                <span className="text-[var(--muted)]">조회</span>
                              </span>
                            </a>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-[6px] border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-12 text-center">
                <p className="text-sm text-[var(--muted)]">
                  왼쪽에서 인플루언서를 선택하면 상세 성과가 표시됩니다.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
