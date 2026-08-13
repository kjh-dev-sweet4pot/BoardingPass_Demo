import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminSession } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";

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

  let body: { status?: string; memo?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const status = String(body.status || "");
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json(
      { error: "승인 또는 반려만 가능합니다." },
      { status: 400 },
    );
  }
  if (status === "rejected" && !String(body.memo || "").trim()) {
    return NextResponse.json(
      { error: "반려 사유를 입력하세요." },
      { status: 400 },
    );
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("creator_links")
    .update({
      status,
      memo: status === "rejected" ? String(body.memo || "").trim() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "링크를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ link: data });
}
