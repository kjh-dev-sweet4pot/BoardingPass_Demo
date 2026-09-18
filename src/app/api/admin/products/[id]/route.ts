import { NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

const PRODUCT_SELECT = "id, name, sku, description, company_id, is_active, created_at";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();
  const { id } = await context.params;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if ("name" in body) {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "상품명을 입력하세요." }, { status: 400 });
    patch.name = name;
  }
  if ("company_id" in body) patch.company_id = String(body.company_id || "").trim() || null;
  if ("sku" in body) patch.sku = String(body.sku || "").trim() || null;
  if ("description" in body) patch.description = String(body.description || "").trim() || null;
  if ("is_active" in body) patch.is_active = Boolean(body.is_active);

  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", id)
    .select(PRODUCT_SELECT)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ product: data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();
  const { id } = await context.params;

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    const inUse = /foreign key|violates|referenced/i.test(error.message);
    if (!inUse) return NextResponse.json({ error: error.message }, { status: 500 });

    // 배정 이력이 있어 하드 삭제가 막히면 목록에서만 숨긴다 (soft-delete)
    const { data, error: archiveErr } = await supabase
      .from("products")
      .update({ is_active: false })
      .eq("id", id)
      .select(PRODUCT_SELECT)
      .maybeSingle();
    if (archiveErr) return NextResponse.json({ error: archiveErr.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      archived: true,
      product: data,
      message: "이력이 있는 상품이라 완전히 삭제할 수 없어 보관 처리했습니다.",
    });
  }
  return NextResponse.json({ ok: true });
}
