import { NextResponse } from "next/server";
import { type SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireAdminManager } from "@/lib/access";
import { createAdminDbClient } from "@/lib/supabase/api-client";
import {
  applyCompanyMatch,
  expandImportRowsByCompany,
  validateImportRow,
  type ImportRowInput,
  type ParsedImportRow,
} from "@/lib/csv-import";
import { findDuplicateAllocation } from "@/lib/alloc-dup";
import { detectPlatform } from "@/lib/creator-link";
import { canonicalBranchName, isBranchStoreName } from "@/lib/store-name";
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
    .select("id, sns_url, profile_image_path, name, instagram_handle, followers, region")
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
      // 아바타·팔로워·region 미수집이면 프로필 재수집
      needsProfile:
        !existing.profile_image_path ||
        existing.followers == null ||
        !existing.region,
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

async function attachImportLinks(
  supabase: AdminSupabase,
  allocationId: string,
  influencerId: string,
  urls: string[],
) {
  if (urls.length === 0) return 0;
  const { data: existing } = await supabase
    .from("creator_links")
    .select("url, publish_url")
    .eq("allocation_id", allocationId);
  const have = new Set(
    (existing || []).flatMap((l) =>
      [l.url, l.publish_url].filter((u): u is string => Boolean(u && String(u).trim())),
    ),
  );
  let added = 0;
  for (const url of urls) {
    if (have.has(url)) continue;
    const platform = detectPlatform(url);
    const payload = {
      allocation_id: allocationId,
      influencer_id: influencerId,
      url,
      publish_url: url,
      platform,
      status: "approved",
      content_status: "발행완료",
      thumbnail_status: "pending",
    };
    let { error } = await supabase.from("creator_links").insert(payload);
    if (error && /platform_check/i.test(error.message) && platform === "xiaohongshu") {
      const retry = await supabase
        .from("creator_links")
        .insert({ ...payload, platform: "etc" });
      error = retry.error;
    }
    if (error) throw new Error(`콘텐츠 링크 저장 실패: ${error.message}`);
    have.add(url);
    added += 1;
  }
  return added;
}

async function findOrCreateStore(
  supabase: AdminSupabase,
  name: string,
  cache: Map<string, string>,
) {
  const trimmed = name.trim();
  if (!isBranchStoreName(trimmed)) {
    throw new Error("방문지점이 상품코드(숫자)입니다. 지점명을 넣어 주세요");
  }
  const canon = canonicalBranchName(trimmed);
  const cached = cache.get(canon);
  if (cached) return cached;

  if (!cache.has("*")) {
    const { data: all } = await supabase.from("stores").select("id, name");
    for (const row of all || []) {
      if (!isBranchStoreName(row.name || "")) continue;
      const c = canonicalBranchName(row.name);
      if (!cache.has(c)) cache.set(c, row.id as string);
    }
    cache.set("*", "*");
  }
  const hit = cache.get(canon);
  if (hit && hit !== "*") return hit;

  const { data: created, error } = await supabase
    .from("stores")
    .insert({ name: canon })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message || "매장 생성 실패");
  cache.set(canon, created.id);
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

  const parsed = expandImportRowsByCompany(
    rawRows.map((row, idx) => validateImportRow(idx + 2, row)),
  ).map((row) => applyCompanyMatch(row, companies || []));
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
  let linked = 0;

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
        const added = await attachImportLinks(
          supabase,
          dupId,
          influencer.id,
          row.content_urls || [],
        );
        if (added > 0) {
          linked += added;
          results.push({
            rowNumber: row.rowNumber,
            ok: true,
            action: "links_added",
          });
        } else {
          skipped++;
          results.push({
            rowNumber: row.rowNumber,
            ok: true,
            action: "skipped_duplicate",
          });
        }
        continue;
      }

      const { data: allocation, error } = await supabase
        .from("allocations")
        .insert({
          influencer_id: influencer.id,
          product_id: productId,
          store_id: storeId,
          company_id: row.company_id,
          quantity: row.quantity,
          visit_date: row.visit_date,
          status: "pending",
        })
        .select("id")
        .single();

      if (error || !allocation?.id) {
        throw new Error(error?.message || "배정 생성에 실패했습니다.");
      }

      if (row.display_price != null && row.cost_amount != null) {
        // ponytail: 방문형 CSV는 확정가로 간주. 캠페인 섭외 Accept와 별개 경로.
        // 천장: accepted_at 의미가 Accept와 섞임 → 나중에 source 컬럼 분리.
        const { error: priceErr } = await supabase
          .from("allocation_pricing")
          .insert({
            allocation_id: allocation.id,
            company_id: row.company_id,
            display_price: row.display_price,
            cost_amount: row.cost_amount,
            accepted_at: new Date().toISOString(),
          });
        if (priceErr) {
          await supabase.from("allocations").delete().eq("id", allocation.id);
          throw new Error(`가격 저장 실패: ${priceErr.message}`);
        }
      }

      if ((row.content_urls || []).length) {
        linked += await attachImportLinks(
          supabase,
          allocation.id,
          influencer.id,
          row.content_urls || [],
        );
      }

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
      linked,
    },
    results,
  });
}
