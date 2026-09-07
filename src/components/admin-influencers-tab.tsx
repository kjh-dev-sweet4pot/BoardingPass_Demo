"use client";

import { useEffect, useMemo, useState } from "react";
import { createManualAllocation } from "@/app/actions/admin";
import { AdminAllocSchedule } from "@/components/admin-alloc-schedule";
import { AdminImportPanel } from "@/components/admin-import-panel";
import { AdminReviewQueue, type AdminReviewTab } from "@/components/admin-review-queue";
import { InfluencerAvatar } from "@/components/influencer-avatar";
import { Field, fieldClass, primaryBtnClass, secondaryBtnClass } from "@/components/ui";
import { type AllocationWithRelations, type Company, type Influencer, type Product, type Store } from "@/lib/types";

export type InfluencersSub =
  | "influencersRegister"
  | "influencersReview"
  | "influencersAlloc";

function InfluencerRegister({
  isManager,
  companies,
}: {
  isManager: boolean;
  companies: Company[];
}) {
  const [list, setList] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [snsUrl, setSnsUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [region, setRegion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarBump, setAvatarBump] = useState<Record<string, number>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/influencers", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "목록 조회 실패");
      setList(body.influencers || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return list;
    return list.filter((inf) =>
      [inf.name, inf.instagram_handle, inf.instagram_handle_normalized, inf.sns_url, inf.notes, inf.region]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(key)),
    );
  }, [list, q]);

  function reset() {
    setEditingId(null);
    setName("");
    setHandle("");
    setSnsUrl("");
    setNotes("");
    setRegion("");
  }

  function startEdit(inf: Influencer) {
    setEditingId(inf.id);
    setName(inf.name);
    setHandle(inf.instagram_handle_normalized || inf.instagram_handle);
    setSnsUrl(inf.sns_url || "");
    setNotes(inf.notes || "");
    setRegion(inf.region || "");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isManager) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        instagram_handle: handle,
        sns_url: snsUrl,
        notes,
        region,
      };
      const res = await fetch(
        editingId ? `/api/admin/influencers/${editingId}` : "/api/admin/influencers",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "저장 실패");
      const next = body.influencer as Influencer;
      setList((prev) => {
        const exists = prev.some((x) => x.id === next.id);
        return exists
          ? prev.map((x) => (x.id === next.id ? next : x))
          : [next, ...prev];
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function refreshAvatar(id: string) {
    const res = await fetch(`/api/admin/influencers/${id}/avatar`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "아바타 갱신 실패");
      return;
    }
    setAvatarBump((m) => ({ ...m, [id]: Date.now() }));
    setList((prev) =>
      prev.map((x) =>
        x.id === id
          ? {
              ...x,
              profile_image_path: body.profile_image_path ?? x.profile_image_path,
              followers: body.followers ?? x.followers,
            }
          : x,
      ),
    );
  }

  return (
    <div className="space-y-5">
      <AdminImportPanel
        compact
        companies={companies}
        onSuccess={() => void load()}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-3">
        <input
          className={`${fieldClass} w-full max-w-sm`}
          placeholder="이름 · 핸들 · 메모 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
        <div className="overflow-x-auto rounded-[6px] border border-[var(--line)] bg-[var(--surface)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[var(--line)] text-[11px] font-medium text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">프로필</th>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">핸들</th>
                <th className="px-3 py-2">국가</th>
                <th className="px-3 py-2">팔로워</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-6 text-[var(--muted)]" colSpan={6}>
                    불러오는 중…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-[var(--muted)]" colSpan={6}>
                    등록된 인플루언서가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((inf) => (
                  <tr key={inf.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-3 py-2">
                      <InfluencerAvatar
                        influencerId={inf.id}
                        name={inf.name}
                        size="thumb"
                        cacheBust={avatarBump[inf.id] || 0}
                      />
                    </td>
                    <td className="px-3 py-2 font-semibold">{inf.name}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">
                      @{inf.instagram_handle_normalized || inf.instagram_handle}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted)]">{inf.region || "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-[var(--muted)]">
                      {inf.followers != null ? inf.followers.toLocaleString("ko-KR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="mr-2 text-xs text-[var(--accent)]"
                        onClick={() => startEdit(inf)}
                      >
                        수정
                      </button>
                      {isManager ? (
                        <button
                          type="button"
                          className="text-xs text-[var(--muted)]"
                          onClick={() => void refreshAvatar(inf.id)}
                        >
                          사진
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="owm-panel h-fit space-y-3 border border-[var(--line)] bg-[var(--surface)] p-5"
      >
        <p className="text-sm font-semibold">
          {editingId ? "인플루언서 수정" : "인플루언서 등록"}
        </p>
        {!isManager ? (
          <p className="text-xs text-[var(--muted)]">등록·수정은 운영관리자만 할 수 있습니다.</p>
        ) : null}
        <Field label="이름">
          <input
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isManager}
          />
        </Field>
        <Field label="인스타그램 핸들">
          <input
            className={fieldClass}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="handle"
            required
            disabled={!isManager}
          />
        </Field>
        <Field label="SNS URL">
          <input
            className={fieldClass}
            value={snsUrl}
            onChange={(e) => setSnsUrl(e.target.value)}
            placeholder="https://"
            disabled={!isManager}
          />
        </Field>
        <Field label="국가 (ISO)">
          <input
            className={fieldClass}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="JP"
            disabled={!isManager}
          />
        </Field>
        <Field label="메모">
          <textarea
            className={`${fieldClass} h-24 py-2`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!isManager}
          />
        </Field>
        <div className="flex gap-2">
          <button className={primaryBtnClass} type="submit" disabled={saving || !isManager}>
            {saving ? "저장 중…" : editingId ? "수정 저장" : "등록"}
          </button>
          {editingId ? (
            <button type="button" className={secondaryBtnClass} onClick={reset}>
              취소
            </button>
          ) : null}
        </div>
      </form>
      </div>
    </div>
  );
}

function InfluencerAllocCreate({
  stores,
  companies,
  products,
  isManager,
}: {
  stores: Store[];
  companies: Company[];
  products: Product[];
  isManager: boolean;
}) {
  if (!isManager) {
    return (
      <p className="mb-4 text-xs text-[var(--muted)]">
        배정 추가는 운영관리자만 할 수 있습니다. 아래 일정에서 조회·수정은 가능합니다.
      </p>
    );
  }

  return (
    <form
      action={createManualAllocation}
      className="owm-panel mb-5 grid gap-3 border border-[var(--line)] bg-[var(--surface)] p-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      <p className="sm:col-span-2 lg:col-span-3 text-sm font-semibold">배정 추가 (매장)</p>
      <Field label="이름">
        <input className={fieldClass} name="name" placeholder="표시명" />
      </Field>
      <Field label="인스타 핸들">
        <input className={fieldClass} name="snsid" required placeholder="handle" />
      </Field>
      <Field label="SNS URL">
        <input className={fieldClass} name="snsurl" placeholder="https://" />
      </Field>
      <Field label="회원사">
        <select className={fieldClass} name="company_id" required defaultValue="">
          <option value="" disabled>
            선택
          </option>
          {companies.filter((c) => c.is_active !== false).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="매장">
        <select className={fieldClass} name="store_id" required defaultValue="">
          <option value="" disabled>
            선택
          </option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="상품">
        <input
          className={fieldClass}
          name="product"
          required
          list="inf-alloc-products"
          placeholder="상품명"
        />
        <datalist id="inf-alloc-products">
          {products.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
      </Field>
      <Field label="수량">
        <input className={fieldClass} name="quantity" type="number" min={1} defaultValue={1} required />
      </Field>
      <Field label="방문 예정일">
        <input className={fieldClass} name="visit_date" type="date" required />
      </Field>
      <Field label="방문 코드">
        <input className={fieldClass} name="visit_code" placeholder="선택" />
      </Field>
      <div className="flex items-end sm:col-span-2 lg:col-span-3">
        <button className={primaryBtnClass} type="submit">
          배정 등록
        </button>
      </div>
    </form>
  );
}

export function AdminInfluencersTab({
  sub,
  isManager,
  storeList,
  companyList,
  productList,
  allocations,
  reviewQueue,
  onReviewQueueChange,
}: {
  sub: InfluencersSub;
  isManager: boolean;
  storeList: Store[];
  companyList: Company[];
  productList: Product[];
  allocations: AllocationWithRelations[];
  reviewQueue?: AdminReviewTab;
  onReviewQueueChange?: (q: AdminReviewTab) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 px-4 pb-4 pt-5 sm:px-7">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
            Influencers
          </p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight text-[var(--ink)] sm:text-[30px]">
            인플루언서
          </h1>
        </div>
      </div>

      {sub === "influencersRegister" ? (
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-8 sm:px-7">
          <InfluencerRegister isManager={isManager} companies={companyList} />
        </div>
      ) : null}

      {sub === "influencersReview" ? (
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-8 sm:px-7">
          <p className="mb-3 text-[12.5px] text-[var(--muted)]">
            콘텐츠 검수 큐입니다. 제출된 콘텐츠를 승인·반려합니다.
          </p>
          <AdminReviewQueue
            queue={reviewQueue}
            onQueueChange={onReviewQueueChange}
          />
        </div>
      ) : null}

      {sub === "influencersAlloc" ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="px-4 pt-1 sm:px-7">
            <InfluencerAllocCreate
              stores={storeList}
              companies={companyList}
              products={productList}
              isManager={isManager}
            />
          </div>
          <AdminAllocSchedule
            list={allocations}
            storeList={storeList}
            companyList={companyList}
          />
        </div>
      ) : null}
    </div>
  );
}
