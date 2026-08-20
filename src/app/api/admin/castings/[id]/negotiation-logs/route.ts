import { NextRequest, NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/access";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { getAdminRole } from "@/lib/session";

const LOG_SELECT =
  "id, casting_id, proposed_amount, memo, proposer, operator_label, created_at";

function operatorLabel(role: Awaited<ReturnType<typeof getAdminRole>>) {
  if (role === "admin_operator") return "운영담당자";
  if (role === "admin_manager") return "운영관리자";
  return "운영자";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createApiClientIfConfigured();
  if (!supabase) return supabaseConfigError();

  const { data, error } = await supabase
    .from("negotiation_logs")
    .select(LOG_SELECT)
    .eq("casting_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const { id: castingId } = await params;
  const supabase = await createApiClientIfConfigured();
  if (!supabase) return supabaseConfigError();

  let body: { proposed_amount?: number | null; memo?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const memo = String(body.memo || "").trim() || null;
  const rawAmount = body.proposed_amount;
  const proposed_amount =
    rawAmount == null
      ? null
      : Number.isFinite(Number(rawAmount))
        ? Math.round(Number(rawAmount))
        : null;

  if (!memo && proposed_amount == null) {
    return NextResponse.json(
      { error: "제안 금액 또는 협의 메모를 입력하세요." },
      { status: 400 },
    );
  }

  const role = await getAdminRole();
  const { data, error } = await supabase
    .from("negotiation_logs")
    .insert({
      casting_id: castingId,
      proposed_amount,
      memo,
      proposer: "operator",
      operator_label: operatorLabel(role),
    })
    .select(LOG_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data }, { status: 201 });
}
