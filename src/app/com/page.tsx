import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { CompanyConsole } from "@/components/company-console";
import { AppShell, Notice, secondaryBtnClass } from "@/components/ui";
import { buildMockContentInsights } from "@/lib/content-insights-mock";
import { getCompanySessionId } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { type AllocationWithRelations, type Company } from "@/lib/types";

export default async function CompanyPage() {
  const companyId = await getCompanySessionId();
  if (!companyId) redirect("/com/login");

  const { configured } = getSupabaseEnv();
  if (!configured) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <Notice error="환경변수가 설정되지 않았습니다." />
      </div>
    );
  }

  const supabase = hasServiceRoleKey() ? createServiceClient() : await createClient();
  const [{ data: company, error: companyError }, { data: allocations, error: allocError }] =
    await Promise.all([
      supabase
        .from("companies")
        .select(
          "id, name, login_id, aliases, contact, is_active, created_at, updated_at",
        )
        .eq("id", companyId)
        .maybeSingle(),
      supabase
        .from("allocations")
        .select(
          "*, products(*), stores(*), influencers(id, name, instagram_handle, instagram_handle_normalized, sns_url), creator_links(*)",
        )
        .eq("company_id", companyId)
        .order("visit_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

  if (companyError || !company || !company.is_active) {
    redirect("/com/login");
  }

  const initialAllocations = (allocations as AllocationWithRelations[]) || [];
  const initialMonthInsights = buildMockContentInsights(initialAllocations, "month");
  const initialAllInsights = buildMockContentInsights(initialAllocations, "all");

  return (
    <AppShell
      full
      fitViewport
      theme="owm"
      eyebrow="Company"
      title={company.name}
      actions={
        <form action={signOut}>
          <input type="hidden" name="next" value="/com/login" />
          <button className={secondaryBtnClass} type="submit">
            로그아웃
          </button>
        </form>
      }
    >
      <CompanyConsole
        company={company as Company}
        initialAllocations={initialAllocations}
        initialMonthInsights={initialMonthInsights}
        initialAllInsights={initialAllInsights}
      />
    </AppShell>
  );
}
