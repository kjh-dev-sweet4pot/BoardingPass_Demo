"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SpreadsheetTable, type SpreadsheetColumn } from "@/components/spreadsheet-table";
import type { AllocationWithRelations, Company, Influencer } from "@/lib/types";

type Row = Influencer & {
  companyNames: string[];
  /** 가장 최근 방문 예정일 (allocations.visit_date 중 최댓값) */
  lastVisitDate: string | null;
  /** 위 최근 방문일에 대응하는 지점명 */
  lastStoreName: string | null;
  /** creator_links의 콘텐츠 URL (발행 URL 우선) */
  contentUrls: string[];
  /** 최근 방문 배정 — 콘텐츠 URL 편집 대상 */
  lastAllocationId: string | null;
  lastContentUrl: string;
};

function ExtLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
      {href}
    </a>
  );
}

/** allocations에서 회사↔인플루언서 매핑을 뽑는다 — influencers 테이블엔 company_id가 없다. */
function buildRows(allocations: AllocationWithRelations[], companyId: string): Row[] {
  const byInfluencer = new Map<
    string,
    {
      influencer: Influencer;
      companyIds: Set<string>;
      companyNames: Set<string>;
      lastVisitDate: string | null;
      lastStoreName: string | null;
      contentUrls: Set<string>;
      lastAllocationId: string | null;
      lastContentUrl: string;
    }
  >();
  for (const a of allocations) {
    const inf = a.influencers;
    if (!inf) continue;
    const company = a.companies;
    const entry =
      byInfluencer.get(inf.id) ||
      {
        influencer: inf,
        companyIds: new Set<string>(),
        companyNames: new Set<string>(),
        lastVisitDate: null,
        lastStoreName: null,
        contentUrls: new Set<string>(),
        lastAllocationId: null,
        lastContentUrl: "",
      };
    for (const l of a.creator_links || []) {
      const u = l.publish_url || l.url;
      if (u) entry.contentUrls.add(u);
    }
    if (company?.id) entry.companyIds.add(company.id);
    if (company?.name) entry.companyNames.add(company.name);
    if (a.visit_date && (!entry.lastVisitDate || a.visit_date > entry.lastVisitDate)) {
      entry.lastVisitDate = a.visit_date;
      entry.lastStoreName = a.stores?.name || null;
      entry.lastAllocationId = a.id;
      const l = a.creator_links?.[0];
      entry.lastContentUrl = l ? l.publish_url || l.url || "" : "";
    }
    byInfluencer.set(inf.id, entry);
  }
  return [...byInfluencer.values()]
    .filter((e) => !companyId || e.companyIds.has(companyId))
    .map((e) => ({
      ...e.influencer,
      companyNames: [...e.companyNames],
      lastVisitDate: e.lastVisitDate,
      lastStoreName: e.lastStoreName,
      contentUrls: [...e.contentUrls],
      lastAllocationId: e.lastAllocationId,
      lastContentUrl: e.lastContentUrl,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export function AdminInfluencerCompanyPanel({
  allocations,
  companies,
}: {
  allocations: AllocationWithRelations[];
  companies: Company[];
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState("");
  const [q, setQ] = useState("");

  const rows = useMemo(() => buildRows(allocations, companyId), [allocations, companyId]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        (r.instagram_handle || "").toLowerCase().includes(query),
    );
  }, [rows, q]);

  async function saveEdits(
    edits: { row: Row; rowKey: string; values: Record<string, string> }[],
  ) {
    for (const { row, values } of edits) {
      if (values.content_urls !== undefined && values.content_urls !== row.lastContentUrl) {
        if (!row.lastAllocationId) throw new Error(`${row.name}: 방문 배정이 없어 콘텐츠 URL을 등록할 수 없습니다.`);
        const res = await fetch("/api/admin/links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ allocation_id: row.lastAllocationId, url: values.content_urls }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
      }
      if (!["name", "instagram_handle", "sns_url", "region", "notes"].some((k) => k in values)) continue;
      // PATCH가 부분 수정이 아니라 name/instagram_handle을 항상 요구하는 전체 치환이라
      // 편집 안 한 필드는 기존 값으로 채워서 같이 보낸다.
      const body: Record<string, string | null> = {
        name: values.name ?? row.name,
        instagram_handle: values.instagram_handle ?? row.instagram_handle,
        sns_url: values.sns_url ?? row.sns_url ?? "",
        region: values.region ?? row.region ?? "",
        notes: values.notes ?? row.notes ?? "",
      };
      const res = await fetch(`/api/admin/influencers/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
    }
    // 시트 행은 서버에서 받은 allocations props로 만든다 — 저장 후 다시 받아와야 새 값이 보인다.
    router.refresh();
  }

  const columns: SpreadsheetColumn<Row>[] = [
    {
      key: "name",
      label: "이름",
      width: 140,
      render: (r) => r.name,
      edit: { kind: "text", getValue: (r) => r.name },
    },
    {
      key: "instagram_handle",
      label: "인스타 핸들",
      width: 140,
      render: (r) => (r.instagram_handle ? `@${r.instagram_handle}` : "—"),
      edit: { kind: "text", getValue: (r) => r.instagram_handle || "" },
    },
    {
      key: "sns_url",
      label: "프로필 URL",
      width: 200,
      render: (r) => (r.sns_url ? <ExtLink href={r.sns_url} /> : "—"),
      sortValue: (r) => r.sns_url || "",
      edit: { kind: "text", getValue: (r) => r.sns_url || "" },
    },
    {
      key: "content_urls",
      label: "콘텐츠 URL",
      width: 240,
      render: (r) =>
        r.contentUrls.length
          ? r.contentUrls.map((u, i) => (
              <span key={u}>
                {i > 0 && " · "}
                <ExtLink href={u} />
              </span>
            ))
          : "—",
      sortValue: (r) => r.contentUrls[0] || "",
      // 최근 방문 배정의 링크를 수정. 링크가 없으면 신규 등록 → 회원사 발행 알림 메일
      edit: { kind: "text", getValue: (r) => r.lastContentUrl },
    },
    {
      key: "region",
      label: "지역",
      width: 90,
      render: (r) => r.region || "—",
      edit: { kind: "text", getValue: (r) => r.region || "" },
    },
    {
      key: "followers",
      label: "팔로워",
      width: 90,
      align: "right",
      render: (r) => (r.followers != null ? r.followers.toLocaleString("ko-KR") : "—"),
    },
    {
      key: "companies",
      label: "소속 회사",
      width: 240,
      render: (r) => r.companyNames.join(" · ") || "—",
    },
    {
      key: "visit_date",
      label: "방문 날짜",
      width: 110,
      render: (r) => r.lastVisitDate || "—",
    },
    {
      key: "store_name",
      label: "지점",
      width: 120,
      render: (r) => r.lastStoreName || "—",
    },
    {
      key: "notes",
      label: "메모",
      width: 220,
      render: (r) => r.notes || "—",
      edit: { kind: "text", getValue: (r) => r.notes || "" },
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-8 sm:px-7">
      <p className="text-[12.5px] text-[var(--muted)]">
        회사별로 배정 이력이 있는 인플루언서를 조회·수정합니다. 셀을 클릭하면 바로 수정할 수
        있습니다.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-10 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          <option value="">전체 회원사</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          className="h-10 min-w-[160px] flex-1 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
          placeholder="이름·핸들 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="text-xs text-[var(--muted)]">{filtered.length}명</span>
      </div>
      <SpreadsheetTable
        storageKey="admin-influencer-company"
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        rowLabel={(r) => r.name}
        onSave={saveEdits}
        emptyText="배정 이력이 있는 인플루언서가 없습니다."
      />
    </div>
  );
}
