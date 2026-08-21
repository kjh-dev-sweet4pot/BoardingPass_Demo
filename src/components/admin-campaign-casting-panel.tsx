"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Field,
  Notice,
  fieldClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/ui";
import { InfluencerAvatar } from "@/components/influencer-avatar";
import {
  type CastingStatus,
  type Company,
  type Product,
  type Store,
} from "@/lib/types";

type CampaignRow = {
  id: string;
  name: string | null;
  status: string;
  company_id: string;
  product_id: string;
  budget_amount?: number | null;
  spent_amount?: number;
  spend_pct?: number | null;
  created_at: string;
  companies?: { id: string; name: string } | null;
  products?: { id: string; name: string; sku?: string | null } | null;
};

type CastingRow = {
  id: string;
  campaign_id: string;
  company_id: string;
  status: CastingStatus;
  allocation_id: string | null;
  created_at: string;
  updated_at: string;
  campaigns?: { id: string; name: string | null; status: string } | null;
  companies?: { id: string; name: string } | null;
  influencers?: {
    id: string;
    name: string;
    instagram_handle: string;
    profile_image_path?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  allocations?: {
    id: string;
    visit_date: string | null;
    target_content_count: number | null;
    allocation_pricing?: {
      display_price: number | null;
      cost_amount?: number | null;
    } | null;
  } | null;
};

type NegotiationLogRow = {
  id: string;
  proposed_amount: number | null;
  memo: string | null;
  proposer: string;
  operator_label: string | null;
  created_at: string;
};

const CASTING_FILTERS: { id: CastingStatus | ""; label: string }[] = [
  { id: "", label: "전체" },
  { id: "Pending", label: "Pending" },
  { id: "Nego", label: "Nego" },
  { id: "Accept", label: "Accept" },
  { id: "결렬", label: "결렬" },
];

function fmtKrw(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toLocaleString("ko-KR")}원`;
}

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export function AdminCampaignCastingPanel({
  companies,
  products,
  stores,
  isManager,
  staleCastings = false,
}: {
  companies: Company[];
  products: Product[];
  stores: Store[];
  isManager: boolean;
  staleCastings?: boolean;
}) {
  const [tab, setTab] = useState<"campaigns" | "castings">(
    staleCastings ? "castings" : "campaigns",
  );
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [castings, setCastings] = useState<CastingRow[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedCastingId, setSelectedCastingId] = useState<string | null>(null);
  const [castingFilter, setCastingFilter] = useState<CastingStatus | "">(
    staleCastings ? "Pending" : "",
  );
  const [logs, setLogs] = useState<NegotiationLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [createCompanyId, setCreateCompanyId] = useState("");
  const [createProductId, setCreateProductId] = useState("");
  const [createName, setCreateName] = useState("");
  const [createBudget, setCreateBudget] = useState("");

  const [addHandle, setAddHandle] = useState("");
  const [addName, setAddName] = useState("");
  const [addSnsUrl, setAddSnsUrl] = useState("");
  const [addCampaignId, setAddCampaignId] = useState("");

  const [logAmount, setLogAmount] = useState("");
  const [logMemo, setLogMemo] = useState("");

  const [acceptForm, setAcceptForm] = useState({
    display_price: "",
    cost_amount: "",
    target_content_count: "1",
    phone: "",
    email: "",
    store_id: stores[0]?.id ?? "",
    visit_date: "",
  });

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  const selectedCasting = useMemo(
    () => castings.find((c) => c.id === selectedCastingId) ?? null,
    [castings, selectedCastingId],
  );

  const loadCampaigns = useCallback(async () => {
    const res = await fetch("/api/admin/campaigns");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "캠페인 조회 실패");
    setCampaigns(json.campaigns ?? []);
  }, []);

  const loadCastings = useCallback(async () => {
    const qs = new URLSearchParams();
    if (castingFilter) qs.set("status", castingFilter);
    if (staleCastings) qs.set("stale_days", "7");
    if (selectedCampaignId && tab === "castings") {
      qs.set("campaign_id", selectedCampaignId);
    }
    const res = await fetch(`/api/admin/castings?${qs}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "섭외 조회 실패");
    setCastings(json.castings ?? []);
  }, [castingFilter, selectedCampaignId, tab, staleCastings]);

  const loadLogs = useCallback(async (castingId: string) => {
    const res = await fetch(`/api/admin/castings/${castingId}/negotiation-logs`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "협상 이력 조회 실패");
    setLogs(json.logs ?? []);
  }, []);

  useEffect(() => {
    if (!staleCastings) return;
    setTab("castings");
    setCastingFilter("Pending");
  }, [staleCastings]);

  useEffect(() => {
    loadCampaigns().catch((e) => setError(e.message));
  }, [loadCampaigns]);

  useEffect(() => {
    loadCastings().catch((e) => setError(e.message));
  }, [loadCastings]);

  useEffect(() => {
    if (!selectedCastingId) {
      setLogs([]);
      return;
    }
    loadLogs(selectedCastingId).catch((e) => setError(e.message));
  }, [selectedCastingId, loadLogs]);

  useEffect(() => {
    if (!selectedCasting) return;
    setAcceptForm((prev) => ({
      ...prev,
      phone: selectedCasting.influencers?.phone ?? prev.phone,
      email: selectedCasting.influencers?.email ?? prev.email,
      store_id: prev.store_id || stores[0]?.id || "",
    }));
  }, [selectedCasting, stores]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청 실패");
    } finally {
      setBusy(false);
    }
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: createCompanyId,
          product_id: createProductId,
          name: createName || null,
          budget_amount: createBudget ? Number(createBudget) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "캠페인 생성 실패");
      setMessage("캠페인을 생성했습니다.");
      setCreateName("");
      setCreateBudget("");
      await loadCampaigns();
      if (json.campaign?.id) setSelectedCampaignId(json.campaign.id);
    });
  }

  async function addCasting(e: React.FormEvent) {
    e.preventDefault();
    const campaign_id = addCampaignId || selectedCampaignId;
    if (!campaign_id) {
      setError("섭외를 추가할 캠페인을 선택하세요.");
      return;
    }
    await run(async () => {
      const res = await fetch("/api/admin/castings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id,
          handle: addHandle,
          name: addName || null,
          sns_url: addSnsUrl || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "섭외 추가 실패");
      setMessage("섭외를 추가했습니다. 협상 금액을 입력하세요.");
      setAddHandle("");
      setAddName("");
      setAddSnsUrl("");
      setTab("castings");
      setSelectedCampaignId(campaign_id);
      await loadCastings();
      if (json.casting?.id) setSelectedCastingId(json.casting.id);
    });
  }

  async function patchCampaignStatus(status: "보류" | "취소") {
    if (!selectedCampaignId) return;
    await run(async () => {
      const res = await fetch(`/api/admin/campaigns/${selectedCampaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "상태 변경 실패");
      setMessage(`캠페인을 ${status}(으)로 지정했습니다.`);
      await loadCampaigns();
    });
  }

  async function patchCasting(body: Record<string, unknown>) {
    if (!selectedCastingId) return;
    await run(async () => {
      const res = await fetch(`/api/admin/castings/${selectedCastingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "섭외 처리 실패");
      setMessage("섭외 상태를 변경했습니다.");
      await loadCastings();
      await loadCampaigns();
      if (json.casting?.id) {
        setSelectedCastingId(json.casting.id);
      }
    });
  }

  async function addNegotiationLog(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCastingId) return;
    await run(async () => {
      const res = await fetch(
        `/api/admin/castings/${selectedCastingId}/negotiation-logs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proposed_amount: logAmount ? Number(logAmount) : null,
            memo: logMemo || null,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "협상 이력 저장 실패");
      setLogAmount("");
      setLogMemo("");
      setMessage("협상 이력을 기록했습니다.");
      await loadLogs(selectedCastingId);
    });
  }

  async function acceptCasting(e: React.FormEvent) {
    e.preventDefault();
    await patchCasting({
      action: "accept",
      display_price: Number(acceptForm.display_price),
      cost_amount: Number(acceptForm.cost_amount),
      target_content_count: Number(acceptForm.target_content_count),
      phone: acceptForm.phone,
      email: acceptForm.email,
      store_id: acceptForm.store_id,
      visit_date: acceptForm.visit_date,
    });
  }

  const activeCompanies = companies.filter((c) => c.is_active);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Notice error={error ?? undefined} message={message ?? undefined} />

      <div
        className="inline-flex w-fit rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5"
        role="tablist"
      >
        {(
          [
            { id: "campaigns", label: "캠페인" },
            { id: "castings", label: "섭외" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              tab === item.id
                ? "bg-[var(--accent)] font-semibold text-[var(--surface)]"
                : "text-[var(--muted)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {staleCastings && tab === "castings" ? (
        <p className="text-xs text-[var(--muted)]">
          대시보드 · 섭외 정체 (Pending 7일 이상)
        </p>
      ) : null}

      {tab === "campaigns" ? (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="owm-panel flex min-h-[420px] flex-col border border-[var(--line)] bg-[var(--surface)] shadow-sm">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <h2
                className="text-lg text-[var(--ink)]"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                캠페인 목록
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--surface)] text-left text-xs text-[var(--muted)]">
                  <tr>
                    <th className="px-5 py-2 font-medium">캠페인</th>
                    <th className="px-3 py-2 font-medium">회원사</th>
                    <th className="px-3 py-2 font-medium">상품</th>
                    <th className="px-3 py-2 font-medium">예산</th>
                    <th className="px-3 py-2 font-medium">집행%</th>
                    <th className="px-3 py-2 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCampaignId(c.id)}
                      className={`cursor-pointer border-t border-[var(--line)] ${
                        selectedCampaignId === c.id ? "bg-[var(--surface-hover)]" : ""
                      }`}
                    >
                      <td className="px-5 py-3">{c.name || "(이름 없음)"}</td>
                      <td className="px-3 py-3">{c.companies?.name ?? "—"}</td>
                      <td className="px-3 py-3">{c.products?.name ?? "—"}</td>
                      <td className="px-3 py-3 tabular-nums">{fmtKrw(c.budget_amount)}</td>
                      <td className="px-3 py-3 tabular-nums">
                        {c.spend_pct != null ? `${c.spend_pct}%` : "—"}
                      </td>
                      <td className="px-3 py-3">{c.status}</td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-[var(--muted)]">
                        등록된 캠페인이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            {isManager ? (
              <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
                <h3 className="text-base font-semibold text-[var(--ink)]">캠페인 생성</h3>
                <form onSubmit={createCampaign} className="mt-3 grid gap-3">
                  <Field label="회원사">
                    <select
                      className={fieldClass}
                      value={createCompanyId}
                      onChange={(e) => setCreateCompanyId(e.target.value)}
                      required
                    >
                      <option value="">선택</option>
                      {activeCompanies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="상품">
                    <select
                      className={fieldClass}
                      value={createProductId}
                      onChange={(e) => setCreateProductId(e.target.value)}
                      required
                    >
                      <option value="">선택</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="캠페인명 (선택)">
                    <input
                      className={fieldClass}
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="예: 2026 가을 런칭"
                    />
                  </Field>
                  <Field label="예산 (원)">
                    <input
                      className={fieldClass}
                      type="number"
                      min={0}
                      value={createBudget}
                      onChange={(e) => setCreateBudget(e.target.value)}
                      placeholder="노출가 기준 예산"
                    />
                  </Field>
                  <button className={primaryBtnClass} type="submit" disabled={busy}>
                    생성
                  </button>
                </form>
              </section>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                캠페인 생성·보류·취소는 운영관리자만 가능합니다.
              </p>
            )}

            {selectedCampaign ? (
              <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
                <h3 className="text-base font-semibold text-[var(--ink)]">캠페인 상세</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-[var(--muted)]">이름</dt>
                    <dd>{selectedCampaign.name || "(이름 없음)"}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">상태</dt>
                    <dd>{selectedCampaign.status}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">회원사</dt>
                    <dd>{selectedCampaign.companies?.name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">상품</dt>
                    <dd>{selectedCampaign.products?.name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">예산</dt>
                    <dd className="tabular-nums">{fmtKrw(selectedCampaign.budget_amount)}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">집행 (노출가 합)</dt>
                    <dd className="tabular-nums">
                      {fmtKrw(selectedCampaign.spent_amount ?? 0)}
                      {selectedCampaign.spend_pct != null
                        ? ` · ${selectedCampaign.spend_pct}%`
                        : ""}
                    </dd>
                  </div>
                </dl>
                {isManager && selectedCampaign.status !== "보류" && selectedCampaign.status !== "취소" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={secondaryBtnClass}
                      disabled={busy}
                      onClick={() => patchCampaignStatus("보류")}
                    >
                      보류
                    </button>
                    <button
                      type="button"
                      className={secondaryBtnClass}
                      disabled={busy}
                      onClick={() => patchCampaignStatus("취소")}
                    >
                      취소
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className={`${secondaryBtnClass} mt-4 w-full`}
                  onClick={() => {
                    setTab("castings");
                    setSelectedCampaignId(selectedCampaign.id);
                    setAddCampaignId(selectedCampaign.id);
                  }}
                >
                  이 캠페인 섭외 보기·추가
                </button>
              </section>
            ) : null}
          </aside>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="owm-panel flex min-h-[420px] flex-col border border-[var(--line)] bg-[var(--surface)] shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
              <h2
                className="text-lg text-[var(--ink)]"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                섭외 목록
              </h2>
              <div className="flex flex-wrap gap-1">
                {CASTING_FILTERS.map((f) => (
                  <button
                    key={f.id || "all"}
                    type="button"
                    onClick={() => setCastingFilter(f.id)}
                    className={`rounded-full px-3 py-1 text-xs ${
                      castingFilter === f.id
                        ? "bg-[var(--accent)] text-[var(--surface)]"
                        : "border border-[var(--line)] text-[var(--muted)]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--surface)] text-left text-xs text-[var(--muted)]">
                  <tr>
                    <th className="px-5 py-2 font-medium">인플루언서</th>
                    <th className="px-3 py-2 font-medium">캠페인</th>
                    <th className="px-3 py-2 font-medium">회원사</th>
                    <th className="px-3 py-2 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {castings.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCastingId(c.id)}
                      className={`cursor-pointer border-t border-[var(--line)] ${
                        selectedCastingId === c.id ? "bg-[var(--surface-hover)]" : ""
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          {c.influencers?.id ? (
                            <InfluencerAvatar
                              influencerId={c.influencers.id}
                              name={c.influencers.name}
                              size="thumb"
                            />
                          ) : null}
                          <div className="min-w-0">
                            {c.influencers?.name ?? "—"}
                            <span className="ml-1 text-xs text-[var(--muted)]">
                              @{c.influencers?.instagram_handle}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">{c.campaigns?.name || "(이름 없음)"}</td>
                      <td className="px-3 py-3">{c.companies?.name ?? "—"}</td>
                      <td className="px-3 py-3">{c.status}</td>
                    </tr>
                  ))}
                  {castings.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-[var(--muted)]">
                        조건에 맞는 섭외가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            {isManager ? (
              <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
                <h3 className="text-base font-semibold text-[var(--ink)]">섭외 추가</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
                  인플루언서를 캠페인에 등록한 뒤, 협상 이력으로 금액을 남깁니다.
                </p>
                <form onSubmit={addCasting} className="mt-3 grid gap-3">
                  <Field label="캠페인">
                    <select
                      className={fieldClass}
                      required
                      value={addCampaignId || selectedCampaignId || ""}
                      onChange={(e) => {
                        setAddCampaignId(e.target.value);
                        setSelectedCampaignId(e.target.value || null);
                      }}
                    >
                      <option value="">선택</option>
                      {campaigns
                        .filter((c) => c.status !== "취소" && c.status !== "보류")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {(c.name || c.products?.name || "캠페인") +
                              ` · ${c.companies?.name ?? ""}`}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="SNS 핸들">
                    <input
                      className={fieldClass}
                      required
                      value={addHandle}
                      onChange={(e) => setAddHandle(e.target.value)}
                      placeholder="@username"
                    />
                  </Field>
                  <Field label="이름 (선택)">
                    <input
                      className={fieldClass}
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      placeholder="표시 이름"
                    />
                  </Field>
                  <Field label="프로필 URL (선택)">
                    <input
                      className={fieldClass}
                      value={addSnsUrl}
                      onChange={(e) => setAddSnsUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </Field>
                  <button className={primaryBtnClass} type="submit" disabled={busy}>
                    섭외 추가
                  </button>
                </form>
              </section>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                섭외 추가는 운영관리자만 가능합니다.
              </p>
            )}

            {selectedCasting ? (
              <>
                <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-[var(--ink)]">섭외 상세</h3>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div>
                      <dt className="text-[var(--muted)]">인플루언서</dt>
                      <dd className="flex items-center gap-2.5">
                        {selectedCasting.influencers?.id ? (
                          <InfluencerAvatar
                            influencerId={selectedCasting.influencers.id}
                            name={selectedCasting.influencers.name}
                            size="md"
                          />
                        ) : null}
                        <span>
                          {selectedCasting.influencers?.name} (@
                          {selectedCasting.influencers?.instagram_handle})
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted)]">상태</dt>
                      <dd>{selectedCasting.status}</dd>
                    </div>
                    {selectedCasting.status === "Accept" && selectedCasting.allocations ? (
                      <>
                        <div>
                          <dt className="text-[var(--muted)]">배정 ID</dt>
                          <dd className="font-mono text-xs">{selectedCasting.allocations.id}</dd>
                        </div>
                        <div>
                          <dt className="text-[var(--muted)]">노출가</dt>
                          <dd>
                            {fmtKrw(
                              selectedCasting.allocations.allocation_pricing?.display_price,
                            )}
                          </dd>
                        </div>
                        {isManager ? (
                          <div>
                            <dt className="text-[var(--muted)]">원가</dt>
                            <dd>
                              {fmtKrw(
                                selectedCasting.allocations.allocation_pricing?.cost_amount,
                              )}
                            </dd>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedCasting.status === "Pending" ? (
                      <button
                        type="button"
                        className={primaryBtnClass}
                        disabled={busy}
                        onClick={() => patchCasting({ action: "start_nego" })}
                      >
                        협의 개시
                      </button>
                    ) : null}
                    {selectedCasting.status === "Pending" || selectedCasting.status === "Nego" ? (
                      <button
                        type="button"
                        className={secondaryBtnClass}
                        disabled={busy}
                        onClick={() => patchCasting({ action: "reject" })}
                      >
                        협상 결렬
                      </button>
                    ) : null}
                  </div>
                </section>

                {selectedCasting.status === "Nego" && isManager ? (
                  <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
                    <h3 className="text-base font-semibold text-[var(--ink)]">섭외 확정</h3>
                    <form onSubmit={acceptCasting} className="mt-3 grid gap-3">
                      <Field label="노출가 (원)">
                        <input
                          className={fieldClass}
                          type="number"
                          min={0}
                          required
                          value={acceptForm.display_price}
                          onChange={(e) =>
                            setAcceptForm((f) => ({ ...f, display_price: e.target.value }))
                          }
                        />
                      </Field>
                      <Field label="원가 (원)">
                        <input
                          className={fieldClass}
                          type="number"
                          min={0}
                          required
                          value={acceptForm.cost_amount}
                          onChange={(e) =>
                            setAcceptForm((f) => ({ ...f, cost_amount: e.target.value }))
                          }
                        />
                      </Field>
                      <Field label="목표 콘텐츠 수">
                        <input
                          className={fieldClass}
                          type="number"
                          min={1}
                          required
                          value={acceptForm.target_content_count}
                          onChange={(e) =>
                            setAcceptForm((f) => ({
                              ...f,
                              target_content_count: e.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="전화">
                        <input
                          className={fieldClass}
                          required
                          value={acceptForm.phone}
                          onChange={(e) =>
                            setAcceptForm((f) => ({ ...f, phone: e.target.value }))
                          }
                        />
                      </Field>
                      <Field label="이메일">
                        <input
                          className={fieldClass}
                          type="email"
                          required
                          value={acceptForm.email}
                          onChange={(e) =>
                            setAcceptForm((f) => ({ ...f, email: e.target.value }))
                          }
                        />
                      </Field>
                      <Field label="방문 지점">
                        <select
                          className={fieldClass}
                          required
                          value={acceptForm.store_id}
                          onChange={(e) =>
                            setAcceptForm((f) => ({ ...f, store_id: e.target.value }))
                          }
                        >
                          <option value="">선택</option>
                          {stores.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="방문 예정일">
                        <input
                          className={fieldClass}
                          type="date"
                          required
                          value={acceptForm.visit_date}
                          onChange={(e) =>
                            setAcceptForm((f) => ({ ...f, visit_date: e.target.value }))
                          }
                        />
                      </Field>
                      <button className={primaryBtnClass} type="submit" disabled={busy}>
                        섭외 확정 (배정 생성)
                      </button>
                    </form>
                  </section>
                ) : selectedCasting.status === "Nego" && !isManager ? (
                  <p className="text-sm text-[var(--muted)]">
                    섭외 확정은 운영관리자만 가능합니다.
                  </p>
                ) : null}

                <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-[var(--ink)]">협상 이력</h3>
                  <form onSubmit={addNegotiationLog} className="mt-3 grid gap-3">
                    <Field label="제안 금액 (선택)">
                      <input
                        className={fieldClass}
                        type="number"
                        min={0}
                        value={logAmount}
                        onChange={(e) => setLogAmount(e.target.value)}
                      />
                    </Field>
                    <Field label="협의 메모">
                      <textarea
                        className={fieldClass}
                        rows={3}
                        value={logMemo}
                        onChange={(e) => setLogMemo(e.target.value)}
                      />
                    </Field>
                    <button className={secondaryBtnClass} type="submit" disabled={busy}>
                      이력 기록
                    </button>
                  </form>
                  <ul className="mt-4 space-y-3">
                    {logs.map((log) => (
                      <li
                        key={log.id}
                        className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                      >
                        <p className="text-xs text-[var(--muted)]">
                          {fmtDt(log.created_at)} · {log.proposer === "operator" ? "운영" : "회원사"}
                          {log.operator_label ? ` · ${log.operator_label}` : ""}
                        </p>
                        {log.proposed_amount != null ? (
                          <p>제안 {fmtKrw(log.proposed_amount)}</p>
                        ) : null}
                        {log.memo ? <p className="text-[var(--muted)]">{log.memo}</p> : null}
                      </li>
                    ))}
                    {logs.length === 0 ? (
                      <li className="text-sm text-[var(--muted)]">협상 이력이 없습니다.</li>
                    ) : null}
                  </ul>
                </section>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">섭외를 선택하세요.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
