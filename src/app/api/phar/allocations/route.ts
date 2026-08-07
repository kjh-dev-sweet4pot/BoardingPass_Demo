import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStoreSessionId, isAdminSession } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function GET() {
  const isAdmin = await isAdminSession();
  const storeId = await getStoreSessionId();

  if (!isAdmin && !storeId) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  const supabase = createClient(url, key);
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
