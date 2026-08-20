import { NextResponse } from "next/server";
import {
  downloadInfluencerAvatarBytes,
  storageClientForAvatars,
} from "@/lib/influencer-profile-image";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { getCompanySessionId } from "@/lib/session";

/** 회원사 세션 — 자사 배정 인플루언서 프로필 (Storage) */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const companyId = await getCompanySessionId();
  if (!companyId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { data: allocation, error: allocErr } = await supabase
    .from("allocations")
    .select("id")
    .eq("company_id", companyId)
    .eq("influencer_id", id)
    .limit(1)
    .maybeSingle();

  if (allocErr) return NextResponse.json({ error: allocErr.message }, { status: 500 });
  if (!allocation) {
    return NextResponse.json({ error: "해당 인플루언서의 자사 배정이 없습니다." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("influencers")
    .select("profile_image_path")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.profile_image_path) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const storage = storageClientForAvatars(supabase);
    const { bytes, contentType } = await downloadInfluencerAvatarBytes(
      storage,
      data.profile_image_path,
    );
    const cacheBust = new URL(request.url).searchParams.get("v") || "";
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheBust ? "private, no-cache" : "private, max-age=300",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "프로필 이미지를 불러오지 못했습니다.",
      },
      { status: 404 },
    );
  }
}
