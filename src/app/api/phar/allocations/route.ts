import { NextResponse } from "next/server";
import {
  createApiClientIfConfigured,
  supabaseConfigError,
} from "@/lib/supabase/api-client";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import {
  getStoreSessionId,
  isAdminSession,
  mintAndSetAuthToken,
  setStoreSessionId,
} from "@/lib/session";

export async function GET() {
  const isAdmin = await isAdminSession();
  const storeId = await getStoreSessionId();

  if (!isAdmin && !storeId) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  // 카운터를 연 채로 두면 JWT/쿠키가 만료되며 목록이 빈 배열로 덮임 → 사용 중엔 세션 연장
  if (storeId) {
    await setStoreSessionId(storeId);
    if (!hasServiceRoleKey()) {
      await mintAndSetAuthToken({ role: "store", store_id: storeId });
    }
  }

  const supabase = hasServiceRoleKey()
    ? createServiceClient()
    : await createApiClientIfConfigured();
  if (!supabase) return supabaseConfigError();

  let query = supabase
    .from("allocations")
    .select("*, products(*), stores(*), influencers(*)")
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (!isAdmin && storeId) {
    query = query.eq("store_id", storeId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ allocations: data || [] });
}
