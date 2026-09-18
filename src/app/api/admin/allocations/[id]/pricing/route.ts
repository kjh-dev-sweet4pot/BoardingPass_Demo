import { type NextRequest, NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { isMoneyOk, parseMoney } from "@/lib/money";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

/**
 * PATCH /api/admin/allocations/[id]/pricing
 * body: { cost_amount?, display_price? } — 확정된 배정의 원가·노출가를 나중에 수정한다.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const { id: allocationId } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: { cost_amount?: number | string; display_price?: number | string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const patch: Record<string, number> = {};
  if (body.cost_amount !== undefined) {
    const v = parseMoney(body.cost_amount);
    if (!isMoneyOk(v)) return NextResponse.json({ error: "원가가 올바르지 않습니다." }, { status: 400 });
    patch.cost_amount = v;
  }
  if (body.display_price !== undefined) {
    const v = parseMoney(body.display_price);
    if (!isMoneyOk(v)) return NextResponse.json({ error: "노출가가 올바르지 않습니다." }, { status: 400 });
    patch.display_price = v;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "수정할 값이 없습니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("allocation_pricing")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("allocation_id", allocationId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "배정 가격 정보를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ pricing: data });
}
