import { NextResponse } from "next/server";
import { getCompanySessionId } from "@/lib/session";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { poolCreatorFromInfluencer } from "@/lib/com-creator-pool";

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

/**
 * GET /api/com/creator-pool
 * 회원사 배정(CSV 업로드 포함)에 있는 인플루언서 → 크리에이터 풀.
 * 원가·마진 미포함 (R3)
 */
export async function GET() {
  const companyId = await getCompanySessionId();
  if (!companyId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("allocations")
    .select(
      "id, product_id, created_at, products(name), influencers(id, name, instagram_handle, instagram_handle_normalized, sns_url)",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const seen = new Set<string>();
  const creators = [];
  for (const row of data ?? []) {
    const infRaw = row.influencers;
    const inf = Array.isArray(infRaw) ? infRaw[0] : infRaw;
    if (!inf?.id || seen.has(inf.id)) continue;
    seen.add(inf.id);
    const productRaw = row.products;
    const product = Array.isArray(productRaw) ? productRaw[0] : productRaw;
    creators.push(
      poolCreatorFromInfluencer(inf, {
        productName: product?.name ?? null,
      }),
    );
  }

  return NextResponse.json({ creators, source: "allocations" as const });
}
