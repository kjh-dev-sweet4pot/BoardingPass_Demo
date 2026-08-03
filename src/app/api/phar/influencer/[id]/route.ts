import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
    { data: identities },
    { data: allocations, error: allocError },
  ] = await Promise.all([
    supabase.from("influencers").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("sns_identities")
      .select("*")
      .eq("influencer_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("allocations")
      .select("*, products(*), stores(*)")
      .eq("influencer_id", id)
      .order("created_at", { ascending: false }),
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

  return NextResponse.json({
    influencer,
    identities: identities || [],
    allocations: allocations || [],
  });
}
