import { NextRequest, NextResponse } from "next/server";
import { fetchAllSpaceMessages } from "@/lib/google-chat";
import { isSuperAdminSession } from "@/lib/session";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";

/** 특정 스페이스(방) 전체 메시지를 chat_messages에 동기화. wjdghl 전용. */
export async function POST(req: NextRequest) {
  if (!(await isSuperAdminSession())) {
    return NextResponse.json(
      { error: "최고 관리자(wjdghl) 계정으로 로그인해야 합니다." },
      { status: 403 },
    );
  }
  if (!hasServiceRoleKey()) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY가 필요합니다." }, { status: 500 });
  }

  let body: { spaceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const spaceId = (body.spaceId || "").trim();
  if (!spaceId) {
    return NextResponse.json({ error: "spaceId가 필요합니다." }, { status: 400 });
  }

  try {
    const messages = await fetchAllSpaceMessages(spaceId);
    const supabase = createServiceClient();
    const rows = messages.map((m) => ({
      id: m.name,
      space_id: spaceId.startsWith("spaces/") ? spaceId : `spaces/${spaceId}`,
      sender_id: m.sender?.name ?? null,
      sender_display_name: m.sender?.displayName ?? null,
      text: m.text ?? null,
      create_time: m.createTime ?? null,
      thread_id: m.thread?.name ?? null,
      raw_json: m,
      synced_at: new Date().toISOString(),
    }));

    let savedCount = 0;
    if (rows.length > 0) {
      const { error } = await supabase.from("chat_messages").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
      savedCount = rows.length;
    }

    return NextResponse.json({ ok: true, fetched: messages.length, savedCount });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "동기화 실패" },
      { status: 502 },
    );
  }
}
