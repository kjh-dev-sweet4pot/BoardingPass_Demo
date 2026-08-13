import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminSession } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { normalizeCompanyKey } from "@/lib/company";

const COMPANY_SELECT =
  "id, name, login_id, aliases, contact, is_active, created_at, updated_at";

export async function POST(
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

  let body: { alias?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const alias = String(body.alias || "").trim();
  if (!alias) {
    return NextResponse.json({ error: "별칭을 입력하세요." }, { status: 400 });
  }

  const supabase = createClient(url, key);
  const { data: current, error: fetchError } = await supabase
    .from("companies")
    .select("id, aliases")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json(
      { error: "회원사를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const aliases: string[] = Array.isArray(current.aliases)
    ? [...current.aliases]
    : [];
  const keyNorm = normalizeCompanyKey(alias);
  const exists = aliases.some((a) => normalizeCompanyKey(a) === keyNorm);
  if (!exists) aliases.push(alias);

  const { data, error } = await supabase
    .from("companies")
    .update({ aliases, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(COMPANY_SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "별칭 추가에 실패했습니다." },
      { status: 500 },
    );
  }
  return NextResponse.json({ company: data });
}
