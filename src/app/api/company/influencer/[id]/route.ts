import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCompanySessionId } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const companyId = await getCompanySessionId();
  if (!companyId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  const supabase = createClient(url, key);
  const [
    { data: influencer, error: infError },
    { data: allocations, error: allocError },
  ] = await Promise.all([
    supabase
      .from("influencers")
      .select(
        "id, name, instagram_handle, instagram_handle_normalized, sns_url, created_at, updated_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("allocations")
      .select("*, products(*), stores(*), creator_links(*)")
      .eq("company_id", companyId)
      .eq("influencer_id", id)
      .order("visit_date", { ascending: false }),
  ]);

  if (infError) {
    return NextResponse.json({ error: infError.message }, { status: 500 });
  }
  if (allocError) {
    return NextResponse.json({ error: allocError.message }, { status: 500 });
  }
  if (!influencer || !allocations || allocations.length === 0) {
    return NextResponse.json(
      { error: "해당 인플루언서의 자사 배정이 없습니다." },
      { status: 404 },
    );
  }

  const links = allocations.flatMap(
    (row: { creator_links?: unknown[] }) => row.creator_links || [],
  );

  return NextResponse.json({
    influencer,
    allocations,
    links,
  });
}
