import { NextRequest, NextResponse } from "next/server";
import { requireAnyAdmin, requireAdminManager } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { type CampaignStatus } from "@/lib/types";

const CAMPAIGN_SELECT = `
  id, name, status, company_id, product_id, created_at, updated_at,
  companies ( id, name ),
  products ( id, name, sku )
`;

const HOLD_CANCEL: CampaignStatus[] = ["보류", "취소"];

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
    .from("campaigns")
    .select(CAMPAIGN_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ campaign: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const status = body.status as CampaignStatus | undefined;
  if (!status || !HOLD_CANCEL.includes(status)) {
    return NextResponse.json(
      { error: "보류 또는 취소만 지정할 수 있습니다." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("campaigns")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(CAMPAIGN_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data });
}
