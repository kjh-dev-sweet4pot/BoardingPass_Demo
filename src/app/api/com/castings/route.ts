import { NextRequest, NextResponse } from "next/server";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { getCompanySessionId } from "@/lib/session";

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

/** 회원사 소속 섭외 목록 (influencer 정보 포함) */
export async function GET() {
  const companyId = await getCompanySessionId();
  if (!companyId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("castings")
    .select("id, influencer_id, campaign_id, status, created_at, influencers(id, name, instagram_handle, instagram_handle_normalized, sns_url, followers, scale_band)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** 담기 — castings Pending 생성 */
export async function POST(request: NextRequest) {
  const companyId = await getCompanySessionId();
  if (!companyId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { influencer_id, campaign_id } = await request.json();
  if (!influencer_id || !campaign_id)
    return NextResponse.json({ error: "influencer_id, campaign_id 필요" }, { status: 400 });

  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("castings")
    .upsert(
      { company_id: companyId, influencer_id, campaign_id, status: "Pending" },
      { onConflict: "campaign_id,influencer_id" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

/** 제외 — castings 삭제 */
export async function DELETE(request: NextRequest) {
  const companyId = await getCompanySessionId();
  if (!companyId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { casting_id } = await request.json();
  if (!casting_id) return NextResponse.json({ error: "casting_id 필요" }, { status: 400 });

  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  const { error } = await supabase
    .from("castings")
    .delete()
    .eq("id", casting_id)
    .eq("company_id", companyId); // 본인 회원사 것만 삭제

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
