import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { getCompanySessionId } from "@/lib/session";

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

/** 회원사 의견 등록 */
export async function POST(request: NextRequest) {
  const companyId = await getCompanySessionId();
  if (!companyId) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { creator_link_id, comment, body: bodyText } = await request.json();
  const text = String(bodyText || comment || "").trim();
  if (!creator_link_id || !text)
    return NextResponse.json({ error: "creator_link_id, body 필요" }, { status: 400 });

  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  // 해당 링크가 이 회원사 소속인지 확인
  const { data: link } = await supabase
    .from("creator_links")
    .select("id, allocations!inner(company_id)")
    .eq("id", creator_link_id)
    .maybeSingle();

  if (!link) return NextResponse.json({ error: "콘텐츠를 찾을 수 없습니다." }, { status: 404 });
  const alloc = (link as any).allocations;
  if (alloc?.company_id !== companyId)
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const { data, error } = await supabase
    .from("content_feedback")
    .insert({ creator_link_id, company_id: companyId, body: text })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
