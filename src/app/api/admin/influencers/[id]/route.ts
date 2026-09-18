import { NextResponse } from "next/server";
import { normalizeHandle } from "@/lib/auth";
import { requireAnyAdmin } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

/**
 * GET /api/admin/influencers/[id]
 * 이 인플루언서의 가장 최근 배정(allocation) 지점·방문일 힌트 — 다른 회사에
 * 이미 배정돼 있다면 같은 지점·날짜를 그대로 재사용할 수 있게 제공한다.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("allocations")
    .select("store_id, visit_date, stores ( id, name )")
    .eq("influencer_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const storeRaw = data?.stores as { id: string; name: string } | { id: string; name: string }[] | null;
  const store = Array.isArray(storeRaw) ? storeRaw[0] : storeRaw;

  return NextResponse.json({
    latestAllocation: data
      ? { store_id: data.store_id, store_name: store?.name ?? null, visit_date: data.visit_date }
      : null,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: {
    name?: string;
    instagram_handle?: string;
    sns_url?: string | null;
    notes?: string | null;
    region?: string | null;
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

  const patch: Record<string, unknown> = {
    name,
    instagram_handle: instagramHandle,
    instagram_handle_normalized: instagramHandle,
    sns_url: snsUrl || null,
    notes: String(body.notes || "").trim() || null,
    updated_at: new Date().toISOString(),
  };
  if ("region" in body) {
    patch.region = String(body.region || "").trim() || null;
  }

  const { data, error } = await supabase
    .from("influencers")
    .update(patch)
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
