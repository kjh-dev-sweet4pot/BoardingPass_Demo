import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createAllocation,
  createInfluencer,
  createProduct,
  createStore,
} from "@/app/actions/admin";
import { signOut } from "@/app/actions/auth";
import {
  AppShell,
  Field,
  Notice,
  fieldClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/ui";
import { isAdminSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  ALLOCATION_STATUS_LABEL,
  type AllocationWithRelations,
  type Influencer,
  type Product,
  type Store,
} from "@/lib/types";

const TABS = [
  "allocations",
  "influencers",
  "products",
  "stores",
] as const;

type Tab = (typeof TABS)[number];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string; message?: string }>;
}) {
  if (!(await isAdminSession())) redirect("/admin/login");

  const params = await searchParams;
  const tab = (TABS.includes(params.tab as Tab) ? params.tab : "allocations") as Tab;

  const supabase = await createClient();
  const [
    { data: stores },
    { data: products },
    { data: influencers },
    { data: allocations },
  ] = await Promise.all([
    supabase.from("stores").select("*").order("created_at", { ascending: false }),
    supabase.from("products").select("*").order("created_at", { ascending: false }),
    supabase.from("influencers").select("*").order("created_at", { ascending: false }),
    supabase
      .from("allocations")
      .select("*, products(*), stores(*), influencers(*)")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <AppShell
      eyebrow="Admin"
      title="운영 콘솔"
      actions={
        <form action={signOut}>
          <input type="hidden" name="next" value="/" />
          <button className={secondaryBtnClass} type="submit">
            로그아웃
          </button>
        </form>
      }
    >
      <Notice error={params.error} message={params.message} />

      <nav className="mb-8 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Link
            key={item}
            href={`/admin?tab=${item}`}
            className={`h-10 px-4 text-sm leading-10 ${
              tab === item
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--line)] bg-[var(--surface)]"
            }`}
          >
            {item}
          </Link>
        ))}
      </nav>

      {tab === "stores" && <StoresPanel stores={(stores as Store[]) || []} />}
      {tab === "products" && (
        <ProductsPanel products={(products as Product[]) || []} />
      )}
      {tab === "influencers" && (
        <InfluencersPanel influencers={(influencers as Influencer[]) || []} />
      )}
      {tab === "allocations" && (
        <AllocationsPanel
          allocations={(allocations as AllocationWithRelations[]) || []}
          influencers={(influencers as Influencer[]) || []}
          products={(products as Product[]) || []}
          stores={(stores as Store[]) || []}
        />
      )}
    </AppShell>
  );
}

function StoresPanel({ stores }: { stores: Store[] }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <form action={createStore} className="flex flex-col gap-4 border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2 className="text-lg" style={{ fontFamily: "var(--font-display), serif" }}>
          매장 추가
        </h2>
        <Field label="이름">
          <input className={fieldClass} name="name" required />
        </Field>
        <Field label="주소">
          <input className={fieldClass} name="address" />
        </Field>
        <button className={primaryBtnClass} type="submit">
          저장
        </button>
      </form>
      <List
        empty="등록된 매장이 없습니다."
        items={stores.map((s) => ({
          id: s.id,
          title: s.name,
          meta: s.address || "주소 없음",
        }))}
      />
    </div>
  );
}

function ProductsPanel({ products }: { products: Product[] }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <form action={createProduct} className="flex flex-col gap-4 border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2 className="text-lg" style={{ fontFamily: "var(--font-display), serif" }}>
          상품 추가
        </h2>
        <Field label="이름">
          <input className={fieldClass} name="name" required />
        </Field>
        <Field label="SKU">
          <input className={fieldClass} name="sku" />
        </Field>
        <Field label="설명">
          <textarea className={`${fieldClass} h-24 py-2`} name="description" />
        </Field>
        <button className={primaryBtnClass} type="submit">
          저장
        </button>
      </form>
      <List
        empty="등록된 상품이 없습니다."
        items={products.map((p) => ({
          id: p.id,
          title: p.name,
          meta: p.sku || p.description || "—",
        }))}
      />
    </div>
  );
}

function InfluencersPanel({ influencers }: { influencers: Influencer[] }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <form action={createInfluencer} className="flex flex-col gap-4 border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2 className="text-lg" style={{ fontFamily: "var(--font-display), serif" }}>
          인플루언서 등록
        </h2>
        <Field label="이름">
          <input className={fieldClass} name="name" required />
        </Field>
        <Field label="인스타그램 핸들">
          <input
            className={fieldClass}
            name="instagram_handle"
            placeholder="@handle"
            required
          />
        </Field>
        <Field label="메모">
          <input className={fieldClass} name="notes" />
        </Field>
        <button className={primaryBtnClass} type="submit">
          저장
        </button>
      </form>

      <ul className="space-y-3">
        {influencers.length === 0 && (
          <li className="text-sm text-[var(--muted)]">등록된 인플루언서가 없습니다.</li>
        )}
        {influencers.map((inf) => (
          <li key={inf.id} className="border border-[var(--line)] bg-[var(--surface)] p-5">
            <h3 className="text-lg">{inf.name}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Instagram @{inf.instagram_handle_normalized}
              {inf.notes ? ` · ${inf.notes}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AllocationsPanel({
  allocations,
  influencers,
  products,
  stores,
}: {
  allocations: AllocationWithRelations[];
  influencers: Influencer[];
  products: Product[];
  stores: Store[];
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      <form action={createAllocation} className="flex flex-col gap-4 border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2 className="text-lg" style={{ fontFamily: "var(--font-display), serif" }}>
          배정 생성
        </h2>
        <Field label="인플루언서">
          <select className={fieldClass} name="influencer_id" required>
            <option value="">선택</option>
            {influencers.map((inf) => (
              <option key={inf.id} value={inf.id}>
                {inf.name} (@{inf.instagram_handle_normalized})
              </option>
            ))}
          </select>
        </Field>
        <Field label="상품">
          <select className={fieldClass} name="product_id" required>
            <option value="">선택</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="매장">
          <select className={fieldClass} name="store_id" required>
            <option value="">선택</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="수량">
          <input className={fieldClass} name="quantity" type="number" min={1} defaultValue={1} />
        </Field>
        <Field label="방문 예정일">
          <input className={fieldClass} name="visit_date" type="date" required />
        </Field>
        <Field label="방문 코드">
          <input className={fieldClass} name="visit_code" placeholder="선택" />
        </Field>
        <button className={primaryBtnClass} type="submit">
          배정
        </button>
      </form>

      <ul className="space-y-3">
        {allocations.length === 0 && (
          <li className="text-sm text-[var(--muted)]">배정이 없습니다.</li>
        )}
        {allocations.map((a) => (
          <li key={a.id} className="border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-medium">
                {a.influencers?.name} → {a.products?.name}
              </p>
              <span className="text-sm text-[var(--accent)]">
                {ALLOCATION_STATUS_LABEL[a.status]}
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {a.stores?.name} · 수량 {a.quantity}
              {a.visit_date ? ` · 방문 ${a.visit_date}` : ""}
              {a.visit_code ? ` · code ${a.visit_code}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function List({
  items,
  empty,
}: {
  items: { id: string; title: string; meta: string }[];
  empty: string;
}) {
  if (!items.length) {
    return <p className="text-sm text-[var(--muted)]">{empty}</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="border border-[var(--line)] bg-[var(--surface)] p-5">
          <p className="font-medium">{item.title}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{item.meta}</p>
        </li>
      ))}
    </ul>
  );
}
