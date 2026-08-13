import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getStoreSessionId, isAdminSession } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const isAdmin = await isAdminSession();
  const storeId = await getStoreSessionId();
  if (!isAdmin && !storeId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const action = String(body.action || "");
  if (action !== "confirm" && action !== "unconfirm") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  const supabase = createClient(url, key);
  const { data: current, error: fetchError } = await supabase
    .from("allocations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "배정을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!isAdmin && storeId && current.store_id !== storeId) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (current.status === "picked_up") {
    return NextResponse.json(
      { error: "수령 완료 건은 변경할 수 없습니다." },
      { status: 400 },
    );
  }
  if (current.status === "cancelled") {
    return NextResponse.json(
      { error: "취소된 배정은 변경할 수 없습니다." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const visit_source = isAdmin ? "admin" : "pharmacist";
  const visit_confirmed_by = isAdmin ? "admin" : storeId;

  const patch =
    action === "confirm"
      ? {
          status: "visited",
          verified_at: current.verified_at || now,
          last_visited_at: now,
          visit_source,
          visit_confirmed_by,
          updated_at: now,
        }
      : {
          status: "pending",
          verified_at: null,
          last_visited_at: null,
          visit_source: null,
          visit_confirmed_by: null,
          updated_at: now,
        };

  if (action === "unconfirm" && current.status !== "visited" && current.status !== "ready") {
    return NextResponse.json(
      { error: "방문 완료 건만 해제할 수 있습니다." },
      { status: 400 },
    );
  }
  if (action === "confirm" && current.status !== "pending") {
    return NextResponse.json(
      { error: "대기 건만 방문 확인할 수 있습니다." },
      { status: 400 },
    );
  }

  const { data: updated, error } = await supabase
    .from("allocations")
    .update(patch)
    .eq("id", id)
    .select(
      "*, products(*), stores(*), influencers(*), companies(id, name), creator_links(*)",
    )
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message || "처리에 실패했습니다." },
      { status: 500 },
    );
  }
  revalidatePath("/admin");
  revalidatePath("/phar");
  revalidatePath("/com");
  return NextResponse.json({ allocation: updated });
}
