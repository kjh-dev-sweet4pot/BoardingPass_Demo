import { NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/access";
import {
  downloadInfluencerAvatarBytes,
  fetchAndStoreInfluencerProfile,
  scheduleInfluencerProfileFetch,
  signedInfluencerAvatarUrl,
  storageClientForAvatars,
} from "@/lib/influencer-profile-image";
import { updateBatchInfluencerProfileStatus } from "@/lib/import-batch-log";
import {
  ADMIN_DB_AUTH_HINT,
  createAdminDbClient,
} from "@/lib/supabase/api-client";
import { hasServiceRoleKey } from "@/lib/supabase/service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const db = await createAdminDbClient();
  if ("error" in db) return db.error;

  const { data, error } = await db.supabase
    .from("influencers")
    .select("id, profile_image_path, instagram_handle, instagram_handle_normalized, sns_url")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "인플루언서를 찾을 수 없습니다." }, { status: 404 });

  if (!data.profile_image_path && process.env.APIFY_TOKEN?.trim()) {
    scheduleInfluencerProfileFetch(db.supabase, id, {
      handle: data.instagram_handle_normalized || data.instagram_handle,
      snsUrl: data.sns_url,
    });
    return new NextResponse(null, { status: 404 });
  }

  if (!data.profile_image_path) {
    return new NextResponse(null, { status: 404 });
  }

  const storage = storageClientForAvatars(db.supabase);

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
  } catch (downloadErr) {
    if (!hasServiceRoleKey()) {
      try {
        const signed = await signedInfluencerAvatarUrl(storage, data.profile_image_path);
        return NextResponse.redirect(signed, 302);
      } catch {
        return NextResponse.json(
          {
            error:
              downloadErr instanceof Error
                ? downloadErr.message
                : "프로필 이미지 로드 실패",
            hint: ADMIN_DB_AUTH_HINT,
          },
          { status: 404 },
        );
      }
    }
    return NextResponse.json(
      {
        error:
          downloadErr instanceof Error
            ? downloadErr.message
            : "Storage에서 프로필 이미지를 불러오지 못했습니다.",
      },
      { status: 404 },
    );
  }
}

/** 수동 프로필 수집 (검증실패·재시도 등) */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const db = await createAdminDbClient();
  if ("error" in db) return db.error;

  if (!process.env.APIFY_TOKEN?.trim()) {
    return NextResponse.json({ error: "APIFY_TOKEN 환경변수가 없습니다." }, { status: 500 });
  }

  let batchInfluencerId: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body.batchInfluencerId === "string") {
      batchInfluencerId = body.batchInfluencerId;
    }
  } catch {
    // body 없음 OK
  }

  const { data, error } = await db.supabase
    .from("influencers")
    .select("id, instagram_handle, instagram_handle_normalized, sns_url")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "인플루언서를 찾을 수 없습니다." }, { status: 404 });

  const storage = storageClientForAvatars(db.supabase);

  try {
    const path = await fetchAndStoreInfluencerProfile(storage, id, {
      handle: data.instagram_handle_normalized || data.instagram_handle,
      snsUrl: data.sns_url,
    });
    if (!path) {
      if (batchInfluencerId) {
        await updateBatchInfluencerProfileStatus(
          db.supabase,
          batchInfluencerId,
          "failed",
          "프로필 이미지를 찾지 못했습니다.",
        );
      }
      return NextResponse.json({ error: "프로필 이미지를 찾지 못했습니다." }, { status: 404 });
    }
    if (batchInfluencerId) {
      await updateBatchInfluencerProfileStatus(db.supabase, batchInfluencerId, "ok", null);
    }
    return NextResponse.json({ ok: true, profile_image_path: path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "프로필 수집 실패";
    if (batchInfluencerId) {
      await updateBatchInfluencerProfileStatus(db.supabase, batchInfluencerId, "failed", message);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
