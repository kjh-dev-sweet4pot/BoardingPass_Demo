"use client";

import { useEffect, useMemo, useState } from "react";
import { secondaryBtnClass } from "@/components/ui";
import { SpreadsheetTable, type SpreadsheetColumn } from "@/components/spreadsheet-table";
import { formatManwon, parseManwon } from "@/lib/company-budget-rounds";
import type { ContentType, Influencer, Platform } from "@/lib/types";

const CONTENT_TYPES: ContentType[] = ["carousel", "visit", "seeding"];
const PLATFORMS: Platform[] = ["instagram", "tiktok", "youtube", "naver_blog", "etc"];

type RateCard = {
  id: string;
  influencer_id: string;
  /** 실측 집계 행(§computedRateCards)은 콘텐츠 유형을 알 수 없어 null */
  content_type: ContentType | null;
  platform: Platform;
  standard_cost: number;
  source: "invoice" | "manual";
  effective_from: string;
  memo: string | null;
};

function buildRateCardColumns(
  influencerLabel: (id: string) => string,
  onRemove: (id: string) => void,
): SpreadsheetColumn<RateCard>[] {
  return [
    { key: "influencer", label: "인플루언서", width: 160, render: (r) => influencerLabel(r.influencer_id) },
    { key: "content_type", label: "콘텐츠", width: 100, render: (r) => r.content_type || "—" },
    { key: "platform", label: "플랫폼", width: 100, render: (r) => r.platform },
    {
      key: "standard_cost",
      label: "표준 단가",
      width: 110,
      align: "right",
      render: (r) => formatManwon(r.standard_cost),
    },
    { key: "source", label: "출처", width: 80, render: (r) => (r.source === "invoice" ? "인보이스" : "수기") },
    { key: "effective_from", label: "적용일", width: 100, render: (r) => r.effective_from },
    { key: "memo", label: "메모", width: 220, render: (r) => r.memo || "—" },
    {
      key: "actions",
      label: "",
      width: 70,
      align: "right",
      render: (r) =>
        r.id.startsWith("computed:") ? null : (
          <button
            type="button"
            className="text-xs text-red-600"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(r.id);
            }}
          >
            삭제
          </button>
        ),
    },
  ];
}

function influencerOptionLabel(i: Influencer) {
  return `${i.name} (@${i.instagram_handle})`;
}

export function AdminMarginRateCardPanel() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [influencerPick, setInfluencerPick] = useState("");
  const [contentType, setContentType] = useState<ContentType>("carousel");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [costManwon, setCostManwon] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);

  const influencerById = useMemo(() => new Map(influencers.map((i) => [i.id, i])), [influencers]);
  const influencerLabel = (id: string) => {
    const i = influencerById.get(id);
    return i ? influencerOptionLabel(i) : id;
  };

  useEffect(() => {
    fetch("/api/admin/influencers")
      .then((res) => res.json())
      .then((data) => setInfluencers(data.influencers || []))
      .catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/margin/rate-cards");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRateCards(data.rateCards || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    const picked = influencers.find((i) => influencerOptionLabel(i) === influencerPick);
    if (!picked) {
      setError("목록에 있는 인플루언서를 선택하세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const cost = parseManwon(costManwon);
      const res = await fetch("/api/admin/margin/rate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          influencer_id: picked.id,
          content_type: contentType,
          platform,
          standard_cost: cost ?? 0,
          memo,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInfluencerPick("");
      setCostManwon("");
      setMemo("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/margin/rate-cards?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 sm:p-7">
      <h3 className="text-base font-semibold">레이트카드</h3>
      <div className="flex flex-wrap items-end gap-2">
        <input
          className="h-10 w-56 rounded-[6px] border border-[var(--line)] px-2 text-sm"
          list="rate-card-influencers"
          placeholder="인플루언서 이름·핸들"
          value={influencerPick}
          onChange={(e) => setInfluencerPick(e.target.value)}
        />
        <datalist id="rate-card-influencers">
          {influencers.map((i) => (
            <option key={i.id} value={influencerOptionLabel(i)} />
          ))}
        </datalist>
        <select
          className="h-10 rounded-[6px] border border-[var(--line)] px-2 text-sm"
          value={contentType}
          onChange={(e) => setContentType(e.target.value as ContentType)}
        >
          {CONTENT_TYPES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-[6px] border border-[var(--line)] px-2 text-sm"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          className="h-10 w-28 rounded-[6px] border border-[var(--line)] px-2 text-sm"
          placeholder="단가(만원)"
          value={costManwon}
          onChange={(e) => setCostManwon(e.target.value)}
        />
        <input
          className="h-10 w-40 rounded-[6px] border border-[var(--line)] px-2 text-sm"
          placeholder="메모"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
        <button type="button" className={secondaryBtnClass} disabled={busy} onClick={add}>
          추가
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <SpreadsheetTable
            storageKey="admin-margin-rate-card"
            columns={buildRateCardColumns(influencerLabel, remove)}
            rows={rateCards}
            rowKey={(r) => r.id}
            rowLabel={(r) => `${influencerLabel(r.influencer_id)} · ${r.platform}`}
            emptyText="등록된 레이트카드가 없습니다."
          />
        </div>
      )}
    </div>
  );
}
