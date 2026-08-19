import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/** 개발용 — 모든 bp_* 세션 쿠키를 강제 삭제 후 로그인 페이지로 */
export async function GET(request: NextRequest) {
  const jar = await cookies();
  const names = ["bp_company_id", "bp_influencer_id", "bp_admin", "bp_admin_role", "bp_store_id", "bp_auth_token"];
  for (const name of names) jar.delete(name);
  const base = new URL(request.url).origin;
  return NextResponse.redirect(`${base}/com/login`, { status: 302 });
}
