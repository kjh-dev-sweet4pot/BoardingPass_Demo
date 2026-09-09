import { NextResponse } from "next/server";
import { getCompanySessionId } from "@/lib/session";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { poolCreatorFromInfluencer, type ProfileAvgMetrics } from "@/lib/com-creator-pool";
import profileMetrics from "@/lib/data/pool-profile-metrics.json";

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
      "id, product_id, created_at, visit_date, products(name), influencers(id, name, instagram_handle, instagram_handle_normalized, sns_url, followers, region), creator_links(url, publish_url, platform, status, content_status, submitted_at, views, likes, comments, saves)",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const best = new Map<
    string,
    {
      inf: Parameters<typeof poolCreatorFromInfluencer>[0];
      product: string | null;
      visitYmd: string;
      links: NonNullable<(typeof data)[number]["creator_links"]>;
    }
  >();
  for (const row of data ?? []) {
    const infRaw = row.influencers;
    const inf = Array.isArray(infRaw) ? infRaw[0] : infRaw;
    if (!inf?.id) continue;
    const productRaw = row.products;
    const product = Array.isArray(productRaw) ? productRaw[0] : productRaw;
    const visitYmd = row.visit_date ? String(row.visit_date).slice(0, 10) : "";
    const rowLinks = Array.isArray(row.creator_links)
      ? row.creator_links
      : row.creator_links
        ? [row.creator_links]
        : [];
    const prev = best.get(inf.id);
    if (!prev) {
      best.set(inf.id, {
        inf,
        product: product?.name ?? null,
        visitYmd,
        links: rowLinks,
      });
      continue;
    }
    prev.links.push(...rowLinks);
    if (visitYmd > prev.visitYmd) {
      prev.visitYmd = visitYmd;
      prev.product = product?.name ?? prev.product;
    }
  }
  const profileById = profileMetrics as Record<string, ProfileAvgMetrics>;
  const creators = [...best.values()].map(({ inf, product, visitYmd, links }) =>
    poolCreatorFromInfluencer(inf, {
      productName: product,
      visitYmd: visitYmd || null,
      links,
      profileAvg: profileById[inf.id] ?? null,
    }),
  );

  return NextResponse.json({ creators, source: "allocations" as const });
}
