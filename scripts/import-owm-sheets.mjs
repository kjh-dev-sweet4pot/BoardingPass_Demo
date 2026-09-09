/**
 * OWM 엑셀 → 회원사·매장·상품·인플루언서·배정·콘텐츠
 *
 *   node scripts/import-owm-sheets.mjs
 *   node scripts/import-owm-sheets.mjs --dry-run
 *
 * 기본 비밀번호(신규 회원사): brandslam2026
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, scryptSync } from "crypto";
import { createRequire } from "module";
import { existsSync, readFileSync } from "fs";
import { createHash } from "crypto";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const DRY = process.argv.includes("--dry-run");
const DEFAULT_PASSWORD = "brandslam2026";

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

const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local"), ...process.env };
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function clean(v) {
  if (v == null) return "";
  const s = String(v).replace(/\u00a0/g, " ").trim();
  if (!s || ["-", "—", "–", "N/A", "n/a", "없음", "なし"].includes(s)) return "";
  return s;
}

function isBlankDash(s) {
  return !s || ["-", "—", "–", "N/A", "n/a", "없음"].includes(s);
}

function num(v) {
  const s = clean(v).replace(/,/g, "");
  if (isBlankDash(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toYmd(year, month, day) {
  if (year < 2000) year += 2000;
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function visitDate(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const utc = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return toYmd(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
  }
  const s = clean(v);
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000 && serial < 80000) {
      const utc = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return toYmd(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
    }
  }
  const dateOnly = s.split(/[T\s]/)[0];
  let m = dateOnly.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (m) return toYmd(+m[1], +m[2], +m[3]);
  m = dateOnly.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) return toYmd(+m[3], +m[1], +m[2]);
  m = dateOnly.match(/^(\d{1,2})[./-](\d{1,2})$/);
  if (m) return toYmd(2026, +m[1], +m[2]);
  return null;
}

function extractUrls(text) {
  const s = String(text || "");
  return [...s.matchAll(/https?:\/\/[^\s,;|"']+/gi)].map((m) =>
    m[0].replace(/[)\].,]+$/, ""),
  );
}

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
    return "etc";
  } catch {
    return "etc";
  }
}

function handleFromUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("instagram.com")) {
      const m = u.pathname.match(/^\/([^/]+)/);
      const h = m?.[1] || "";
      if (["p", "reel", "reels", "stories"].includes(h.toLowerCase())) return "";
      return decodeURIComponent(h).replace(/^@/, "");
    }
    if (host.includes("tiktok.com")) {
      const m = u.pathname.match(/^\/@([^/]+)/);
      return m ? decodeURIComponent(m[1]) : "";
    }
    if (host.includes("xiaohongshu") || host.includes("rednote")) {
      const m = u.pathname.match(/\/user\/profile\/([^/?#]+)/);
      return m ? m[1] : "";
    }
  } catch {
    /* ignore */
  }
  return "";
}

