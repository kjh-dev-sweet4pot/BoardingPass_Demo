"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  clearAdminSession,
  clearInfluencerSession,
  isValidAdminCredentials,
  setAdminSession,
  setInfluencerSessionId,
} from "@/lib/session";

export async function signInAdmin(formData: FormData) {
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");

  if (!isValidAdminCredentials(username, password)) {
    redirect(
      `/admin/login?error=${encodeURIComponent("아이디 또는 비밀번호가 올바르지 않습니다.")}`,
    );
  }

  await setAdminSession();
  redirect("/admin");
}

export async function signOut(formData: FormData) {
  const next = String(formData.get("next") || "/");
  await clearAdminSession();
  await clearInfluencerSession();
  redirect(next);
}

export async function verifyInfluencer(formData: FormData) {
  const handle = String(formData.get("instagram_handle") || "").trim();

  if (!handle) {
    redirect(`/inf?error=${encodeURIComponent("인스타그램 핸들을 입력하세요.")}`);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("verify_influencer_by_handle", {
      p_instagram_handle: handle,
    });

    if (error) {
      redirect(`/inf?error=${encodeURIComponent(error.message)}`);
    }

    const payload = typeof data === "string" ? JSON.parse(data) : data;
    const influencerId = payload?.influencer?.id as string | undefined;

    if (!influencerId) {
      redirect(
        `/inf?error=${encodeURIComponent("등록된 인스타그램 핸들과 일치하지 않습니다.")}`,
      );
    }

    await setInfluencerSessionId(influencerId);
  } catch (err) {
    // redirect() throws a special error — rethrow it
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }

    const message =
      err instanceof Error ? err.message : "본인확인 중 오류가 발생했습니다.";
    redirect(`/inf?error=${encodeURIComponent(message)}`);
  }

  redirect("/inf?message=본인확인이 완료되었습니다.");
}

export async function clearInfluencerPass() {
  await clearInfluencerSession();
  redirect("/inf");
}
