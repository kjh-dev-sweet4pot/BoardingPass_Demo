import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isAdminSession } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  validateImportRow,
  type ImportRowInput,
  type ParsedImportRow,
} from "@/lib/csv-import";

type ImportResult = {
  rowNumber: number;
  ok: boolean;
  action?: string;
  error?: string;
};

/** DB 스키마 제네릭이 없으면 from()/select() 결과가 never로 추론됨 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminSupabase = SupabaseClient<any>;

async function findOrCreateInfluencer(
  supabase: AdminSupabase,
  row: ParsedImportRow,
  cache: Map<string, string>,
) {
  const cached = cache.get(row.snsid);
  if (cached) return cached;

  const { data: existing } = await supabase
    .from("influencers")
    .select("id, sns_url")
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
    cache.set(row.snsid, existing.id);
    return existing.id as string;
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
  cache.set(row.snsid, created.id);
  return created.id as string;
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
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }

  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 없습니다." },
      { status: 500 },
    );
  }

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

  const parsed = rawRows.map((row, idx) => validateImportRow(idx + 2, row));
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: AdminSupabase = createClient<any>(url, key);
  const influencerCache = new Map<string, string>();
  const storeCache = new Map<string, string>();
  const productCache = new Map<string, string>();
  const results: ImportResult[] = [];

  let created = 0;
  let skipped = 0;
  let failed = 0;

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
      const influencerId = await findOrCreateInfluencer(
        supabase,
        row,
        influencerCache,
      );
      const storeId = await findOrCreateStore(supabase, row.store, storeCache);
      const productId = await findOrCreateProduct(
        supabase,
        row.product,
        productCache,
      );

      const { data: dup } = await supabase
        .from("allocations")
        .select("id")
        .eq("influencer_id", influencerId)
        .eq("product_id", productId)
        .eq("store_id", storeId)
        .eq("visit_date", row.visit_date)
        .maybeSingle();

      if (dup?.id) {
        skipped++;
        results.push({
          rowNumber: row.rowNumber,
          ok: true,
          action: "skipped_duplicate",
        });
        continue;
      }

      const { error } = await supabase.from("allocations").insert({
        influencer_id: influencerId,
        product_id: productId,
        store_id: storeId,
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

  return NextResponse.json({
    summary: {
      total: parsed.length,
      created,
      skipped,
      failed,
    },
    results,
  });
}
