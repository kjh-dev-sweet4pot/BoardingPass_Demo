import { NextResponse } from "next/server";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { getStoreSessionId, isAdminSession } from "@/lib/session";

export async function GET() {
  const isAdmin = await isAdminSession();
  const storeId = await getStoreSessionId();

  if (!isAdmin && !storeId) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const supabase = await createApiClientIfConfigured();
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
