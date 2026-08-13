import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { normalizeVisitDate } from "@/lib/csv-import";
import { type AllocationStatus } from "@/lib/types";
import { findDuplicateAllocation } from "@/lib/alloc-dup";

const STATUSES: AllocationStatus[] = [
  "pending",
  "visited",
  "ready",
  "picked_up",
  "cancelled",
];

const ALLOC_SELECT =
  "*, products(*), stores(*), influencers(*), companies(id, name), creator_links(*)";

function asYmd(value: string | null | undefined) {
  if (!value) return null;
  return String(value).slice(0, 10) || null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "배정 ID가 필요합니다." }, { status: 400 });
  }

  const { url, key, configured } = getSupabaseEnv();
  if (!configured) {
    return NextResponse.json(
      { error: "Supabase 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  let body: {
    visit_date?: string | null;
    store_id?: string;
    company_id?: string | null;
    quantity?: number | string;
    visit_code?: string | null;
    status?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const supabase = createClient(url, key);
  const { data: current, error: fetchError } = await supabase
    .from("allocations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json(
      { error: "배정을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if ("visit_date" in body) {
    const visit_date = normalizeVisitDate(String(body.visit_date || "").trim());
    if (!visit_date) {
      return NextResponse.json(
        { error: "방문 예정일을 입력하세요." },
        { status: 400 },
      );
    }
    patch.visit_date = visit_date;
  }

  if ("store_id" in body) {
    const storeId = String(body.store_id || "").trim();
    if (!storeId) {
      return NextResponse.json(
        { error: "방문 지점을 선택하세요." },
        { status: 400 },
      );
    }
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id")
      .eq("id", storeId)
      .maybeSingle();
    if (storeError) {
      return NextResponse.json({ error: storeError.message }, { status: 500 });
    }
    if (!store) {
      return NextResponse.json(
        { error: "선택한 지점을 찾을 수 없습니다." },
        { status: 400 },
      );
    }
    patch.store_id = storeId;
  }

  if ("company_id" in body) {
    const companyId = String(body.company_id || "").trim();
    if (!companyId) {
      return NextResponse.json(
        { error: "회원사를 선택하세요." },
        { status: 400 },
      );
    }
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .maybeSingle();
    if (companyError) {
      return NextResponse.json({ error: companyError.message }, { status: 500 });
    }
    if (!company) {
      return NextResponse.json(
        { error: "선택한 회원사를 찾을 수 없습니다." },
        { status: 400 },
      );
    }
    patch.company_id = companyId;
  }

  if ("quantity" in body) {
    const quantity = Number(body.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      return NextResponse.json(
        { error: "수량이 올바르지 않습니다." },
        { status: 400 },
      );
    }
    patch.quantity = Math.floor(quantity);
  }

  if ("visit_code" in body) {
    const code = String(body.visit_code || "").trim();
    patch.visit_code = code || null;
  }

  if ("status" in body) {
    const status = String(body.status || "") as AllocationStatus;
    if (!STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "상태가 올바르지 않습니다." },
        { status: 400 },
      );
    }
    patch.status = status;
    const now = new Date().toISOString();
    if (status === "picked_up") {
      if (!current.picked_up_at) patch.picked_up_at = now;
    } else if (current.status === "picked_up") {
      patch.picked_up_at = null;
    }
    if (status === "visited" || status === "ready") {
      if (!current.verified_at) patch.verified_at = now;
      if (!current.last_visited_at) patch.last_visited_at = now;
      if (!current.visit_source) {
        patch.visit_source = "admin";
        patch.visit_confirmed_by = "admin";
      }
    } else if (status === "pending") {
      patch.verified_at = null;
      patch.last_visited_at = null;
      patch.visit_source = null;
      patch.visit_confirmed_by = null;
    }
  }

  const nextStoreId = String(patch.store_id ?? current.store_id);
  const nextVisitDate =
    asYmd(String(patch.visit_date ?? current.visit_date)) || "";
  const nextCompanyId =
    (patch.company_id as string | undefined) ?? current.company_id ?? null;
  const storeChanged = nextStoreId !== current.store_id;
  const dateChanged = nextVisitDate !== asYmd(current.visit_date);
  const companyChanged = nextCompanyId !== (current.company_id ?? null);

  if (storeChanged || dateChanged || companyChanged) {
    try {
      const dupId = await findDuplicateAllocation(supabase, {
        influencerId: current.influencer_id,
        productId: current.product_id,
        storeId: nextStoreId,
        visitDate: nextVisitDate,
        companyId: nextCompanyId,
        excludeId: id,
      });
      if (dupId) {
        return NextResponse.json(
          {
            error:
              "동일한 배정(핸들·상품·매장·방문일·회원사)이 이미 있습니다.",
          },
          { status: 409 },
        );
      }
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "중복 확인 실패" },
        { status: 500 },
      );
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("allocations")
    .update(patch)
    .eq("id", id)
    .select(ALLOC_SELECT)
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message || "수정에 실패했습니다." },
      { status: 500 },
    );
  }

  revalidatePath("/admin");
  revalidatePath("/phar");
  revalidatePath("/com");
  return NextResponse.json({ allocation: updated });
}
