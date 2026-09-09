function cleanEnv(value?: string) {
  if (!value) return "";
  const trimmed = value
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\r?\n/g, "");
  // .env 줄 끝 ` — 주석` 이 키에 붙으면 fetch Authorization 헤더가 깨진다
  const jwt = trimmed.match(
    /^(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/,
  );
  if (jwt) return jwt[1];
  return trimmed.split(/[\s#—–]/)[0] || "";
}

export function getSupabaseEnv() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  // Prefer legacy JWT anon key. Publishable keys also work on new Supabase projects.
  const anon = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const publishable = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const key = anon || publishable;

  return { url, key, configured: Boolean(url && key) };
}

export function requireSupabaseEnv() {
  const env = getSupabaseEnv();
  if (!env.configured) {
    throw new Error(
      "Supabase env missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).",
    );
  }
  return env;
}

export function getJwtSecret() {
  return cleanEnv(process.env.SUPABASE_JWT_SECRET);
}

export function getServiceRoleKey() {
  return cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
