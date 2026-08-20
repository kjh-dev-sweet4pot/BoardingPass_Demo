import { NextResponse } from "next/server";
import { type SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireAdminManager } from "@/lib/access";
import { createAdminDbClient } from "@/lib/supabase/api-client";
import {
  applyCompanyMatch,
  validateImportRow,
  type ImportRowInput,
  type ParsedImportRow,
} from "@/lib/csv-import";
import { findDuplicateAllocation } from "@/lib/alloc-dup";
import {
  scheduleInfluencerProfileFetch,
} from "@/lib/influencer-profile-image";
import {
  isImportLogTableMissing,
  updateBatchInfluencerProfileStatus,
  type ImportProfileFetchStatus,
} from "@/lib/import-batch-log";
import { getAdminRole } from "@/lib/session";

type ImportResult = {
  rowNumber: number;
  ok: boolean;
  action?: string;
  error?: string;
};

/** DB 스키마 제네릭이 없으면 from()/select() 결과가 never로 추론됨 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminSupabase = SupabaseClient<any>;

type InfluencerUpsert = {
  id: string;
  isNew: boolean;
  needsProfile: boolean;
  name: string;
  handle: string;
  snsUrl: string;
};

async function findOrCreateInfluencer(
  supabase: AdminSupabase,
  row: ParsedImportRow,
  cache: Map<string, InfluencerUpsert>,
): Promise<InfluencerUpsert> {
  const cached = cache.get(row.snsid);
  if (cached) return cached;

  const { data: existing } = await supabase
    .from("influencers")
    .select("id, sns_url, profile_image_path, name, instagram_handle")
    .eq("instagram_handle_normalized", row.snsid)
    .maybeSingle();

  if (existing?.id) {
    if (row.snsurl && row.snsurl !== existing.sns_url) {
      await supabase
        .from("influencers")
        .update({
          sns_url: row.snsurl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
    const ref: InfluencerUpsert = {
      id: existing.id as string,
      isNew: false,
      needsProfile: !existing.profile_image_path,
      name: row.name || existing.name || row.snsid,
      handle: row.snsid,
      snsUrl: row.snsurl || existing.sns_url || "",
    };
    cache.set(row.snsid, ref);
    return ref;
  }

  const { data: created, error } = await supabase
    .from("influencers")
    .insert({
      name: row.name,
      instagram_handle: row.snsid,
      sns_url: row.snsurl,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message || "인플루언서 생성 실패");
  const ref: InfluencerUpsert = {
    id: created.id as string,
    isNew: true,
    needsProfile: true,
    name: row.name || row.snsid,
    handle: row.snsid,
    snsUrl: row.snsurl || "",
  };
  cache.set(row.snsid, ref);
  return ref;
}

async function findOrCreateStore(
  supabase: AdminSupabase,
  name: string,
  cache: Map<string, string>,
) {
  const key = name.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const { data: existing } = await supabase
    .from("stores")
    .select("id, name")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    cache.set(key, existing.id);
    return existing.id as string;
  }

  const { data: created, error } = await supabase
    .from("stores")
    .insert({ name })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message || "매장 생성 실패");
  cache.set(key, created.id);
  return created.id as string;
}

async function findOrCreateProduct(
  supabase: AdminSupabase,
  name: string,
  cache: Map<string, string>,
) {
  const key = name.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const { data: existing } = await supabase
    .from("products")
    .select("id, name")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    cache.set(key, existing.id);
    return existing.id as string;
  }

  const { data: created, error } = await supabase
    .from("products")
    .insert({ name })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message || "상품 생성 실패");
  cache.set(key, created.id);
  return created.id as string;
}

export async function POST(request: Request) {
  const auth = await requireAdminManager();
  if ("error" in auth) return auth.error;

  const db = await createAdminDbClient();
  if ("error" in db) return db.error;
  const supabaseClient = db.supabase;

  let body: { rows?: ImportRowInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const rawRows = Array.isArray(body.rows) ? body.rows : [];
  if (rawRows.length === 0) {
    return NextResponse.json({ error: "가져올 행이 없습니다." }, { status: 400 });
  }
  if (rawRows.length > 500) {
    return NextResponse.json(
      { error: "한 번에 최대 500행까지 가져올 수 있습니다." },
      { status: 400 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: AdminSupabase = supabaseClient as AdminSupabase;
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, aliases, is_active");

  const parsed = rawRows.map((row, idx) =>
    applyCompanyMatch(validateImportRow(idx + 2, row), companies || []),
  );
  const valid = parsed.filter((r) => r.ok);
  if (valid.length === 0) {
    return NextResponse.json(
      { error: "유효한 행이 없습니다.", results: parsed.map((r) => ({
          rowNumber: r.rowNumber,
          ok: false,
          error: r.errors.join(", "),
        })) },
      { status: 400 },
    );
  }
  const influencerCache = new Map<string, InfluencerUpsert>();
  const storeCache = new Map<string, string>();
  const productCache = new Map<string, string>();
  const results: ImportResult[] = [];

  let created = 0;
  let skipped = 0;
  let failed = 0;

  const adminRole = await getAdminRole();
  let batchId: string | null = null;
  const batchInfluencerIds = new Map<string, string>();

  const { data: batchRow, error: batchErr } = await supabase
    .from("import_batches")
    .insert({
      uploaded_by: adminRole,
      row_total: parsed.length,
    })
    .select("id")
    .single();

  if (batchErr) {
    if (!isImportLogTableMissing(batchErr)) {
      return NextResponse.json({ error: batchErr.message }, { status: 500 });
    }
  } else if (batchRow?.id) {
    batchId = batchRow.id as string;
  }

  async function trackInfluencer(influencer: InfluencerUpsert) {
    if (!batchId || batchInfluencerIds.has(influencer.id)) return;

    let initialStatus: ImportProfileFetchStatus = "pending";
    if (!influencer.needsProfile) initialStatus = "skipped";
    else if (!process.env.APIFY_TOKEN?.trim()) {
      initialStatus = "failed";
    }

    const { data: item, error } = await supabase
      .from("import_batch_influencers")
      .insert({
        batch_id: batchId,
        influencer_id: influencer.id,
        name: influencer.name,
        instagram_handle: influencer.handle,
        is_new: influencer.isNew,
        profile_fetch_status: initialStatus,
        profile_fetch_error:
          initialStatus === "failed" && !process.env.APIFY_TOKEN?.trim()
            ? "APIFY_TOKEN 없음"
            : null,
      })
      .select("id")
      .single();

    if (error || !item?.id) return;
    batchInfluencerIds.set(influencer.id, item.id as string);

    if (influencer.needsProfile && process.env.APIFY_TOKEN?.trim()) {
      scheduleInfluencerProfileFetch(
        supabase,
        influencer.id,
        { handle: influencer.handle, snsUrl: influencer.snsUrl },
        (result) => {
          void updateBatchInfluencerProfileStatus(
            supabase,
            item.id as string,
            result.ok ? "ok" : "failed",
            result.error,
          );
        },
      );
    }
  }

  for (const row of parsed) {
    if (!row.ok) {
      failed++;
      results.push({
        rowNumber: row.rowNumber,
        ok: false,
        error: row.errors.join(", "),
      });
      continue;
    }

    try {
      const influencer = await findOrCreateInfluencer(
        supabase,
        row,
        influencerCache,
      );
      await trackInfluencer(influencer);

      const storeId = await findOrCreateStore(supabase, row.store, storeCache);
      const productId = await findOrCreateProduct(
        supabase,
        row.product,
        productCache,
      );

      if (!row.company_id) {
        throw new Error("회원사 매칭에 실패했습니다.");
      }

      const dupId = await findDuplicateAllocation(supabase, {
        influencerId: influencer.id,
        productId,
        storeId,
        visitDate: row.visit_date,
        companyId: row.company_id,
      });

      if (dupId) {
        skipped++;
        results.push({
          rowNumber: row.rowNumber,
          ok: true,
          action: "skipped_duplicate",
        });
        continue;
      }

      const { error } = await supabase.from("allocations").insert({
        influencer_id: influencer.id,
        product_id: productId,
        store_id: storeId,
        company_id: row.company_id,
        quantity: row.quantity,
        visit_date: row.visit_date,
        status: "pending",
      });

      if (error) throw new Error(error.message);

      created++;
      results.push({
        rowNumber: row.rowNumber,
        ok: true,
        action: "created",
      });
    } catch (err: unknown) {
      failed++;
      results.push({
        rowNumber: row.rowNumber,
        ok: false,
        error: err instanceof Error ? err.message : "처리 실패",
      });
    }
  }

  if (batchId) {
    await supabase
      .from("import_batches")
      .update({
        created_count: created,
        skipped_count: skipped,
        failed_count: failed,
        row_total: parsed.length,
      })
      .eq("id", batchId);
  }

  revalidatePath("/admin");
  revalidatePath("/com");
  return NextResponse.json({
    batchId,
    summary: {
      total: parsed.length,
      created,
      skipped,
      failed,
    },
    results,
  });
}
