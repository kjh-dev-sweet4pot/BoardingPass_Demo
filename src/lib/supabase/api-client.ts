import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { AUTH_TOKEN_COOKIE } from "@/lib/session";
import { getJwtSecret, getSupabaseEnv } from "@/lib/supabase/env";

import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";

export function supabaseConfigError() {
  return NextResponse.json(
    { error: "Supabase 환경변수가 없습니다." },
    { status: 500 },
  );
}

export const ADMIN_DB_AUTH_HINT =
  ".env에 SUPABASE_SERVICE_ROLE_KEY(권장) 또는 SUPABASE_JWT_SECRET을 설정한 뒤 dev 서버 재시작 → 로그아웃 → manager01 재로그인하세요.";

/** 운영 admin API: service_role 우선, 없으면 bp_auth_token JWT */
export async function createAdminDbClient(): Promise<
  { supabase: SupabaseClient } | { error: NextResponse }
> {
  if (hasServiceRoleKey()) {
    try {
      return { supabase: createServiceClient() };
    } catch (err) {
      return {
        error: NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "SUPABASE_SERVICE_ROLE_KEY 설정을 확인하세요.",
          },
          { status: 500 },
        ),
      };
    }
  }

  if (!getSupabaseEnv().configured) {
    return { error: supabaseConfigError() };
  }

  const jar = await cookies();
  const token = jar.get(AUTH_TOKEN_COOKIE)?.value;
  if (!token) {
    return {
      error: NextResponse.json(
        {
          error: "DB 접근 JWT(bp_auth_token)가 없습니다.",
          hint: getJwtSecret()
            ? ADMIN_DB_AUTH_HINT
            : `SUPABASE_JWT_SECRET이 .env에 없습니다. ${ADMIN_DB_AUTH_HINT}`,
        },
        { status: 500 },
      ),
    };
  }

  return { supabase: await createApiClient() };
}

/** 쿠키로 이미 인증한 서버 라우트용. JWT가 RLS에 안 실리면 service_role로 기록. */
export async function createAuthedDbClient() {
  if (hasServiceRoleKey()) return createServiceClient();
  return createApiClientIfConfigured();
}

export async function createApiClientIfConfigured() {
  if (!getSupabaseEnv().configured) return null;
  return createApiClient();
}

export async function createApiClient() {
  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    throw new Error("Supabase env missing");
  }

  const jar = await cookies();
  const token = jar.get(AUTH_TOKEN_COOKIE)?.value;

  return createClient(url, key, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    auth: { persistSession: false },
  });
}

export async function getApiClientOrNull() {
  const { configured } = getSupabaseEnv();
  if (!configured) return null;
  return createApiClient();
}
