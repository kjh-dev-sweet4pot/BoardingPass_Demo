import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { CONTENT_FILES_BUCKET } from "@/lib/content-file-storage";
import {
  createApiClientIfConfigured,
  supabaseConfigError,
} from "@/lib/supabase/api-client";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { getStoreSessionId } from "@/lib/session";

const MAX_BYTES = 8 * 1024 * 1024;
const PREFIX = "phar-display";

function folder(storeId: string) {
  return `${PREFIX}/${storeId}`;
}

async function db() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

export async function GET() {
  const storeId = await getStoreSessionId();
  if (!storeId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const supabase = await db();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase.storage
    .from(CONTENT_FILES_BUCKET)
    .list(folder(storeId), { sortBy: { column: "created_at", order: "desc" } });
  if (error) {
    return NextResponse.json({ photos: [] });
  }

  const files = (data || []).filter((f) => f.name && f.id);
  const photos: { path: string; name: string; url: string }[] = [];
  for (const f of files.slice(0, 24)) {
    const path = `${folder(storeId)}/${f.name}`;
    const signed = await supabase.storage
      .from(CONTENT_FILES_BUCKET)
      .createSignedUrl(path, 60 * 30);
    if (signed.data?.signedUrl) {
      photos.push({ path, name: f.name, url: signed.data.signedUrl });
    }
  }
  return NextResponse.json({ photos });
}

export async function POST(request: Request) {
  const storeId = await getStoreSessionId();
  if (!storeId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const supabase = await db();
  if (!supabase) return supabaseConfigError();

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "사진을 선택하세요." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "사진은 8MB 이하여야 합니다." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "이미지만 올릴 수 있습니다." }, { status: 400 });
  }
  const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
  const path = `${folder(storeId)}/${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(CONTENT_FILES_BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, path });
}

export async function DELETE(request: Request) {
  const storeId = await getStoreSessionId();
  if (!storeId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const supabase = await db();
  if (!supabase) return supabaseConfigError();
  const path = new URL(request.url).searchParams.get("path") || "";
  if (!path.startsWith(`${folder(storeId)}/`)) {
    return NextResponse.json({ error: "잘못된 경로입니다." }, { status: 400 });
  }
  const { error } = await supabase.storage.from(CONTENT_FILES_BUCKET).remove([path]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
