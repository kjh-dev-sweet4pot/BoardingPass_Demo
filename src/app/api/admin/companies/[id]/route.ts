import { NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: Record<string, unknown>;
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
  if ("contact_email" in body) {
    patch.contact_email = String(body.contact_email || "").trim() || null;
  }
  if ("is_active" in body) {
    patch.is_active = Boolean(body.is_active);
  }

  const crm = companyCrmFieldsFromBody(body, "patch");
  if (crm.error) {
    return NextResponse.json({ error: crm.error }, { status: 400 });
  }
  Object.assign(patch, crm.fields);

  let { data, error } = await supabase
    .from("companies")
    .update(patch)
    .eq("id", id)
    .select(COMPANY_SELECT)
    .maybeSingle();

  if (error && isMissingCompanyCrmColumn(error.message)) {
    for (const key of Object.keys(crm.fields)) delete patch[key];
    const retry = await supabase
      .from("companies")
      .update(patch)
      .eq("id", id)
      .select(COMPANY_SELECT_MAIL)
      .maybeSingle();
    data = retry.data as typeof data;
    error = retry.error;
    if (!error && data) {
      return NextResponse.json({
        company: data,
        warning:
          "계약·예산 컬럼이 DB에 없습니다. scripts/sql/companies-contract-fields.sql 을 실행해 주세요.",
      });
    }
  }

  if (error && isMissingColumnError(error.message, "contact_email")) {
    delete patch.contact_email;
    for (const key of Object.keys(crm.fields)) delete patch[key];
    const retry = await supabase
      .from("companies")
      .update(patch)
      .eq("id", id)
      .select(COMPANY_SELECT_BASE)
      .maybeSingle();
    data = retry.data as typeof data;
    error = retry.error;
  }

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
