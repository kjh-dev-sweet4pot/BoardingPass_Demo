/**
 * 캠페인 발행이 없는 배정 인플 → SNS 최근 3건 평균을 JSON에 저장.
 *   node scripts/refresh-pool-profile-metrics.mjs
 *   node scripts/refresh-pool-profile-metrics.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const DRY = process.argv.includes("--dry-run");
const APIFY_BASE = "https://api.apify.com/v2";
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/lib/data/pool-profile-metrics.json",
);
const XHS_ER = 0.012;

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
          line.slice(idx + 1).trim().replace(/^["']|["']$/g, "").split(/[\s#—–]/)[0],
        ];
      }),
  );
}
function jwt(v) {
  const t = (v || "").trim();
  const m = t.match(/^(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/);
  return m ? m[1] : t.split(/[\s#—–]/)[0] || "";
}

const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local"), ...process.env };
const token = env.APIFY_TOKEN?.trim();
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  jwt(env.SUPABASE_SERVICE_ROLE_KEY),
  { auth: { persistSession: false } },
);

function isPub(l) {
  if (l.content_status === "발행완료") return true;
  if (l.content_status) return false;
  return l.status === "approved";
}

function asCount(v) {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  return 0;
}

function estimateViews({ views, likes, comments, saves }) {
  if (views > 0) return views;
  const interact = likes + comments;
  if (interact > 0) return Math.round(interact / XHS_ER);
  if (saves > 0) return Math.round(saves / XHS_ER);
  return 0;
}

async function expandXhsShortUrl(url) {
  if (!/xhslink\.(cn|com)/i.test(url || "")) return url;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0" },
    });
    const finalUrl = res.url || "";
    const encoded = finalUrl.match(/redirectPath=([^&]+)/)?.[1];
    const dest = encoded ? decodeURIComponent(encoded) : finalUrl;
    const id = dest.match(/\/user\/profile\/([0-9a-f]{24})/i)?.[1];
    if (id) return `https://www.xiaohongshu.com/user/profile/${id}`;
    return dest.startsWith("http") ? dest : url;
  } catch {
    return url;
  }
}

async function scrapeXhs(profileUrl) {
  const res = await fetch(
    `${APIFY_BASE}/acts/atomus~xiaohongshu-scraper/run-sync-get-dataset-items?token=${token}&memoryMbytes=512&timeout=180`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchType: "profile",
        userUrls: [profileUrl],
        includePosts: true,
      }),
    },
  );
  if (!res.ok) throw new Error(`Apify ${res.status}: ${(await res.text()).slice(0, 180)}`);
  const items = await res.json();
  const posts = [...(items[0]?.posts || [])].sort(
    (a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0),
  );
  return posts.slice(0, 3).map((p) => {
    const likes = asCount(p.liked_count);
    const comments = asCount(p.comments_count);
    const saves = asCount(p.collected_count);
    const views = estimateViews({
      views: asCount(p.view_count),
      likes,
      comments,
      saves,
    });
    return {
      url: p.url || "",
      views,
      likes,
      comments,
      saves,
      viewsEstimated: asCount(p.view_count) <= 0,
    };
  });
}

function mean(rows, key) {
  if (!rows.length) return null;
  return Math.round(rows.reduce((s, r) => s + (r[key] || 0), 0) / rows.length);
}

async function main() {
  if (!token) throw new Error("APIFY_TOKEN 없음");
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  const { data: allocs, error } = await supabase
    .from("allocations")
    .select(
      "influencer_id, influencers(id, name, sns_url), creator_links(url, publish_url, content_status, status)",
    );
  if (error) throw new Error(error.message);

  const need = new Map();
  for (const a of allocs || []) {
    const inf = Array.isArray(a.influencers) ? a.influencers[0] : a.influencers;
    if (!inf?.id || need.has(inf.id)) continue;
    const sns = inf.sns_url || "";
    if (!/xiaohongshu|xhslink|rednote/i.test(sns)) continue;
    const links = Array.isArray(a.creator_links) ? a.creator_links : [];
    const hasPub = links.some((l) => isPub(l) && (l.url || l.publish_url));
    if (hasPub) continue;
    need.set(inf.id, inf);
  }

  // 한 인플이 여러 배정에 있으면 위 루프가 첫 행만 봄. 발행 있는 배정이 나중에 오면 빠질 수 있음.
  const published = new Set();
  for (const a of allocs || []) {
    const inf = Array.isArray(a.influencers) ? a.influencers[0] : a.influencers;
    if (!inf?.id) continue;
    const links = Array.isArray(a.creator_links) ? a.creator_links : [];
    if (links.some((l) => isPub(l) && (l.url || l.publish_url))) published.add(inf.id);
  }
  for (const id of published) need.delete(id);

  console.log({ need: need.size, dry: DRY });
  if (DRY) {
    for (const inf of need.values()) console.log(" ", inf.name, inf.sns_url);
    return;
  }

  const out = { ...prev };
  let ok = 0;
  let fail = 0;
  for (const inf of need.values()) {
    try {
      const profile = await expandXhsShortUrl(inf.sns_url);
      const posts = await scrapeXhs(profile);
      if (!posts.length) {
        fail++;
        console.warn("no posts", inf.name);
        continue;
      }
      out[inf.id] = {
        views: mean(posts, "views"),
        likes: mean(posts, "likes"),
        comments: mean(posts, "comments"),
        saves: mean(posts, "saves"),
        count: posts.length,
        viewsEstimated: posts.some((p) => p.viewsEstimated),
        posts: posts.filter((p) => p.url).map((p) => ({ platform: "xiaohongshu", url: p.url })),
      };
      ok++;
      console.log(`ok ${inf.name} v=${out[inf.id].views} l=${out[inf.id].likes} n=${posts.length}`);
    } catch (err) {
      fail++;
      console.warn("fail", inf.name, err instanceof Error ? err.message.slice(0, 160) : err);
    }
  }
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log({ ok, fail, wrote: OUT });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
