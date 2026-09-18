import { NextRequest, NextResponse } from "next/server";
import { fetchTransactions } from "@/lib/bankda";
import { isAdminSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  if (!from || !to) {
    return NextResponse.json({ error: "from, to 파라미터 필요 (YYYYMMDD)" }, { status: 400 });
  }

  try {
    const result = await fetchTransactions(from, to);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
