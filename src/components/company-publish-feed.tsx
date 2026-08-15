"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildPublishFeed,
  formatPublishMd,
  publishThumbCandidates,
  PUBLISH_KIND_LABEL,
  PUBLISH_PLATFORM_LABEL,
  type PublishItem,
  type PublishKind,
} from "@/lib/publish-feed-mock";

const FEED = buildPublishFeed();

type Tab = "all" | PublishKind;

export function CompanyPublishFeed() {
  const [tab, setTab] = useState<Tab>("all");

  const filtered = useMemo(
    () => (tab === "all" ? FEED : FEED.filter((row) => row.kind === tab)),
    [tab],
  );

  const counts = useMemo(() => {
    const next = { all: FEED.length, carousel: 0, visit: 0, seeding: 0 };
    for (const row of FEED) next[row.kind] += 1;
    return next;
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0">
        <p className="text-xs text-[var(--muted)]">
          발행 완료 {FEED.length.toLocaleString("ko-KR")}건 · JP 시딩 실업로드
        </p>
        <p className="mt-0.5 text-sm text-[var(--ink)]">
          게시물 썸네일로 루틴 발행 현황을 확인하세요
        </p>
      </div>

      <div
        className="flex shrink-0 flex-wrap gap-1 rounded-full border border-[var(--line)] bg-white p-0.5"
        role="tablist"
      >
        {(
          [
            ["all", "전체"],
            ["carousel", PUBLISH_KIND_LABEL.carousel],
            ["visit", PUBLISH_KIND_LABEL.visit],
            ["seeding", PUBLISH_KIND_LABEL.seeding],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-full px-3.5 py-2 text-xs font-semibold ${
              tab === key
                ? "bg-[var(--accent)] !text-white"
                : "text-[var(--muted)]"
            }`}
          >
            {label}{" "}
            <span className="tabular-nums opacity-80">{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            해당 유형의 발행 콘텐츠가 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {filtered.map((row) => (
              <PublishCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PublishThumb({ item }: { item: PublishItem }) {
  const candidates = useMemo(() => publishThumbCandidates(item), [item]);
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setIdx(0);
    setFailed(false);
  }, [item.id]);

  const src =
    !failed && candidates.length > 0
      ? candidates[Math.min(idx, candidates.length - 1)]
      : null;

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#efe4d6]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
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
        <div className="flex h-full w-full items-center justify-center text-xs text-[var(--muted)]">
          {PUBLISH_PLATFORM_LABEL[item.platform] || item.platform}
        </div>
      )}
    </div>
  );
}

function PublishCard({ row }: { row: PublishItem }) {
  return (
    <a
      href={row.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[#fffdfb] shadow-[0_1px_0_rgba(61,31,10,0.06)] transition hover:border-[var(--accent)]/50"
    >
      <div className="relative">
        <PublishThumb item={row} />
        <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)] shadow-sm">
          {PUBLISH_KIND_LABEL[row.kind]}
        </span>
        <span className="absolute top-2 right-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-[var(--muted)] shadow-sm">
          {PUBLISH_PLATFORM_LABEL[row.platform] || row.platform}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold text-[var(--ink)]">
          {row.title}
        </p>
        <p className="truncate text-xs text-[var(--accent)]">
          {row.creatorName} · {row.handle}
        </p>
        <p className="mt-auto pt-1 text-[11px] tabular-nums text-[var(--muted)]">
          {formatPublishMd(row.publishedYmd)} · 게시물 열기
        </p>
      </div>
    </a>
  );
}
