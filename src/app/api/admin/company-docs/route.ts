import { NextResponse } from "next/server";
import { requireAdminManager, requireAnyAdmin } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import {
  COMPANY_DOC_KINDS,
  COMPANY_DOC_STATUSES,
  type CompanyDocKind,
  type CompanyDocStatus,
} from "@/lib/company-docs";

const SELECT =
  "id, company_id, kind, title, status, issued_on, payload, created_at, updated_at";

function missingTable(message: string) {
  return /company_docs/i.test(message) && /does not exist|schema cache|relation/i.test(message);
}

function grantHint(message: string) {
  if (!/permission denied/i.test(message)) return null;
  return NextResponse.json(
    {
      error:
        "company_docs 테이블 권한이 없습니다. scripts/sql/company-docs.sql 을 Supabase SQL editor에서 다시 실행하세요. (GRANT + 운영자 정책)",
    },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id") || "";
  if (!companyId) {
    return NextResponse.json({ error: "회원사를 선택하세요." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("company_docs")
    .select(SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    if (missingTable(error.message)) {
      return NextResponse.json(
        {
          error:
            "company_docs 테이블이 없습니다. scripts/sql/company-docs.sql 을 Supabase SQL editor에서 실행하세요.",
        },
        { status: 500 },
      );
    }
    const denied = grantHint(error.message);
    if (denied) return denied;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ docs: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const body = (await request.json().catch(() => ({}))) as {
    company_id?: string;
    kind?: string;
    title?: string;
    status?: string;
    issued_on?: string | null;
    payload?: unknown;
  };
  const companyId = String(body.company_id || "").trim();
  const kind = body.kind as CompanyDocKind;
  if (!companyId) {
    return NextResponse.json({ error: "회원사를 선택하세요." }, { status: 400 });
  }
  if (!COMPANY_DOC_KINDS.includes(kind)) {
    return NextResponse.json({ error: "계약서 또는 인보이스를 선택하세요." }, { status: 400 });
  }
  const status = (COMPANY_DOC_STATUSES as readonly string[]).includes(String(body.status))
    ? (body.status as CompanyDocStatus)
    : "초안";
  const issuedOn = body.issued_on ? String(body.issued_on).slice(0, 10) : null;
  const title = String(body.title || "").trim() || `${kind} ${issuedOn || ""}`.trim();

  const { data, error } = await supabase
    .from("company_docs")
    .insert({
      company_id: companyId,
      kind,
      title,
      status,
      issued_on: issuedOn,
      payload: body.payload && typeof body.payload === "object" ? body.payload : {},
    })
    .select(SELECT)
    .single();

  if (error) {
    if (missingTable(error.message)) {
      return NextResponse.json(
        {
          error:
            "company_docs 테이블이 없습니다. scripts/sql/company-docs.sql 을 Supabase SQL editor에서 실행하세요.",
        },
        { status: 500 },
      );
    }
    const denied = grantHint(error.message);
    if (denied) return denied;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
