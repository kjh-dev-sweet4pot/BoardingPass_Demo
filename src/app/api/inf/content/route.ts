import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  uploadContentFile,
  validateContentUpload,
} from "@/lib/content-file-storage";
import { getInfluencerSessionId } from "@/lib/session";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

/** 콘텐츠 파일 업로드 → creator_links content_status `제출` */
export async function POST(request: Request) {
  const influencerId = await getInfluencerSessionId();
  if (!influencerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const allocationId = String(formData.get("allocation_id") || "").trim();
  const file = formData.get("file");
  if (!allocationId) {
    return NextResponse.json({ error: "배정이 필요합니다." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일을 선택하세요." }, { status: 400 });
  }

  const fileError = validateContentUpload(file);
  if (fileError) {
    return NextResponse.json({ error: fileError }, { status: 400 });
  }

  const { data: allocation, error: allocErr } = await supabase
    .from("allocations")
    .select("id, influencer_id, company_id, status")
    .eq("id", allocationId)
    .maybeSingle();

  if (allocErr) {
    return NextResponse.json({ error: allocErr.message }, { status: 500 });
  }
  if (!allocation) {
    return NextResponse.json({ error: "배정을 찾을 수 없습니다." }, { status: 404 });
  }
  if (allocation.influencer_id !== influencerId) {
    return NextResponse.json({ error: "본인 배정만 제출할 수 있습니다." }, { status: 403 });
  }
  if (allocation.status !== "picked_up") {
    return NextResponse.json(
      { error: "수령 완료 후 제출할 수 있습니다." },
      { status: 400 },
    );
  }
  if (!allocation.company_id) {
    return NextResponse.json({ error: "회원사 정보가 없습니다." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("creator_links")
    .select("id, status, content_status")
    .eq("allocation_id", allocationId)
    .neq("status", "rejected")
    .maybeSingle();

  if (existing?.id) {
    return NextResponse.json(
      { error: "이미 제출된 콘텐츠가 있습니다." },
      { status: 409 },
    );
  }

  const fileId = randomUUID();
  const bytes = Buffer.from(await file.arrayBuffer());

  let objectPath: string;
  try {
    if (!hasServiceRoleKey()) {
      return NextResponse.json(
        { error: "파일 업로드 설정(SERVICE_ROLE)이 필요합니다." },
        { status: 500 },
      );
    }
    const uploaded = await uploadContentFile(createServiceClient(), {
      companyId: allocation.company_id,
      fileId,
      filename: file.name || "content",
      bytes,
      contentType: file.type || "application/octet-stream",
    });
    objectPath = uploaded.path;
  } catch (e) {
    const message = e instanceof Error ? e.message : "업로드 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { data: created, error: insErr } = await supabase
    .from("creator_links")
    .insert({
      allocation_id: allocationId,
      influencer_id: influencerId,
      url: `content://${fileId}`,
      platform: "etc",
      status: "submitted",
      content_status: "제출",
      submitted_file_path: objectPath,
      submitted_at: now,
      updated_at: now,
    })
    .select(
      "id, allocation_id, status, content_status, submitted_file_path, submitted_at",
    )
    .single();

  if (insErr || !created) {
    return NextResponse.json(
      { error: insErr?.message || "제출 생성 실패" },
      { status: 500 },
    );
  }

  return NextResponse.json({ link: created }, { status: 201 });
}
