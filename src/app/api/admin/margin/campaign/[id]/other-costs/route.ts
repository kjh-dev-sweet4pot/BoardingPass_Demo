import { type NextRequest, NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { type OtherCostType } from "@/lib/types";

const COST_TYPES: OtherCostType[] = ["광고비", "상품제공가", "대행수수료", "기타"];

type OtherCostBody = {
  id?: string;
  cost_type?: string;
  amount?: number | string;
  memo?: string | null;
};

function readBody(body: OtherCostBody) {
  const costType = body.cost_type as OtherCostType;
  const amount = Math.round(Number(body.amount) || 0);
  if (!COST_TYPES.includes(costType)) return { error: "비용 종류를 선택하세요." as const };
  if (amount < 0) return { error: "금액은 0 이상이어야 합니다." as const };
  return { row: { cost_type: costType, amount, memo: body.memo || null } };
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
    .from("campaign_other_costs")
    .select("*")
    .eq("campaign_id", id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ costs: data });
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

  let body: OtherCostBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const parsed = readBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await supabase
    .from("campaign_other_costs")
    .insert({ ...parsed.row, campaign_id: id })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cost: data });
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

  let body: OtherCostBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  const parsed = readBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await supabase
    .from("campaign_other_costs")
    .update({ ...parsed.row, updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .eq("campaign_id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cost: data });
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

  const costId = new URL(request.url).searchParams.get("cost_id");
  if (!costId) return NextResponse.json({ error: "cost_id가 필요합니다." }, { status: 400 });

  const { error } = await supabase
    .from("campaign_other_costs")
    .delete()
    .eq("id", costId)
    .eq("campaign_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
