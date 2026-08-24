import { NextResponse } from "next/server";
import { signedContentFileUrl } from "@/lib/content-file-storage";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { getCompanySessionId } from "@/lib/session";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";

/** 제출 파일 Presigned URL (회원사 검수용, S7) */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const companyId = await getCompanySessionId();
  if (!companyId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = hasServiceRoleKey()
    ? createServiceClient()
    : await createApiClientIfConfigured();
  if (!supabase) return supabaseConfigError();

  const { data: link, error } = await supabase
    .from("creator_links")
    .select("id, submitted_file_path, allocations!inner(company_id)")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!link?.submitted_file_path) {
    return NextResponse.json({ error: "제출 파일이 없습니다." }, { status: 404 });
  }

  const alloc = link.allocations as { company_id?: string } | { company_id?: string }[];
  const ownerId = Array.isArray(alloc) ? alloc[0]?.company_id : alloc?.company_id;
  if (ownerId !== companyId) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: "SERVICE_ROLE 키가 필요합니다." },
      { status: 500 },
    );
  }

  try {
    const url = await signedContentFileUrl(
      createServiceClient(),
      link.submitted_file_path,
    );
    return NextResponse.json({ url, expiresInSec: 60 * 15 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "URL 생성 실패" },
      { status: 500 },
    );
  }
}
