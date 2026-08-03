import type { AppRole, Profile } from "@/lib/types";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function getSessionProfile(): Promise<{
  userId: string | null;
  profile: Profile | null;
}> {
  if (!getSupabaseEnv().configured) {
    return { userId: null, profile: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { userId: user.id, profile: profile as Profile | null };
}

export async function requireRole(roles: AppRole[]) {
  const { userId, profile } = await getSessionProfile();
  if (!userId || !profile || !roles.includes(profile.role)) {
    return null;
  }
  return { userId, profile };
}

export function normalizeHandle(handle: string) {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}
