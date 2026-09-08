/**
 * 배정된 인플루언서 중 프로필 사진 없는 건 Apify로 수집 → Storage.
 *   node scripts/refresh-influencer-avatars.mjs
 *   node scripts/refresh-influencer-avatars.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import http from "node:http";
import https from "node:https";

const DRY = process.argv.includes("--dry-run");
const APIFY_BASE = "https://api.apify.com/v2";
const BUCKET = "influencer-avatars";

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

function platformOf(url, handle) {
  const u = (url || "").toLowerCase();
  if (/tiktok\.com/.test(u)) return "tiktok";
  if (/xiaohongshu|xhslink|rednote/.test(u)) return "xiaohongshu";
  if (/instagram\.com|instagr\.am/.test(u)) return "instagram";
  if (/^[0-9a-f]{24}$/i.test(handle || "")) return "xiaohongshu";
  if (url) return "other";
  return "instagram";
}

function ttHandle(url, handle) {
  const m = (url || "").match(/tiktok\.com\/@([^/?#]+)/i);
  if (m) return decodeURIComponent(m[1]);
  const h = (handle || "").replace(/^@/, "");
  return /^[a-zA-Z0-9._]{2,24}$/.test(h) ? h : null;
}

function igHandle(url, handle) {
  try {
    const seg = new URL(url).pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    if (seg && !/^(p|reel|reels|stories)$/i.test(seg)) return seg;
  } catch {
    /* ignore */
  }
  const h = (handle || "").replace(/^@/, "");
  return /^[a-zA-Z0-9._]{2,30}$/.test(h) ? h : null;
}

async function apify(actor, body, timeout = 180, memory = 512) {
  const res = await fetch(
    `${APIFY_BASE}/acts/${actor}/run-sync-get-dataset-items?token=${token}&memoryMbytes=${memory}&timeout=${timeout}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  if (!res.ok) throw new Error(`Apify ${res.status} ${actor}: ${(await res.text()).slice(0, 180)}`);
  const raw = await res.json();
  return Array.isArray(raw) ? raw : [];
}

async function scrape(platform, url, handle) {
  if (platform === "tiktok") {
    const username = ttHandle(url, handle);
    if (!username) return null;
    const items = await apify("toolzerhub~tiktok-profile-scraper", {
      username: [username],
      addonUserDetails: true,
    });
    const it = items[0];
    if (!it || it.error) return null;
    const imageUrl =
      it.avatarLarger || it.user?.avatarLarger || it.avatar_url || it.avatarMedium || null;
    const fans = it.stats?.follower_count ?? it.stats?.followerCount;
    return { imageUrl, followers: typeof fans === "number" ? fans : null };
  }
  if (platform === "xiaohongshu") {
    const target = url || (handle && /^[0-9a-f]{24}$/i.test(handle)
      ? `https://www.xiaohongshu.com/user/profile/${handle}`
      : null);
    if (!target) return null;
    const isNote = /discovery\/item|\/explore\/|xhslink\.(com|cn)\/o\//i.test(target);
    if (isNote) {
      const items = await apify("atomus~xiaohongshu-scraper", {
        searchType: "note-detail",
        noteUrls: [target],
        includeComments: false,
      });
      const it = items[0];
      const imageUrl = it?.user?.avatar || it?.author?.avatar || it?.cover || null;
      return { imageUrl, followers: null };
    }
    const items = await apify("atomus~xiaohongshu-scraper", {
      searchType: "profile",
      userUrls: [target],
      includePosts: false,
    });
    const it = items[0];
    if (!it) return null;
    return {
      imageUrl: it.avatar || it.user?.avatar || null,
      followers: typeof it.fans === "number" ? it.fans : it.fans_count ?? null,
    };
  }
  const username = igHandle(url, handle);
  if (!username) return null;
  const items = await apify(
    "data-slayer~instagram-user-info-scraper-cookieless",
    { usernames: [username] },
    180,
    1024,
  );
  const it = items[0];
  if (!it || it.error) return null;
  const versions = [...(it.hd_profile_pic_versions || [])].sort((a, b) => (b.width || 0) - (a.width || 0));
  const imageUrl =
    it.hd_profile_pic_url_info?.url || versions[0]?.url || it.profile_pic_url_hd || it.profile_pic_url || null;
  return { imageUrl, followers: typeof it.follower_count === "number" ? it.follower_count : null };
}

