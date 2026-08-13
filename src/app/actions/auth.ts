"use server";

import { redirect } from "next/navigation";
import {
  clearAdminSession,
  clearCompanySession,
  clearInfluencerSession,
  clearStoreSession,
  isValidAdminCredentials,
  isValidStorePassword,
  setAdminSession,
  setCompanySessionId,
  setStoreSessionId,
} from "@/lib/session";
import { normalizeLoginId } from "@/lib/company";
import { verifyPassword } from "@/lib/password";
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

export async function signInCompany(formData: FormData) {
  const loginId = normalizeLoginId(String(formData.get("login_id") || ""));
  const password = String(formData.get("password") || "");

  if (!loginId || !password) {
    redirect(
      `/com/login?error=${encodeURIComponent("아이디 또는 비밀번호가 올바르지 않습니다.")}`,
    );
  }

  const supabase = await createClient();
  const { data: company, error } = await supabase
    .from("companies")
    .select("id, login_id, password_hash, is_active")
    .eq("login_id", loginId)
    .maybeSingle();

  if (error || !company || !verifyPassword(password, company.password_hash)) {
    redirect(
      `/com/login?error=${encodeURIComponent("아이디 또는 비밀번호가 올바르지 않습니다.")}`,
    );
  }

  if (!company.is_active) {
    redirect(
      `/com/login?error=${encodeURIComponent("비활성화된 계정입니다. 운영자에게 문의해 주세요.")}`,
    );
  }

  await setCompanySessionId(company.id);
  redirect("/com");
}

export async function signOut(formData: FormData) {
  const next = String(formData.get("next") || "/");
  await clearAdminSession();
  await clearInfluencerSession();
  await clearStoreSession();
  await clearCompanySession();
  redirect(next);
}
