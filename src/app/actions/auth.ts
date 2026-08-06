"use server";

import { redirect } from "next/navigation";
import {
  clearAdminSession,
  clearInfluencerSession,
  clearStoreSession,
  isValidAdminCredentials,
  isValidStorePassword,
  setAdminSession,
  setStoreSessionId,
} from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { type Store } from "@/lib/types";

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

export async function signInStore(formData: FormData) {
  const storeId = String(formData.get("store_id") || "").trim();
  const password = String(formData.get("password") || "");

  if (!storeId) {
    redirect(
      `/phar/login?error=${encodeURIComponent("지점을 선택해 주세요.")}`,
    );
  }

  const supabase = await createClient();
  const { data: store, error } = await supabase
    .from("stores")
    .select("id, name")
    .eq("id", storeId)
    .maybeSingle();

  if (error || !store) {
    redirect(
      `/phar/login?error=${encodeURIComponent("선택한 지점을 찾을 수 없습니다.")}`,
    );
  }

  const storeRow = store as Pick<Store, "id" | "name">;
  if (!isValidStorePassword(storeRow, password)) {
    redirect(
      `/phar/login?error=${encodeURIComponent("비밀번호가 올바르지 않습니다.")}`,
    );
  }

  await setStoreSessionId(storeRow.id);
  redirect("/phar");
}

export async function signOut(formData: FormData) {
  const next = String(formData.get("next") || "/");
  await clearAdminSession();
  await clearInfluencerSession();
  await clearStoreSession();
  redirect(next);
}
