"use server";

import { redirect } from "next/navigation";
import {
  clearAdminSession,
  clearAuthToken,
  clearCompanySession,
  clearInfluencerSession,
  clearStoreSession,
  isValidAdminManagerCredentials,
  isValidAdminOperatorCredentials,
  isValidStorePassword,
  mintAndSetAuthToken,
  setAdminSession,
  setCompanySessionId,
  setStoreSessionId,
} from "@/lib/session";
import { normalizeLoginId } from "@/lib/company";
import { verifyPassword } from "@/lib/password";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { type Store } from "@/lib/types";

export async function signInAdmin(formData: FormData) {
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");

  const isManager = isValidAdminManagerCredentials(username, password);
  const isOperator = isValidAdminOperatorCredentials(username, password);

  if (!isManager && !isOperator) {
    redirect(
      `/admin/login?error=${encodeURIComponent("아이디 또는 비밀번호가 올바르지 않습니다.")}`,
    );
  }

  const role = isManager ? "admin_manager" : "admin_operator";
  await setAdminSession(role);
  await mintAndSetAuthToken({ role });
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

  const supabase = hasServiceRoleKey()
    ? createServiceClient()
    : await createClient();
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
  await mintAndSetAuthToken({ role: "store", store_id: storeRow.id });
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

  if (!getSupabaseEnv().configured) {
    redirect(
      `/com/login?error=${encodeURIComponent("서버 Supabase 설정이 없습니다. NEXT_PUBLIC_SUPABASE_URL·ANON_KEY를 확인해 주세요.")}`,
    );
  }

  // RLS: companies.password_hash는 anon/authenticated 조회 불가 → 로그인 검증은 service_role 전용
  if (!hasServiceRoleKey()) {
    redirect(
      `/com/login?error=${encodeURIComponent("회원사 로그인에 SUPABASE_SERVICE_ROLE_KEY가 필요합니다. Vercel 환경변수를 확인해 주세요.")}`,
    );
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    redirect(
      `/com/login?error=${encodeURIComponent("서버 DB 연결 설정(SUPABASE_SERVICE_ROLE_KEY)을 확인해 주세요.")}`,
    );
  }

  const { data: company, error } = await supabase
    .from("companies")
    .select("id, login_id, password_hash, is_active")
    .eq("login_id", loginId)
    .maybeSingle();

  if (error) {
    redirect(
      `/com/login?error=${encodeURIComponent("로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")}`,
    );
  }

  if (!company || !verifyPassword(password, company.password_hash)) {
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
  await mintAndSetAuthToken({ role: "company", company_id: company.id });
  redirect("/com");
}

export async function signOut(formData: FormData) {
  const next = String(formData.get("next") || "/");
  await clearAdminSession();
  await clearInfluencerSession();
  await clearStoreSession();
  await clearCompanySession();
  await clearAuthToken();
  redirect(next);
}
