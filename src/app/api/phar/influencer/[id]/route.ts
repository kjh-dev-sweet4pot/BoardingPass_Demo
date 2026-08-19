import { NextResponse } from "next/server";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { getStoreSessionId, isAdminSession } from "@/lib/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const isAdmin = await isAdminSession();
  const storeId = await getStoreSessionId();

  if (!isAdmin && !storeId) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const supabase = await createApiClientIfConfigured();
  if (!supabase) return supabaseConfigError();

  let allocQuery = supabase
    .from("allocations")
    .select("*, products(*), stores(*), companies(id, name), creator_links(*)")
    .eq("influencer_id", id)
    .order("created_at", { ascending: false });

  // 지점 로그인: 해당 매장 배정만 / Admin: 전체
  if (!isAdmin && storeId) {
    allocQuery = allocQuery.eq("store_id", storeId);
  }

  const [
    { data: influencer, error: infError },
    { data: allocations, error: allocError },
  ] = await Promise.all([
    supabase.from("influencers").select("*").eq("id", id).maybeSingle(),
    allocQuery,
  ]);

  if (infError || !influencer) {
    return NextResponse.json(
      { error: infError?.message || "인플루언서를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (allocError) {
    return NextResponse.json({ error: allocError.message }, { status: 500 });
  }

  const rows = allocations || [];
  if (rows.length === 0) {
    return NextResponse.json(
      {
        error: isAdmin
          ? "해당 인플루언서 배정이 없습니다."
          : "이 지점에 해당 인플루언서 배정이 없습니다.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    influencer,
    allocations: rows,
  });
}
