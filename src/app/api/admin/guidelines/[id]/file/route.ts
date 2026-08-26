import { NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/access";
import { signedContentFileUrl } from "@/lib/content-file-storage";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";

/**
 * GET /api/admin/guidelines/[id]/file
 * 가이드라인 PDF Presigned URL (운영자 검수용, S7)
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { data: guideline, error } = await supabase
    .from("guidelines")
    .select("id, file_path, title")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!guideline?.file_path) {
    return NextResponse.json({ error: "가이드라인 파일이 없습니다." }, { status: 404 });
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
      guideline.file_path,
    );
    return NextResponse.json({
      url,
      title: guideline.title,
      expiresInSec: 60 * 15,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "URL 생성 실패" },
      { status: 500 },
    );
  }
}
