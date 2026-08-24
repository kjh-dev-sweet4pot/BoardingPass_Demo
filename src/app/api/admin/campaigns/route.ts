import { NextRequest, NextResponse } from "next/server";
import { requireAnyAdmin, requireAdminManager } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

const CAMPAIGN_SELECT = `
  id, name, status, company_id, product_id, budget_amount, created_at, updated_at,
  companies ( id, name ),
  products ( id, name, sku )
`;

function parseBudget(v: unknown) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

async function attachSpend(
  supabase: NonNullable<Awaited<ReturnType<typeof createAuthedDbClient>>>,
  campaigns: Array<{ id: string } & Record<string, unknown>>,
) {
  if (campaigns.length === 0) return campaigns;
  const ids = campaigns.map((c) => c.id);
  const { data: castings } = await supabase
    .from("castings")
    .select(
      "campaign_id, status, allocations ( allocation_pricing ( display_price ) )",
    )
    .in("campaign_id", ids)
    .eq("status", "Accept");

  const spent = new Map<string, number>();
  for (const row of castings ?? []) {
    const alloc = Array.isArray(row.allocations) ? row.allocations[0] : row.allocations;
    const pricing = alloc?.allocation_pricing;
    const priceRow = Array.isArray(pricing) ? pricing[0] : pricing;
    const price = Number(priceRow?.display_price ?? 0);
    if (!Number.isFinite(price)) continue;
    spent.set(row.campaign_id, (spent.get(row.campaign_id) ?? 0) + price);
  }

  return campaigns.map((c) => {
    const spentAmount = spent.get(c.id) ?? 0;
    const budget = typeof c.budget_amount === "number" ? c.budget_amount : null;
    const spendPct =
      budget != null && budget > 0 ? Math.round((spentAmount / budget) * 1000) / 10 : null;
    return { ...c, spent_amount: spentAmount, spend_pct: spendPct };
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const companyId = new URL(request.url).searchParams.get("company_id");

  let query = supabase
    .from("campaigns")
    .select(CAMPAIGN_SELECT)
    .order("created_at", { ascending: false });

  if (companyId) query = query.eq("company_id", companyId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const campaigns = await attachSpend(supabase, data ?? []);
  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: {
    company_id?: string;
    product_id?: string;
    name?: string;
    budget_amount?: number | string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const company_id = String(body.company_id || "").trim();
  const product_id = String(body.product_id || "").trim();
  const name = String(body.name || "").trim() || null;
  const budget_amount = parseBudget(body.budget_amount);

  if (!company_id || !product_id) {
    return NextResponse.json(
      { error: "회원사와 상품을 선택하세요." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("campaigns")
    .insert({ company_id, product_id, name, status: "견적수립", budget_amount })
    .select(CAMPAIGN_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [campaign] = await attachSpend(supabase, [data]);
  return NextResponse.json({ campaign }, { status: 201 });
}
