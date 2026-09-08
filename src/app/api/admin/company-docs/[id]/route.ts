import { NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import {
  COMPANY_DOC_KINDS,
  COMPANY_DOC_STATUSES,
  type CompanyDocKind,
  type CompanyDocStatus,
} from "@/lib/company-docs";

const SELECT =
  "id, company_id, kind, title, status, issued_on, payload, created_at, updated_at";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    status?: string;
    issued_on?: string | null;
    payload?: unknown;
    kind?: string;
  };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (COMPANY_DOC_STATUSES.includes(body.status as CompanyDocStatus)) {
    patch.status = body.status;
  }
  if ("issued_on" in body) {
    patch.issued_on = body.issued_on ? String(body.issued_on).slice(0, 10) : null;
  }
  if (body.payload && typeof body.payload === "object") patch.payload = body.payload;
  if (COMPANY_DOC_KINDS.includes(body.kind as CompanyDocKind)) patch.kind = body.kind;

  const { data, error } = await supabase
    .from("company_docs")
    .update(patch)
    .eq("id", id)
    .select(SELECT)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      {
        error: /permission denied/i.test(error.message)
          ? "company_docs 테이블 권한이 없습니다. scripts/sql/company-docs.sql 을 Supabase SQL editor에서 다시 실행하세요."
          : error.message,
      },
      { status: 500 },
    );
  }
  if (!data) return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();
  const { id } = await context.params;
  const { error } = await supabase.from("company_docs").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      {
        error: /permission denied/i.test(error.message)
          ? "company_docs 테이블 권한이 없습니다. scripts/sql/company-docs.sql 을 Supabase SQL editor에서 다시 실행하세요."
          : error.message,
      },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
