import { createHmac, randomUUID } from "crypto";

export type AppAuthRole =
  | "company"
  | "admin_manager"
  | "admin_operator"
  | "store"
  | "influencer";

export type AppAuthClaims = {
  role: AppAuthRole;
  company_id?: string;
  store_id?: string;
  influencer_id?: string;
};

function base64url(input: string | Buffer) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64url");
}

/** Supabase RLS용 HS256 JWT. SUPABASE_JWT_SECRET 없으면 null (레거시 쿠키만 동작). */
export function signSessionJwt(
  claims: AppAuthClaims,
  expiresInSec = 60 * 60 * 12,
) {
  const secret = process.env.SUPABASE_JWT_SECRET?.trim();
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const sub =
    claims.company_id ||
    claims.store_id ||
    claims.influencer_id ||
    claims.role ||
    randomUUID();

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    aud: "authenticated",
    exp: now + expiresInSec,
    iat: now,
    iss: "supabase",
    sub,
    role: "authenticated",
    app_metadata: {
      role: claims.role,
      company_id: claims.company_id ?? null,
      store_id: claims.store_id ?? null,
      influencer_id: claims.influencer_id ?? null,
    },
  };

  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret)
    .update(`${h}.${p}`)
    .digest("base64url");
  return `${h}.${p}.${sig}`;
}

// ponytail: self-check — secret 설정 시 JWT 3세그먼트 생성 확인
if (process.env.SUPABASE_JWT_SECRET?.trim()) {
  const token = signSessionJwt({
    role: "company",
    company_id: "00000000-0000-4000-8000-000000000001",
  });
  if (!token || token.split(".").length !== 3) {
    throw new Error("signSessionJwt self-check failed");
  }
}
