import { NextRequest, NextResponse } from "next/server";
import {
  requireAnyAdmin,
  requireAdminManager,
  canViewCostAmount,
  stripPricingDeep,
} from "@/lib/access";
import { acceptCasting } from "@/lib/admin-casting-accept";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { type CastingStatus } from "@/lib/types";

const CASTING_SELECT = `
  id, campaign_id, company_id, influencer_id, status, allocation_id,
  created_at, updated_at,
  campaigns ( id, name, status ),
  companies ( id, name ),
  influencers (
    id, name, instagram_handle, instagram_handle_normalized,
    phone, email
  ),
  allocations (
    id, visit_date, target_content_count,
    allocation_pricing ( display_price, cost_amount, accepted_at )
  )
`;

type CastingAction = "start_nego" | "accept" | "reject";

function parseMoney(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("castings")
    .select(CASTING_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "섭외를 찾을 수 없습니다." }, { status: 404 });

  const isManager = await canViewCostAmount();
  return NextResponse.json({
    casting: isManager ? data : stripPricingDeep(data),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: {
    action?: CastingAction;
    display_price?: number;
    cost_amount?: number;
    target_content_count?: number;
    phone?: string;
    email?: string;
    store_id?: string;
    visit_date?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const action = body.action;
  if (!action) {
    return NextResponse.json({ error: "action이 필요합니다." }, { status: 400 });
  }

  const { data: current, error: curErr } = await supabase
    .from("castings")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (curErr) return NextResponse.json({ error: curErr.message }, { status: 500 });
  if (!current) {
    return NextResponse.json({ error: "섭외를 찾을 수 없습니다." }, { status: 404 });
  }

  const status = current.status as CastingStatus;
  const now = new Date().toISOString();

  if (action === "start_nego") {
    if (status !== "Pending") {
      return NextResponse.json(
        { error: "Pending 상태에서만 협의 개시할 수 있습니다." },
        { status: 400 },
      );
    }
    const { data, error } = await supabase
      .from("castings")
      .update({ status: "Nego", updated_at: now })
      .eq("id", id)
      .select(CASTING_SELECT)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const isManager = await canViewCostAmount();
    return NextResponse.json({ casting: isManager ? data : stripPricingDeep(data) });
  }

  if (action === "reject") {
    if (status !== "Pending" && status !== "Nego") {
      return NextResponse.json(
        { error: "Pending 또는 Nego 상태에서만 협상 결렬할 수 있습니다." },
        { status: 400 },
      );
    }
    const { data, error } = await supabase
      .from("castings")
      .update({ status: "결렬", updated_at: now })
      .eq("id", id)
      .select(CASTING_SELECT)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const isManager = await canViewCostAmount();
    return NextResponse.json({ casting: isManager ? data : stripPricingDeep(data) });
  }

  if (action === "accept") {
    const mgr = await requireAdminManager();
    if ("error" in mgr) return mgr.error;

    const displayPrice = parseMoney(body.display_price);
    const costAmount = parseMoney(body.cost_amount);
    const targetContentCount = parseMoney(body.target_content_count);
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const storeId = String(body.store_id || "").trim();
    const visitDate = String(body.visit_date || "").trim();

    if (displayPrice == null || costAmount == null || targetContentCount == null || targetContentCount < 1) {
      return NextResponse.json(
        { error: "노출가·원가·목표 콘텐츠 수를 입력하세요." },
        { status: 400 },
      );
    }
    if (!phone || !email) {
      return NextResponse.json(
        { error: "전화·이메일 연락처를 입력하세요." },
        { status: 400 },
      );
    }
    if (!storeId || !visitDate) {
      return NextResponse.json(
        { error: "방문 지점·방문 예정일을 선택하세요." },
        { status: 400 },
      );
    }

    try {
      await acceptCasting(supabase, {
        castingId: id,
        displayPrice,
        costAmount,
        targetContentCount,
        phone,
        email,
        storeId,
        visitDate,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "섭외 확정 실패";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("castings")
      .select(CASTING_SELECT)
      .eq("id", id)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ casting: data });
  }

  return NextResponse.json({ error: "알 수 없는 action입니다." }, { status: 400 });
}
