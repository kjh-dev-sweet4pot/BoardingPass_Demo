import { CONTENT_FILES_BUCKET } from "@/lib/content-file-storage";
import type { SupabaseClient } from "@supabase/supabase-js";

const PREFIX = "admin-mail";
const META = "meta.json";
const SIG_PREFIX = "signature.";

export type AdminMailProfile = {
  loginId: string;
  displayName: string;
  signaturePath: string | null;
  signatureUrl: string | null;
};

export function mailProfileFolder(loginId: string) {
  const id = loginId.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "") || "manager";
  return `${PREFIX}/${id}`;
}

export async function loadAdminMailProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  loginId: string,
): Promise<AdminMailProfile> {
  const folder = mailProfileFolder(loginId);
  const { data: files } = await supabase.storage.from(CONTENT_FILES_BUCKET).list(folder);
  const names = (files || []).map((f) => f.name);
  let displayName = "";
  if (names.includes(META)) {
    const { data } = await supabase.storage
      .from(CONTENT_FILES_BUCKET)
      .download(`${folder}/${META}`);
    if (data) {
      try {
        const raw = JSON.parse(await data.text()) as { displayName?: string };
        displayName = String(raw.displayName || "").trim();
      } catch {
        displayName = "";
      }
    }
  }
  const sigName = names.find((n) => n.startsWith(SIG_PREFIX));
  let signaturePath: string | null = null;
  let signatureUrl: string | null = null;
  if (sigName) {
    signaturePath = `${folder}/${sigName}`;
    const signed = await supabase.storage
      .from(CONTENT_FILES_BUCKET)
      .createSignedUrl(signaturePath, 60 * 60);
    signatureUrl = signed.data?.signedUrl || null;
  }
  return { loginId: folder.slice(PREFIX.length + 1), displayName, signaturePath, signatureUrl };
}

export async function loadSignatureBytes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  path: string,
) {
  const { data, error } = await supabase.storage.from(CONTENT_FILES_BUCKET).download(path);
  if (error || !data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  const type = data.type || guessImageType(path);
  return { bytes, type, filename: path.split("/").pop() || "signature.png" };
}

function guessImageType(path: string) {
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  return "image/png";
}

export async function saveAdminMailProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  loginId: string,
  input: { displayName: string; file?: File | null },
) {
  const folder = mailProfileFolder(loginId);
  const meta = Buffer.from(JSON.stringify({ displayName: input.displayName.trim() }));
  const { error: metaErr } = await supabase.storage
    .from(CONTENT_FILES_BUCKET)
    .upload(`${folder}/${META}`, meta, {
      contentType: "application/json",
      upsert: true,
    });
  if (metaErr) throw new Error(metaErr.message);

  if (input.file && input.file.size) {
    const ext = (input.file.name.split(".").pop() || "png").replace(/[^a-z0-9]/gi, "") || "png";
    const { data: existing } = await supabase.storage.from(CONTENT_FILES_BUCKET).list(folder);
    const old = (existing || [])
      .map((f) => f.name)
      .filter((n) => n.startsWith(SIG_PREFIX))
      .map((n) => `${folder}/${n}`);
    if (old.length) await supabase.storage.from(CONTENT_FILES_BUCKET).remove(old);
    const bytes = Buffer.from(await input.file.arrayBuffer());
    const { error } = await supabase.storage
      .from(CONTENT_FILES_BUCKET)
      .upload(`${folder}/${SIG_PREFIX}${ext}`, bytes, {
        contentType: input.file.type || "image/png",
        upsert: true,
      });
    if (error) throw new Error(error.message);
  }
}
