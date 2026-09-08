import { NextResponse } from "next/server";
import { requireAdminManager, requireAnyAdmin } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import {
  COMPANY_SELECT,
  COMPANY_SELECT_BASE,
  COMPANY_SELECT_MAIL,
  isMissingColumnError,
  isMissingCompanyCrmColumn,
} from "@/lib/company";
import { createCompanyFromBody } from "@/lib/company-write";

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

  const result = await createCompanyFromBody(supabase, body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    company: result.company,
    warning: result.warning,
  });
}
