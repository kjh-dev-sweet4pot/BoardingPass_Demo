import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const CONTENT_FILES_BUCKET = "content-files";

const SIGNED_URL_TTL_SEC = 60 * 15;

/** S7: 회원사별 경로 `{company_id}/{file_id}/{filename}` */
export function contentFileObjectPath(
  companyId: string,
  fileId: string,
  filename: string,
) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
  return `${companyId}/${fileId}/${safe}`;
}

export async function uploadContentFile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  input: {
    companyId: string;
    fileId?: string;
    filename: string;
    bytes: Buffer;
    contentType: string;
  },
) {
  const fileId = input.fileId || randomUUID();
  const path = contentFileObjectPath(input.companyId, fileId, input.filename);
  const { error } = await supabase.storage
    .from(CONTENT_FILES_BUCKET)
    .upload(path, input.bytes, {
      contentType: input.contentType,
      upsert: false,
    });
  if (error) throw new Error(error.message);
  return { path, fileId };
}

export async function signedContentFileUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  objectPath: string,
  expiresInSec = SIGNED_URL_TTL_SEC,
) {
  const { data, error } = await supabase.storage
    .from(CONTENT_FILES_BUCKET)
    .createSignedUrl(objectPath, expiresInSec);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Presigned URL 생성 실패");
  }
  return data.signedUrl;
}

export const CONTENT_UPLOAD_MAX_BYTES = 80 * 1024 * 1024;

export function validateContentUpload(file: File) {
  if (!file.size) return "파일을 선택하세요.";
  if (file.size > CONTENT_UPLOAD_MAX_BYTES) {
    return "파일 크기는 80MB 이하여야 합니다.";
  }
  const type = file.type || "";
  if (
    !type.startsWith("image/") &&
    !type.startsWith("video/") &&
    type !== "application/pdf"
  ) {
    return "이미지·동영상·PDF만 업로드할 수 있습니다.";
  }
  return null;
}
