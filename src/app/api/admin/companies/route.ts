import { NextResponse } from "next/server";
import { requireAdminManager, requireAnyAdmin } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { hashPassword } from "@/lib/password";
import {
  COMPANY_SELECT,
  COMPANY_SELECT_BASE,
  COMPANY_SELECT_MAIL,
  companyCrmFieldsFromBody,
  isMissingColumnError,
  isMissingCompanyCrmColumn,
  normalizeLoginId,
} from "@/lib/company";

async function selectCompanies(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
) {
  const first = await supabase
    .from("companies")
    .select(COMPANY_SELECT)
    .order("name", { ascending: true });
  if (!first.error) return first;
  if (isMissingCompanyCrmColumn(first.error.message)) {
    const mail = await supabase
      .from("companies")
      .select(COMPANY_SELECT_MAIL)
      .order("name", { ascending: true });
    if (!mail.error) return mail;
    if (isMissingColumnError(mail.error.message, "contact_email")) {
      return supabase
        .from("companies")
        .select(COMPANY_SELECT_BASE)
        .order("name", { ascending: true });
    }
    return mail;
  }
  if (isMissingColumnError(first.error.message, "contact_email")) {
    return supabase
      .from("companies")
      .select(COMPANY_SELECT_BASE)
      .order("name", { ascending: true });
  }
  return first;
}

export async function GET() {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const res = await selectCompanies(supabase);
  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }
  return NextResponse.json({ companies: res.data || [] });
}

export async function POST(request: Request) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: Record<string, unknown>;
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
  const contact_email = String(body.contact_email || "").trim() || null;
  const crm = companyCrmFieldsFromBody(body, "create");
  if (crm.error) {
    return NextResponse.json({ error: crm.error }, { status: 400 });
  }

  const insertRow: Record<string, unknown> = {
    name,
    login_id,
    password_hash: hashPassword(password),
    aliases,
    contact: String(body.contact || "").trim() || null,
    is_active: body.is_active !== false,
    contact_email,
    ...crm.fields,
  };

  let { data, error } = await supabase
    .from("companies")
    .insert(insertRow)
    .select(COMPANY_SELECT)
    .single();

  if (error && isMissingCompanyCrmColumn(error.message)) {
    for (const key of Object.keys(crm.fields)) delete insertRow[key];
    const retry = await supabase
      .from("companies")
      .insert(insertRow)
      .select(COMPANY_SELECT_MAIL)
      .single();
    data = retry.data as typeof data;
    error = retry.error;
    if (!error) {
      return NextResponse.json({
        company: data,
        warning:
          "계약·예산 컬럼이 DB에 없습니다. scripts/sql/companies-contract-fields.sql 을 실행해 주세요.",
      });
    }
  }

  if (error && isMissingColumnError(error.message, "contact_email")) {
    delete insertRow.contact_email;
    for (const key of Object.keys(crm.fields)) delete insertRow[key];
    const retry = await supabase
      .from("companies")
      .insert(insertRow)
      .select(COMPANY_SELECT_BASE)
      .single();
    data = retry.data as typeof data;
    error = retry.error;
  }

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
