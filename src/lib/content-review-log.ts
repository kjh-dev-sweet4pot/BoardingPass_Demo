import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminRole } from "@/lib/session";
import { getAdminLoginId, getAdminRole } from "@/lib/session";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";

export function adminOperatorLabel(role: AdminRole | null) {
  if (role === "admin_operator") return "운영담당자";
  if (role === "admin_manager") return "운영관리자";
  return "운영자";
}

export async function adminReviewerFields() {
  const role = await getAdminRole();
  const loginId = (await getAdminLoginId())?.trim().toLowerCase();
  return {
    operator_label: adminOperatorLabel(role),
    operator_id: loginId || "unknown",
  };
}

/** 검수 이력 테이블 — service_role 우선 (RLS·GRANT 이슈 회피) */
export function contentReviewLogsClient(fallback: SupabaseClient) {
  if (hasServiceRoleKey()) return createServiceClient();
  return fallback;
}
