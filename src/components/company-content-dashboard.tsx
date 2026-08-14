"use client";

import { CREATOR_PLATFORM_LABEL } from "@/lib/creator-link";
import {
  engagementRate,
  formatMetric,
  type ContentInfluencerInsight,
  type ContentInsightsSnapshot,
  type ContentPostInsight,
  type ContentProductInsight,
} from "@/lib/content-insights";

export type ContentFocus =
  | { kind: "product"; productId: string }
  | { kind: "influencer"; influencerId: string }
  | { kind: "post"; id: string }
  | null;

function ymdKst(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysYmd(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function formatMdMidnight(ymd: string) {
  const [, month, day] = ymd.split("-").map(Number);
  return `${month}월 ${day}일 00:00`;
}

function contentRefreshCopy(source: ContentInsightsSnapshot["source"]) {
  const today = ymdKst();
  const todayLabel = formatMdMidnight(today);
  if (source === "mock") {
    return `${todayLabel} 기준 : ${formatMdMidnight(addDaysYmd(today, 1))}에 데이터를 갱신합니다.`;
  }
  return `${todayLabel} 수집 데이터`;
}

export function CompanyContentDashboard({
  snapshot,
  focus,
  onFocus,
  onOpenAllocation,
}: {
  snapshot: ContentInsightsSnapshot;
  focus: ContentFocus;
  onFocus: (next: ContentFocus) => void;
  onOpenAllocation: (opts: {
    allocationId?: string | null;
    search: string;
  }) => void;
}) {
  const maxProductViews = snapshot.products[0]?.views || 1;
  const selectedPost =
    focus?.kind === "post"
      ? snapshot.posts.find((p) => p.id === focus.id) || null
      : null;
  const selectedProduct =
    focus?.kind === "product"
      ? snapshot.products.find((p) => p.productId === focus.productId) || null
      : selectedPost
        ? snapshot.products.find((p) => p.productId === selectedPost.productId) ||
          null
        : null;
  const selectedInfluencer =
    focus?.kind === "influencer"
      ? snapshot.influencers.find((p) => p.influencerId === focus.influencerId) ||
        null
      : selectedPost
        ? snapshot.influencers.find(
            (p) => p.influencerId === selectedPost.influencerId,
          ) || null
        : null;

  return (
    <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.9fr)_minmax(280px,0.7fr)]">
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <p className="text-xs text-[var(--muted)]">
            {contentRefreshCopy(snapshot.source)}
          </p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="조회수" value={formatMetric(snapshot.totals.views)} />
          <Kpi label="좋아요" value={formatMetric(snapshot.totals.likes)} />
          <Kpi label="콘텐츠" value={`${snapshot.totals.posts}`} unit="건" />
          <Kpi
            label="인플루언서"
            value={`${snapshot.totals.influencers}`}
            unit="명"
          />
        </div>

        {snapshot.posts.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-6 py-12 text-center">
            <div>
              <p className="font-medium text-[var(--ink)]">
                아직 성과로 볼 콘텐츠가 없습니다
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                수령·링크 등록이 쌓이면 상품별 조회수와 인플루언서 성과가 여기에
                표시됩니다.
              </p>
            </div>
          </div>
        ) : (
          <>
            <section className="min-h-0 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
              <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3">
                <h2 className="text-sm font-semibold">상품별 성과</h2>
              </header>
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="text-xs text-[var(--muted)]">
                    <th className="px-4 py-2 font-medium">상품</th>
                    <th className="px-4 py-2 font-medium">조회</th>
                    <th className="px-4 py-2 font-medium">좋아요</th>
                    <th className="px-4 py-2 font-medium">콘텐츠</th>
                    <th className="px-4 py-2 font-medium">인플</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.products.map((row) => {
                    const active =
                      focus?.kind === "product" &&
                      focus.productId === row.productId;
                    return (
                      <tr
                        key={row.productId}
                        className={`cursor-pointer border-t border-[var(--line)] ${
                          active
                            ? "bg-[var(--accent-soft)]"
                            : "hover:bg-[var(--accent-soft)]/40"
                        }`}
                        onClick={() =>
                          onFocus({ kind: "product", productId: row.productId })
                        }
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold">{row.productName}</p>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--accent-soft)]">
                            <div
                              className="h-full rounded-full bg-[var(--accent)]"
                              style={{
                                width: `${Math.max(8, (row.views / maxProductViews) * 100)}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatMetric(row.views)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatMetric(row.likes)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{row.posts}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {row.influencerCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <section className="min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
              <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3">
                <h2 className="text-sm font-semibold">최근 콘텐츠</h2>
              </header>
              <ul>
                {snapshot.posts.slice(0, 20).map((post) => {
                  const active = focus?.kind === "post" && focus.id === post.id;
                  return (
                    <li
                      key={post.id}
                      className={`cursor-pointer border-b border-[var(--line)] last:border-b-0 ${
                        active
                          ? "bg-[var(--accent-soft)]"
                          : "hover:bg-[var(--accent-soft)]/40"
                      }`}
                    >
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                        onClick={() => onFocus({ kind: "post", id: post.id })}
                      >
                        <span>
                          <span className="block text-sm font-semibold">
                            {post.productName}
                          </span>
                          <span className="mt-0.5 block text-xs text-[var(--muted)]">
                            {post.influencerName} · {post.influencerHandle} ·{" "}
                            {CREATOR_PLATFORM_LABEL[post.platform]}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-xs tabular-nums text-[var(--muted)]">
                          <span className="block font-semibold text-[var(--accent)]">
                            {formatMetric(post.views)} 조회
                          </span>
                          {formatMetric(post.likes)} 좋아요
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </div>

      <aside className="min-h-[50vh] min-w-0 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm lg:min-h-0">
        {selectedPost ? (
          <PostDetail
            post={selectedPost}
            onBack={() => onFocus(null)}
            onOpenAllocation={() =>
              onOpenAllocation({
                allocationId: selectedPost.allocationId,
                search: selectedPost.influencerHandle.replace(/^@/, ""),
              })
            }
          />
        ) : selectedProduct ? (
          <ProductDetail
            product={selectedProduct}
            posts={snapshot.posts.filter(
              (p) => p.productId === selectedProduct.productId,
            )}
            onBack={() => onFocus(null)}
            onOpenAllocation={() =>
              onOpenAllocation({ search: selectedProduct.productName })
            }
            onSelectPost={(id) => onFocus({ kind: "post", id })}
          />
        ) : selectedInfluencer ? (
          <InfluencerDetail
            influencer={selectedInfluencer}
            posts={snapshot.posts.filter(
              (p) => p.influencerId === selectedInfluencer.influencerId,
            )}
            onBack={() => onFocus(null)}
            onOpenAllocation={() =>
              onOpenAllocation({
                search: selectedInfluencer.handle.replace(/^@/, ""),
              })
            }
            onSelectPost={(id) => onFocus({ kind: "post", id })}
          />
        ) : (
          <InfluencerRank
            influencers={snapshot.influencers}
            onSelect={(influencerId) =>
              onFocus({ kind: "influencer", influencerId })
            }
          />
        )}
      </aside>
    </div>
  );
}

function AsideBack({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
    >
      ← 뒤로
    </button>
  );
}

function Kpi({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-4">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--accent)]">
        {value}
        {unit ? (
          <span className="ml-1 text-sm font-medium text-[var(--muted)]">
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function PostDetail({
  post,
  onBack,
  onOpenAllocation,
}: {
  post: ContentPostInsight;
  onBack: () => void;
  onOpenAllocation: () => void;
}) {
  const er = engagementRate(post.views, post.likes, post.comments);
  return (
    <div>
      <AsideBack onBack={onBack} />
      <p className="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
        Content
      </p>
      <h3 className="mt-1 text-xl font-bold text-[var(--ink)]">
        {post.productName}
      </h3>
      <p className="mt-1 text-sm text-[var(--accent)]">
        {post.influencerName} · {post.influencerHandle}
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">{post.caption}</p>
      <dl className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-[var(--accent-soft)]/50 px-3 py-4 text-center">
        <div>
          <dt className="text-[11px] text-[var(--muted)]">조회</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {formatMetric(post.views)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-[var(--muted)]">좋아요</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {formatMetric(post.likes)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-[var(--muted)]">댓글</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {formatMetric(post.comments)}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-[var(--muted)]">
        참여율 {er.toFixed(1)}% · {CREATOR_PLATFORM_LABEL[post.platform]} ·{" "}
        {post.storeName}
      </p>
      <div className="mt-5 flex flex-col gap-2">
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold !text-white"
        >
          콘텐츠 열기
        </a>
        <button
          type="button"
          onClick={onOpenAllocation}
          className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-medium"
        >
          배정에서 보기
        </button>
      </div>
    </div>
  );
}

function ProductDetail({
  product,
  posts,
  onBack,
  onOpenAllocation,
  onSelectPost,
}: {
  product: ContentProductInsight;
  posts: ContentPostInsight[];
  onBack: () => void;
  onOpenAllocation: () => void;
  onSelectPost: (id: string) => void;
}) {
  return (
    <div>
      <AsideBack onBack={onBack} />
      <p className="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
        Product
      </p>
      <h3 className="mt-1 text-xl font-bold text-[var(--ink)]">
        {product.productName}
      </h3>
      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-[var(--accent-soft)]/50 px-4 py-4">
        <div>
          <dt className="text-xs text-[var(--muted)]">조회수</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {formatMetric(product.views)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">좋아요</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {formatMetric(product.likes)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">콘텐츠</dt>
          <dd className="mt-1 font-semibold">{product.posts}건</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">인플루언서</dt>
          <dd className="mt-1 font-semibold">{product.influencerCount}명</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={onOpenAllocation}
        className="mt-4 w-full rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-medium"
      >
        이 상품 배정 보기
      </button>
      <ul className="mt-4 space-y-2">
        {posts.map((post) => (
          <li key={post.id}>
            <button
              type="button"
              onClick={() => onSelectPost(post.id)}
              className="w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-left text-sm"
            >
              <span className="block font-medium">{post.influencerName}</span>
              <span className="text-xs text-[var(--muted)]">
                {formatMetric(post.views)} 조회 · {formatMetric(post.likes)}{" "}
                좋아요
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfluencerDetail({
  influencer,
  posts,
  onBack,
  onOpenAllocation,
  onSelectPost,
}: {
  influencer: ContentInfluencerInsight;
  posts: ContentPostInsight[];
  onBack: () => void;
  onOpenAllocation: () => void;
  onSelectPost: (id: string) => void;
}) {
  return (
    <div>
      <AsideBack onBack={onBack} />
      <p className="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
        Influencer
      </p>
      <h3 className="mt-1 text-xl font-bold text-[var(--ink)]">
        {influencer.name}
      </h3>
      <p className="mt-1 text-[var(--accent)]">{influencer.handle}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-[var(--accent-soft)]/50 px-4 py-4">
        <div>
          <dt className="text-xs text-[var(--muted)]">조회수</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {formatMetric(influencer.views)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">좋아요</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {formatMetric(influencer.likes)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">콘텐츠</dt>
          <dd className="mt-1 font-semibold">{influencer.posts}건</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">상품</dt>
          <dd className="mt-1 text-sm">{influencer.productNames.join(", ")}</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={onOpenAllocation}
        className="mt-4 w-full rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-medium"
      >
        이 인플루언서 배정 보기
      </button>
      <ul className="mt-4 space-y-2">
        {posts.map((post) => (
          <li key={post.id}>
            <button
              type="button"
              onClick={() => onSelectPost(post.id)}
              className="w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-left text-sm"
            >
              <span className="block font-medium">{post.productName}</span>
              <span className="text-xs text-[var(--muted)]">
                {formatMetric(post.views)} 조회 · {formatMetric(post.likes)}{" "}
                좋아요
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfluencerRank({
  influencers,
  onSelect,
}: {
  influencers: ContentInfluencerInsight[];
  onSelect: (id: string) => void;
}) {
  if (influencers.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
        <p className="text-base font-medium text-[var(--ink)]">
          상품·콘텐츠를 선택하면 상세가 여기에 표시됩니다
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
        Ranking
      </p>
      <h3 className="mt-1 text-lg font-bold text-[var(--ink)]">
        인플루언서 성과
      </h3>
      <ul className="mt-4 space-y-2">
        {influencers.slice(0, 8).map((row, idx) => (
          <li key={row.influencerId}>
            <button
              type="button"
              onClick={() => onSelect(row.influencerId)}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--line)] px-3 py-2.5 text-left"
            >
              <span className="w-5 text-xs font-semibold text-[var(--muted)]">
                {idx + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {row.name}
                </span>
                <span className="text-xs text-[var(--muted)]">{row.handle}</span>
              </span>
              <span className="text-right text-xs tabular-nums text-[var(--muted)]">
                <span className="block font-semibold text-[var(--accent)]">
                  {formatMetric(row.views)}
                </span>
                조회
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
