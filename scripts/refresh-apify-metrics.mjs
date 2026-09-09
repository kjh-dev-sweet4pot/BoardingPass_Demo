/**
 * 발행 콘텐츠 지표를 Apify로 최신화. 같은 URL은 1회만 수집.
 *
 *   node scripts/refresh-apify-metrics.mjs
 *   node scripts/refresh-apify-metrics.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";

const DRY = process.argv.includes("--dry-run");
const APIFY_BASE = "https://api.apify.com/v2";
const TT_ACTOR = "GdWCkxBtKWOsKjdch";
const IG_ACTOR = "oi5NGnwthRXoqEux1";
const XHS_ACTOR = "atomus~xiaohongshu-scraper";

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
          line
            .slice(idx + 1)
            .trim()
            .replace(/^["']|["']$/g, "")
            .split(/[\s#—–]/)[0],
        ];
      }),
  );
}

function cleanJwt(value) {
  const v = (value || "").trim();
  const jwt = v.match(/^(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/);
  return jwt ? jwt[1] : v.split(/[\s#—–]/)[0] || "";
}

const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local"), ...process.env };
const token = env.APIFY_TOKEN?.trim();
const supabase = createClient(
  cleanJwt(env.NEXT_PUBLIC_SUPABASE_URL) || env.NEXT_PUBLIC_SUPABASE_URL,
  cleanJwt(env.SUPABASE_SERVICE_ROLE_KEY),
  { auth: { persistSession: false } },
);

function detectPlatform(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("instagram.com") || host === "instagr.am") return "instagram";
    if (host.includes("tiktok.com")) return "tiktok";
    if (
      host.includes("xiaohongshu.com") ||
      host.includes("xhslink.com") ||
      host.includes("xhslink.cn") ||
      host.includes("rednote.com")
    ) {
      return "xiaohongshu";
    }
  } catch {
    /* ignore */
  }
  return "etc";
}

function urlKey(url) {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    if (!/xhslink|vt\.tiktok/i.test(u.hostname)) u.search = "";
    return u.toString().replace(/\/+$/, "").toLowerCase();
  } catch {
    return url.trim().split("#")[0].toLowerCase();
  }
}

function asCount(v) {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/,/g, "");
  const wan = s.match(/^([\d.]+)\s*[만万]$/);
  if (wan) return Math.round(Number(wan[1]) * 10_000);
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

async function apify(actorId, body, timeout = 180, memory = 512) {
  const res = await fetch(
    `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}&memoryMbytes=${memory}&timeout=${timeout}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify ${actorId} ${res.status}: ${text.slice(0, 240)}`);
  }
  const raw = await res.json();
  return Array.isArray(raw) ? raw : [];
}

