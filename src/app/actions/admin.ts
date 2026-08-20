"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuthedDbClient } from "@/lib/supabase/api-client";
import { isAdminManagerSession } from "@/lib/session";
import { normalizeHandle } from "@/lib/auth";
import { normalizeVisitDate, parseProductAndQty } from "@/lib/csv-import";
import { findDuplicateAllocation } from "@/lib/alloc-dup";

async function ensureAdminManager() {
  if (!(await isAdminManagerSession())) redirect("/admin/login");
}

function fail(message: string): never {
  redirect(`/admin?error=${encodeURIComponent(message)}`);
}

export async function createManualAllocation(formData: FormData) {
  await ensureAdminManager();
  const supabase = await createAuthedDbClient();
  if (!supabase) fail("Supabase 환경변수가 없습니다.");

  const name = String(formData.get("name") || "").trim();
  const snsid = normalizeHandle(
    String(formData.get("snsid") || formData.get("instagram_handle") || ""),
  );
  const snsurl =
    String(formData.get("snsurl") || formData.get("SNS_URL") || "").trim() ||
    null;
  const storeIdRaw = String(formData.get("store_id") || "").trim();
  const storeName = String(formData.get("store") || "").trim();
  const productRaw = String(formData.get("product") || "").trim();
  const visit_date =
    normalizeVisitDate(String(formData.get("visit_date") || "").trim()) || "";
  const visit_code = String(formData.get("visit_code") || "").trim() || null;
  const companyId = String(formData.get("company_id") || "").trim();
  const { name: productName, quantity } = parseProductAndQty(
    productRaw,
    (() => {
      const raw = formData.get("quantity");
      if (raw == null || typeof raw !== "string") return undefined;
      return raw;
    })(),
  );

  if (!snsid) fail("인스타그램 핸들(snsid)을 입력하세요.");
  if (!storeIdRaw && !storeName) fail("방문지점을 선택하세요.");
  if (!productName) fail("상품을 입력하세요.");
  if (!companyId) fail("회원사를 선택하세요.");
  if (!visit_date) fail("방문 예정일을 입력하세요.");
  if (!Number.isFinite(quantity) || quantity < 1) fail("수량이 올바르지 않습니다.");

  const displayName = name || snsid;

  let influencerId: string;
  const { data: existingInf } = await supabase
    .from("influencers")
    .select("id, sns_url")
    .eq("instagram_handle_normalized", snsid)
    .maybeSingle();

  if (existingInf?.id) {
    influencerId = existingInf.id;
    if (snsurl && snsurl !== existingInf.sns_url) {
      await supabase
        .from("influencers")
        .update({
          sns_url: snsurl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", influencerId);
    }
  } else {
    const { data: created, error } = await supabase
      .from("influencers")
      .insert({
        name: displayName,
        instagram_handle: snsid,
        sns_url: snsurl,
      })
      .select("id")
      .single();
    if (error || !created) fail(error?.message || "인플루언서 생성 실패");
    influencerId = created.id;
  }

  let storeId: string;
  if (storeIdRaw) {
    const { data: store, error } = await supabase
      .from("stores")
      .select("id")
      .eq("id", storeIdRaw)
      .maybeSingle();
    if (error || !store) fail("선택한 지점을 찾을 수 없습니다.");
    storeId = store.id;
  } else {
    const { data: existingStore } = await supabase
      .from("stores")
      .select("id")
      .ilike("name", storeName)
      .limit(1)
      .maybeSingle();
    if (existingStore?.id) {
      storeId = existingStore.id;
    } else {
      const { data: created, error } = await supabase
        .from("stores")
        .insert({ name: storeName })
        .select("id")
        .single();
      if (error || !created) fail(error?.message || "매장 생성 실패");
      storeId = created.id;
    }
  }

  let productId: string;
  const { data: existingProduct } = await supabase
    .from("products")
    .select("id")
    .ilike("name", productName)
    .limit(1)
    .maybeSingle();
  if (existingProduct?.id) {
    productId = existingProduct.id;
  } else {
    const { data: created, error } = await supabase
      .from("products")
      .insert({ name: productName })
      .select("id")
      .single();
    if (error || !created) fail(error?.message || "상품 생성 실패");
    productId = created.id;
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, is_active")
    .eq("id", companyId)
    .maybeSingle();
  if (!company?.id) fail("선택한 회원사를 찾을 수 없습니다.");
  if (!company.is_active) fail("비활성 회원사입니다.");

  const dupId = await findDuplicateAllocation(supabase, {
    influencerId,
    productId,
    storeId,
    visitDate: visit_date,
    companyId,
  });
  if (dupId) {
    fail("동일한 배정(핸들·상품·매장·방문일·회원사)이 이미 있습니다.");
  }

  const { error } = await supabase.from("allocations").insert({
    influencer_id: influencerId,
    product_id: productId,
    store_id: storeId,
    company_id: companyId,
    quantity,
    visit_date,
    visit_code,
    status: "pending",
  });

  if (error) fail(error.message);

  revalidatePath("/admin");
  revalidatePath("/com");
  redirect("/admin?message=" + encodeURIComponent("수동 등록이 완료되었습니다."));
}
