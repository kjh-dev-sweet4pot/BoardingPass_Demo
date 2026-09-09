import { NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { createAdminDbClient } from "@/lib/supabase/api-client";
import {
  applyCompanyMatch,
  expandImportRowsByCompany,
  validateImportRow,
  type ImportRowInput,
} from "@/lib/csv-import";
import { dupIndexKey, loadImportDupMap, pickImportDup } from "@/lib/import-dup";
import { ALLOCATION_STATUS_LABEL, type AllocationStatus } from "@/lib/types";

function statusLabel(status: string) {
  if (status in ALLOCATION_STATUS_LABEL) {
    return ALLOCATION_STATUS_LABEL[status as AllocationStatus];
  }
  return status || "—";
}

export async function POST(request: Request) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const db = await createAdminDbClient();
  if ("error" in db) return db.error;

  let body: { rows?: ImportRowInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const rawRows = Array.isArray(body.rows) ? body.rows : [];
  const { data: companies } = await db.supabase
    .from("companies")
    .select("id, name, aliases, is_active");

  const parsed = expandImportRowsByCompany(
    rawRows.map((row, idx) => validateImportRow(idx + 2, row)),
  ).map((row) => applyCompanyMatch(row, companies || []));

  const { byKey } = await loadImportDupMap(
    db.supabase,
    parsed.map((r) => r.snsid),
  );

  const matches = parsed.map((row) => {
    if (!row.ok || !row.company_id) return null;
    const picked = pickImportDup(
      byKey.get(dupIndexKey(row.snsid, row.company_id)) || [],
      {
        product: row.product,
        store: row.store,
        visitDate: row.visit_date,
      },
    );
    if (!picked) return null;
    return {
      allocationId: picked.hit.id,
      exact: picked.exact,
      visit_date: picked.hit.visit_date,
      store: picked.hit.store_name,
      product: picked.hit.product_name,
      quantity: picked.hit.quantity,
      name: picked.hit.influencer_name,
      display_price: picked.hit.display_price,
      cost_amount: picked.hit.cost_amount,
      content_urls: picked.hit.content_urls,
      status: picked.hit.status,
      statusLabel: statusLabel(picked.hit.status),
    };
  });

  return NextResponse.json({ matches });
}
