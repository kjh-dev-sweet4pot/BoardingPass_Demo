"use client";

import { useEffect, useState } from "react";
import { StateBadge } from "@/components/state-badge";
import { ProgressCount } from "@/components/progress-count";
import { EmptyState } from "@/components/empty-state";

type CreatorLink = {
  id: string;
  status: string;
  link_url: string | null;
  submitted_at: string | null;
  verification_failed: boolean | null;
};

type Allocation = {
  id: string;
  status: string;
  target_content_count: number | null;
  influencer_id: string;
  influencers: { id: string; name: string; instagram_handle_normalized?: string; instagram_handle?: string } | null;
  creator_links: CreatorLink[];
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  allocations: Allocation[];
};

function handle(alloc: Allocation) {
  const raw = alloc.influencers?.instagram_handle_normalized || alloc.influencers?.instagram_handle || "";
  const n = raw.replace(/^@+/, "").trim();
  return n ? `@${n}` : alloc.influencers?.name || "—";
}

function publishedCount(links: CreatorLink[]) {
  return links.filter((l) => l.status === "발행완료").length;
}
function submittedLinks(links: CreatorLink[]) {
  return links.filter((l) => l.status === "제출");
}

export function CompanyProgressTab({ companyId }: { companyId: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCampaignId, setOpenCampaignId] = useState<string | null>(null);
  const [openAllocId, setOpenAllocId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/com/campaigns")
      .then((r) => r.json())
      .then((data) => { setCampaigns(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId]);

  if (loading) return <div className="py-16 text-center text-sm text-[var(--muted)]">불러오는 중…</div>;

  if (campaigns.length === 0) {
    return <EmptyState positive title="진행 중인 캠페인이 없습니다" message="운영팀이 캠페인을 개설하면 여기에 표시됩니다." />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
      {campaigns.map((campaign) => {
        const isOpen = openCampaignId === campaign.id;
        const allocs = campaign.allocations ?? [];
        const totalPublished = allocs.reduce((s, a) => s + publishedCount(a.creator_links ?? []), 0);
        const totalTarget = allocs.reduce((s, a) => s + (a.target_content_count ?? 0), 0);

        return (
          <div key={campaign.id} className="rounded-2xl border border-[var(--line)] bg-white overflow-hidden">
            {/* 캠페인 행 */}
            <button
              type="button"
              className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-[var(--surface)]"
              onClick={() => setOpenCampaignId(isOpen ? null : campaign.id)}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-[var(--ink)] truncate">{campaign.name}</span>
                {allocs.length > 0 && (
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    배정 {allocs.length}건
                    {totalTarget > 0 ? ` · ` : ""}
                    {totalTarget > 0 && <ProgressCount current={totalPublished} total={totalTarget} label="발행" />}
                  </span>
                )}
              </span>
              <StateBadge value={campaign.status as any} />
              <span className="text-xs text-[var(--muted)]">{isOpen ? "▲" : "▼"}</span>
            </button>

            {/* 배정 목록 */}
            {isOpen && (
              <div className="border-t border-[var(--line)]">
                {allocs.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-[var(--muted)]">
                    아직 배정된 인플루언서가 없습니다. 섭외 확정 후 배정이 생성됩니다.
                  </p>
                ) : (
                  allocs.map((alloc) => {
                    const links = alloc.creator_links ?? [];
                    const target = alloc.target_content_count ?? 0;
                    const pubCount = publishedCount(links);
                    const submitted = submittedLinks(links);
                    const allocOpen = openAllocId === alloc.id;

                    return (
                      <div key={alloc.id} className="border-b border-[var(--line)] last:border-b-0">
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-[var(--surface)]"
                          onClick={() => setOpenAllocId(allocOpen ? null : alloc.id)}
                        >
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-[var(--ink)] truncate">{handle(alloc)}</span>
                            {target > 0 && (
                              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                                <ProgressCount current={pubCount} total={target} label="발행" />
                              </span>
                            )}
                          </span>
                          <StateBadge value={alloc.status as any} />
                          {submitted.length > 0 && (
                            <span className="rounded-full bg-[var(--badge-warn-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--badge-warn-fg)]">
                              검토 대기 {submitted.length}
                            </span>
                          )}
                          <span className="text-xs text-[var(--muted)]">{allocOpen ? "▲" : "▼"}</span>
                        </button>

                        {/* 제출된 콘텐츠 — 의견 등록 */}
                        {allocOpen && submitted.length > 0 && (
                          <div className="bg-[var(--surface)] px-5 pb-4 pt-3 space-y-3">
                            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">검토 대기 콘텐츠</p>
                            {submitted.map((link) => (
                              <FeedbackForm key={link.id} link={link} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FeedbackForm({ link }: { link: CreatorLink }) {
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!comment.trim() || loading) return;
    setLoading(true);
    const res = await fetch("/api/com/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creator_link_id: link.id, comment }),
    });
    setLoading(false);
    if (res.ok) { setSent(true); setComment(""); }
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--ink)]">
          {link.link_url ? (
            <a href={link.link_url} target="_blank" rel="noopener noreferrer" className="underline text-[var(--accent)]">
              콘텐츠 링크
            </a>
          ) : "콘텐츠 링크 없음"}
        </span>
        <StateBadge value="제출" />
        {link.verification_failed && <StateBadge value="실패" />}
      </div>
      {sent ? (
        <p className="text-xs text-[var(--muted)]">의견이 제출되었습니다.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <textarea
              className="flex-1 rounded-xl border border-[var(--line)] px-3 py-2 text-sm resize-none"
              rows={2}
              placeholder="검토 의견을 입력하세요"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button
              type="button"
              disabled={!comment.trim() || loading}
              onClick={submit}
              className="h-10 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold !text-white disabled:opacity-40 shrink-0"
            >
              제출
            </button>
          </div>
          <p className="text-[11px] text-[var(--muted)]">검수 결정은 운영자가 수행합니다.</p>
        </div>
      )}
    </div>
  );
}