function slugHandle(name, extra = "") {
  const base = `${name}-${extra}`
    .toLowerCase()
    .replace(/[^a-z0-9가-힣._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const hash = createHash("sha1").update(`${name}|${extra}`).digest("hex").slice(0, 8);
  return (base || "creator") + "-" + hash;
}

function normalizeCompanyKey(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/주식회사/g, "")
    .replace(/\(주\)/g, "")
    .replace(/\s+/g, "");
}

function normalizeLoginId(raw) {
  return raw.trim().toLowerCase();
}

const COMPANY_CANON = [
  {
    name: "brandslam",
    login_id: "brandslam",
    aliases: ["브랜드슬램", "brandslam", "BrandSlam", "BRANDSLAM"],
  },
  {
    name: "닥터리앤장",
    login_id: "drlienjang",
    aliases: ["닥터리엔장", "닥터리앤장", "리엔장", "달터리앤장", "닥터리엔장"],
  },
  { name: "옵티팜", login_id: "optipharm", aliases: ["옵티팜"] },
  { name: "rxme", login_id: "rxme", aliases: ["rxme", "RXME"] },
  { name: "텔로엑트", login_id: "telloact", aliases: ["텔로엑트", "텔로액트"] },
  { name: "이뮨", login_id: "immune", aliases: ["이뮨"] },
];

function splitCompanies(raw) {
  return raw
    .split(/[,，、/|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 시트명 `남포오픈(텔로엑트)` · `명동오픈_리엔장,텔로엑트` */
function brandsFromSheetName(sheet) {
  const under = sheet.includes("_") ? sheet.slice(sheet.indexOf("_") + 1) : "";
  const fromUnder = splitCompanies(under).filter((s) => !/^\d+$/.test(s));
  if (fromUnder.length) {
    return fromUnder.map((b) => canonCompany(b)?.name || b);
  }
  const paren = sheet.match(/\(([^)]+)\)/);
  if (paren && !/^\d+$/.test(paren[1].replace(/\s/g, ""))) {
    return splitCompanies(paren[1]).map((b) => canonCompany(b)?.name || b);
  }
  return [];
}

function targetCompanies(v) {
  const names = (v.companyNames || []).map((c) => canonCompany(c)?.name || c);
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length > 0) return unique;
  return [canonCompany(v.allocCompany)?.name || v.allocCompany || "brandslam"];
}

function canonCompany(raw) {
  const key = normalizeCompanyKey(raw);
  if (!key) return null;
  for (const c of COMPANY_CANON) {
    if (normalizeCompanyKey(c.name) === key) return c;
    if (c.aliases.some((a) => normalizeCompanyKey(a) === key)) return c;
  }
  return { name: raw.trim(), login_id: null, aliases: [] };
}

function storeName(raw) {
  const s = clean(raw);
  const t = s.toLowerCase();
  if (/bukchon|북촌/.test(t)) return "OWM 북촌점";
  if (/gangnam|강남/.test(t)) return "OWM 강남점";
  if (/seongsu|성수/.test(t)) return "OWM 성수점";
  if (/jonggak|종각/.test(t)) return "OWM 종각점";
  if (/itaewon|이태원/.test(t)) return "OWM 이태원점";
  if (/sinsa|신사/.test(t)) return "OWM 신사점";
  if (/명동/.test(t)) return "OWM 명동점";
  if (/남포/.test(t)) return "OWM 남포점";
  return s || "OWM";
}

function isPostUrl(url) {
  const p = detectPlatform(url);
  if (p === "etc") return false;
  if (p === "instagram") return /\/(reel|reels|p)\//i.test(url);
  if (p === "tiktok") return /\/video\/|vt\.tiktok|\/t\//i.test(url);
  if (p === "xiaohongshu") {
    return /discovery\/item|\/explore\/|xhslink\.(com|cn)\/o\//i.test(url);
  }
  return false;
}

function isProfileUrl(url) {
  const p = detectPlatform(url);
  if (p === "etc") return false;
  return !isPostUrl(url);
}

/** @typedef {{
  source: string;
  companyNames: string[];
  allocCompany: string;
  name: string;
  snsUrl: string;
  handleHint: string;
  store: string;
  product: string;
  visitDate: string | null;
  posts: { url: string; views: number|null; likes: number|null; comments: number|null; saves: number|null }[];
  followers: number|null;
}} ImportVisit */

/** @type {ImportVisit[]} */
const visits = [];

function pushVisit(v) {
  if (!v.name && !v.snsUrl && v.posts.length === 0) return;
  visits.push(v);
}

function addPostsFromCells(posts, urlCell, metrics) {
  const urls = extractUrls(urlCell).filter(isPostUrl);
  for (const url of urls) {
    posts.push({ url, ...metrics });
  }
}

function parseJonghap(wb) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets["종합"], { header: 1, defval: "", raw: true });
  let store = "";
  for (const row of rows) {
    const r = row.map((c) => (typeof c === "string" ? c.trim() : c));
    const first = clean(r[0]);
    if (first && !r.slice(1).some((c) => clean(c)) && first.length < 12 && !/\d/.test(first)) {
      store = first;
      continue;
    }
    if (clean(r[0]) === "대행사" && clean(r[2]) === "이름") continue;
    const name = clean(r[2]);
    const channel = clean(r[3]);
    if (!name || !channel) continue;
    const url = extractUrls(r[10] || r[11] || "").find((u) => detectPlatform(u) !== "etc") || "";
    const posts = [];
    if (url && isPostUrl(url)) {
      posts.push({
        url,
        views: num(r[7]),
        likes: num(r[9]),
        comments: null,
        saves: num(r[8]),
      });
    }
    const agency = clean(r[0]);
    pushVisit({
      source: "종합",
      companyNames: agency ? [agency] : [],
      allocCompany: agency || "brandslam",
      name,
      snsUrl: url && isProfileUrl(url) ? url : "",
      handleHint: handleFromUrl(url) || "",
      store: storeName(store),
      product: "OWM 시딩",
      visitDate: visitDate(r[5]),
      posts,
      followers: num(r[4]),
    });
  }
}

