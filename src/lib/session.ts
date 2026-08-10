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

/** Plain username/password — no email. Case-insensitive username. */
export const ADMIN_USERNAME = "manager01";
export const ADMIN_PASSWORD = "slamglobal260801";

export function isValidAdminCredentials(username: string, password: string) {
  return (
    username.trim().toLowerCase() === ADMIN_USERNAME.toLowerCase() &&
    password === ADMIN_PASSWORD
  );
}

/** 지점명 → 비밀번호 (DB stores.name 기준, "점" 유무 모두 매칭) */
export const PHAR_STORE_PASSWORDS: Record<string, string> = {
  강남: "gnowm26",
  강남점: "gnowm26",
  남포: "pusanowm2608",
  남포점: "pusanowm2608",
  명동: "mdongowm26",
  명동점: "mdongowm26",
  신사: "ssaowm2626",
  신사점: "ssaowm2626",
  종각: "jgakowm26",
  종각점: "jgakowm26",
  성수: "ssuowm2626",
  성수점: "ssuowm2626",
  북촌: "bchonowm26",
  북촌점: "bchonowm26",
  이태원: "itaeowm26",
  이태원점: "itaeowm26",
  분당서현: "bdshowm2608",
  분당서현점: "bdshowm2608",
};

/** 맵에 없는 지점용 기본 비밀번호 */
export const PHAR_DEFAULT_PASSWORD = "phar";

export function expectedStorePassword(store: { id: string; name: string }) {
  const name = store.name.trim();
  if (PHAR_STORE_PASSWORDS[name]) return PHAR_STORE_PASSWORDS[name];

  // "OWM 강남점" 등 접두가 있어도 키 매칭
  const keys = Object.keys(PHAR_STORE_PASSWORDS).sort(
    (a, b) => b.length - a.length,
  );
  for (const key of keys) {
    if (name.includes(key)) return PHAR_STORE_PASSWORDS[key];
  }

  return PHAR_DEFAULT_PASSWORD;
}

export function isValidStorePassword(
  store: { id: string; name: string },
  password: string,
) {
  return password === expectedStorePassword(store);
}
