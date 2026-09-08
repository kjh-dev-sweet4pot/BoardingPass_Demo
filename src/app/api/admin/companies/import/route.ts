import { NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { createCompanyFromBody } from "@/lib/company-write";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { type Company } from "@/lib/types";

export async function POST(request: Request) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: { rows?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "등록할 행이 없습니다." }, { status: 400 });
  }
  if (rows.length > 200) {
    return NextResponse.json({ error: "한 번에 200행까지 등록할 수 있습니다." }, { status: 400 });
  }

  const created: Company[] = [];
  const failures: { row: number; name: string; error: string }[] = [];
  let warning: string | undefined;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== "object") {
      failures.push({ row: i + 1, name: "", error: "행 형식이 올바르지 않습니다." });
      continue;
    }
    const rec = row as Record<string, unknown>;
    const result = await createCompanyFromBody(supabase, rec);
    if ("error" in result) {
      failures.push({
        row: i + 1,
        name: String(rec.name || ""),
        error: result.error,
      });
      continue;
    }
    created.push(result.company);
    if (result.warning) warning = result.warning;
  }

  return NextResponse.json({
    created,
    failures,
    warning,
  });
}
