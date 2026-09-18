import { type NextRequest, NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

type BudgetItemBody = {
  id?: string;
  tier?: string;
  content_type?: string | null;
  platform?: string | null;
  unit_cost?: number | string;
  slot_count?: number | string;
  expected_publish_per_slot?: number | string;
  sort_order?: number;
  memo?: string | null;
};

function expectedPublishPerSlot(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 1;
}

function readBody(body: BudgetItemBody) {
  const tier = String(body.tier || "").trim();
  const unitCost = Math.round(Number(body.unit_cost) || 0);
  const slotCount = Math.round(Number(body.slot_count) || 0);
  if (!tier) return { error: "티어를 선택하세요." as const };
  if (unitCost < 0) return { error: "단가는 0 이상이어야 합니다." as const };
  if (slotCount <= 0) return { error: "슬롯 수는 1 이상이어야 합니다." as const };
  return {
    row: {
      tier,
      content_type: body.content_type || null,
      platform: body.platform || null,
      unit_cost: unitCost,
      slot_count: slotCount,
      expected_publish_per_slot: Math.max(0, Math.round(expectedPublishPerSlot(body.expected_publish_per_slot))),
      sort_order: Math.round(Number(body.sort_order) || 0),
      memo: body.memo || null,
    },
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("budget_plan_items")
    .select("*")
    .eq("campaign_id", id)
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: BudgetItemBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const parsed = readBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await supabase
    .from("budget_plan_items")
    .insert({ ...parsed.row, campaign_id: id })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: BudgetItemBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  const parsed = readBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await supabase
    .from("budget_plan_items")
    .update({ ...parsed.row, updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .eq("campaign_id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const itemId = new URL(request.url).searchParams.get("item_id");
  if (!itemId) return NextResponse.json({ error: "item_id가 필요합니다." }, { status: 400 });

  const { error } = await supabase
    .from("budget_plan_items")
    .delete()
    .eq("id", itemId)
    .eq("campaign_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
