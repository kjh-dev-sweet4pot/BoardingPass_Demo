import { NextRequest, NextResponse } from "next/server";
import { requireAnyAdmin } from "@/lib/access";
import { createApiClientIfConfigured, supabaseConfigError } from "@/lib/supabase/api-client";
import { type CastingStatus } from "@/lib/types";

const CASTING_SELECT = `
  id, campaign_id, company_id, influencer_id, status, allocation_id,
  created_at, updated_at,
  campaigns ( id, name, status, product_id, products ( id, name ) ),
  companies ( id, name ),
  influencers (
    id, name, instagram_handle, instagram_handle_normalized,
    sns_url, phone, email, scale_band
  ),
  allocations (
    id, visit_date, target_content_count, rollup_status,
    allocation_pricing ( display_price, cost_amount, accepted_at )
  )
`;

const STATUSES: CastingStatus[] = ["Pending", "Nego", "Accept", "결렬"];

export async function GET(request: NextRequest) {
  const auth = await requireAnyAdmin();
  if ("error" in auth) return auth.error;

  const supabase = await createApiClientIfConfigured();
  if (!supabase) return supabaseConfigError();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as CastingStatus | null;
  const campaignId = searchParams.get("campaign_id");
  const companyId = searchParams.get("company_id");

  let query = supabase
    .from("castings")
    .select(CASTING_SELECT)
    .order("updated_at", { ascending: false });

  if (status && STATUSES.includes(status)) query = query.eq("status", status);
  if (campaignId) query = query.eq("campaign_id", campaignId);
  if (companyId) query = query.eq("company_id", companyId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ castings: data ?? [] });
}
