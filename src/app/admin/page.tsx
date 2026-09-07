import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { AdminConsoleLayout } from "@/components/admin-console-layout";
import { AppShell } from "@/components/ui";
import { isAdminSession, getAdminRole } from "@/lib/session";
import {
  COMPANY_SELECT,
  COMPANY_SELECT_BASE,
  COMPANY_SELECT_MAIL,
  isMissingColumnError,
  isMissingCompanyCrmColumn,
} from "@/lib/company";
import { createAuthedDbClient } from "@/lib/supabase/api-client";
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

  const supabase = await createAuthedDbClient();
  if (!supabase) redirect("/admin/login");
  const adminRole = await getAdminRole();
  const companiesQuery = supabase
    .from("companies")
    .select(COMPANY_SELECT)
    .order("name", { ascending: true });
  const [{ data: stores }, companiesRes, { data: products }, { data: allocations, error }] =
    await Promise.all([
      supabase.from("stores").select("*").order("name", { ascending: true }),
      companiesQuery,
      supabase.from("products").select("*").order("name", { ascending: true }),
      supabase
        .from("allocations")
        .select(
          "*, products(*), stores(*), influencers(*), companies(id, name), creator_links(id, status)",
        )
        .order("visit_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
  let companies = companiesRes.data;
  if (companiesRes.error) {
    const msg = companiesRes.error.message;
    const select = isMissingCompanyCrmColumn(msg)
      ? COMPANY_SELECT_MAIL
      : isMissingColumnError(msg, "contact_email")
        ? COMPANY_SELECT_BASE
        : COMPANY_SELECT_BASE;
    const fallback = await supabase
      .from("companies")
      .select(select)
      .order("name", { ascending: true });
    companies = fallback.data as typeof companies;
  }

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
              className="inline-flex h-9 items-center justify-center rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-hover)]"
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
