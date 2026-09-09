import { NextResponse } from "next/server";
import { requireAdminManager, requireAnyAdmin } from "@/lib/access";
import {
  loadAdminMailProfile,
  saveAdminMailProfile,
} from "@/lib/admin-mail-profile";
import { ADMIN_USERNAME, getAdminLoginId } from "@/lib/session";
import { createAdminDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

const SIG_MAX = 2 * 1024 * 1024;

async function loginKey() {
  return (await getAdminLoginId())?.trim().toLowerCase() || ADMIN_USERNAME;
}

export async function GET() {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;
  const db = await createAdminDbClient();
  if ("error" in db) return db.error;
  const profile = await loadAdminMailProfile(db.supabase, await loginKey());
  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const db = await createAdminDbClient();
  if ("error" in db) return db.error;
  if (!db.supabase) return supabaseConfigError();

  const form = await request.formData();
  const displayName = String(form.get("display_name") || "").trim();
  const file = form.get("file");
  const upload = file instanceof File && file.size ? file : null;
  if (upload) {
    if (upload.size > SIG_MAX) {
      return NextResponse.json({ error: "서명 사진은 2MB 이하여야 합니다." }, { status: 400 });
    }
    if (!upload.type.startsWith("image/")) {
      return NextResponse.json({ error: "이미지 파일만 등록할 수 있습니다." }, { status: 400 });
    }
  }
  try {
    await saveAdminMailProfile(db.supabase, await loginKey(), {
      displayName,
      file: upload,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "저장 실패" },
      { status: 500 },
    );
  }
  const profile = await loadAdminMailProfile(db.supabase, await loginKey());
  return NextResponse.json({ ok: true, profile });
}
