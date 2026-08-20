import { NextResponse } from "next/server";
import { requireAdminManager, requireAnyAdmin } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { hashPassword } from "@/lib/password";
import { normalizeLoginId } from "@/lib/company";

const COMPANY_SELECT =
  "id, name, login_id, aliases, contact, is_active, created_at, updated_at";

export async function GET() {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_SELECT)
    .order("name", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ companies: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

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

  const name = String(body.name || "").trim();
  const login_id = normalizeLoginId(String(body.login_id || ""));
  const password = String(body.password || "");
  if (!name) {
    return NextResponse.json({ error: "회원사명을 입력하세요." }, { status: 400 });
  }
  if (!login_id) {
    return NextResponse.json({ error: "로그인 아이디를 입력하세요." }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "비밀번호를 입력하세요." }, { status: 400 });
  }

  const aliases = Array.isArray(body.aliases)
    ? body.aliases.map((a) => String(a).trim()).filter(Boolean)
    : [];

  const { data, error } = await supabase
    .from("companies")
    .insert({
      name,
      login_id,
      password_hash: hashPassword(password),
      aliases,
      contact: String(body.contact || "").trim() || null,
      is_active: body.is_active !== false,
    })
    .select(COMPANY_SELECT)
    .single();

  if (error || !data) {
    const msg = error?.message || "회원사 생성에 실패했습니다.";
    const status = msg.toLowerCase().includes("unique") ? 409 : 500;
    return NextResponse.json(
      {
        error: status === 409 ? "이미 사용 중인 회원사명 또는 아이디입니다." : msg,
      },
      { status },
    );
  }

  return NextResponse.json({ company: data });
}
