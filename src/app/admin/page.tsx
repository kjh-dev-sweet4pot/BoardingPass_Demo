import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { AdminConsoleLayout } from "@/components/admin-console-layout";
import { AppShell, secondaryBtnClass } from "@/components/ui";
import { isAdminSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { type AllocationWithRelations, type Store } from "@/lib/types";

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
  const [{ data: stores }, { data: allocations, error }] = await Promise.all([
    supabase.from("stores").select("*").order("name", { ascending: true }),
    supabase
      .from("allocations")
      .select("*, products(*), stores(*), influencers(*)")
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const list = (allocations as AllocationWithRelations[]) || [];
  const storeList = (stores as Store[]) || [];

  return (
    <AppShell
      full
      compactHeader
      theme="owm"
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
      <AdminConsoleLayout
        storeList={storeList}
        list={list}
        error={params.error || error?.message}
        message={params.message}
      />
    </AppShell>
  );
}