function igCode(url) {
  const m = url.match(/\/(?:p|reel|reels)\/([^/?#]+)/i);
  return m?.[1]?.toLowerCase() || null;
}

async function scrapeTikTok(urls) {
  const items = await apify(TT_ACTOR, { postURLs: urls, shouldDownloadCovers: true }, 120, 512);
  const out = new Map();
  for (const url of urls) {
    const hit = items.find(
      (it) =>
        (it.id && url.includes(it.id)) ||
        (it.webVideoUrl && urlKey(it.webVideoUrl) === urlKey(url)),
    ) || (urls.length === 1 ? items[0] : null);
    if (!hit) continue;
    out.set(urlKey(url), {
      views: asCount(hit.playCount) ?? 0,
      likes: asCount(hit.diggCount) ?? 0,
      comments: asCount(hit.commentCount) ?? 0,
      saves: asCount(hit.collectCount),
      shares: asCount(hit.shareCount),
      reposts: null,
    });
  }
  return out;
}

async function scrapeInstagram(urls) {
  const items = await apify(IG_ACTOR, { postUrls: urls }, 180, 1024);
  const byCode = new Map();
  for (const item of items) {
    const code = (item.code || item.shortcode || "").toLowerCase();
    if (!code) continue;
    const m = item.metrics || {};
    byCode.set(code, {
      views: asCount(m.ig_play_count) ?? asCount(m.play_count) ?? asCount(m.view_count) ?? 0,
      likes: asCount(m.like_count) ?? 0,
      comments: asCount(m.comment_count) ?? 0,
      saves: asCount(m.save_count),
      shares: asCount(m.share_count),
      reposts: asCount(m.repost_count),
    });
  }
  const out = new Map();
  for (const url of urls) {
    const code = igCode(url);
    const hit = (code && byCode.get(code)) || (urls.length === 1 && byCode.size === 1
      ? [...byCode.values()][0]
      : null);
    if (hit) out.set(urlKey(url), hit);
  }
  return out;
}

async function scrapeXhs(urls) {
  const items = await apify(
    XHS_ACTOR,
    { searchType: "note-detail", noteUrls: urls, includeComments: false },
    180,
    512,
  );
  const out = new Map();
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const noteId = (url.match(/[0-9a-f]{24}/i) || [])[0]?.toLowerCase();
    const hit =
      items.find((it) => {
        const id = String(it.id || it.noteId || "").toLowerCase();
        return (noteId && id === noteId) || (it.url && urlKey(it.url) === urlKey(url));
      }) || (urls.length === 1 ? items[0] : items[i]);
    if (!hit || !(hit.id || hit.noteId || hit.url)) continue;
    const likes = asCount(hit.liked_count) ?? asCount(hit.likedCount) ?? 0;
    const comments = asCount(hit.comments_count) ?? asCount(hit.commentsCount) ?? 0;
    const saves = asCount(hit.collected_count) ?? asCount(hit.collectedCount);
    const shares = asCount(hit.shared_count) ?? asCount(hit.sharedCount) ?? asCount(hit.share_count);
    const measured =
      asCount(hit.view_count) ?? asCount(hit.viewCount) ?? asCount(hit.read_count);
    const interact = likes + comments;
    const estimated =
      interact > 0 ? Math.round(interact / 0.05) : saves > 0 ? Math.round(saves / 0.05) : 0;
    out.set(urlKey(url), {
      views: measured > 0 ? measured : Math.max(estimated, interact + (saves || 0) + (shares || 0)),
      likes,
      comments,
      saves,
      shares,
      reposts: null,
    });
  }
  return out;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function applyMetrics(linkIds, metrics) {
  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("creator_links")
    .update({
      views: metrics.views,
      likes: metrics.likes,
      comments: metrics.comments,
      saves: metrics.saves,
      shares: metrics.shares,
      reposts: metrics.reposts,
      metrics_collected_at: now,
      updated_at: now,
    })
    .in("id", linkIds);
  if (upErr) throw new Error(upErr.message);
  for (const id of linkIds) {
    const { error } = await supabase.from("content_metrics").insert({
      creator_link_id: id,
      collected_at: now,
      views: metrics.views ?? 0,
      likes: metrics.likes ?? 0,
      comments: metrics.comments ?? 0,
      saves: metrics.saves,
      shares: metrics.shares,
      reposts: metrics.reposts,
    });
    if (error && !/duplicate|unique/i.test(error.message)) {
      console.warn("metrics insert", id, error.message);
    }
  }
}

async function main() {
  if (!token) throw new Error("APIFY_TOKEN 없음");
  const loginArg = process.argv.find((a) => a.startsWith("--login="));
  const loginId = loginArg ? loginArg.slice("--login=".length).trim() : "";
  let query = supabase.from("creator_links").select("id, url, publish_url, platform");
  if (loginId) {
    const { data: co, error: coErr } = await supabase
      .from("companies")
      .select("id")
      .eq("login_id", loginId)
      .maybeSingle();
    if (coErr) throw new Error(coErr.message);
    if (!co?.id) throw new Error(`회원사 없음: ${loginId}`);
    const { data: allocs, error: allocErr } = await supabase
      .from("allocations")
      .select("id")
      .eq("company_id", co.id);
    if (allocErr) throw new Error(allocErr.message);
    const allocIds = (allocs || []).map((a) => a.id);
    if (allocIds.length === 0) {
      console.log({ login: loginId, links: 0 });
      return;
    }
    query = supabase
      .from("creator_links")
      .select("id, url, publish_url, platform")
      .in("allocation_id", allocIds);
  }
  const { data: links, error } = await query;
  if (error) throw new Error(error.message);

  const groups = new Map();
  for (const link of links || []) {
    const url = (link.publish_url || link.url || "").trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const platform = detectPlatform(url);
    if (platform === "etc") continue;
    const key = `${platform}\t${urlKey(url)}`;
    const g = groups.get(key) || { platform, url, ids: [] };
    g.ids.push(link.id);
    groups.set(key, g);
  }

  const byPlat = { tiktok: [], instagram: [], xiaohongshu: [] };
  for (const g of groups.values()) byPlat[g.platform].push(g);

  console.log({
    login: loginId || "all",
    links: (links || []).length,
    unique: groups.size,
    tiktok: byPlat.tiktok.length,
    instagram: byPlat.instagram.length,
    xiaohongshu: byPlat.xiaohongshu.length,
    dry: DRY,
  });
  if (DRY) return;

  const sizes = { tiktok: 8, instagram: 4, xiaohongshu: 3 };
  let ok = 0;
  let fail = 0;
  const errors = [];

  for (const platform of ["tiktok", "instagram", "xiaohongshu"]) {
    const items = byPlat[platform];
    const size = sizes[platform];
    for (const batch of chunk(items, size)) {
      const urls = batch.map((b) => b.url);
      try {
        const scraped =
          platform === "tiktok"
            ? await scrapeTikTok(urls)
            : platform === "instagram"
              ? await scrapeInstagram(urls)
              : await scrapeXhs(urls);
        for (const g of batch) {
          const m = scraped.get(urlKey(g.url));
          if (!m) {
            fail++;
            errors.push(`${platform} no-result ${g.url.slice(0, 80)}`);
            continue;
          }
          await applyMetrics(g.ids, m);
          ok++;
          console.log(`ok ${platform} x${g.ids.length} v=${m.views} l=${m.likes} ${g.url.slice(0, 70)}`);
        }
      } catch (err) {
        fail += batch.length;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${platform} batch: ${msg.slice(0, 200)}`);
        console.warn("batch fail", platform, msg.slice(0, 200));
      }
    }
  }

  console.log({ ok, fail, errorCount: errors.length });
  for (const e of errors.slice(0, 20)) console.log("  ", e);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
