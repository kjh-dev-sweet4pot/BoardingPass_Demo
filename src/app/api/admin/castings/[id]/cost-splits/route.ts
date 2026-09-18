import { NextRequest, NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

/**
 * casting_cost_splits: 한 캐스팅(인플루언서 섭외 건)의 실제 원가를 여러
 * 캠페인(회원사)에 나눠 기록한다 — 다중 고객사 공유 캐스팅의 실 원가 배분.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("casting_cost_splits")
    .select("id, casting_id, campaign_id, amount, is_manual, created_at, updated_at, campaigns ( id, name )")
    .eq("casting_id", id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ splits: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: { campaign_id?: string; amount?: number | string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const campaignId = String(body.campaign_id || "").trim();
  const amount = Math.round(Number(body.amount));
  if (!campaignId) return NextResponse.json({ error: "캠페인을 선택하세요." }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "금액은 0 이상이어야 합니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("casting_cost_splits")
    .upsert(
      { casting_id: id, campaign_id: campaignId, amount, is_manual: true, updated_at: new Date().toISOString() },
      { onConflict: "casting_id,campaign_id" },
    )
    .select("id, casting_id, campaign_id, amount, is_manual, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ split: data });
}
