import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { AdminConsoleLayout } from "@/components/admin-console-layout";
import { AppShell } from "@/components/ui";
import { isAdminSession, getAdminRole } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { type AllocationWithRelations, type Company, type Product, type Store } from "@/lib/types";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
}) {
  if (!(await isAdminSession())) redirect("/admin/login");

  const params = await searchParams;

  const supabase = await createClient();
  const adminRole = await getAdminRole();
  const [{ data: stores }, { data: companies }, { data: products }, { data: allocations, error }] =
    await Promise.all([
      supabase.from("stores").select("*").order("name", { ascending: true }),
      supabase
        .from("companies")
        .select(
          "id, name, login_id, aliases, contact, is_active, created_at, updated_at",
        )
        .order("name", { ascending: true }),
      supabase.from("products").select("*").order("name", { ascending: true }),
      supabase
        .from("allocations")
        .select(
          "*, products(*), stores(*), influencers(*), companies(id, name), creator_links(id, status)",
        )
        .order("visit_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

  const list = (allocations as AllocationWithRelations[]) || [];
  const storeList = (stores as Store[]) || [];
  const companyList = (companies as Company[]) || [];
  const productList = (products as Product[]) || [];

  return (
    <AppShell full fitViewport theme="owm" hideHeader>
      <AdminConsoleLayout
        storeList={storeList}
        companyList={companyList}
        productList={productList}
        list={list}
        isManager={adminRole === "admin_manager"}
        error={params.error || error?.message}
        message={params.message}
        sidebarActions={
          <form action={signOut}>
            <input type="hidden" name="next" value="/" />
            <button
              className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-hover)]"
              type="submit"
            >
              로그아웃
            </button>
          </form>
        }
      />
    </AppShell>
  );
}
