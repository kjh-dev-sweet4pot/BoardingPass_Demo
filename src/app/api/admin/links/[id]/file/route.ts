import { NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/access";
import { signedContentFileUrl } from "@/lib/content-file-storage";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { hasServiceRoleKey, createServiceClient } from "@/lib/supabase/service";

/** 제출 파일 Presigned URL (운영자 검수용, S7) */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { data: link, error } = await supabase
    .from("creator_links")
    .select("id, submitted_file_path")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!link?.submitted_file_path) {
    return NextResponse.json({ error: "제출 파일이 없습니다." }, { status: 404 });
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
