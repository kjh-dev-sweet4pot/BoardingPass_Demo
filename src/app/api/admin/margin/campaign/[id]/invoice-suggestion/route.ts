import { type NextRequest, NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import {
  emptyLine,
  medianUnitPrice,
  type CompanyDocRow,
  type DocLine,
  type InvoicePayload,
} from "@/lib/company-docs";

/**
 * GET /api/admin/margin/campaign/[id]/invoice-suggestion
 * 인보이스 초안 항목·단가 추천. 과거 발행된 인보이스 중 같은 회원사(우선) 또는
 * 같은 상품명(description 부분 일치) 이력을 모아 단가 median으로 제안한다.
 * 이력이 없으면 campaigns.budget_amount 1줄로 대체.
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
    .select("id, company_id, budget_amount, products ( name )")
    .eq("id", id)
    .maybeSingle();
  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });

  const productRaw = campaign.products as { name: string } | { name: string }[] | null;
  const productName = (Array.isArray(productRaw) ? productRaw[0]?.name : productRaw?.name) || "";

  const { data: docs, error: docsErr } = await supabase
    .from("company_docs")
    .select("id, company_id, payload")
    .eq("kind", "인보이스")
    .order("created_at", { ascending: false })
    .limit(300);
  if (docsErr) return NextResponse.json({ error: docsErr.message }, { status: 500 });

  const rows = (docs ?? []) as Pick<CompanyDocRow, "id" | "company_id" | "payload">[];
  const sameCompanyPrices: number[] = [];
  const sameProductPrices: number[] = [];
  for (const row of rows) {
    const lines = ((row.payload as InvoicePayload)?.lines || []) as DocLine[];
    for (const line of lines) {
      if (!line.description || !productName) continue;
      if (!line.description.toLowerCase().includes(productName.toLowerCase())) continue;
      if (row.company_id === campaign.company_id) sameCompanyPrices.push(line.unitPrice);
      else sameProductPrices.push(line.unitPrice);
    }
  }

  const suggestedUnitPrice =
    medianUnitPrice(sameCompanyPrices) ?? medianUnitPrice(sameProductPrices) ?? campaign.budget_amount ?? 0;
  const basis = sameCompanyPrices.length
    ? `같은 회원사 과거 인보이스 ${sameCompanyPrices.length}건 기준`
    : sameProductPrices.length
      ? `동일 상품 과거 인보이스 ${sameProductPrices.length}건 기준`
      : "이력 없음 — 캠페인 예산 그대로 사용";

  const line: DocLine = {
    ...emptyLine(),
    description: productName || "캠페인 진행비",
    qty: 1,
    unitPrice: suggestedUnitPrice,
  };

  return NextResponse.json({ lines: [line], basis });
}
