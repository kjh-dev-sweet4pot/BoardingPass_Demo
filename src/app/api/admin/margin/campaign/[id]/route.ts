import { type NextRequest, NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import type { CampaignMarginRow } from "@/lib/types";

const CAMPAIGN_SELECT = `
  id, name, status, company_id, product_id, budget_amount, created_at, updated_at,
  companies ( id, name ),
  products ( id, name, sku )
`;

/**
 * GET /api/admin/margin/campaign/[id]
 * 캠페인 마진 화면 상세 번들: 캠페인 + 마진 집계 + 발행 목표 + 예산 계획 + 기타 소요비용.
 * 운영관리자만 접근 가능.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const [
    { data: campaign, error: campErr },
    { data: marginRow },
    { data: target },
    { data: budgetItems, error: itemsErr },
    { data: otherCosts, error: costsErr },
  ] = await Promise.all([
    supabase.from("campaigns").select(CAMPAIGN_SELECT).eq("id", id).maybeSingle(),
    supabase.from("v_campaign_margin").select("*").eq("campaign_id", id).maybeSingle(),
    supabase.from("campaign_targets").select("*").eq("campaign_id", id).maybeSingle(),
    supabase
      .from("budget_plan_items")
      .select("*")
      .eq("campaign_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("campaign_other_costs")
      .select("*")
      .eq("campaign_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  if (costsErr) return NextResponse.json({ error: costsErr.message }, { status: 500 });

  // ponytail: 슬롯 채움 카운트는 castings.budget_plan_item_id 기반이었는데
  // castings를 더 이상 안 써서(테이블 자체를 없앨 예정) 0으로 고정한다.
  const items = (budgetItems ?? []).map((i) => ({
    ...i,
    planned_amount: (i.unit_cost as number) * (i.slot_count as number),
    filled_count: 0,
    remaining_count: i.slot_count as number,
  }));

  // 확정된 배정(인플루언서·원가) — 섭외/casting 플로우를 안 쓰므로 allocations를
  // 직접 조회한다. budget_plan_item 슬롯 연결도 castings 기반이라 지금은 항상
  // "슬롯 미지정"으로 잡히지만, 그 부분은 후순위(슬롯 매칭은 보류)라 그대로 둔다.
  const { data: allocRows } = await supabase
    .from("allocations")
    .select(
      "id, influencer_id, store_id, visit_date, influencers ( name ), allocation_pricing ( cost_amount, display_price, quote_total_amount )",
    )
    .eq("campaign_id", id)
    .neq("status", "cancelled");

  // 같은 방문(인플루언서+지점+날짜)을 공유하는 다른 회사 배정 수 — 원가가 몇 개 사에
  // 나눠져 있는지 보여주기 위함 (visitKey 개념은 src/lib/alloc-dup.ts와 동일).
  const infIds = [...new Set((allocRows ?? []).map((a) => a.influencer_id as string))];
  const { data: siblingRows } = infIds.length
    ? await supabase
        .from("allocations")
        .select("influencer_id, store_id, visit_date, company_id")
        .in("influencer_id", infIds)
        .neq("status", "cancelled")
    : { data: [] as { influencer_id: string; store_id: string; visit_date: string | null; company_id: string | null }[] };

  const companyCountByVisit = new Map<string, Set<string>>();
  for (const row of siblingRows ?? []) {
    const key = `${row.influencer_id}|${row.store_id}|${row.visit_date ?? ""}`;
    const set = companyCountByVisit.get(key) ?? new Set<string>();
    if (row.company_id) set.add(row.company_id);
    companyCountByVisit.set(key, set);
  }

  return NextResponse.json({
    campaign,
    margin: (marginRow as CampaignMarginRow) || null,
    target: target || null,
    budgetItems: items,
    otherCosts: otherCosts || [],
    unassignedAllocations: (allocRows ?? []).map((a) => {
      const inf = a.influencers as unknown as { name: string } | { name: string }[] | null;
      const pricing = a.allocation_pricing as unknown as
        | { cost_amount: number | null; display_price: number | null; quote_total_amount: number | null }
        | { cost_amount: number | null; display_price: number | null; quote_total_amount: number | null }[]
        | null;
      const p = Array.isArray(pricing) ? pricing[0] : pricing;
      const key = `${a.influencer_id}|${a.store_id}|${a.visit_date ?? ""}`;
      return {
        id: a.id as string,
        influencer_name: (Array.isArray(inf) ? inf[0]?.name : inf?.name) ?? "—",
        cost_amount: p?.cost_amount ?? null,
        display_price: p?.display_price ?? null,
        quote_total_amount: p?.quote_total_amount ?? null,
        split_company_count: companyCountByVisit.get(key)?.size ?? 1,
      };
    }),
  });
}

/**
 * PATCH /api/admin/margin/campaign/[id]
 * body: { target_publish_count, memo } — campaign_targets upsert (1:1, campaign_id unique)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: { target_publish_count?: number; memo?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const targetPublishCount = Math.max(0, Math.round(Number(body.target_publish_count) || 0));
  const { data, error } = await supabase
    .from("campaign_targets")
    .upsert(
      {
        campaign_id: id,
        target_publish_count: targetPublishCount,
        memo: body.memo ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "campaign_id" },
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ target: data });
}
