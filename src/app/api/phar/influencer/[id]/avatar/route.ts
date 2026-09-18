import { NextResponse } from "next/server";
import {
  downloadInfluencerAvatarBytes,
  signedInfluencerAvatarUrl,
  storageClientForAvatars,
} from "@/lib/influencer-profile-image";
import {
  createApiClientIfConfigured,
  supabaseConfigError,
} from "@/lib/supabase/api-client";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { getStoreSessionId, isAdminSession } from "@/lib/session";

/**
 * Phar(지점)·Admin 세션에서 인플루언서 프로필 사진 조회.
 * Admin avatar API(/api/admin/influencers/[id]/avatar)는 requireAnyAdmin()으로
 * 보호되어 있으므로 phar 용 별도 엔드포인트를 제공한다.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const isAdmin = await isAdminSession();
  const storeId = await getStoreSessionId();

  if (!isAdmin && !storeId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;

  const supabase = hasServiceRoleKey()
    ? createServiceClient()
    : await createApiClientIfConfigured();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("influencers")
    .select("id, profile_image_path")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "인플루언서를 찾을 수 없습니다." }, { status: 404 });
  if (!data.profile_image_path) return new NextResponse(null, { status: 404 });

  const storage = storageClientForAvatars(supabase);

  try {
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
  } catch {
    // service_role 없으면 signed URL로 redirect
    try {
      const signed = await signedInfluencerAvatarUrl(storage, data.profile_image_path);
      return NextResponse.redirect(signed, 302);
    } catch {
      return new NextResponse(null, { status: 404 });
    }
  }
}
