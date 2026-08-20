import type { SupabaseClient } from "@supabase/supabase-js";

export type ImportProfileFetchStatus = "pending" | "ok" | "failed" | "skipped";

export type ImportBatchInfluencerRow = {
  id: string;
  batch_id: string;
  influencer_id: string;
  name: string | null;
  instagram_handle: string | null;
  is_new: boolean;
  profile_fetch_status: ImportProfileFetchStatus;
  profile_fetch_error: string | null;
  influencers?: {
    profile_image_path: string | null;
  } | null;
};

export type ImportBatchRow = {
  id: string;
  uploaded_at: string;
  uploaded_by: string | null;
  row_total: number;
  created_count: number;
  skipped_count: number;
  failed_count: number;
  import_batch_influencers: ImportBatchInfluencerRow[];
};

/** ponytail: 실제 미존재·스키마 캐시만 — RLS 등 다른 오류와 구분 */
export function isImportLogTableMissing(error: { message?: string; code?: string } | null) {
  const msg = error?.message || "";
  const code = error?.code || "";
  if (code === "42P01") return true;
  if (/relation .* does not exist/i.test(msg)) return true;
  if (/could not find the table .*import_batch/i.test(msg)) return true;
  if (/schema cache.*import_batch/i.test(msg)) return true;
  return false;
}

export async function updateBatchInfluencerProfileStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  batchInfluencerId: string,
  status: ImportProfileFetchStatus,
  errorMessage?: string | null,
) {
  await supabase
    .from("import_batch_influencers")
    .update({
      profile_fetch_status: status,
      profile_fetch_error: errorMessage || null,
    })
    .eq("id", batchInfluencerId);
}

export function effectiveProfileStatus(item: ImportBatchInfluencerRow): ImportProfileFetchStatus {
  if (item.profile_fetch_status === "ok") return "ok";
  if (item.influencers?.profile_image_path) return "ok";
  return item.profile_fetch_status;
}

export function formatKstDateTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}
