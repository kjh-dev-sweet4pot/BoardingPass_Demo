import { NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/access";
import { createAdminDbClient } from "@/lib/supabase/api-client";
import {
  formatKstDateTime,
  isImportLogTableMissing,
  type ImportBatchRow,
} from "@/lib/import-batch-log";
import { ADMIN_DB_AUTH_HINT } from "@/lib/supabase/api-client";

const BATCH_SELECT = `
  id,
  uploaded_at,
  uploaded_by,
  row_total,
  created_count,
  skipped_count,
  failed_count,
  import_batch_influencers (
    id,
    batch_id,
    influencer_id,
    name,
    instagram_handle,
    is_new,
    profile_fetch_status,
    profile_fetch_error
  )
`;

export async function GET(request: Request) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const db = await createAdminDbClient();
  if ("error" in db) return db.error;
  const supabase = db.supabase;

  const limit = Math.min(
    50,
    Math.max(1, parseInt(new URL(request.url).searchParams.get("limit") || "20", 10) || 20),
  );

  const { data, error } = await supabase
    .from("import_batches")
    .select(BATCH_SELECT)
    .order("uploaded_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isImportLogTableMissing(error)) {
      return NextResponse.json({
        batches: [],
        tableMissing: true,
        hint: "scripts/sql/t14-import-batch-log.sql 을 Supabase SQL Editor에서 실행하세요.",
      });
    }
    return NextResponse.json(
      {
        batches: [],
        error: error.message,
        hint: /row-level security|permission denied/i.test(error.message)
          ? `scripts/sql/t14-import-batch-log-rls-fix.sql 을 다시 실행하세요. ${ADMIN_DB_AUTH_HINT}`
          : undefined,
      },
      { status: 500 },
    );
  }

  const batches = ((data || []) as ImportBatchRow[]).map((batch) => ({
    ...batch,
    uploaded_at_label: formatKstDateTime(batch.uploaded_at),
    influencer_count: batch.import_batch_influencers?.length ?? 0,
  }));

  return NextResponse.json({ batches });
}
