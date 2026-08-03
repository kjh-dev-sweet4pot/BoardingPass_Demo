export function normalizeHandle(handle: string) {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}
