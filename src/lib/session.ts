import { cookies } from "next/headers";

export const INF_COOKIE = "bp_influencer_id";
export const ADMIN_COOKIE = "bp_admin";

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

/** Plain username/password — no email. Case-insensitive. */
export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD = "admin";

export function isValidAdminCredentials(username: string, password: string) {
  return (
    username.trim().toLowerCase() === ADMIN_USERNAME &&
    password === ADMIN_PASSWORD
  );
}
