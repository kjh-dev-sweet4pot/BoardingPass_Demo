import { NextResponse, after } from "next/server";
import { randomUUID } from "crypto";
import {
  CONTENT_FILES_BUCKET,
  contentFileObjectPath,
  validateContentUpload,
} from "@/lib/content-file-storage";
import {
  collectInstagramLinkThumbnail,
  collectTikTokLinkThumbnail,
  collectXiaohongshuLinkThumbnail,
} from "@/lib/collect-link-thumbnail";
import { detectPlatform, validateCreatorUrl } from "@/lib/creator-link";
import { getInfluencerSessionId } from "@/lib/session";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";

async function getClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

/** 콘텐츠 제출. `sign: true`면 Storage 직접 업로드용 URL만 발급 (Vercel 본문 한도 우회). */
export async function POST(request: Request) {
  const influencerId = await getInfluencerSessionId();
  if (!influencerId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = await getClient();
  if (!supabase) return supabaseConfigError();

  let body: {
    sign?: boolean;
    allocation_id?: string;
    url?: string;
    object_path?: string;
    filename?: string;
    content_type?: string;
    size?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const allocationId = String(body.allocation_id || "").trim();
  const snsUrl = String(body.url || "").trim();
  const objectPath = String(body.object_path || "").trim() || null;
  if (!allocationId) {
    return NextResponse.json({ error: "배정이 필요합니다." }, { status: 400 });
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
    .select("id")
    .eq("allocation_id", allocationId)
    .neq("status", "rejected")
    .maybeSingle();

  if (existing?.id) {
    return NextResponse.json(
      { error: "이미 제출된 콘텐츠가 있습니다." },
      { status: 409 },
    );
  }

  if (body.sign) {
    if (!allocation.company_id) {
      return NextResponse.json({ error: "회원사 정보가 없습니다." }, { status: 400 });
    }
    if (!hasServiceRoleKey()) {
      return NextResponse.json(
        { error: "파일 업로드 설정(SERVICE_ROLE)이 필요합니다." },
        { status: 500 },
      );
    }
    const metaErr = validateContentUpload({
      size: Number(body.size) || 0,
      type: String(body.content_type || ""),
    });
    if (metaErr) return NextResponse.json({ error: metaErr }, { status: 400 });

    const fileId = randomUUID();
    const path = contentFileObjectPath(
      allocation.company_id,
      fileId,
      String(body.filename || "content"),
    );
    const { data, error } = await createServiceClient()
      .storage.from(CONTENT_FILES_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data?.token) {
      return NextResponse.json(
        { error: error?.message || "업로드 URL 생성 실패" },
        { status: 500 },
      );
    }
    return NextResponse.json({ path, token: data.token, file_id: fileId });
  }

  if (!objectPath && !snsUrl) {
    return NextResponse.json(
      { error: "파일 또는 SNS URL을 입력하세요." },
      { status: 400 },
    );
  }
  if (snsUrl) {
    const urlError = validateCreatorUrl(snsUrl);
    if (urlError) return NextResponse.json({ error: urlError }, { status: 400 });
  }

  let fileId: string | null = null;
  let verifiedPath: string | null = null;
  if (objectPath) {
    if (!allocation.company_id) {
      return NextResponse.json({ error: "회원사 정보가 없습니다." }, { status: 400 });
    }
    const parts = objectPath.split("/");
    if (parts.length !== 3 || parts[0] !== allocation.company_id || !parts[1]) {
      return NextResponse.json({ error: "잘못된 파일 경로입니다." }, { status: 400 });
    }
    if (!hasServiceRoleKey()) {
      return NextResponse.json(
        { error: "파일 업로드 설정(SERVICE_ROLE)이 필요합니다." },
        { status: 500 },
      );
    }
    const { error: miss } = await createServiceClient()
      .storage.from(CONTENT_FILES_BUCKET)
      .createSignedUrl(objectPath, 60);
    if (miss) {
      return NextResponse.json(
        { error: "업로드된 파일을 찾을 수 없습니다." },
        { status: 400 },
      );
    }
    fileId = parts[1];
    verifiedPath = objectPath;
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
      submitted_file_path: verifiedPath,
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
  if (snsUrl && (created.platform === "xiaohongshu" || detectPlatform(snsUrl) === "xiaohongshu")) {
    after(async () => {
      await collectXiaohongshuLinkThumbnail(supabase, created.id, snsUrl);
    });
  }

  return NextResponse.json({ link: created }, { status: 201 });
}
