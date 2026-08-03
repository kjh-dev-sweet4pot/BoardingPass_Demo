"use server";

import { redirect } from "next/navigation";
import {
  clearAdminSession,
  clearInfluencerSession,
  isValidAdminCredentials,
  setAdminSession,
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
