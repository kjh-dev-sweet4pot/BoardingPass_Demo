"use client";

import { useMemo, useState } from "react";
import {
  buildPublishFeed,
  formatPublishMd,
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
          실제 업로드 링크로 루틴 발행 현황을 확인하세요
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

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            해당 유형의 발행 콘텐츠가 없습니다.
          </p>
        ) : (
          <ul>
            {filtered.map((row) => (
              <PublishRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PublishRow({ row }: { row: PublishItem }) {
  return (
    <li className="border-b border-[var(--line)] last:border-b-0">
      <a
        href={row.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 transition hover:bg-[var(--accent-soft)]/40"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
              {PUBLISH_KIND_LABEL[row.kind]}
            </span>
            <span className="text-[11px] text-[var(--muted)]">
              {PUBLISH_PLATFORM_LABEL[row.platform] || row.platform}
            </span>
          </span>
          <span className="mt-1 block text-sm font-semibold text-[var(--ink)]">
            {row.title}
          </span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            {row.creatorName} · {row.handle} · {row.productName}
          </span>
        </span>
        <span className="shrink-0 text-right text-xs tabular-nums text-[var(--muted)]">
          <span className="block font-medium text-[var(--accent)]">
            {formatPublishMd(row.publishedYmd)}
          </span>
          링크 열기
        </span>
      </a>
    </li>
  );
}
