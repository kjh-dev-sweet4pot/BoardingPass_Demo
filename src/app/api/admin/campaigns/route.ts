import { NextRequest, NextResponse } from "next/server";
import { requireAnyAdmin, requireAdminManager } from "@/lib/access";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";

const CAMPAIGN_SELECT = `
  id, name, status, company_id, product_id, created_at, updated_at,
  companies ( id, name ),
  products ( id, name, sku )
`;

export async function GET(request: NextRequest) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createApiClientIfConfigured();
  if (!supabase) return supabaseConfigError();

  const companyId = new URL(request.url).searchParams.get("company_id");

  let query = supabase
    .from("campaigns")
    .select(CAMPAIGN_SELECT)
    .order("created_at", { ascending: false });

  if (companyId) query = query.eq("company_id", companyId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const supabase = await createApiClientIfConfigured();
  if (!supabase) return supabaseConfigError();

  let body: { company_id?: string; product_id?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const company_id = String(body.company_id || "").trim();
  const product_id = String(body.product_id || "").trim();
  const name = String(body.name || "").trim() || null;

  if (!company_id || !product_id) {
    return NextResponse.json(
      { error: "회원사와 상품을 선택하세요." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("campaigns")
    .insert({ company_id, product_id, name, status: "견적수립" })
    .select(CAMPAIGN_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data }, { status: 201 });
}
