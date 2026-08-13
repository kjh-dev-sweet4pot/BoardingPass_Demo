/**
 * KnownBeauty × 긴자점 데모 데이터만 Supabase 에서 제거.
 * 기본은 dry-run. 실제로 지울 때만 --apply.
 *
 *   node scripts/mock/teardown-knownbeauty.mjs
 *   node scripts/mock/teardown-knownbeauty.mjs --apply
 *   node scripts/mock/teardown-knownbeauty.mjs --apply --purge-company
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const apply = process.argv.includes("--apply");
const purgeCompany = process.argv.includes("--purge-company");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l.slice(i + 1).trim().replace(/^["']|["']$/g, ""),
      ];
    }),
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

function fail(label, error) {
  throw new Error(`${label}: ${error?.message || error}`);
}

async function countEq(table, col, val) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(col, val);
  if (error) fail(`${table} count`, error);
  return count || 0;
}

const { data: store, error: storeErr } = await supabase
  .from("stores")
  .select("id, name")
  .eq("name", "긴자점")
  .maybeSingle();
if (storeErr) fail("store", storeErr);

const { data: company, error: companyErr } = await supabase
  .from("companies")
  .select("id, name, login_id")
  .eq("login_id", "company")
  .maybeSingle();
if (companyErr) fail("company", companyErr);

const allocs = store?.id
  ? await countEq("allocations", "store_id", store.id)
  : 0;
const infs = await countEq("influencers", "notes", "seed:knownbeauty-jp");
const { count: products, error: prodErr } = await supabase
  .from("products")
  .select("id", { count: "exact", head: true })
  .like("sku", "KB-%");
if (prodErr) fail("products count", prodErr);

const plan = {
  mode: apply ? "apply" : "dry-run",
  store: store || null,
  company: company || null,
  allocations: allocs,
  influencers: infs,
  products: products || 0,
  purgeCompany,
};

console.log(JSON.stringify(plan, null, 2));

if (!apply) {
  console.log("실제로 지우려면 --apply 를 붙여 다시 실행하세요.");
  process.exit(0);
}

if (store?.id) {
  const { error } = await supabase
    .from("allocations")
    .delete()
    .eq("store_id", store.id);
  if (error) fail("delete allocations", error);
  console.log("deleted allocations at 긴자점");
}

const { error: infDel } = await supabase
  .from("influencers")
  .delete()
  .eq("notes", "seed:knownbeauty-jp");
if (infDel) fail("delete influencers", infDel);
console.log("deleted seed influencers");

const { error: prodDel } = await supabase
  .from("products")
  .delete()
  .like("sku", "KB-%");
if (prodDel) fail("delete products", prodDel);
console.log("deleted KB-* products");

if (store?.id) {
  const { error } = await supabase.from("stores").delete().eq("id", store.id);
  if (error) fail("delete store", error);
  console.log("deleted 긴자점");
}

if (purgeCompany && company?.id) {
  const { error } = await supabase
    .from("companies")
    .delete()
    .eq("id", company.id);
  if (error) fail("delete company", error);
  console.log("deleted company", company.login_id);
} else {
  console.log("company kept (login_id=company). 계정까지 지우려면 --purge-company");
}
