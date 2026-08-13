/**
 * KnownBeauty × 긴자점 데모 시드. 앱 런타임과 무관.
 * 재시드가 필요 없으면 `scripts/mock` 폴더를 통째로 삭제하면 됩니다.
 * DB 데모 데이터만 지울 때는 teardown 을 쓰세요.
 *
 *   node scripts/mock/seed-knownbeauty.mjs
 *   node scripts/mock/teardown-knownbeauty.mjs
 *   node scripts/mock/teardown-knownbeauty.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, scryptSync } from "crypto";
import { readFileSync } from "fs";
import { pickRealLink } from "./real-content-links.mjs";

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

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function fail(label, error) {
  throw new Error(`${label}: ${error?.message || error}`);
}

const PRODUCTS = [
  ["KB-VC15", "KnownBeauty 비타민C 15 세럼"],
  ["KB-RETN", "KnownBeauty 레티놀 나이트 크림"],
  ["KB-CERA", "KnownBeauty 세라마이드 배리어 크림"],
  ["KB-UV01", "KnownBeauty UV 톤업 선스크린"],
  ["KB-HYAL", "KnownBeauty 히알루론 워터 앰플"],
  ["KB-CLNS", "KnownBeauty 클렌징 밀크"],
  ["KB-EYE1", "KnownBeauty 펩타이드 아이크림"],
  ["KB-LIP1", "KnownBeauty 립 트리트먼트"],
  ["KB-MIST", "KnownBeauty 미네랄 미스트 토너"],
  ["KB-MASK", "KnownBeauty 콜라겐 시트 마스크"],
];

const INFLUENCERS = [
  ["사토 유이", "yui.sato.beauty"],
  ["다나카 마이", "mai.tanaka.skincare"],
  ["스즈키 하나", "hana.suzuki.diary"],
  ["와타나베 리코", "riko.watanabe.glow"],
  ["이토 사쿠라", "sakura.ito.skin"],
  ["야마모토 아오이", "aoi.yamamoto.beauty"],
  ["나카무라 미나", "mina.nakamura.lab"],
  ["고바야시 에미", "emi.kobayashi.glow"],
  ["가토 린", "rin.kato.tokyo"],
  ["요시다 나츠키", "natsuki.yoshida.skin"],
  ["사사키 미오", "mio.sasaki.beauty"],
  ["마츠모토 유나", "yuna.matsumoto.diary"],
  ["이노우에 카에데", "kaede.inoue.skincare"],
  ["기무라 히나", "hina.kimura.glow"],
  ["하야시 아야", "aya.hayashi.beauty"],
  ["시미즈 코토네", "kotone.shimizu.skin"],
  ["모리 레나", "rena.mori.tokyo"],
  ["이케다 미유", "miyu.ikeda.beauty"],
  ["후지타 노아", "noa.fujita.glow"],
  ["오카다 시오리", "shiori.okada.diary"],
];

function visitYmd(index) {
  // 7/18 ~ 8/13 사이 분산
  const start = Date.UTC(2026, 6, 18);
  const day = index % 27;
  const d = new Date(start + day * 86400000);
  return d.toISOString().slice(0, 10);
}

function isoAt(ymd, hour) {
  return new Date(`${ymd}T${String(hour).padStart(2, "0")}:18:00+09:00`).toISOString();
}

async function upsertCompany() {
  const { data: existing, error } = await supabase
    .from("companies")
    .select("id, login_id, name")
    .eq("login_id", "company")
    .maybeSingle();
  if (error) fail("company lookup", error);

  const patch = {
    name: "KnownBeauty",
    login_id: "company",
    password_hash: hashPassword("company"),
    aliases: ["KnownBeuaty", "KB", "노운뷰티"],
    contact: "partnership@knownbeauty.jp",
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { data, error: upd } = await supabase
      .from("companies")
      .update(patch)
      .eq("id", existing.id)
      .select("id, name, login_id")
      .single();
    if (upd) fail("company update", upd);
    console.log("company updated", data);
    return data;
  }

  const { data, error: ins } = await supabase
    .from("companies")
    .insert(patch)
    .select("id, name, login_id")
    .single();
  if (ins) fail("company insert", ins);
  console.log("company inserted", data);
  return data;
}

async function upsertStore() {
  const { data: existing, error } = await supabase
    .from("stores")
    .select("id, name")
    .eq("name", "긴자점")
    .maybeSingle();
  if (error) fail("store lookup", error);
  if (existing?.id) {
    const { data, error: upd } = await supabase
      .from("stores")
      .update({ address: "東京都中央区銀座4-6-16" })
      .eq("id", existing.id)
      .select("id, name")
      .single();
    if (upd) fail("store update", upd);
    console.log("store reused", data);
    return data;
  }
  const { data, error: ins } = await supabase
    .from("stores")
    .insert({ name: "긴자점", address: "東京都中央区銀座4-6-16" })
    .select("id, name")
    .single();
  if (ins) fail("store insert", ins);
  console.log("store inserted", data);
  return data;
}

async function upsertProducts() {
  const out = [];
  for (const [sku, name] of PRODUCTS) {
    const { data: existing, error } = await supabase
      .from("products")
      .select("id, name, sku")
      .eq("sku", sku)
      .maybeSingle();
    if (error) fail("product lookup", error);
    if (existing?.id) {
      out.push(existing);
      continue;
    }
    const { data, error: ins } = await supabase
      .from("products")
      .insert({ name, sku, description: name })
      .select("id, name, sku")
      .single();
    if (ins) fail("product insert", ins);
    out.push(data);
  }
  console.log("products", out.length);
  return out;
}

async function upsertInfluencers() {
  const out = [];
  for (const [name, handle] of INFLUENCERS) {
    const { data: existing, error } = await supabase
      .from("influencers")
      .select("id, name, instagram_handle, instagram_handle_normalized")
      .eq("instagram_handle_normalized", handle)
      .maybeSingle();
    if (error) fail("influencer lookup", error);
    if (existing?.id) {
      out.push(existing);
      continue;
    }
    const { data, error: ins } = await supabase
      .from("influencers")
      .insert({
        name,
        instagram_handle: handle,
        sns_url: `https://www.instagram.com/${handle}`,
        notes: "seed:knownbeauty-jp",
      })
      .select("id, name, instagram_handle, instagram_handle_normalized")
      .single();
    if (ins) fail("influencer insert", ins);
    out.push(data);
  }
  console.log("influencers", out.length);
  return out;
}

function planAllocations(influencers, products) {
  const rows = [];
  let n = 0;
  for (let i = 0; i < influencers.length; i += 1) {
    const inf = influencers[i];
    const count = 2 + (i % 2); // 2 or 3 products each → 50 total
    const used = new Set();
    for (let k = 0; k < count; k += 1) {
      let pIdx = (i * 3 + k * 7) % products.length;
      while (used.has(pIdx)) pIdx = (pIdx + 1) % products.length;
      used.add(pIdx);
      const visit_date = visitYmd(i * 3 + k);
      const status =
        n < 45 ? "picked_up" : n < 48 ? "visited" : "pending";
      rows.push({
        inf,
        product: products[pIdx],
        visit_date,
        status,
        seq: n,
      });
      n += 1;
    }
  }
  // extra picked_up rows so we can attach 2nd links → ~55-58 contents
  for (let extra = 0; extra < 8; extra += 1) {
    const inf = influencers[extra];
    const product = products[(extra + 4) % products.length];
    const visit_date = visitYmd(20 + extra);
    rows.push({
      inf,
      product,
      visit_date,
      status: "picked_up",
      seq: n,
      secondWave: true,
    });
    n += 1;
  }
  return rows;
}

async function insertAllocations(plan, storeId, companyId) {
  const inserted = [];
  for (const row of plan) {
    const { data: dup } = await supabase
      .from("allocations")
      .select("id, status")
      .eq("influencer_id", row.inf.id)
      .eq("product_id", row.product.id)
      .eq("store_id", storeId)
      .eq("visit_date", row.visit_date)
      .eq("company_id", companyId)
      .maybeSingle();
    if (dup?.id) {
      inserted.push({ ...dup, plan: row });
      continue;
    }

    const nowHour = 11 + (row.seq % 7);
    const payload = {
      influencer_id: row.inf.id,
      product_id: row.product.id,
      store_id: storeId,
      company_id: companyId,
      quantity: 1 + (row.seq % 2),
      status: row.status,
      visit_date: row.visit_date,
      visit_code: String(1000 + row.seq).padStart(4, "0"),
      visit_source:
        row.status === "pending" ? null : row.seq % 3 === 0 ? "auto" : "pharmacist",
      visit_confirmed_by:
        row.status === "pending" ? null : row.seq % 3 === 0 ? "auto" : "pharmacist",
      verified_at:
        row.status === "pending" ? null : isoAt(row.visit_date, nowHour),
      last_visited_at:
        row.status === "pending" ? null : isoAt(row.visit_date, nowHour + 1),
      picked_up_at:
        row.status === "picked_up" ? isoAt(row.visit_date, nowHour + 2) : null,
    };

    const { data, error } = await supabase
      .from("allocations")
      .insert(payload)
      .select("id, status")
      .single();
    if (error) fail(`allocation ${row.inf.name} ${row.product.name}`, error);
    inserted.push({ ...data, plan: row });
  }
  console.log("allocations", inserted.length);
  return inserted;
}

function linkFor(row, _allocId, variant) {
  return pickRealLink(row.seq * 10 + variant);
}

async function insertLinks(allocs) {
  let created = 0;
  for (const row of allocs) {
    if (row.status !== "picked_up") continue;
    const variants = row.plan.secondWave ? [0] : [0];
    // first 10 picked_up also get a second platform link
    if (!row.plan.secondWave && row.plan.seq < 5) variants.push(1);

    const { count: existingCount } = await supabase
      .from("creator_links")
      .select("id", { count: "exact", head: true })
      .eq("allocation_id", row.id);
    if ((existingCount || 0) >= variants.length) {
      created += existingCount || 0;
      continue;
    }

    for (const variant of variants) {
      const link = linkFor(row.plan, row.id, variant);
      const { data: dup } = await supabase
        .from("creator_links")
        .select("id")
        .eq("allocation_id", row.id)
        .eq("url", link.url)
        .maybeSingle();
      if (dup?.id) {
        created += 1;
        continue;
      }
      const { error } = await supabase.from("creator_links").insert({
        allocation_id: row.id,
        influencer_id: row.plan.inf.id,
        url: link.url,
        platform: link.platform,
        status: row.plan.seq % 11 === 0 ? "submitted" : "approved",
      });
      if (error) fail(`link ${link.url}`, error);
      created += 1;
    }
  }
  console.log("creator_links", created);
  return created;
}

async function detachLegacyDemoAllocations(companyId, storeId) {
  const { data, error } = await supabase
    .from("allocations")
    .select("id")
    .eq("company_id", companyId)
    .neq("store_id", storeId);
  if (error) fail("legacy alloc lookup", error);
  const ids = (data || []).map((r) => r.id);
  if (ids.length === 0) return 0;
  const { error: upd } = await supabase
    .from("allocations")
    .update({ company_id: null, updated_at: new Date().toISOString() })
    .in("id", ids);
  if (upd) fail("legacy alloc detach", upd);
  console.log("detached legacy demo allocations", ids.length);
  return ids.length;
}

const company = await upsertCompany();
const store = await upsertStore();
const products = await upsertProducts();
const influencers = await upsertInfluencers();
const plan = planAllocations(influencers, products);
const allocs = await insertAllocations(plan, store.id, company.id);
await detachLegacyDemoAllocations(company.id, store.id);
const links = await insertLinks(allocs);

const picked = allocs.filter((a) => a.status === "picked_up").length;
console.log(
  JSON.stringify(
    {
      company: company.name,
      login: "company / company",
      store: store.name,
      influencers: influencers.length,
      products: products.length,
      allocations: allocs.length,
      picked_up: picked,
      contents: links,
    },
    null,
    2,
  ),
);
