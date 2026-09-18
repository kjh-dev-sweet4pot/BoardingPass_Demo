import { NextRequest, NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { parseInvoiceText } from "@/lib/company-docs";

/**
 * POST /api/admin/company-docs/parse-invoice-pdf
 * multipart/form-data: file — 브랜드슬램 인보이스 양식으로 발행된 PDF에서 항목을 읽어온다.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "PDF 파일을 선택하세요." }, { status: 400 });
  }

  const { PDFParse } = await import("pdf-parse");
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const parser = new PDFParse({ data: buffer });
    const { text } = await parser.getText();
    const payload = parseInvoiceText(text);
    if (!payload.lines?.length) {
      return NextResponse.json(
        { error: "인보이스 항목을 읽지 못했습니다. 브랜드슬램 양식 PDF인지 확인하세요." },
        { status: 400 },
      );
    }
    return NextResponse.json({ payload });
  } catch {
    return NextResponse.json({ error: "PDF를 읽지 못했습니다." }, { status: 400 });
  }
}
