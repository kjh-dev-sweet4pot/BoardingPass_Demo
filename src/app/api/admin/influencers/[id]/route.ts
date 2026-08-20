import { NextResponse } from "next/server";
import { normalizeHandle } from "@/lib/auth";
import { requireAnyAdmin } from "@/lib/access";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const supabase = await createApiClientIfConfigured();
  if (!supabase) return supabaseConfigError();

  let body: {
    name?: string;
    instagram_handle?: string;
    sns_url?: string | null;
    notes?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const instagramHandle = normalizeHandle(String(body.instagram_handle || ""));
  if (!instagramHandle) {
    return NextResponse.json(
      { error: "인스타그램 핸들을 입력하세요." },
      { status: 400 },
    );
  }

  const name = String(body.name || "").trim() || instagramHandle;
  const snsUrl = String(body.sns_url || "").trim();
  if (snsUrl && !/^https?:\/\//i.test(snsUrl)) {
    return NextResponse.json(
      { error: "SNS URL은 http:// 또는 https:// 로 시작해야 합니다." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("influencers")
    .update({
      name,
      instagram_handle: instagramHandle,
      instagram_handle_normalized: instagramHandle,
      sns_url: snsUrl || null,
      notes: String(body.notes || "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    const status = error.message.toLowerCase().includes("unique") ? 409 : 500;
    return NextResponse.json(
      {
        error:
          status === 409
            ? "이미 사용 중인 인스타그램 핸들입니다."
            : error.message,
      },
      { status },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "인플루언서를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return NextResponse.json({ influencer: data });
}
