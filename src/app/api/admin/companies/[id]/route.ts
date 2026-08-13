import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminSession } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { hashPassword } from "@/lib/password";
import { normalizeLoginId } from "@/lib/company";

const COMPANY_SELECT =
  "id, name, login_id, aliases, contact, is_active, created_at, updated_at";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }
  const { id } = await context.params;
  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  let body: {
    name?: string;
    login_id?: string;
    password?: string;
    aliases?: string[];
    contact?: string | null;
    is_active?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if ("name" in body) {
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "회원사명을 입력하세요." }, { status: 400 });
    }
    patch.name = name;
  }
  if ("login_id" in body) {
    const login_id = normalizeLoginId(String(body.login_id || ""));
    if (!login_id) {
      return NextResponse.json(
        { error: "로그인 아이디를 입력하세요." },
        { status: 400 },
      );
    }
    patch.login_id = login_id;
  }
  if ("password" in body && String(body.password || "")) {
    patch.password_hash = hashPassword(String(body.password));
  }
  if ("aliases" in body) {
    patch.aliases = Array.isArray(body.aliases)
      ? body.aliases.map((a) => String(a).trim()).filter(Boolean)
      : [];
  }
  if ("contact" in body) {
    patch.contact = String(body.contact || "").trim() || null;
  }
  if ("is_active" in body) {
    patch.is_active = Boolean(body.is_active);
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("companies")
    .update(patch)
    .eq("id", id)
    .select(COMPANY_SELECT)
    .maybeSingle();

  if (error) {
    const status = error.message.toLowerCase().includes("unique") ? 409 : 500;
    return NextResponse.json(
      {
        error:
          status === 409
            ? "이미 사용 중인 회원사명 또는 아이디입니다."
            : error.message,
      },
      { status },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "회원사를 찾을 수 없습니다." },
      { status: 404 },
    );
  }
  return NextResponse.json({ company: data });
}