function parseJuneEn(wb) {
  const name = "6월 영미권 OWM(강남, 북촌, 성수, 종각, 이태원)";
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true });
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const person = clean(r[3]);
    if (!person) continue;
    const posts = [];
    addPostsFromCells(posts, r[12], {
      views: num(r[13]),
      likes: num(r[14]),
      comments: num(r[15]),
      saves: num(r[16]),
    });
    addPostsFromCells(posts, r[19], {
      views: num(r[20]),
      likes: num(r[21]),
      comments: num(r[22]),
      saves: null,
    });
    const sns = extractUrls(r[5] || r[7] || "").find(isProfileUrl) || "";
    pushVisit({
      source: name,
      companyNames: [],
      allocCompany: "brandslam",
      name: person,
      snsUrl: sns,
      handleHint: handleFromUrl(sns) || handleFromUrl(posts[0]?.url || ""),
      store: storeName(r[0]),
      product: "OWM 시딩",
      visitDate: visitDate(r[1]),
      posts,
      followers: num(r[6]) || num(r[8]),
    });
  }
}

function parseJuneCn(wb) {
  const name = "6월 중화권 OWM(강남, 북촌, 성수, 종각, 이태원)";
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true });
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const person = clean(r[3]);
    if (!person) continue;
    const posts = [];
    addPostsFromCells(posts, r[9], {
      views: null,
      likes: num(r[10]),
      comments: num(r[11]),
      saves: null,
    });
    const sns = extractUrls(r[5] || "").find(Boolean) || "";
    pushVisit({
      source: name,
      companyNames: [],
      allocCompany: "brandslam",
      name: person,
      snsUrl: sns,
      handleHint: handleFromUrl(sns),
      store: storeName(r[0]),
      product: "OWM 시딩",
      visitDate: visitDate(r[1]),
      posts,
      followers: null,
    });
  }
}

function parseSinsaMega(wb) {
  const name = "6월 신사점 메가";
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true });
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    const person = clean(r[0]);
    if (!person) continue;
    const posts = [];
    addPostsFromCells(posts, r[11], {
      views: num(r[12]),
      likes: num(r[13]),
      comments: num(r[14]),
      saves: num(r[15]),
    });
    addPostsFromCells(posts, r[16], {
      views: num(r[17]),
      likes: num(r[18]),
      comments: num(r[19]),
      saves: null,
    });
    const sns =
      extractUrls(r[2] || r[3] || r[6] || "").find(isProfileUrl) ||
      extractUrls(r[2] || r[3] || r[6] || "")[0] ||
      "";
    pushVisit({
      source: name,
      companyNames: [],
      allocCompany: "brandslam",
      name: person,
      snsUrl: sns,
      handleHint: handleFromUrl(sns) || person.replace(/\s+/g, ""),
      store: "OWM 신사점",
      product: "OWM 시딩",
      visitDate: visitDate(r[8]) || visitDate(r[10]),
      posts: dedupePosts(posts),
      followers: null,
    });
  }
}

function parseAprMay(wb, sheet, store) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "", raw: true });
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const person = clean(r[0]);
    if (!person) continue;
    const posts = [];
    addPostsFromCells(posts, r[6], {
      views: num(r[7]),
      likes: num(r[8]),
      comments: num(r[9]),
      saves: num(r[10]),
    });
    addPostsFromCells(posts, r[11], {
      views: num(r[12]),
      likes: num(r[13]),
      comments: num(r[14]),
      saves: num(r[15]),
    });
    const sns = extractUrls(r[2] || r[3] || "").find(isProfileUrl) || "";
    pushVisit({
      source: sheet,
      companyNames: [],
      allocCompany: "brandslam",
      name: person,
      snsUrl: sns,
      handleHint: handleFromUrl(sns) || handleFromUrl(posts[0]?.url || ""),
      store,
      product: "OWM 시딩",
      visitDate: visitDate(r[4]),
      posts,
      followers: null,
    });
  }
}

