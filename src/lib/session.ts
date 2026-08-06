import { cookies } from "next/headers";

export const INF_COOKIE = "bp_influencer_id";
export const ADMIN_COOKIE = "bp_admin";
export const STORE_COOKIE = "bp_store_id";

export async function getInfluencerSessionId() {
  const jar = await cookies();
  return jar.get(INF_COOKIE)?.value ?? null;
}

export async function setInfluencerSessionId(id: string) {
  const jar = await cookies();
  jar.set(INF_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearInfluencerSession() {
  const jar = await cookies();
  jar.delete(INF_COOKIE);
}

export async function isAdminSession() {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === "1";
}

export async function setAdminSession() {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export async function getStoreSessionId() {
  const jar = await cookies();
  return jar.get(STORE_COOKIE)?.value ?? null;
}

export async function setStoreSessionId(storeId: string) {
  const jar = await cookies();
  jar.set(STORE_COOKIE, storeId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearStoreSession() {
  const jar = await cookies();
  jar.delete(STORE_COOKIE);
}

/** Plain username/password — no email. Case-insensitive. */
export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD = "admin";

export function isValidAdminCredentials(username: string, password: string) {
  return (
    username.trim().toLowerCase() === ADMIN_USERNAME &&
    password === ADMIN_PASSWORD
  );
}

/** Alpha default when PHAR_DEFAULT_PASSWORD / PHAR_STORE_PASSWORDS unset. */
export const PHAR_DEFAULT_PASSWORD = "phar";

function parseStorePasswordMap(): Record<string, string> {
  const raw = process.env.PHAR_STORE_PASSWORDS?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function expectedStorePassword(store: { id: string; name: string }) {
  const map = parseStorePasswordMap();
  return (
    map[store.id] ||
    map[store.name] ||
    process.env.PHAR_DEFAULT_PASSWORD?.trim() ||
    PHAR_DEFAULT_PASSWORD
  );
}

export function isValidStorePassword(
  store: { id: string; name: string },
  password: string,
) {
  return password === expectedStorePassword(store);
}
