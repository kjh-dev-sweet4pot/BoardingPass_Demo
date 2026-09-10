/** 방문지점명. 숫자만 있으면 상품 SKU가 stores.name으로 들어간 오수입. */
export function isBranchStoreName(name: string) {
  const t = name.trim();
  return t.length > 0 && !/^\d+$/.test(t);
}

/** "OWM 명동점" · "약국 명동" · "명동점" → "명동" */
export function canonicalBranchName(name: string) {
  return name
    .trim()
    .replace(/^OWM\s+/i, "")
    .replace(/^약국\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/점$/u, "");
}

export function uniqueBranchStores<T extends { id: string; name: string }>(
  stores: T[],
): T[] {
  const map = new Map<string, T>();
  for (const s of stores) {
    const k = canonicalBranchName(s.name);
    if (!k) continue;
    const prev = map.get(k);
    if (!prev) {
      map.set(k, s);
      continue;
    }
    const preferNew =
      /점$/.test(s.name.trim()) && !/점$/.test(prev.name.trim());
    if (preferNew) map.set(k, s);
  }
  return [...map.values()];
}

if (process.env.RUN_STORE_NAME_SELF_CHECK === "1") {
  if (
    !isBranchStoreName("OWM 강남점") ||
    !isBranchStoreName("강남점") ||
    isBranchStoreName("21800") ||
    isBranchStoreName("104000") ||
    isBranchStoreName("") ||
    canonicalBranchName("OWM 명동점") !== "명동" ||
    canonicalBranchName("명동점") !== "명동" ||
    canonicalBranchName("약국 명동") !== "명동" ||
    canonicalBranchName("명동") !== "명동" ||
    uniqueBranchStores([
      { id: "1", name: "명동" },
      { id: "2", name: "명동점" },
      { id: "3", name: "약국 명동" },
    ]).length !== 1
  ) {
    throw new Error("isBranchStoreName self-check failed");
  }
  console.log("store-name self-check ok");
}
