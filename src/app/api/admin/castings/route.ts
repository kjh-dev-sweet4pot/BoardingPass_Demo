import { NextRequest, NextResponse } from "next/server";
import { requireAnyAdmin, requireAdminManager, canViewCostAmount, stripPricingDeep } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { type CastingStatus } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const CASTING_SELECT = `
  id, campaign_id, company_id, influencer_id, status, allocation_id,
  created_at, updated_at,
  campaigns ( id, name, status, product_id, products ( id, name ) ),
  companies ( id, name ),
  influencers (
    id, name, instagram_handle, instagram_handle_normalized,
    sns_url, phone, email, scale_band, profile_image_path
  ),
  allocations (
    id, visit_date, target_content_count, rollup_status,
    allocation_pricing ( display_price, cost_amount, accepted_at )
  )
`;

const STATUSES: CastingStatus[] = ["Pending", "Nego", "Accept", "결렬"];

function bareHandle(raw: string) {
  return raw.replace(/^@+/, "").trim().toLowerCase();
}

async function findOrCreateInfluencer(
  supabase: SupabaseClient,
  input: { handle: string; name?: string; sns_url?: string },
) {
  const handle = bareHandle(input.handle);
  if (!handle) throw new Error("SNS 핸들이 필요합니다.");

  const { data: existing } = await supabase
    .from("influencers")
    .select("id")
    .eq("instagram_handle_normalized", handle)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const name = String(input.name || "").trim() || handle;
  const sns_url = String(input.sns_url || "").trim() || null;

  const { data: created, error } = await supabase
    .from("influencers")
    .insert({
      name,
      instagram_handle: handle,
      instagram_handle_normalized: handle,
      sns_url,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message || "인플루언서 생성 실패");
  return created.id as string;
}

export async function GET(request: NextRequest) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as CastingStatus | null;
  const campaignId = searchParams.get("campaign_id");
  const companyId = searchParams.get("company_id");
  const staleDays = parseInt(searchParams.get("stale_days") || "", 10);

  let query = supabase
    .from("castings")
    .select(CASTING_SELECT)
    .order("updated_at", { ascending: false });

  if (status && STATUSES.includes(status)) query = query.eq("status", status);
  if (campaignId) query = query.eq("campaign_id", campaignId);
  if (companyId) query = query.eq("company_id", companyId);
  if (Number.isFinite(staleDays) && staleDays > 0) {
    const cutoff = new Date(Date.now() - staleDays * 86400000).toISOString();
    query = query.lt("created_at", cutoff);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const isManager = await canViewCostAmount();
  return NextResponse.json({
    castings: isManager ? (data ?? []) : stripPricingDeep(data ?? []),
  });
}

/**
 * POST /api/admin/castings
 * 운영자가 캠페인에 인플루언서 섭외(Pending)를 추가.
 * body: { campaign_id, handle, name?, sns_url? } 또는 { campaign_id, influencer_id }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: {
    campaign_id?: string;
    influencer_id?: string;
    handle?: string;
    name?: string;
    sns_url?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const campaign_id = String(body.campaign_id || "").trim();
  if (!campaign_id) {
    return NextResponse.json({ error: "campaign_id가 필요합니다." }, { status: 400 });
  }

  const { data: campaign, error: campErr } = await supabase
    .from("campaigns")
    .select("id, company_id, status")
    .eq("id", campaign_id)
    .maybeSingle();

  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 });
  if (!campaign) {
    return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });
  }
  if (campaign.status === "취소" || campaign.status === "보류") {
    return NextResponse.json(
      { error: `${campaign.status} 캠페인에는 섭외를 추가할 수 없습니다.` },
      { status: 400 },
    );
  }

  let influencer_id = String(body.influencer_id || "").trim();
  if (!influencer_id) {
    try {
      influencer_id = await findOrCreateInfluencer(supabase, {
        handle: String(body.handle || ""),
        name: body.name,
        sns_url: body.sns_url,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "인플루언서 확인 실패" },
        { status: 400 },
      );
    }
  }

  const { data: existing } = await supabase
    .from("castings")
    .select("id, status")
    .eq("campaign_id", campaign_id)
    .eq("influencer_id", influencer_id)
    .maybeSingle();

  if (existing) {
    if (existing.status === "결렬") {
      const { data: revived, error: reviveErr } = await supabase
        .from("castings")
        .update({ status: "Pending", updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select(CASTING_SELECT)
        .single();
      if (reviveErr) {
        return NextResponse.json({ error: reviveErr.message }, { status: 500 });
      }
      return NextResponse.json({ casting: revived }, { status: 200 });
    }
    return NextResponse.json(
      { error: "이미 이 캠페인에 등록된 섭외입니다.", casting: existing },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("castings")
    .insert({
      campaign_id,
      company_id: campaign.company_id,
      influencer_id,
      status: "Pending",
    })
    .select(CASTING_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ casting: data }, { status: 201 });
}
