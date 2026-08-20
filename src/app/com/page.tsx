import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { CompanyConsole } from "@/components/company-console";
import { AppShell, Notice } from "@/components/ui";
import { buildMockContentInsights } from "@/lib/content-insights-mock";
import { getCompanySessionId } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { type Company } from "@/lib/types";

/** 로그인 체감: 서버는 회원사만 확인. 배정·성과는 탭에서 지연 로드. */
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
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select(
      "id, name, login_id, aliases, contact, is_active, created_at, updated_at",
    )
    .eq("id", companyId)
    .maybeSingle();

  if (companyError || !company || !company.is_active) {
    const msg = !hasServiceRoleKey()
      ? "회원사 데이터 조회에 SUPABASE_SERVICE_ROLE_KEY가 필요합니다. Vercel 환경변수를 확인해 주세요."
      : companyError
        ? "회원사 정보를 불러오지 못했습니다. 다시 로그인해 주세요."
        : !company
          ? "회원사 정보를 찾을 수 없습니다."
          : "비활성화된 계정입니다. 운영자에게 문의해 주세요.";
    redirect(`/com/login?error=${encodeURIComponent(msg)}`);
  }

  const liveCompany = company as Company;
  const emptyInsights = buildMockContentInsights([], "all", { fabricate: false });

  return (
    <AppShell full fitViewport theme="owm" hideHeader>
      <CompanyConsole
        company={liveCompany}
        initialAllocations={[]}
        initialMonthInsights={emptyInsights}
        initialAllInsights={emptyInsights}
        sidebarActions={
          <form action={signOut}>
            <input type="hidden" name="next" value="/com/login" />
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
