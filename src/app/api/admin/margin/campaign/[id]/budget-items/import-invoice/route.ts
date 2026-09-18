import { NextRequest, NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { type DocLine, type InvoicePayload } from "@/lib/company-docs";
import { classifyTierFromText } from "@/lib/quote-engine";

/**
 * POST /api/admin/margin/campaign/[id]/budget-items/import-invoice
 * body: { doc_id } — 인보이스 라인(설명/수량/단가)을 예산 계획 슬롯으로 그대로 옮긴다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  let body: { doc_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const docId = String(body.doc_id || "").trim();
  if (!docId) return NextResponse.json({ error: "인보이스를 선택하세요." }, { status: 400 });

  const { data: campaign, error: campErr } = await supabase
    .from("campaigns")
    .select("id, company_id")
    .eq("id", id)
    .maybeSingle();
  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });

  const { data: doc, error: docErr } = await supabase
    .from("company_docs")
    .select("id, company_id, payload")
    .eq("id", docId)
    .maybeSingle();
  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: "인보이스를 찾을 수 없습니다." }, { status: 404 });
  if (doc.company_id !== campaign.company_id) {
    return NextResponse.json({ error: "이 캠페인의 회원사 인보이스가 아닙니다." }, { status: 400 });
  }

  const lines = ((doc.payload as InvoicePayload)?.lines || []) as DocLine[];
  const rows = lines
    .filter((l) => l.description && l.qty > 0 && l.unitPrice >= 0)
    .map((l) => ({
      campaign_id: id,
      tier: classifyTierFromText(l.description),
      content_type: null,
      platform: null,
      unit_cost: Math.round(l.unitPrice),
      slot_count: Math.round(l.qty),
      expected_publish_per_slot: 1,
      sort_order: 0,
      memo: [l.description, l.remark].filter(Boolean).join(" · ") || null,
    }));
  if (rows.length === 0) {
    return NextResponse.json({ error: "불러올 인보이스 항목이 없습니다." }, { status: 400 });
  }

  const { data, error } = await supabase.from("budget_plan_items").insert(rows).select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}
