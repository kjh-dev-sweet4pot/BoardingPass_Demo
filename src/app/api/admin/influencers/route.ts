import { NextResponse } from "next/server";
import { normalizeHandle } from "@/lib/auth";
import { requireAnyAdmin, requireAdminManager } from "@/lib/access";
import { scheduleInfluencerProfileFetch } from "@/lib/influencer-profile-image";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

const INFLUENCER_SELECT =
  "id, name, instagram_handle, instagram_handle_normalized, sns_url, profile_image_path, followers, region, notes, created_at, updated_at";

export async function GET() {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("influencers")
    .select(INFLUENCER_SELECT)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ influencers: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

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

  const handle = normalizeHandle(String(body.instagram_handle || ""));
  if (!handle) {
    return NextResponse.json(
      { error: "인스타그램 핸들을 입력하세요." },
      { status: 400 },
    );
  }
  const name = String(body.name || "").trim() || handle;
  const snsUrl = String(body.sns_url || "").trim();
  if (snsUrl && !/^https?:\/\//i.test(snsUrl)) {
    return NextResponse.json(
      { error: "SNS URL은 http:// 또는 https:// 로 시작해야 합니다." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("influencers")
    .insert({
      name,
      instagram_handle: handle,
      instagram_handle_normalized: handle,
      sns_url: snsUrl || null,
      notes: String(body.notes || "").trim() || null,
      region: String(body.region || "").trim() || null,
    })
    .select(INFLUENCER_SELECT)
    .single();

  if (error || !data) {
    const msg = error?.message || "인플루언서 생성에 실패했습니다.";
    const status = msg.toLowerCase().includes("unique") ? 409 : 500;
    return NextResponse.json(
      {
        error:
          status === 409 ? "이미 등록된 인스타그램 핸들입니다." : msg,
      },
      { status },
    );
  }

  scheduleInfluencerProfileFetch(supabase, data.id, {
    handle,
    snsUrl: snsUrl || null,
  });

  return NextResponse.json({ influencer: data });
}
