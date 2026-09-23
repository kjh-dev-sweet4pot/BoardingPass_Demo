import { NextRequest, NextResponse } from "next/server";
import { isSuperAdminSession } from "@/lib/session";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";

/** DB에 이미 동기화된 chat_messages 조회 + 참여자별 메시지 수 집계. wjdghl 전용. */
export async function GET(req: NextRequest) {
  if (!(await isSuperAdminSession())) {
    return NextResponse.json(
      { error: "최고 관리자(wjdghl) 계정으로 로그인해야 합니다." },
      { status: 403 },
    );
  }
  if (!hasServiceRoleKey()) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY가 필요합니다." }, { status: 500 });
  }

  const spaceId = req.nextUrl.searchParams.get("spaceId")?.trim();
  if (!spaceId) {
    return NextResponse.json({ error: "spaceId가 필요합니다." }, { status: 400 });
  }
  const space = spaceId.startsWith("spaces/") ? spaceId : `spaces/${spaceId}`;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, sender_display_name, text, create_time, thread_id")
    .eq("space_id", space)
    .order("create_time", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const bySender = new Map<string, number>();
  for (const r of rows) {
    const name = r.sender_display_name || "(알 수 없음)";
    bySender.set(name, (bySender.get(name) ?? 0) + 1);
  }
  const participantCounts = [...bySender.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ messages: rows, participantCounts, total: rows.length });
}
