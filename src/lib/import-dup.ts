import { canonicalBranchName } from "@/lib/store-name";

export type ImportDupMode = "add" | "replace" | "skip";

export type ImportDupCandidate = {
  id: string;
  visit_date: string | null;
  quantity: number;
  status: string;
  store_id: string;
  product_id: string;
  company_id: string | null;
  store_name: string;
  product_name: string;
  influencer_name: string;
  display_price: number | null;
  cost_amount: number | null;
  content_urls: string[];
};

export type ImportDupChange = {
  field:
    | "visit_date"
    | "store"
    | "product"
    | "quantity"
    | "name"
    | "display_price"
    | "cost_amount"
    | "content_url";
  label: string;
  from: string;
  to: string;
};

function firstRel<T>(raw: unknown): T | null {
  if (!raw) return null;
  return (Array.isArray(raw) ? raw[0] : raw) as T;
}

function moneyLabel(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("ko-KR");
}

function urlList(raw: unknown): string[] {
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const rec = row as { url?: string; publish_url?: string };
    for (const u of [rec.url, rec.publish_url]) {
      const v = String(u || "").trim();
      if (!v || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

export function dupIndexKey(handle: string, companyId: string) {
  return `${handle}|${companyId}`;
}

export async function loadImportDupMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (t: string) => any },
  handles: string[],
) {
  const uniq = [...new Set(handles.map((h) => h.trim()).filter(Boolean))];
  const byHandle = new Map<string, string>();
  const byKey = new Map<string, ImportDupCandidate[]>();
  if (uniq.length === 0) return { byHandle, byKey };

  const { data: infs, error: infErr } = await supabase
    .from("influencers")
    .select("id, instagram_handle_normalized")
    .in("instagram_handle_normalized", uniq);
  if (infErr) throw new Error(infErr.message);
  const idToHandle = new Map<string, string>();
  for (const inf of infs || []) {
    const handle = String(inf.instagram_handle_normalized || "");
    const id = String(inf.id);
    if (!handle || !id) continue;
    byHandle.set(handle, id);
    idToHandle.set(id, handle);
  }
  const ids = [...byHandle.values()];
  if (ids.length === 0) return { byHandle, byKey };

  const { data: allocs, error: allocErr } = await supabase
    .from("allocations")
    .select(
      "id, influencer_id, company_id, product_id, store_id, visit_date, quantity, status, products(name), stores(name), influencers(name), allocation_pricing(display_price, cost_amount), creator_links(url, publish_url)",
    )
    .in("influencer_id", ids)
    .neq("status", "cancelled");
  if (allocErr) throw new Error(allocErr.message);

  for (const row of allocs || []) {
    const handle = idToHandle.get(String(row.influencer_id));
    const companyId = row.company_id ? String(row.company_id) : "";
    if (!handle || !companyId) continue;
    const product = firstRel<{ name?: string }>(row.products);
    const store = firstRel<{ name?: string }>(row.stores);
    const inf = firstRel<{ name?: string }>(row.influencers);
    const pricing = firstRel<{
      display_price?: number | null;
      cost_amount?: number | null;
    }>(row.allocation_pricing);
    const cand: ImportDupCandidate = {
      id: String(row.id),
      visit_date: row.visit_date ? String(row.visit_date).slice(0, 10) : null,
      quantity: Number(row.quantity) || 1,
      status: String(row.status || ""),
      store_id: String(row.store_id),
      product_id: String(row.product_id),
      company_id: companyId,
      store_name: String(store?.name || ""),
      product_name: String(product?.name || ""),
      influencer_name: String(inf?.name || ""),
      display_price:
        pricing?.display_price != null ? Number(pricing.display_price) : null,
      cost_amount:
        pricing?.cost_amount != null ? Number(pricing.cost_amount) : null,
      content_urls: urlList(row.creator_links),
    };
    const key = dupIndexKey(handle, companyId);
    const list = byKey.get(key) || [];
    list.push(cand);
    byKey.set(key, list);
  }
  return { byHandle, byKey };
}

export function parseImportDupMode(raw: unknown): ImportDupMode {
  const v = String(raw || "").trim();
  if (v === "add" || v === "replace" || v === "skip") return v;
  return "replace";
}

export function pickImportDup(
  candidates: ImportDupCandidate[],
  want: { product: string; store: string; visitDate: string },
): { hit: ImportDupCandidate; exact: boolean } | null {
  if (candidates.length === 0) return null;
  const store = canonicalBranchName(want.store);
  const product = want.product.trim().toLowerCase();
  const visit = want.visitDate.slice(0, 10);
  const exact = candidates.find(
    (c) =>
      (c.visit_date || "").slice(0, 10) === visit &&
      canonicalBranchName(c.store_name) === store &&
      c.product_name.trim().toLowerCase() === product,
  );
  if (exact) return { hit: exact, exact: true };
  const sameProduct = candidates.filter(
    (c) => c.product_name.trim().toLowerCase() === product,
  );
  const pool = sameProduct.length > 0 ? sameProduct : candidates;
  const hit = [...pool].sort((a, b) =>
    (b.visit_date || "").localeCompare(a.visit_date || ""),
  )[0];
  return hit ? { hit, exact: false } : null;
}

/** 상태·수령·방문확인 필드는 넣지 않는다. */
export function allocationReplacePatch(
  current: {
    visit_date: string | null;
    quantity: number;
    store_id: string;
    product_id: string;
    company_id: string | null;
  },
  next: {
    visit_date?: string;
    quantity?: number;
    store_id?: string;
    product_id?: string;
    company_id?: string | null;
  },
) {
  const patch: Record<string, unknown> = {};
  const curVisit = (current.visit_date || "").slice(0, 10);
  if (next.visit_date && next.visit_date !== curVisit) {
    patch.visit_date = next.visit_date;
  }
  if (next.quantity != null && next.quantity !== current.quantity) {
    patch.quantity = next.quantity;
  }
  if (next.store_id && next.store_id !== current.store_id) {
    patch.store_id = next.store_id;
  }
  if (next.product_id && next.product_id !== current.product_id) {
    patch.product_id = next.product_id;
  }
  if (next.company_id && next.company_id !== (current.company_id || null)) {
    patch.company_id = next.company_id;
  }
  return patch;
}

export function importDupChanges(
  current: Pick<
    ImportDupCandidate,
    | "visit_date"
    | "store_name"
    | "product_name"
    | "quantity"
    | "influencer_name"
    | "display_price"
    | "cost_amount"
    | "content_urls"
  >,
  next: {
    visit_date: string;
    store: string;
    product: string;
    quantity: number;
    name?: string;
    display_price?: number | null;
    cost_amount?: number | null;
    content_urls?: string[];
  },
): ImportDupChange[] {
  const out: ImportDupChange[] = [];
  const nextVisit = (next.visit_date || "").slice(0, 10);
  const curVisit = (current.visit_date || "").slice(0, 10);
  if (nextVisit && nextVisit !== curVisit) {
    out.push({
      field: "visit_date",
      label: "방문일",
      from: curVisit || "—",
      to: nextVisit,
    });
  }
  const nextStore = canonicalBranchName(next.store);
  const curStore = canonicalBranchName(current.store_name);
  if (nextStore && nextStore !== curStore) {
    out.push({
      field: "store",
      label: "매장",
      from: current.store_name || "—",
      to: next.store,
    });
  }
  const nextProduct = next.product.trim().toLowerCase();
  const curProduct = current.product_name.trim().toLowerCase();
  if (nextProduct && nextProduct !== curProduct) {
    out.push({
      field: "product",
      label: "상품",
      from: current.product_name || "—",
      to: next.product,
    });
  }
  if (next.quantity !== current.quantity) {
    out.push({
      field: "quantity",
      label: "수량",
      from: String(current.quantity),
      to: String(next.quantity),
    });
  }
  const nextName = (next.name || "").trim();
  const curName = (current.influencer_name || "").trim();
  if (nextName && nextName !== curName) {
    out.push({
      field: "name",
      label: "이름",
      from: curName || "—",
      to: nextName,
    });
  }
  if (next.display_price != null && next.cost_amount != null) {
    if (next.display_price !== current.display_price) {
      out.push({
        field: "display_price",
        label: "노출가",
        from: moneyLabel(current.display_price),
        to: moneyLabel(next.display_price),
      });
    }
    if (next.cost_amount !== current.cost_amount) {
      out.push({
        field: "cost_amount",
        label: "원가",
        from: moneyLabel(current.cost_amount),
        to: moneyLabel(next.cost_amount),
      });
    }
  }
  const have = new Set(current.content_urls || []);
  const added = (next.content_urls || []).filter((u) => u && !have.has(u));
  if (added.length) {
    out.push({
      field: "content_url",
      label: "콘텐츠",
      from: current.content_urls.length
        ? `${current.content_urls.length}건`
        : "없음",
      to: `+${added.length}`,
    });
  }
  return out;
}

if (process.env.RUN_IMPORT_DUP_SELF_CHECK === "1") {
  const a: ImportDupCandidate = {
    id: "old",
    visit_date: "2026-09-05",
    quantity: 1,
    status: "picked_up",
    store_id: "s1",
    product_id: "p1",
    company_id: "c1",
    store_name: "명동",
    product_name: "닥터리앤장, 옵티팜, rxme",
    influencer_name: "서하얀",
    display_price: 100000,
    cost_amount: 80000,
    content_urls: ["https://x.com/a"],
  };
  const picked = pickImportDup([a], {
    product: "닥터리앤장, 옵티팜, rxme",
    store: "명동점",
    visitDate: "2026-09-06",
  });
  if (!picked || picked.exact || picked.hit.id !== "old") {
    throw new Error("pickImportDup same-product fallback failed");
  }
  const patch = allocationReplacePatch(
    {
      visit_date: "2026-09-05",
      quantity: 1,
      store_id: "s1",
      product_id: "p1",
      company_id: "c1",
    },
    {
      visit_date: "2026-09-06",
      quantity: 1,
      store_id: "s2",
      product_id: "p1",
      company_id: "c1",
    },
  );
  if (patch.visit_date !== "2026-09-06" || patch.store_id !== "s2") {
    throw new Error("allocationReplacePatch fields failed");
  }
  if ("status" in patch || "picked_up_at" in patch || "quantity" in patch) {
    throw new Error("allocationReplacePatch leaked unchanged fields");
  }
  const changes = importDupChanges(a, {
    visit_date: "2026-09-06",
    store: "명동점",
    product: "닥터리앤장, 옵티팜, rxme",
    quantity: 1,
    name: "서하얀",
    display_price: 100000,
    cost_amount: 80000,
    content_urls: ["https://x.com/a", "https://x.com/b"],
  });
  const fields = changes.map((c) => c.field).join(",");
  if (fields !== "visit_date,store,content_url") {
    throw new Error(`importDupChanges fields failed: ${fields}`);
  }
  console.log("import-dup self-check ok");
}