function refererFor(imageUrl) {
  try {
    const host = new URL(imageUrl).hostname.toLowerCase();
    if (host.includes("tiktok") || host.includes("muscdn")) return "https://www.tiktok.com/";
    if (host.includes("instagram") || host.includes("fbcdn") || host.includes("cdninstagram")) {
      return "https://www.instagram.com/";
    }
    if (host.includes("xhscdn") || host.includes("xiaohongshu")) return "https://www.xiaohongshu.com/";
  } catch {
    /* ignore */
  }
  return null;
}

function downloadImage(imageUrl) {
  return new Promise((resolve, reject) => {
    const u = new URL(imageUrl);
    const lib = u.protocol === "http:" ? http : https;
    const req = lib.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "GET",
        family: 4,
        timeout: 20000,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          ...(refererFor(imageUrl) ? { referer: refererFor(imageUrl) } : {}),
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          downloadImage(new URL(res.headers.location, imageUrl).toString()).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`image ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const bytes = Buffer.concat(chunks);
          if (bytes.length < 200) reject(new Error("image too small"));
          else resolve({ bytes, contentType: res.headers["content-type"] || "image/jpeg" });
        });
      },
    );
    req.on("timeout", () => { req.destroy(); reject(new Error("image timeout")); });
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  if (!token) throw new Error("APIFY_TOKEN 없음");
  const { data: allocs, error } = await supabase
    .from("allocations")
    .select("influencer_id, influencers(id, name, instagram_handle, sns_url, profile_image_path)");
  if (error) throw new Error(error.message);

  const seen = new Set();
  const missing = [];
  for (const a of allocs || []) {
    const inf = Array.isArray(a.influencers) ? a.influencers[0] : a.influencers;
    if (!inf?.id || seen.has(inf.id) || inf.profile_image_path) continue;
    seen.add(inf.id);
    missing.push(inf);
  }

  const counts = { tiktok: 0, instagram: 0, xiaohongshu: 0, skip: 0 };
  for (const inf of missing) {
    const p = platformOf(inf.sns_url, inf.instagram_handle);
    if (counts[p] != null) counts[p]++;
    else counts.skip++;
  }
  console.log({ allocatedMissing: missing.length, ...counts, dry: DRY });
  if (DRY) return;

  let ok = 0;
  let fail = 0;
  for (const inf of missing) {
    const platform = platformOf(inf.sns_url, inf.instagram_handle);
    if (platform === "other") {
      fail++;
      continue;
    }
    try {
      const scraped = await scrape(platform, inf.sns_url, inf.instagram_handle);
      if (!scraped?.imageUrl) {
        fail++;
        console.warn("no-image", inf.name, platform);
        continue;
      }
      const { bytes, contentType } = await downloadImage(scraped.imageUrl);
      const path = `${inf.id}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: contentType.startsWith("image/") ? contentType : "image/jpeg", upsert: true });
      if (upErr) throw new Error(upErr.message);
      const patch = {
        profile_image_path: path,
        updated_at: new Date().toISOString(),
      };
      if (typeof scraped.followers === "number") patch.followers = scraped.followers;
      const { error: dbErr } = await supabase.from("influencers").update(patch).eq("id", inf.id);
      if (dbErr) throw new Error(dbErr.message);
      ok++;
      console.log("ok", platform, inf.name, scraped.followers ?? "");
    } catch (err) {
      fail++;
      console.warn("fail", inf.name, err instanceof Error ? err.message.slice(0, 160) : err);
    }
  }
  console.log({ ok, fail });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
