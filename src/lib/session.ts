import { cookies } from "next/headers";
import {
  type AppAuthClaims,
  signSessionJwt,
} from "@/lib/supabase/jwt";

export const INF_COOKIE = "bp_influencer_id";
export const ADMIN_COOKIE = "bp_admin";
export const ADMIN_ROLE_COOKIE = "bp_admin_role";
export const STORE_COOKIE = "bp_store_id";
export const COMPANY_COOKIE = "bp_company_id";
export const AUTH_TOKEN_COOKIE = "bp_auth_token";

export type AdminRole = "admin_manager" | "admin_operator";

const SESSION_MAX_AGE = 60 * 60 * 12;
const ADMIN_MAX_AGE = 60 * 60 * 24;

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
    maxAge: SESSION_MAX_AGE,
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

export async function getAdminRole(): Promise<AdminRole | null> {
  if (!(await isAdminSession())) return null;
  const jar = await cookies();
  const role = jar.get(ADMIN_ROLE_COOKIE)?.value;
  if (role === "admin_operator") return "admin_operator";
  return "admin_manager";
}

export async function isAdminManagerSession() {
  return (await getAdminRole()) === "admin_manager";
}

export async function setAdminSession(role: AdminRole = "admin_manager") {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_MAX_AGE,
  });
  jar.set(ADMIN_ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_MAX_AGE,
  });
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  jar.delete(ADMIN_ROLE_COOKIE);
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
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearStoreSession() {
  const jar = await cookies();
  jar.delete(STORE_COOKIE);
}

export async function getCompanySessionId() {
  const jar = await cookies();
  return jar.get(COMPANY_COOKIE)?.value ?? null;
}

export async function setCompanySessionId(companyId: string) {
  const jar = await cookies();
  jar.set(COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearCompanySession() {
  const jar = await cookies();
  jar.delete(COMPANY_COOKIE);
}

export async function setAuthToken(token: string) {
  const jar = await cookies();
  jar.set(AUTH_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearAuthToken() {
  const jar = await cookies();
  jar.delete(AUTH_TOKEN_COOKIE);
}

export async function mintAndSetAuthToken(claims: AppAuthClaims) {
  const token = signSessionJwt(claims);
  if (token) await setAuthToken(token);
}

/** Plain username/password — no email. Case-insensitive username. */
export const ADMIN_USERNAME = "manager01";
export const ADMIN_PASSWORD = "slamglobal260801";
export const OPERATOR_USERNAME = "operator01";
export const OPERATOR_PASSWORD = "slamglobal260802";

export function isValidAdminManagerCredentials(
  username: string,
  password: string,
) {
  return (
    username.trim().toLowerCase() === ADMIN_USERNAME.toLowerCase() &&
    password === ADMIN_PASSWORD
  );
}

export function isValidAdminOperatorCredentials(
  username: string,
  password: string,
) {
  return (
    username.trim().toLowerCase() === OPERATOR_USERNAME.toLowerCase() &&
    password === OPERATOR_PASSWORD
  );
}

export function isValidAdminCredentials(username: string, password: string) {
  return (
    isValidAdminManagerCredentials(username, password) ||
    isValidAdminOperatorCredentials(username, password)
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
  긴자: "ginzaa",
  긴자점: "ginzaa",
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
