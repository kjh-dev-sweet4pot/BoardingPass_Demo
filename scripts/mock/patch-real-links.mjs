/**
 * KnownBeauty creator_links 를 실제로 열리는 공개 콘텐츠 URL 로 교체.
 * 앱 런타임과 무관. 재패치가 필요 없으면 `scripts/mock` 을 삭제하면 됩니다.
 *
 *   node scripts/mock/patch-real-links.mjs
 */
import { createClient } from "@supabase/supabase-js";
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

const { data: company, error: companyError } = await supabase
  .from("companies")
  .select("id")
  .eq("login_id", "company")
  .maybeSingle();
if (companyError) throw companyError;
if (!company?.id) throw new Error("KnownBeauty company not found");

const { data: allocs, error } = await supabase
  .from("allocations")
  .select("id, creator_links(id, url, platform)")
  .eq("company_id", company.id)
  .order("visit_date", { ascending: true });
if (error) throw error;

const links = [];
for (const a of allocs || []) {
  for (const l of a.creator_links || []) links.push(l);
}
links.sort((a, b) => String(a.id).localeCompare(String(b.id)));

let updated = 0;
const byPlat = { instagram: 0, tiktok: 0, youtube: 0, etc: 0 };
for (let i = 0; i < links.length; i += 1) {
  const next = pickRealLink(i);
  const { error: upd } = await supabase
    .from("creator_links")
    .update({
      url: next.url,
      platform: next.platform,
      updated_at: new Date().toISOString(),
    })
    .eq("id", links[i].id);
  if (upd) throw upd;
  byPlat[next.platform] = (byPlat[next.platform] || 0) + 1;
  updated += 1;
}

console.log({ updated, byPlat, sample: pickRealLink(0) });
