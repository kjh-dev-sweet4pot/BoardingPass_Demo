"use client";

import { useEffect, useMemo, useState } from "react";
import { secondaryBtnClass } from "@/components/ui";
import { formatManwon, parseManwon } from "@/lib/company-budget-rounds";
import type { ContentType, Influencer, Platform } from "@/lib/types";

const CONTENT_TYPES: ContentType[] = ["carousel", "visit", "seeding"];
const PLATFORMS: Platform[] = ["instagram", "tiktok", "youtube", "naver_blog", "etc"];

type RateCard = {
  id: string;
  influencer_id: string;
  content_type: ContentType;
  platform: Platform;
  standard_cost: number;
  source: "invoice" | "manual";
  effective_from: string;
  memo: string | null;
};

export function AdminMarginRateCardPanel() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [q, setQ] = useState("");
  const [influencerId, setInfluencerId] = useState("");
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contentType, setContentType] = useState<ContentType>("carousel");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [costManwon, setCostManwon] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);

  const filteredInfluencers = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return influencers.slice(0, 30);
    return influencers
      .filter(
        (i) =>
          i.name.toLowerCase().includes(term) ||
          i.instagram_handle.toLowerCase().includes(term),
      )
      .slice(0, 30);
  }, [influencers, q]);

  const selected = influencers.find((i) => i.id === influencerId) || null;

  useEffect(() => {
    fetch("/api/admin/influencers")
      .then((res) => res.json())
      .then((data) => setInfluencers(data.influencers || []))
      .catch(() => {});
  }, []);

  async function load() {
    if (!influencerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/margin/rate-cards?influencer_id=${influencerId}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [influencerId]);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const cost = parseManwon(costManwon);
      const res = await fetch("/api/admin/margin/rate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          influencer_id: influencerId,
          content_type: contentType,
          platform,
          standard_cost: cost ?? 0,
          memo,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
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
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4 sm:p-7">
      <div className="flex w-64 shrink-0 flex-col gap-2 overflow-hidden">
        <input
          className="h-10 rounded-[6px] border border-[var(--line)] px-3 text-sm"
          placeholder="이름·핸들 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="min-h-0 flex-1 overflow-auto rounded-[8px] border border-[var(--line)]">
          {filteredInfluencers.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => setInfluencerId(i.id)}
              className={`block w-full border-b border-[var(--line)] px-3 py-2 text-left text-sm last:border-0 hover:bg-[var(--surface-hover)] ${
                influencerId === i.id ? "bg-[var(--surface-hover)] font-semibold" : ""
              }`}
            >
              {i.name} <span className="text-xs text-[var(--muted)]">@{i.instagram_handle}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {!selected ? (
          <p className="text-sm text-[var(--muted)]">왼쪽에서 인플루언서를 선택하세요.</p>
        ) : (
          <>
            <h3 className="text-base font-semibold">{selected.name} 레이트카드</h3>
            <div className="flex flex-wrap items-end gap-2">
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
              <table className="w-full text-sm">
                <thead className="text-left text-[var(--muted)]">
                  <tr className="border-b border-[var(--line)]">
                    <th className="px-2 py-2">콘텐츠</th>
                    <th className="px-2 py-2">플랫폼</th>
                    <th className="px-2 py-2 text-right">표준 단가</th>
                    <th className="px-2 py-2">출처</th>
                    <th className="px-2 py-2">적용일</th>
                    <th className="px-2 py-2">메모</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rateCards.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-2 py-2">{r.content_type}</td>
                      <td className="px-2 py-2">{r.platform}</td>
                      <td className="px-2 py-2 text-right">{formatManwon(r.standard_cost)}</td>
                      <td className="px-2 py-2">{r.source === "invoice" ? "인보이스" : "수기"}</td>
                      <td className="px-2 py-2">{r.effective_from}</td>
                      <td className="px-2 py-2">{r.memo || "—"}</td>
                      <td className="px-2 py-2 text-right">
                        <button type="button" className="text-xs text-red-600" onClick={() => remove(r.id)}>
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
