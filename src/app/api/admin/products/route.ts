import { NextRequest, NextResponse } from "next/server";
import { requireAdminManager, requireAnyAdmin } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

const PRODUCT_SELECT = "id, name, sku, description, company_id, is_active, created_at";

export async function GET(request: NextRequest) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const companyId = new URL(request.url).searchParams.get("company_id");
  let query = supabase.from("products").select(PRODUCT_SELECT).order("name", { ascending: true });
  if (companyId) query = query.eq("company_id", companyId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name || "").trim();
  const companyId = String(body.company_id || "").trim() || null;
  const sku = String(body.sku || "").trim() || null;
  const description = String(body.description || "").trim() || null;
  if (!name) return NextResponse.json({ error: "상품명을 입력하세요." }, { status: 400 });

  const { data, error } = await supabase
    .from("products")
    .insert({ name, company_id: companyId, sku, description })
    .select(PRODUCT_SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data }, { status: 201 });
}
