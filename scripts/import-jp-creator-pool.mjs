#!/usr/bin/env node
/**
 * Usage:
 *   node scripts/import-jp-creator-pool.mjs "/path/to/BS - JP - 23yearsold.xlsx"
 * Writes src/lib/data/jp-creator-pool.json (no address/phone).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const src = process.argv[2];
if (!src) {
  console.error("Usage: node scripts/import-jp-creator-pool.mjs <xlsx>");
  process.exit(1);
}

const wb = XLSX.readFile(src);
const LIST_SHEETS = [
  { name: "6월 미들급 인원 리스트", tier: "middle" },
  { name: "6월 1차 마이크로 리스트", tier: "micro" },
  { name: "6월 2차 마이크로 리스트", tier: "micro" },
  { name: "4월,5월 미들급 인원 리스트", tier: "middle" },
  { name: "4월, 5월 1차 마이크로 시딩 리스트", tier: "micro" },
  { name: "4월, 5월 2차 마이크로 시딩 리스트", tier: "micro" },
];

function clean(v) {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s || s === "なし" || s === "없음" || s === "-" || s === "N/A") return "";
  return s;
}
function num(v) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
function excelDayToYmd(v) {
  if (v === "" || v == null) return null;
  if (typeof v === "number") {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + v * 86400000).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}
function handleFromUrl(url, kind) {
  const u = clean(url);
  if (!u) return "";
  const m =
    kind === "instagram"
      ? u.match(/instagram\.com\/([^\/\?#]+)/i)
      : kind === "tiktok"
        ? u.match(/tiktok\.com\/@([^\/\?#]+)/i)
        : u.match(/(?:x|twitter)\.com\/([^\/\?#]+)/i);
  if (!m) return "";
  const h = decodeURIComponent(m[1]).replace(/^@/, "");
  if (["reels", "reel", "p", "stories", "status", "video"].includes(h.toLowerCase()))
    return "";
  return h;
}
function pickProfile(row) {
  const ig = clean(row.Instagram_URL);
  const tt = clean(row.Tiktok_URL);
  const x = clean(row.X_URL);
  if (ig)
    return {
      channel: "instagram",
      url: ig.split("?")[0].replace(/\/reels\/?$/, "/"),
      handle: handleFromUrl(ig, "instagram"),
      followers: num(row.Instagram_Follower),
    };
  if (tt)
    return {
      channel: "tiktok",
      url: tt.split("?")[0],
      handle: handleFromUrl(tt, "tiktok"),
      followers: num(row.Tiktok_Follower),
    };
  if (x)
    return {
      channel: "x",
      url: x.split("?")[0],
      handle: handleFromUrl(x, "x"),
      followers: num(row.X_Follower),
    };
  return { channel: "instagram", url: "", handle: "", followers: null };
}
function collectPosts(row) {
  const posts = [];
  const add = (platform, url) => {
    const u = clean(url);
    if (!u || !/^https?:\/\//i.test(u)) return;
    posts.push({ platform, url: u });
  };
  add("instagram", row["Posting URL (IG)"]);
  add("tiktok", row["Posting URL (TT)"]);
  add("x", row["Posting URL (X)"]);
  const other = clean(row["others(LIPS)"]);
  if (other)
    add(/youtube/i.test(other) ? "youtube" : "lips", other);
  const seen = new Set();
  return posts.filter((p) => (seen.has(p.url) ? false : (seen.add(p.url), true)));
}
function priceFromFollowers(f) {
  const base =
    f == null
      ? 180000
      : f >= 100000
        ? 550000
        : f >= 40000
          ? 380000
          : f >= 15000
            ? 280000
            : f >= 5000
              ? 180000
              : 120000;
  return Math.round(base / 10000) * 10000;
}

const byKey = new Map();
for (const sheet of LIST_SHEETS) {
  if (!wb.Sheets[sheet.name]) continue;
  for (const row of XLSX.utils.sheet_to_json(wb.Sheets[sheet.name], { defval: "" })) {
    const name = clean(row.name);
    if (!name) continue;
    const profile = pickProfile(row);
    const posts = collectPosts(row);
    const product = clean(row.Product || row.product);
    const uploadYmd = excelDayToYmd(
      row["upload day\n(within the last month)"] ?? row.upload_day,
    );
    const metrics = {
      views: num(row.Views),
      likes: num(row["Likes♥"] ?? row.Likes),
      comments: num(row.Comments),
      saves: num(row.Saves),
      shares: num(row.share),
    };
    const key = (profile.handle || name).toLowerCase();
    const entry = {
      name,
      handle: profile.handle
        ? `@${profile.handle}`
        : `@${name.replace(/\s+/g, "").slice(0, 16)}`,
      channel: profile.channel,
      profileUrl: profile.url || null,
      followers: profile.followers,
      tier: sheet.tier,
      product: product || null,
      posts,
      uploadYmd,
      metrics,
      category: clean(row.Category) || null,
    };
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, entry);
      continue;
    }
    const mergedPosts = [...existing.posts];
    for (const p of posts)
      if (!mergedPosts.some((x) => x.url === p.url)) mergedPosts.push(p);
    byKey.set(key, {
      ...existing,
      followers:
        Math.max(existing.followers || 0, entry.followers || 0) ||
        entry.followers,
      profileUrl: existing.profileUrl || entry.profileUrl,
      channel: existing.profileUrl ? existing.channel : entry.channel,
      product: existing.product || entry.product,
      posts: mergedPosts,
      uploadYmd: existing.uploadYmd || entry.uploadYmd,
      metrics:
        (entry.metrics.views || 0) > (existing.metrics.views || 0)
          ? entry.metrics
          : existing.metrics,
      tier:
        existing.tier === "middle" || entry.tier === "middle"
          ? "middle"
          : "micro",
    });
  }
}

const creators = [...byKey.values()].map((c, i) => {
  const platforms = new Set(c.posts.map((p) => p.platform));
  return {
    id: `jp-${String(i + 1).padStart(3, "0")}`,
    name: c.name,
    handle: c.handle,
    market: "jp",
    channel: c.channel,
    profileUrl: c.profileUrl,
    followers: c.followers || 0,
    priceKrw: priceFromFollowers(c.followers || null),
    overlap: platforms.size >= 3 ? "channel" : i % 17 === 0 ? "distributor" : null,
    tier: c.tier,
    product: c.product,
    posts: c.posts,
    uploadYmd: c.uploadYmd,
    metrics: c.metrics,
    category: c.category,
  };
});
creators.sort((a, b) => {
  const ap = a.posts.length ? 1 : 0;
  const bp = b.posts.length ? 1 : 0;
  if (ap !== bp) return bp - ap;
  return (b.followers || 0) - (a.followers || 0);
});
creators.forEach((c, i) => {
  c.id = `jp-${String(i + 1).padStart(3, "0")}`;
});

const out = path.join(process.cwd(), "src/lib/data/jp-creator-pool.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(creators, null, 2));
console.log("wrote", out, "creators", creators.length);
