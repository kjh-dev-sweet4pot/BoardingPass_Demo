import type { SupabaseClient } from "@supabase/supabase-js";

/** influencer + product + store + visit_date + company_id */
export async function findDuplicateAllocation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  input: {
    influencerId: string;
    productId: string;
    storeId: string;
    visitDate: string;
    companyId: string | null;
    excludeId?: string;
  },
) {
  let query = supabase
    .from("allocations")
    .select("id")
    .eq("influencer_id", input.influencerId)
    .eq("product_id", input.productId)
    .eq("store_id", input.storeId)
    .eq("visit_date", input.visitDate);

  if (input.companyId) {
    query = query.eq("company_id", input.companyId);
  } else {
    query = query.is("company_id", null);
  }

  if (input.excludeId) {
    query = query.neq("id", input.excludeId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ? String(data.id) : null;
}
