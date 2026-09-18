import { NextRequest, NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { invoiceTotals, type DocLine, type InvoicePayload } from "@/lib/company-docs";

/**
 * GET /api/admin/margin/campaign/[id]/invoices
 * 이 캠페인 회원사 앞으로 발행된 인보이스 목록(예산 계획 불러오기용 후보).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { data: campaign, error: campErr } = await supabase
    .from("campaigns")
    .select("id, company_id")
    .eq("id", id)
    .maybeSingle();
  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });

  const { data, error } = await supabase
    .from("company_docs")
    .select("id, title, issued_on, payload")
    .eq("company_id", campaign.company_id)
    .eq("kind", "인보이스")
    .order("issued_on", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const invoices = (data ?? []).map((row) => {
    const lines = ((row.payload as InvoicePayload)?.lines || []) as DocLine[];
    return {
      id: row.id,
      title: row.title,
      issued_on: row.issued_on,
      line_count: lines.filter((l) => l.description && l.qty > 0).length,
      total: invoiceTotals(lines).grand,
    };
  });

  return NextResponse.json({ invoices });
}
