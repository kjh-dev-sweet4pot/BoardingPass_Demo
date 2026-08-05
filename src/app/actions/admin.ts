"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminSession } from "@/lib/session";

async function ensureAdmin() {
  if (!(await isAdminSession())) redirect("/admin/login");
}

export async function createStore(formData: FormData) {
  await ensureAdmin();
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  const address = String(formData.get("address") || "").trim() || null;

  const { error } = await supabase.from("stores").insert({ name, address });
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin");
  redirect("/admin?tab=stores");
}

export async function createProduct(formData: FormData) {
  await ensureAdmin();
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  const sku = String(formData.get("sku") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;

  const { error } = await supabase
    .from("products")
    .insert({ name, sku, description });
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin");
  redirect("/admin?tab=products");
}

export async function createInfluencer(formData: FormData) {
  await ensureAdmin();
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  const notes = String(formData.get("notes") || "").trim() || null;
  const instagram_handle = String(
    formData.get("instagram_handle") || formData.get("handle") || "",
  ).trim();

  if (!instagram_handle) {
    redirect(`/admin?error=${encodeURIComponent("인스타그램 핸들을 입력하세요.")}`);
  }

  const { error } = await supabase.from("influencers").insert({
    name,
    notes,
    instagram_handle,
  });

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin");
  redirect("/admin?tab=influencers");
}

export async function createAllocation(formData: FormData) {
  await ensureAdmin();
  const supabase = await createClient();

  const influencer_id = String(formData.get("influencer_id") || "");
  const product_id = String(formData.get("product_id") || "");
  const store_id = String(formData.get("store_id") || "");
  const quantity = Number(formData.get("quantity") || 1);
  const visit_code = String(formData.get("visit_code") || "").trim() || null;
  const visit_date_raw = String(formData.get("visit_date") || "").trim();
  const visit_date = visit_date_raw || null;

  if (!visit_date) {
    redirect(
      `/admin?tab=allocations&error=${encodeURIComponent("방문 예정일을 입력하세요.")}`,
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(visit_date)) {
    redirect(
      `/admin?tab=allocations&error=${encodeURIComponent("방문 예정일 형식이 올바르지 않습니다.")}`,
    );
  }

  const { error } = await supabase.from("allocations").insert({
    influencer_id,
    product_id,
    store_id,
    quantity,
    visit_code,
    visit_date,
    status: "pending",
  });

  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin");
  redirect("/admin?tab=allocations");
}
