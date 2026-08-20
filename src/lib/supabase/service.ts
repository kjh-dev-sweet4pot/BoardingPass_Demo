import { createClient } from "@supabase/supabase-js";
import { getServiceRoleKey, requireSupabaseEnv } from "@/lib/supabase/env";

/** 로그인·본인확인 등 JWT 발급 전 DB 조회. 서버 전용 (R4). */
export function createServiceClient() {
  const { url } = requireSupabaseEnv();
  const serviceKey = getServiceRoleKey();
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY missing. Required for login and verify flows after T2 RLS.",
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function hasServiceRoleKey() {
  return Boolean(getServiceRoleKey());
}
