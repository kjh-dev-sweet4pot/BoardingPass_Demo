import { NextRequest, NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { isAdminTestCompany } from "@/lib/company";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";

/**
 * GET /api/admin/castings/[id]/overlap
 * 같은 인플루언서가 다른 회원사 캠페인에 이미 Accept 확정돼 있는지 조회한다.
 * 이미 섭외된 인플루언서를 추가 배치하면 실제 추가 원가는 낮아질 수 있다는
 * 판단 근거로 쓴다 (다중 고객사 공유 캐스팅).
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

  const { data: casting, error: castingErr } = await supabase
    .from("castings")
    .select("id, influencer_id")
    .eq("id", id)
    .maybeSingle();
  if (castingErr) return NextResponse.json({ error: castingErr.message }, { status: 500 });
  if (!casting) return NextResponse.json({ error: "섭외를 찾을 수 없습니다." }, { status: 404 });

  const { data, error } = await supabase
    .from("castings")
    .select(
      `
      id, campaign_id, company_id, status,
      campaigns ( id, name ),
      companies ( id, name, login_id ),
      allocations ( allocation_pricing ( display_price, cost_amount ) )
      `,
    )
    .eq("influencer_id", casting.influencer_id)
    .eq("status", "Accept")
    .neq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type CompanyRow = { id: string; name: string; login_id: string };
  const overlaps = (data ?? []).filter((row) => {
    const companiesRaw = row.companies as unknown as CompanyRow | CompanyRow[] | null;
    const company = Array.isArray(companiesRaw) ? companiesRaw[0] : companiesRaw;
    return !company || !isAdminTestCompany(company);
  });

  return NextResponse.json({ overlaps });
}