function parseMyeongdong(wb) {
  for (const sheet of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "", raw: true });
    if (!rows[0]) continue;
    const header = rows[0].map((h) => clean(h));
    const col = (aliases) => header.findIndex((h) => aliases.some((a) => h.toLowerCase() === a.toLowerCase()));
    const iName = col(["Name", "이름"]);
    const iSnsId = col(["SNS_ID"]);
    const iSns = col(["SNS_URL"]);
    const iStore = col(["방문지점"]);
    const iDate = col(["방문날짜"]);
    const iProduct = col(["상품"]);
    const iUpload = col(["Upload_URL"]);
    const iViews = col(["조회수"]);
    const iLikes = col(["좋아요수"]);
    const iSaves = col(["저장수"]);
    const iBrand = col(["브랜드사"]);
    if (iSns < 0 && iUpload < 0) continue;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const name = clean(iName >= 0 ? r[iName] : "") || clean(iSnsId >= 0 ? r[iSnsId] : "");
      if (!name) continue;
      const brandsRaw = iBrand >= 0 ? clean(r[iBrand]) : "";
      const brands = (
        brandsRaw ? splitCompanies(brandsRaw) : brandsFromSheetName(sheet)
      ).map((b) => canonCompany(b)?.name || b);
      const posts = [];
      addPostsFromCells(posts, iUpload >= 0 ? r[iUpload] : "", {
        views: iViews >= 0 ? num(r[iViews]) : null,
        likes: iLikes >= 0 ? num(r[iLikes]) : null,
        comments: null,
        saves: iSaves >= 0 ? num(r[iSaves]) : null,
      });
      const sns = extractUrls(iSns >= 0 ? r[iSns] : "").find(Boolean) || "";
      pushVisit({
        source: sheet,
        companyNames: brands,
        allocCompany: brands[0] || "brandslam",
        name,
        snsUrl: sns,
        handleHint: clean(iSnsId >= 0 ? r[iSnsId] : "") || handleFromUrl(sns),
        store: storeName(iStore >= 0 ? r[iStore] : "명동"),
        product: clean(iProduct >= 0 ? r[iProduct] : "") || "OWM 시딩",
        visitDate: visitDate(iDate >= 0 ? r[iDate] : null),
        posts,
        followers: null,
      });
    }
  }
}

