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

/** GET /api/admin/margin/rate-cards?influencer_id= */
export async function GET(request: NextRequest) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const influencerId = new URL(request.url).searchParams.get("influencer_id");
  let query = supabase
    .from("creator_rate_cards")
    .select("*")
    .order("influencer_id", { ascending: true })
    .order("effective_from", { ascending: false });
  if (influencerId) query = query.eq("influencer_id", influencerId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rateCards: data });
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
