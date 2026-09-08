/** 방문지점명. 숫자만 있으면 상품 SKU가 stores.name으로 들어간 오수입. */
export function isBranchStoreName(name: string) {
  const t = name.trim();
  return t.length > 0 && !/^\d+$/.test(t);
}

if (process.env.RUN_STORE_NAME_SELF_CHECK === "1") {
  if (
    !isBranchStoreName("OWM 강남점") ||
    !isBranchStoreName("강남점") ||
    isBranchStoreName("21800") ||
    isBranchStoreName("104000") ||
    isBranchStoreName("")
  ) {
    throw new Error("isBranchStoreName self-check failed");
  }
  console.log("store-name self-check ok");
}
