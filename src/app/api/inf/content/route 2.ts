import { NextResponse, after } from "next/server";
import { randomUUID } from "crypto";
import {
  uploadContentFile,
  validateContentUpload,
} from "@/lib/content-file-storage";
import {
  collectInstagramLinkThumbnail,
  collectTikTokLinkThumbnail,
} from "@/lib/collect-link-thumbnail";
import { detectPlatform, validateCreatorUrl } from "@/lib/creator-link";
import { getInfluencerSessionId } from "@/lib/session";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

/** 콘텐츠 제출 → content_status `제출` (파일 및/또는 SNS URL) */
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
  const snsUrl = String(formData.get("url") || "").trim();
  const fileRaw = formData.get("file");
  const file = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null;

  if (!allocationId) {
    return NextResponse.json({ error: "배정이 필요합니다." }, { status: 400 });
  }
  if (!file && !snsUrl) {
    return NextResponse.json(
      { error: "파일 또는 SNS URL을 입력하세요." },
      { status: 400 },
    );
  }

  if (snsUrl) {
    const urlError = validateCreatorUrl(snsUrl);
    if (urlError) return NextResponse.json({ error: urlError }, { status: 400 });
  }

  if (file) {
    const fileError = validateContentUpload(file);
    if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });
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

  let objectPath: string | null = null;
  let fileId: string = randomUUID();

  if (file) {
    if (!allocation.company_id) {
      return NextResponse.json({ error: "회원사 정보가 없습니다." }, { status: 400 });
    }
    if (!hasServiceRoleKey()) {
      return NextResponse.json(
        { error: "파일 업로드 설정(SERVICE_ROLE)이 필요합니다." },
        { status: 500 },
      );
    }
    try {
      const uploaded = await uploadContentFile(createServiceClient(), {
        companyId: allocation.company_id,
        fileId,
        filename: file.name || "content",
        bytes: Buffer.from(await file.arrayBuffer()),
        contentType: file.type || "application/octet-stream",
      });
      objectPath = uploaded.path;
      fileId = uploaded.fileId;
    } catch (e) {
      const message = e instanceof Error ? e.message : "업로드 실패";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const now = new Date().toISOString();
  const url = snsUrl || `content://${fileId}`;
  const platform = snsUrl ? detectPlatform(snsUrl) : "etc";

  const { data: created, error: insErr } = await supabase
    .from("creator_links")
    .insert({
      allocation_id: allocationId,
      influencer_id: influencerId,
      url,
      platform,
      status: "submitted",
      content_status: "제출",
      submitted_file_path: objectPath,
      thumbnail_status: snsUrl ? "pending" : undefined,
      submitted_at: now,
      updated_at: now,
    })
    .select(
      "id, allocation_id, url, platform, status, content_status, submitted_file_path, submitted_at",
    )
    .single();

  if (insErr || !created) {
    return NextResponse.json(
      { error: insErr?.message || "제출 생성 실패" },
      { status: 500 },
    );
  }

  if (snsUrl && created.platform === "tiktok") {
    after(async () => {
      await collectTikTokLinkThumbnail(supabase, created.id, snsUrl);
    });
  }
  if (snsUrl && created.platform === "instagram") {
    after(async () => {
      await collectInstagramLinkThumbnail(supabase, created.id, snsUrl);
    });
  }

  return NextResponse.json({ link: created }, { status: 201 });
}
