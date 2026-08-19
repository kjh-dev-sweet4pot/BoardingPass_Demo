/**
 * TS. /com 개발용 시드 데이터
 *
 * 실행:
 *   node scripts/mock/seed-ts-company-demo.mjs
 *
 * 필요 env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 로그인:
 *   companya / companya
 *   companyb / companyb
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, scryptSync } from "crypto";
import { existsSync, readFileSync } from "fs";

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const idx = line.indexOf("=");
        return [
          line.slice(0, idx).trim(),
          line.slice(idx + 1).trim().replace(/^["']|["']$/g, ""),
        ];
      }),
  );
}

const env = {
  ...loadEnvFile(".env"),
  ...loadEnvFile(".env.local"),
  ...process.env,
};

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false },
});

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function fail(label, error) {
  throw new Error(`${label}: ${error?.message || error}`);
}

function iso(date, hour = 10) {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+09:00`).toISOString();
}

function addDays(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

const COMPANY_DEFS = [
  {
    key: "A",
    login_id: "companya",
    password: "companya",
    name: "KnownBeauty Alpha",
    aliases: ["KBA", "KnownBeauty A", "Alpha"],
    contact: "alpha@knownbeauty.jp",
  },
  {
    key: "B",
    login_id: "companyb",
    password: "companyb",
    name: "KnownBeauty Beta",
    aliases: ["KBB", "KnownBeauty B", "Beta"],
    contact: "beta@knownbeauty.jp",
  },
];

const STORE_DEFS = [
  { name: "긴자점", address: "東京都中央区銀座4-6-16" },
  { name: "강남점", address: "서울특별시 강남구 테헤란로 123" },
];

const PRODUCT_DEFS = [
  { company: "A", sku: "TSA-ESS", name: "Alpha 브라이트 에센스" },
  { company: "A", sku: "TSA-SER", name: "Alpha 리페어 세럼" },
  { company: "A", sku: "TSA-CRM", name: "Alpha 배리어 크림" },
  { company: "B", sku: "TSB-SUN", name: "Beta 톤업 선스크린" },
  { company: "B", sku: "TSB-MSK", name: "Beta 수딩 마스크" },
  { company: "B", sku: "TSB-MST", name: "Beta 하이드라 미스트" },
];

const SCALE_BANDS = [
  "10K 이하",
  "10K-50K",
  "50K-200K",
  "200K+",
];

const INFLUENCERS = [
  ["사토 유이", "tsdemo.yui"],
  ["다나카 마이", "tsdemo.mai"],
  ["스즈키 하나", "tsdemo.hana"],
  ["와타나베 리코", "tsdemo.riko"],
  ["이토 사쿠라", "tsdemo.sakura"],
  ["야마모토 아오이", "tsdemo.aoi"],
  ["나카무라 미나", "tsdemo.mina"],
  ["고바야시 에미", "tsdemo.emi"],
  ["가토 린", "tsdemo.rin"],
  ["요시다 나츠키", "tsdemo.natsuki"],
  ["사사키 미오", "tsdemo.mio"],
  ["마츠모토 유나", "tsdemo.yuna"],
  ["이노우에 카에데", "tsdemo.kaede"],
  ["기무라 히나", "tsdemo.hina"],
  ["하야시 아야", "tsdemo.aya"],
  ["시미즈 코토네", "tsdemo.kotone"],
  ["모리 레나", "tsdemo.rena"],
  ["이케다 미유", "tsdemo.miyu"],
  ["후지타 노아", "tsdemo.noa"],
  ["오카다 시오리", "tsdemo.shiori"],
];

async function upsertCompany(def) {
  const patch = {
    name: def.name,
    login_id: def.login_id,
    password_hash: hashPassword(def.password),
    aliases: def.aliases,
    contact: def.contact,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error } = await supabase
    .from("companies")
    .select("id")
    .eq("login_id", def.login_id)
    .maybeSingle();
  if (error) fail(`company lookup ${def.login_id}`, error);

  if (existing?.id) {
    const { data, error: upd } = await supabase
      .from("companies")
      .update(patch)
      .eq("id", existing.id)
      .select("id, name, login_id")
      .single();
    if (upd) fail(`company update ${def.login_id}`, upd);
    return data;
  }

  const { data, error: ins } = await supabase
    .from("companies")
    .insert(patch)
    .select("id, name, login_id")
    .single();
  if (ins) fail(`company insert ${def.login_id}`, ins);
  return data;
}

async function upsertStore(def) {
  const { data: existing, error } = await supabase
    .from("stores")
    .select("id")
    .eq("name", def.name)
    .maybeSingle();
  if (error) fail(`store lookup ${def.name}`, error);

  if (existing?.id) {
    const { data, error: upd } = await supabase
      .from("stores")
      .update({ address: def.address })
      .eq("id", existing.id)
      .select("id, name")
      .single();
    if (upd) fail(`store update ${def.name}`, upd);
    return data;
  }

  const { data, error: ins } = await supabase
    .from("stores")
    .insert(def)
    .select("id, name")
    .single();
  if (ins) fail(`store insert ${def.name}`, ins);
  return data;
}

async function upsertProduct(def) {
  const { data: existing, error } = await supabase
    .from("products")
    .select("id, sku, name")
    .eq("sku", def.sku)
    .maybeSingle();
  if (error) fail(`product lookup ${def.sku}`, error);

  if (existing?.id) return existing;

  const { data, error: ins } = await supabase
    .from("products")
    .insert({
      sku: def.sku,
      name: def.name,
      description: `${def.name} · TS 시드`,
    })
    .select("id, sku, name")
    .single();
  if (ins) fail(`product insert ${def.sku}`, ins);
  return data;
}

async function upsertInfluencer([name, handle], index) {
  const scale_band = SCALE_BANDS[index % SCALE_BANDS.length];
  const patch = {
    name,
    instagram_handle: handle,
    instagram_handle_normalized: handle,
    sns_url: `https://www.instagram.com/${handle}`,
    phone: `010-77${String(index).padStart(2, "0")}-12${String(index).padStart(2, "0")}`,
    email: `${handle}@seed.local`,
    scale_band,
    notes: "seed:ts-company-demo",
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error } = await supabase
    .from("influencers")
    .select("id, name, instagram_handle_normalized")
    .eq("instagram_handle_normalized", handle)
    .maybeSingle();
  if (error) fail(`influencer lookup ${handle}`, error);

  if (existing?.id) {
    const { data, error: upd } = await supabase
      .from("influencers")
      .update(patch)
      .eq("id", existing.id)
      .select("id, name, instagram_handle_normalized")
      .single();
    if (upd) fail(`influencer update ${handle}`, upd);
    return data;
  }

  const { data, error: ins } = await supabase
    .from("influencers")
    .insert(patch)
    .select("id, name, instagram_handle_normalized")
    .single();
  if (ins) fail(`influencer insert ${handle}`, ins);
  return data;
}

async function upsertCampaign({ company_id, product_id, status, name }) {
  const { data: existing, error } = await supabase
    .from("campaigns")
    .select("id")
    .eq("company_id", company_id)
    .eq("name", name)
    .maybeSingle();
  if (error) fail(`campaign lookup ${name}`, error);

  if (existing?.id) {
    const { data, error: upd } = await supabase
      .from("campaigns")
      .update({ product_id, status, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("id, name, status")
      .single();
    if (upd) fail(`campaign update ${name}`, upd);
    return data;
  }

  const { data, error: ins } = await supabase
    .from("campaigns")
    .insert({ company_id, product_id, status, name })
    .select("id, name, status")
    .single();
  if (ins) fail(`campaign insert ${name}`, ins);
  return data;
}

async function upsertGuideline(campaign_id, title, body) {
  const { data: existing, error } = await supabase
    .from("guidelines")
    .select("id")
    .eq("campaign_id", campaign_id)
    .eq("title", title)
    .maybeSingle();
  if (error) fail(`guideline lookup ${title}`, error);

  if (existing?.id) {
    const { error: upd } = await supabase
      .from("guidelines")
      .update({ body, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (upd) fail(`guideline update ${title}`, upd);
    return existing.id;
  }

  const { data, error: ins } = await supabase
    .from("guidelines")
    .insert({ campaign_id, title, body })
    .select("id")
    .single();
  if (ins) fail(`guideline insert ${title}`, ins);
  return data.id;
}

async function upsertCasting({
  campaign_id,
  company_id,
  influencer_id,
  status,
  allocation_id = null,
}) {
  const { data: existing, error } = await supabase
    .from("castings")
    .select("id")
    .eq("campaign_id", campaign_id)
    .eq("influencer_id", influencer_id)
    .maybeSingle();
  if (error) fail(`casting lookup ${campaign_id}/${influencer_id}`, error);

  const patch = {
    company_id,
    status,
    allocation_id,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { data, error: upd } = await supabase
      .from("castings")
      .update(patch)
      .eq("id", existing.id)
      .select("id, status")
      .single();
    if (upd) fail(`casting update ${campaign_id}/${influencer_id}`, upd);
    return data;
  }

  const { data, error: ins } = await supabase
    .from("castings")
    .insert({ campaign_id, company_id, influencer_id, ...patch })
    .select("id, status")
    .single();
  if (ins) fail(`casting insert ${campaign_id}/${influencer_id}`, ins);
  return data;
}

async function upsertAllocation({
  influencer_id,
  product_id,
  store_id,
  company_id,
  campaign_id,
  visit_date,
  status,
  quantity,
  target_content_count,
  visit_code,
}) {
  const { data: existing, error } = await supabase
    .from("allocations")
    .select("id")
    .eq("influencer_id", influencer_id)
    .eq("product_id", product_id)
    .eq("store_id", store_id)
    .eq("visit_date", visit_date)
    .eq("company_id", company_id)
    .maybeSingle();
  if (error) fail(`allocation lookup ${influencer_id}/${visit_date}`, error);

  const patch = {
    company_id,
    campaign_id,
    quantity,
    target_content_count,
    status,
    visit_date,
    visit_code,
    visit_source: status === "pending" ? null : "admin",
    visit_confirmed_by: status === "pending" ? null : "admin",
    verified_at: status === "pending" ? null : iso(visit_date, 10),
    last_visited_at: status === "pending" ? null : iso(visit_date, 11),
    picked_up_at: status === "picked_up" ? iso(visit_date, 12) : null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { data, error: upd } = await supabase
      .from("allocations")
      .update(patch)
      .eq("id", existing.id)
      .select("id, campaign_id")
      .single();
    if (upd) fail(`allocation update ${influencer_id}/${visit_date}`, upd);
    return data;
  }

  const { data, error: ins } = await supabase
    .from("allocations")
    .insert({
      influencer_id,
      product_id,
      store_id,
      ...patch,
    })
    .select("id, campaign_id")
    .single();
  if (ins) fail(`allocation insert ${influencer_id}/${visit_date}`, ins);
  return data;
}

async function upsertCreatorLink({
  allocation_id,
  influencer_id,
  url,
  platform,
  status,
  content_status,
  publish_url,
  submitted_at,
  verification_failed = false,
}) {
  const { data: existing, error } = await supabase
    .from("creator_links")
    .select("id")
    .eq("allocation_id", allocation_id)
    .eq("url", url)
    .maybeSingle();
  if (error) fail(`creator_link lookup ${url}`, error);

  const patch = {
    influencer_id,
    platform,
    status,
    content_status,
    publish_url,
    verification_failed,
    submitted_at,
    updated_at: submitted_at,
  };

  if (existing?.id) {
    const { data, error: upd } = await supabase
      .from("creator_links")
      .update(patch)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (upd) fail(`creator_link update ${url}`, upd);
    return data.id;
  }

  const { data, error: ins } = await supabase
    .from("creator_links")
    .insert({
      allocation_id,
      url,
      ...patch,
    })
    .select("id")
    .single();
  if (ins) fail(`creator_link insert ${url}`, ins);
  return data.id;
}

async function replaceMetrics({ creator_link_id, seed, postedYmd }) {
  const { error: del } = await supabase
    .from("content_metrics")
    .delete()
    .eq("creator_link_id", creator_link_id);
  if (del) fail(`content_metrics delete ${creator_link_id}`, del);

  const rows = [];
  let lastViews = 1200 + seed * 230;
  let lastLikes = 70 + seed * 5;
  let lastComments = 8 + seed;

  for (let step = 0; step <= 12; step += 1) {
    const when = new Date(
      new Date(`${postedYmd}T09:00:00+09:00`).getTime() + step * 6 * 60 * 60 * 1000,
    );
    lastViews += 280 + seed * 11 + step * 35;
    lastLikes += 18 + (step % 4);
    lastComments += 2 + (step % 3 === 0 ? 1 : 0);
    rows.push({
      creator_link_id,
      collected_at: when.toISOString(),
      views: lastViews,
      likes: lastLikes,
      comments: lastComments,
    });
  }

  for (let day = 4; day <= 14; day += 1) {
    const when = new Date(`${addDays(postedYmd, day)}T09:00:00+09:00`);
    lastViews += 420 + seed * 9 + day * 22;
    lastLikes += 20 + (day % 5);
    lastComments += 2 + (day % 4 === 0 ? 1 : 0);
    rows.push({
      creator_link_id,
      collected_at: when.toISOString(),
      views: lastViews,
      likes: lastLikes,
      comments: lastComments,
    });
  }

  const { error: ins } = await supabase.from("content_metrics").insert(rows);
  if (ins) fail(`content_metrics insert ${creator_link_id}`, ins);

  const latest = rows[rows.length - 1];
  const { error: upd } = await supabase
    .from("creator_links")
    .update({
      views: latest.views,
      likes: latest.likes,
      comments: latest.comments,
      metrics_collected_at: latest.collected_at,
      updated_at: latest.collected_at,
    })
    .eq("id", creator_link_id);
  if (upd) fail(`creator_link metric mirror ${creator_link_id}`, upd);
}

async function main() {
  const companies = {};
  for (const def of COMPANY_DEFS) {
    companies[def.key] = await upsertCompany(def);
  }

  const stores = {};
  for (const def of STORE_DEFS) {
    stores[def.name] = await upsertStore(def);
  }

  const products = {};
  for (const def of PRODUCT_DEFS) {
    products[def.sku] = await upsertProduct(def);
  }

  const influencers = [];
  for (let i = 0; i < INFLUENCERS.length; i += 1) {
    influencers.push(await upsertInfluencer(INFLUENCERS[i], i));
  }

  const campaignQuote = await upsertCampaign({
    company_id: companies.A.id,
    product_id: products["TSA-ESS"].id,
    status: "견적수립",
    name: "TS-A 견적수립 캠페인",
  });
  const campaignRun = await upsertCampaign({
    company_id: companies.A.id,
    product_id: products["TSA-SER"].id,
    status: "시행",
    name: "TS-A 시행 캠페인",
  });
  const campaignHold = await upsertCampaign({
    company_id: companies.A.id,
    product_id: products["TSA-CRM"].id,
    status: "보류",
    name: "TS-A 보류 캠페인",
  });
  const campaignResult = await upsertCampaign({
    company_id: companies.B.id,
    product_id: products["TSB-SUN"].id,
    status: "시행",
    name: "TS-B 결과 캠페인",
  });

  await upsertGuideline(campaignQuote.id, "TS quote guideline", "견적수립 단계 가이드라인");
  await upsertGuideline(campaignRun.id, "TS run guideline", "시행 중 콘텐츠 가이드라인");
  await upsertGuideline(campaignHold.id, "TS hold guideline", "보류 상태 콘텐츠 가이드라인");
  await upsertGuideline(campaignResult.id, "TS result guideline", "결과 단계 콘텐츠 가이드라인");

  const allocationPlans = [
    {
      label: "run-mid",
      campaign: campaignRun,
      company: companies.A,
      product: products["TSA-SER"],
      store: stores["긴자점"],
      influencer: influencers[0],
      visit_date: "2026-08-10",
      status: "picked_up",
      quantity: 1,
      target_content_count: 3,
      links: [
        { suffix: "a", content_status: "발행완료", status: "approved" },
        { suffix: "b", content_status: "발행완료", status: "approved" },
        { suffix: "c", content_status: "승인", status: "approved", noMetrics: true },
      ],
    },
    {
      label: "run-making",
      campaign: campaignRun,
      company: companies.A,
      product: products["TSA-SER"],
      store: stores["강남점"],
      influencer: influencers[1],
      visit_date: "2026-08-13",
      status: "picked_up",
      quantity: 2,
      target_content_count: 3,
      links: [],
    },
    {
      label: "hold-review",
      campaign: campaignHold,
      company: companies.A,
      product: products["TSA-CRM"],
      store: stores["긴자점"],
      influencer: influencers[2],
      visit_date: "2026-08-09",
      status: "picked_up",
      quantity: 1,
      target_content_count: 3,
      links: [
        { suffix: "a", content_status: "제출", status: "submitted", noMetrics: true },
        { suffix: "b", content_status: "발행완료", status: "approved", verification_failed: true },
      ],
    },
    {
      label: "result-1",
      campaign: campaignResult,
      company: companies.B,
      product: products["TSB-SUN"],
      store: stores["강남점"],
      influencer: influencers[10],
      visit_date: "2026-08-02",
      status: "picked_up",
      quantity: 1,
      target_content_count: 3,
      links: [
        { suffix: "a", content_status: "발행완료", status: "approved" },
        { suffix: "b", content_status: "발행완료", status: "approved" },
        { suffix: "c", content_status: "발행완료", status: "approved" },
      ],
    },
    {
      label: "result-2",
      campaign: campaignResult,
      company: companies.B,
      product: products["TSB-MSK"],
      store: stores["긴자점"],
      influencer: influencers[11],
      visit_date: "2026-08-03",
      status: "picked_up",
      quantity: 1,
      target_content_count: 3,
      links: [
        { suffix: "a", content_status: "발행완료", status: "approved" },
        { suffix: "b", content_status: "발행완료", status: "approved" },
        { suffix: "c", content_status: "발행완료", status: "approved" },
      ],
    },
  ];

  const allocations = {};
  for (let i = 0; i < allocationPlans.length; i += 1) {
    const plan = allocationPlans[i];
    const allocation = await upsertAllocation({
      influencer_id: plan.influencer.id,
      product_id: plan.product.id,
      store_id: plan.store.id,
      company_id: plan.company.id,
      campaign_id: plan.campaign.id,
      visit_date: plan.visit_date,
      status: plan.status,
      quantity: plan.quantity,
      target_content_count: plan.target_content_count,
      visit_code: `TS${1000 + i}`,
    });
    allocations[plan.label] = allocation;
  }

  const castingPlans = [
    { campaign: campaignQuote, company: companies.A, influencer: influencers[3], status: "Pending" },
    { campaign: campaignQuote, company: companies.A, influencer: influencers[4], status: "Nego" },
    { campaign: campaignQuote, company: companies.A, influencer: influencers[5], status: "결렬" },
    { campaign: campaignRun, company: companies.A, influencer: influencers[0], status: "Accept", allocation: allocations["run-mid"] },
    { campaign: campaignRun, company: companies.A, influencer: influencers[1], status: "Accept", allocation: allocations["run-making"] },
    { campaign: campaignRun, company: companies.A, influencer: influencers[6], status: "Pending" },
    { campaign: campaignRun, company: companies.A, influencer: influencers[7], status: "Nego" },
    { campaign: campaignHold, company: companies.A, influencer: influencers[2], status: "Accept", allocation: allocations["hold-review"] },
    { campaign: campaignHold, company: companies.A, influencer: influencers[8], status: "결렬" },
    { campaign: campaignResult, company: companies.B, influencer: influencers[10], status: "Accept", allocation: allocations["result-1"] },
    { campaign: campaignResult, company: companies.B, influencer: influencers[11], status: "Accept", allocation: allocations["result-2"] },
  ];

  for (const plan of castingPlans) {
    await upsertCasting({
      campaign_id: plan.campaign.id,
      company_id: plan.company.id,
      influencer_id: plan.influencer.id,
      status: plan.status,
      allocation_id: plan.allocation?.id || null,
    });
  }

  let publishedLinks = 0;
  for (let planIndex = 0; planIndex < allocationPlans.length; planIndex += 1) {
    const plan = allocationPlans[planIndex];
    const allocation = allocations[plan.label];

    for (let linkIndex = 0; linkIndex < plan.links.length; linkIndex += 1) {
      const linkPlan = plan.links[linkIndex];
      const postedYmd = addDays(plan.visit_date, 7 + linkIndex);
      const url = `https://www.instagram.com/p/ts${plan.label.replace(/[^a-z0-9]/gi, "").toLowerCase()}${linkPlan.suffix}/`;
      const linkId = await upsertCreatorLink({
        allocation_id: allocation.id,
        influencer_id: plan.influencer.id,
        url,
        platform: "instagram",
        status: linkPlan.status,
        content_status: linkPlan.content_status,
        publish_url:
          linkPlan.content_status === "발행완료" ? url : null,
        submitted_at: iso(postedYmd, 9),
        verification_failed: Boolean(linkPlan.verification_failed),
      });

      if (!linkPlan.noMetrics && linkPlan.content_status === "발행완료") {
        await replaceMetrics({
          creator_link_id: linkId,
          seed: planIndex * 10 + linkIndex + 1,
          postedYmd,
        });
        publishedLinks += 1;
      }
    }
  }

  await supabase
    .from("campaigns")
    .update({ status: "보류" })
    .eq("id", campaignHold.id);

  const summary = {
    companies: COMPANY_DEFS.length,
    products: PRODUCT_DEFS.length,
    influencers: INFLUENCERS.length,
    campaigns: 4,
    castings: castingPlans.length,
    allocations: allocationPlans.length,
    published_links: publishedLinks,
    logins: [
      "companya / companya",
      "companyb / companyb",
    ],
  };

  console.log(JSON.stringify(summary, null, 2));
}

await main();
