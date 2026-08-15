#!/usr/bin/env node
/**
 * Download REAL SNS images into public/creator-avatars/{id}.jpg
 * 1) profile via unavatar
 * 2) else first post (IG media endpoint / microlink OG image)
 *
 * Usage: node scripts/fetch-creator-avatars.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pool = require("../src/lib/data/jp-creator-pool.json");

const OUT = path.join(process.cwd(), "public/creator-avatars");
const MANIFEST = path.join(process.cwd(), "src/lib/data/jp-creator-avatar-manifest.json");
fs.mkdirSync(OUT, { recursive: true });

function bare(h) {
  return String(h || "")
    .replace(/^@+/, "")
    .trim();
}

function provider(ch) {
  if (ch === "tiktok") return "tiktok";
  if (ch === "x" || ch === "twitter") return "twitter";
  return "instagram";
}

function handleOf(c) {
  const fromUrl = (url, ch) => {
    const u = String(url || "");
    const m =
      ch === "tiktok"
        ? u.match(/tiktok\.com\/@([^\/\?#]+)/i)
        : ch === "x"
          ? u.match(/(?:x|twitter)\.com\/([^\/\?#]+)/i)
          : u.match(/instagram\.com\/([^\/\?#]+)/i);
    if (!m) return "";
    const h = decodeURIComponent(m[1]).replace(/^@/, "");
    if (["reels", "reel", "p", "stories", "status", "video"].includes(h.toLowerCase()))
      return "";
    return /^[\w.]+$/.test(h) ? h : "";
  };
  return (
    fromUrl(c.profileUrl, c.channel) ||
    (/^[\w.]+$/.test(bare(c.handle)) ? bare(c.handle) : "") ||
    ""
  );
}

function igMediaUrl(postUrl) {
  const m = String(postUrl).match(
    /instagram\.com\/(?:reel|reels|p)\/([^\/\?#]+)/i,
  );
  return m ? `https://www.instagram.com/p/${m[1]}/media/?size=l` : null;
}

async function download(url, dest, { referer } = {}) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      ...(referer ? { referer } : {}),
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });
  if (!res.ok) return false;
  const ctype = res.headers.get("content-type") || "";
  if (!ctype.includes("image") && !ctype.includes("octet-stream")) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1500) return false;
  fs.writeFileSync(dest, buf);
  return true;
}

async function microlinkImage(postUrl) {
  const api = `https://api.microlink.io?url=${encodeURIComponent(postUrl)}`;
  const res = await fetch(api, {
    headers: { "user-agent": "BoardingPassAvatarFetcher/1.0" },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data?.image?.url || null;
}

async function fetchOne(c) {
  const dest = path.join(OUT, `${c.id}.jpg`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1500) {
    return { id: c.id, source: "cached" };
  }

  const h = handleOf(c);
  if (h) {
    const ok = await download(
      `https://unavatar.io/${provider(c.channel)}/${encodeURIComponent(h)}?fallback=false`,
      dest,
    );
    if (ok) return { id: c.id, source: "profile" };
  }

  for (const post of c.posts || []) {
    const ig = igMediaUrl(post.url);
    if (ig) {
      const ok = await download(ig, dest, {
        referer: "https://www.instagram.com/",
      });
      if (ok) return { id: c.id, source: "post-ig" };
    }
  }

  for (const post of (c.posts || []).slice(0, 2)) {
    try {
      const img = await microlinkImage(post.url);
      if (!img) continue;
      const ok = await download(img, dest);
      if (ok) return { id: c.id, source: "post-og" };
    } catch {
      /* continue */
    }
  }

  return { id: c.id, source: "miss" };
}

const concurrency = 4;
const queue = [...pool];
const results = [];
let done = 0;

async function worker() {
  while (queue.length) {
    const c = queue.shift();
    try {
      const r = await fetchOne(c);
      results.push(r);
    } catch (e) {
      results.push({ id: c.id, source: "miss", error: String(e) });
    }
    done += 1;
    if (done % 25 === 0 || done === pool.length) {
      const ok = results.filter((x) => x.source !== "miss").length;
      console.log(`${done}/${pool.length} saved=${ok}`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const manifest = {};
for (const r of results) {
  if (r.source !== "miss") manifest[r.id] = r.source;
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
console.log("done", {
  total: pool.length,
  saved: Object.keys(manifest).length,
  by: results.reduce((a, r) => ((a[r.source] = (a[r.source] || 0) + 1), a), {}),
});
