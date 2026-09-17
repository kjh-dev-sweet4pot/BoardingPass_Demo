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

  // 배정된 슬롯 수 (castings.budget_plan_item_id 기준)
  const itemIds = (budgetItems ?? []).map((i) => i.id as string);
  const { data: filledRows } = itemIds.length
    ? await supabase.from("castings").select("budget_plan_item_id").in("budget_plan_item_id", itemIds)
    : { data: [] as { budget_plan_item_id: string | null }[] };
  const filledCountByItem = new Map<string, number>();
  for (const row of filledRows ?? []) {
    if (!row.budget_plan_item_id) continue;
    filledCountByItem.set(
      row.budget_plan_item_id,
      (filledCountByItem.get(row.budget_plan_item_id) ?? 0) + 1,
    );
  }
  const items = (budgetItems ?? []).map((i) => {
    const filled = filledCountByItem.get(i.id as string) ?? 0;
    return {
      ...i,
      planned_amount: (i.unit_cost as number) * (i.slot_count as number),
      filled_count: filled,
      remaining_count: Math.max(0, (i.slot_count as number) - filled),
    };
  });

  return NextResponse.json({
    campaign,
    margin: (marginRow as CampaignMarginRow) || null,
    target: target || null,
    budgetItems: items,
    otherCosts: otherCosts || [],
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
