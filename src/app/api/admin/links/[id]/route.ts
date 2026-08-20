import { NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

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

  const { data, error } = await supabase
    .from("creator_links")
    .update({
      status,
      content_status: status === "approved" ? "승인" : "반려",
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
