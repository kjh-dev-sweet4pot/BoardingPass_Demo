import { type NextRequest, NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { isAdminTestCompany } from "@/lib/company";
import { createAuthedDbClient, supabaseConfigError } from "@/lib/supabase/api-client";
import { marginState, type CampaignMarginRow } from "@/lib/types";

const PAGE_SIZE = 20;
const EMPTY_ID = "00000000-0000-0000-0000-000000000000";

/**
 * GET /api/admin/margin/overview?company_id=&status=&margin_state=&q=&page=
 * 캠페인별 마진 현황. v_campaign_margin(집계) + campaigns/companies(표시용)를
 * 애플리케이션 레이어에서 병합 — 뷰는 FK가 없어 PostgREST 임베드가 안 된다.
 * 운영관리자만 접근 가능.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const supabase = await createAuthedDbClient();
  if (!supabase) return supabaseConfigError();

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id") || null;
  const status = searchParams.get("status") || null;
  const marginStateFilter = searchParams.get("margin_state") || null;
  const q = searchParams.get("q")?.trim() || null;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  let campaignsQuery = supabase
    .from("campaigns")
    .select("id, name, status, company_id, budget_amount, companies(id, name, login_id)")
    .neq("status", "취소");
  if (companyId) campaignsQuery = campaignsQuery.eq("company_id", companyId);
  if (status) campaignsQuery = campaignsQuery.eq("status", status);
  if (q) campaignsQuery = campaignsQuery.ilike("name", `%${q}%`);

  const { data: campaignsRaw, error: campErr } = await campaignsQuery;
  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 });

  type CompanyRow = { id: string; name: string; login_id: string };
  const campaigns = (campaignsRaw ?? []).filter((c) => {
    const companiesRaw = c.companies as unknown as CompanyRow | CompanyRow[] | null;
    const company = Array.isArray(companiesRaw) ? companiesRaw[0] : companiesRaw;
    return !company || !isAdminTestCompany(company);
  });

  const campaignIds = campaigns.map((c) => c.id);
  const { data: marginRows, error: marginErr } = await supabase
    .from("v_campaign_margin")
    .select("*")
    .in("campaign_id", campaignIds.length ? campaignIds : [EMPTY_ID]);
  if (marginErr) return NextResponse.json({ error: marginErr.message }, { status: 500 });

  const marginByCampaign = new Map(
    (marginRows ?? []).map((r) => [r.campaign_id as string, r as CampaignMarginRow]),
  );

  let rows = campaigns.map((c) => {
    const margin = marginByCampaign.get(c.id) ?? null;
    const companyRaw = c.companies as unknown as CompanyRow | CompanyRow[] | null;
    const company = Array.isArray(companyRaw) ? companyRaw[0] : companyRaw;
    return {
      campaign_id: c.id as string,
      campaign_name: c.name as string | null,
      campaign_status: c.status as string,
      company_id: c.company_id as string,
      company_name: company?.name ?? null,
      revenue: margin?.revenue ?? (c.budget_amount as number | null) ?? null,
      planned_cost: margin?.planned_cost ?? 0,
      committed_cost: margin?.committed_cost ?? 0,
      realized_cost: margin?.realized_cost ?? 0,
      other_cost: margin?.other_cost ?? 0,
      committed_margin_rate: margin?.committed_margin_rate ?? null,
      realized_margin_rate: margin?.realized_margin_rate ?? null,
      burn_rate: margin?.burn_rate ?? null,
      spend_pct: margin?.spend_pct ?? null,
      target_publish_count: margin?.target_publish_count ?? null,
      published_count: margin?.published_count ?? 0,
      slot_total: margin?.slot_total ?? 0,
      slot_filled: margin?.slot_filled ?? 0,
      margin_state: marginState(margin?.committed_margin_rate ?? null),
    };
  });

  if (marginStateFilter) rows = rows.filter((r) => r.margin_state === marginStateFilter);

  // 정렬 기본값: committed_margin_rate 오름차순, null은 맨 뒤
  rows.sort((a, b) => {
    if (a.committed_margin_rate === null && b.committed_margin_rate === null) return 0;
    if (a.committed_margin_rate === null) return 1;
    if (b.committed_margin_rate === null) return -1;
    return a.committed_margin_rate - b.committed_margin_rate;
  });

  const total = rows.length;
  const start = (page - 1) * PAGE_SIZE;
  const paged = rows.slice(start, start + PAGE_SIZE);

  return NextResponse.json({ rows: paged, total, page, pageSize: PAGE_SIZE });
}
