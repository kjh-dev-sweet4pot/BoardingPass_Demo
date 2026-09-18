import { type NextRequest, NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { type ContentType, type Platform } from "@/lib/types";

const CONTENT_TYPES: ContentType[] = ["carousel", "visit", "seeding"];
const PLATFORMS: Platform[] = ["instagram", "tiktok", "youtube", "naver_blog", "etc"];

type RateCardBody = {
  id?: string;
  influencer_id?: string;
  content_type?: string;
  platform?: string;
  standard_cost?: number | string;
  source?: string;
  effective_from?: string;
  memo?: string | null;
};

function readBody(body: RateCardBody) {
  const contentType = body.content_type as ContentType;
  const platform = body.platform as Platform;
  const standardCost = Math.round(Number(body.standard_cost) || 0);
  if (!CONTENT_TYPES.includes(contentType)) return { error: "콘텐츠 유형을 선택하세요." as const };
  if (!PLATFORMS.includes(platform)) return { error: "플랫폼을 선택하세요." as const };
  if (standardCost < 0) return { error: "단가는 0 이상이어야 합니다." as const };
  return {
    row: {
      content_type: contentType,
      platform,
      standard_cost: standardCost,
      source: body.source === "invoice" ? "invoice" : "manual",
      effective_from: body.effective_from || new Date().toISOString().slice(0, 10),
      memo: body.memo || null,
    },
  };
}

/**
 * 실제 배정·집행 데이터(allocations → allocation_pricing/creator_links)에서 인플루언서×플랫폼별
 * 최근 단가를 뽑아 "실측" 레이트카드 행으로 만든다. creator_rate_cards는 수기 입력만 쌓이는 별도
 * 표라 늘 비어 있었음 — 그 표만 보여주면 실제로 있는 배정 단가가 하나도 안 보였다.
 * influencerId를 주면 그 인플루언서만, 생략하면 전체를 계산한다.
 */
async function computedRateCards(
  supabase: Awaited<ReturnType<typeof createAuthedDbClient>>,
  influencerId?: string,
) {
  if (!supabase) return [];
  // allocations가 수천 건이라 allocation_id를 먼저 다 모아 .in()으로 되짚으면 URL이 너무 길어져
  // "Bad Request"가 난다 — allocation_pricing에서 곧장 allocations를 조인해 걸러야 안전하다.
  let pricingQuery = supabase
    .from("allocation_pricing")
    .select("allocation_id, cost_amount, accepted_at, allocations!inner(influencer_id)")
    .not("cost_amount", "is", null)
    .not("accepted_at", "is", null);
  if (influencerId) pricingQuery = pricingQuery.eq("allocations.influencer_id", influencerId);
  const { data: pricing } = await pricingQuery;
  if (!pricing || pricing.length === 0) return [];

  const allocIds = pricing.map((p) => p.allocation_id as string);
  const { data: links } = await supabase
    .from("creator_links")
    .select("allocation_id, platform")
    .in("allocation_id", allocIds);
  const platformByAlloc = new Map<string, string>();
  for (const l of links ?? []) {
    if (l.platform) platformByAlloc.set(l.allocation_id as string, l.platform as string);
  }

  const grouped = new Map<string, { cost_amount: number; accepted_at: string }[]>();
  for (const p of pricing) {
    const allocRel = p.allocations as unknown as { influencer_id: string } | { influencer_id: string }[];
    const infId = Array.isArray(allocRel) ? allocRel[0]?.influencer_id : allocRel?.influencer_id;
    if (!infId) continue;
    const platform = platformByAlloc.get(p.allocation_id as string) || "etc";
    const key = `${infId}::${platform}`;
    const list = grouped.get(key) ?? [];
    list.push({ cost_amount: p.cost_amount as number, accepted_at: p.accepted_at as string });
    grouped.set(key, list);
  }

  return [...grouped.entries()].map(([key, rows]) => {
    const [infId, platform] = key.split("::");
    const sorted = [...rows].sort((a, b) => b.accepted_at.localeCompare(a.accepted_at));
    const latest = sorted[0];
    return {
      id: `computed:${key}`,
      influencer_id: infId,
      content_type: null,
      platform,
      standard_cost: latest.cost_amount,
      source: "invoice" as const,
      effective_from: latest.accepted_at.slice(0, 10),
      memo: `실측 배정 단가 ${rows.length}건 중 최근값`,
    };
  });
}

/** GET /api/admin/margin/rate-cards?influencer_id= (생략하면 전체 인플루언서) */
export async function GET(request: NextRequest) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const influencerId = new URL(request.url).searchParams.get("influencer_id") || undefined;
  let query = supabase
    .from("creator_rate_cards")
    .select("*")
    .order("influencer_id", { ascending: true })
    .order("effective_from", { ascending: false });
  if (influencerId) query = query.eq("influencer_id", influencerId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const computed = await computedRateCards(supabase, influencerId);
  return NextResponse.json({ rateCards: [...computed, ...(data ?? [])] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: RateCardBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const influencerId = String(body.influencer_id || "").trim();
  if (!influencerId) return NextResponse.json({ error: "인플루언서를 선택하세요." }, { status: 400 });
  const parsed = readBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await supabase
    .from("creator_rate_cards")
    .insert({ ...parsed.row, influencer_id: influencerId })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rateCard: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: RateCardBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  const parsed = readBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await supabase
    .from("creator_rate_cards")
    .update({ ...parsed.row, updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rateCard: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const { error } = await supabase.from("creator_rate_cards").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
