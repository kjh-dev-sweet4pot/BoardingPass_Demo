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
import { isBranchStoreName } from "@/lib/store-name";
import { type AllocationWithRelations, type Company, type Product, type Store } from "@/lib/types";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
    section?: string;
    campaignId?: string;
    reviewQueue?: string;
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
  // 이 페이지는 admin 콘솔 내 탭 전환(navigate())마다 서버에서 다시 실행된다.
  // 아래 allocations 쿼리는 무거운 풀 조인이라, 실제로 그 목록을 쓰는
  // 인플루언서 탭(등록/검수/배정)일 때만 돈다 — 그 외 탭(성과·마진 등)에서
  // 매번 전체 배정을 긁어오면서 느려지는 걸 막는다.
  const section = params.section;
  const needsAllocations =
    section === "influencersRegister" ||
    section === "influencersReview" ||
    section === "influencersAlloc";
  const [{ data: stores }, companiesRes, { data: products }, allocResult] =
    await Promise.all([
      supabase.from("stores").select("*").order("name", { ascending: true }),
      companiesQuery,
      supabase.from("products").select("*").order("name", { ascending: true }),
      needsAllocations
        ? supabase
            .from("allocations")
            .select(
              "*, products(*), stores(*), influencers(*), companies(id, name), creator_links(id, status)",
            )
            .order("visit_date", { ascending: false })
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
  const { data: allocations, error } = allocResult;
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
  const storeList = ((stores as Store[]) || []).filter((s) => isBranchStoreName(s.name));
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
        initialSection={params.section}
        initialCampaignId={params.campaignId}
        initialReviewQueue={params.reviewQueue}
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