function dedupePosts(posts) {
  const seen = new Set();
  const out = [];
  for (const p of posts) {
    const key = p.url.split("?")[0].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function visitKey(v) {
  return [
    v.name.trim().toLowerCase(),
    v.store,
    v.visitDate || "",
    v.allocCompany,
  ].join("|");
}

function mergeVisits(list) {
  const map = new Map();
  for (const v of list) {
    const k = visitKey(v);
    const prev = map.get(k);
    if (!prev) {
      map.set(k, { ...v, posts: dedupePosts(v.posts), companyNames: [...v.companyNames] });
      continue;
    }
    prev.posts = dedupePosts([...prev.posts, ...v.posts]);
    prev.snsUrl = prev.snsUrl || v.snsUrl;
    prev.handleHint = prev.handleHint || v.handleHint;
    prev.followers = prev.followers ?? v.followers;
    prev.visitDate = prev.visitDate || v.visitDate;
    for (const c of v.companyNames) {
      if (!prev.companyNames.includes(c)) prev.companyNames.push(c);
    }
  }
  return [...map.values()];
}

async function findOrCreateCompany(nameRaw, cache) {
  const canon = canonCompany(nameRaw) || { name: nameRaw, login_id: null, aliases: [] };
  const key = normalizeCompanyKey(canon.name);
  if (cache.has(key)) return cache.get(key);

  const { data: all } = await supabase.from("companies").select("id, name, login_id, aliases");
  const hit = (all || []).find((c) => {
    if (normalizeCompanyKey(c.name) === key) return true;
    return (c.aliases || []).some((a) => normalizeCompanyKey(a) === key);
  });
  if (hit) {
    const aliases = new Set([...(hit.aliases || []), ...canon.aliases]);
    if (aliases.size !== (hit.aliases || []).length) {
      await supabase.from("companies").update({ aliases: [...aliases] }).eq("id", hit.id);
    }
    cache.set(key, hit.id);
    return hit.id;
  }

  let login = canon.login_id || normalizeLoginId(canon.name.replace(/[^a-zA-Z0-9가-힣]/g, "")).slice(0, 24);
  if (!login) login = "co-" + createHash("sha1").update(canon.name).digest("hex").slice(0, 10);
  const used = new Set((all || []).map((c) => c.login_id));
  let login_id = login;
  let n = 2;
  while (used.has(login_id)) {
    login_id = `${login}${n++}`;
  }

  if (DRY) {
    const fake = "dry-" + key;
    cache.set(key, fake);
    return fake;
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({
      name: canon.name,
      login_id,
      password_hash: hashPassword(DEFAULT_PASSWORD),
      aliases: canon.aliases.filter((a) => normalizeCompanyKey(a) !== key),
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || `회원사 생성 실패: ${canon.name}`);
  console.log(`+ company ${canon.name} (${login_id})`);
  cache.set(key, data.id);
  return data.id;
}

async function findOrCreateByName(table, name, cache) {
  const key = name.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const { data: existing } = await supabase.from(table).select("id, name").ilike("name", name).limit(1).maybeSingle();
  if (existing?.id) {
    cache.set(key, existing.id);
    return existing.id;
  }
  if (DRY) {
    cache.set(key, "dry-" + key);
    return cache.get(key);
  }
  const { data, error } = await supabase.from(table).insert({ name }).select("id").single();
  if (error || !data) throw new Error(error?.message || `${table} 생성 실패: ${name}`);
  cache.set(key, data.id);
  return data.id;
}

function cleanHandleHint(raw) {
  const s = String(raw || "").replace(/^@/, "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || /xiaohongshu|xhslink|instagram\.com|tiktok\.com/i.test(s)) {
    return handleFromUrl(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  }
  return s;
}

async function findOrCreateInfluencer(v, cache) {
  const handle =
    cleanHandleHint(v.handleHint) ||
    handleFromUrl(v.snsUrl) ||
    slugHandle(v.name, v.store);
  const norm = handle.toLowerCase();
  if (cache.has(norm)) return cache.get(norm);

  const { data: existing } = await supabase
    .from("influencers")
    .select("id")
    .eq("instagram_handle_normalized", norm)
    .maybeSingle();
  if (existing?.id) {
    cache.set(norm, existing.id);
    if (v.snsUrl) {
      await supabase
        .from("influencers")
        .update({ sns_url: v.snsUrl, followers: v.followers ?? undefined, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
    return existing.id;
  }
  if (DRY) {
    cache.set(norm, "dry-" + norm);
    return cache.get(norm);
  }
  const { data, error } = await supabase
    .from("influencers")
    .insert({
      name: v.name,
      instagram_handle: handle,
      sns_url: v.snsUrl || null,
      followers: v.followers,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || `인플루언서 생성 실패: ${v.name}`);
  cache.set(norm, data.id);
  return data.id;
}

async function findOrCreateCampaign(companyId, productId, name, cache) {
  const key = `${companyId}|${productId}`;
  if (cache.has(key)) return cache.get(key);
  const { data: existing } = await supabase
    .from("campaigns")
    .select("id")
    .eq("company_id", companyId)
    .eq("product_id", productId)
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    cache.set(key, existing.id);
    return existing.id;
  }
  if (DRY) {
    cache.set(key, "dry-camp-" + key);
    return cache.get(key);
  }
  const { data, error } = await supabase
    .from("campaigns")
    .insert({ company_id: companyId, product_id: productId, name, status: "견적수립" })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "캠페인 생성 실패");
  cache.set(key, data.id);
  return data.id;
}

async function main() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  }

  const file1 = "/Users/eunbee/Downloads/브랜드슬램 x OWM (1).xlsx";
  const file2 = "/Users/eunbee/Downloads/OWM 명동 - 본시트 (1).xlsx";
  const wb1 = XLSX.readFile(file1);
  const wb2 = XLSX.readFile(file2);

  parseJonghap(wb1);
  parseJuneEn(wb1);
  parseJuneCn(wb1);
  parseSinsaMega(wb1);
  parseAprMay(wb1, "4,5월 성수지점", "OWM 성수점");
  parseAprMay(wb1, "4,5월 이태원지점", "OWM 이태원점");
  parseMyeongdong(wb2);

  const merged = mergeVisits(visits);
  const companySet = new Set(["brandslam"]);
  for (const v of merged) {
    for (const c of targetCompanies(v)) companySet.add(c);
  }

  console.log(`visits=${visits.length} merged=${merged.length} companies=${[...companySet].join(", ")}`);
  console.log(`posts=${merged.reduce((n, v) => n + v.posts.length, 0)}`);

  if (DRY) {
    console.log(JSON.stringify(merged.slice(0, 3), null, 2));
    return;
  }

  const companyCache = new Map();
  const storeCache = new Map();
  const productCache = new Map();
  const infCache = new Map();
  const campCache = new Map();

  for (const name of companySet) {
    await findOrCreateCompany(name, companyCache);
  }

  let createdAlloc = 0;
  let skippedAlloc = 0;
  let createdLinks = 0;

  for (const v of merged) {
    const storeId = await findOrCreateByName("stores", v.store, storeCache);
    const productId = await findOrCreateByName("products", v.product, productCache);
    const influencerId = await findOrCreateInfluencer(v, infCache);
    const visit = v.visitDate || "2026-01-01";
    const companies = targetCompanies(v);

    for (const companyName of companies) {
    const companyId = await findOrCreateCompany(companyName, companyCache);
    const { data: dup } = await supabase
      .from("allocations")
      .select("id")
      .eq("influencer_id", influencerId)
      .eq("product_id", productId)
      .eq("store_id", storeId)
      .eq("visit_date", visit)
      .eq("company_id", companyId)
      .maybeSingle();

    let allocationId = dup?.id || null;
    if (!allocationId) {
      const hasPosts = v.posts.length > 0;
      const { data: alloc, error } = await supabase
        .from("allocations")
        .insert({
          influencer_id: influencerId,
          product_id: productId,
          store_id: storeId,
          company_id: companyId,
          quantity: 1,
          visit_date: visit,
          status: hasPosts ? "picked_up" : "pending",
          picked_up_at: hasPosts ? new Date().toISOString() : null,
          target_content_count: Math.max(1, v.posts.length),
        })
        .select("id")
        .single();
      if (error || !alloc) throw new Error(error?.message || "배정 생성 실패");
      allocationId = alloc.id;
      createdAlloc++;
    } else {
      skippedAlloc++;
    }

    for (const post of v.posts) {
      const { data: existingLink } = await supabase
        .from("creator_links")
        .select("id")
        .eq("allocation_id", allocationId)
        .eq("url", post.url)
        .maybeSingle();
      if (existingLink?.id) continue;

      const now = new Date().toISOString();
      const platform = detectPlatform(post.url);
      const row = {
        allocation_id: allocationId,
        influencer_id: influencerId,
        url: post.url,
        publish_url: post.url,
        platform,
        status: "approved",
        content_status: "발행완료",
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        saves: post.saves,
        shares: null,
        reposts: null,
        metrics_collected_at: now,
        submitted_at: now,
        updated_at: now,
      };
      let { data: link, error } = await supabase
        .from("creator_links")
        .insert(row)
        .select("id")
        .single();
      if (error && /platform_check/i.test(error.message) && platform === "xiaohongshu") {
        const retry = await supabase
          .from("creator_links")
          .insert({ ...row, platform: "etc" })
          .select("id")
          .single();
        link = retry.data;
        error = retry.error;
      }
      if (error || !link) throw new Error(error?.message || "콘텐츠 생성 실패");
      createdLinks++;

      if (post.views != null || post.likes != null) {
        await supabase.from("content_metrics").insert({
          creator_link_id: link.id,
          collected_at: now,
          views: post.views ?? 0,
          likes: post.likes ?? 0,
          comments: post.comments ?? 0,
          saves: post.saves,
          shares: null,
          reposts: null,
        });
      }
    }
    }
  }

  console.log({ createdAlloc, skippedAlloc, createdLinks, password: DEFAULT_PASSWORD });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
