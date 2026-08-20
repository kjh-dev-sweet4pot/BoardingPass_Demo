import { NextResponse } from "next/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { getCompanySessionId } from "@/lib/session";

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

/** 회원사 소속 캠페인 목록 (배정 + 콘텐츠 포함) */
export async function GET() {
  const companyId = await getCompanySessionId();
  if (!companyId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("campaigns")
    .select(`
      id, name, status, created_at,
      allocations (
        id, status, target_content_count, influencer_id,
        influencers (id, name, instagram_handle_normalized, instagram_handle),
        creator_links (id, status, link_url, submitted_at, verification_failed)
      )
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
