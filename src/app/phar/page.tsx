import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { PharListWithModal } from "@/components/phar-list-with-modal";
import { AppShell, Notice, secondaryBtnClass } from "@/components/ui";
import { getStoreSessionId, clearStoreSession } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { type AllocationWithRelations, type Store } from "@/lib/types";

export default async function PharPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
}) {
  const storeId = await getStoreSessionId();
  if (!storeId) redirect("/phar/login");

  const params = await searchParams;
  const { configured } = getSupabaseEnv();

  if (!configured) {
    return (
      <AppShell wide eyebrow="Phar" title="매장 배정 현황">
        <Notice error="ERR ENV..." />
      </AppShell>
    );
  }

  const supabase = await createClient();
  const [{ data: store }, { data: allocations, error }] = await Promise.all([
    supabase
      .from("stores")
      .select("id, name")
      .eq("id", storeId)
      .maybeSingle(),
    supabase
      .from("allocations")
      .select("*, products(*), stores(*), influencers(*)")
      .eq("store_id", storeId)
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (!store) {
    await clearStoreSession();
    redirect(
      `/phar/login?error=${encodeURIComponent("세션 지점을 찾을 수 없습니다. 다시 로그인해 주세요.")}`,
    );
  }

  const storeRow = store as Pick<Store, "id" | "name">;
  const list = (allocations as AllocationWithRelations[]) || [];

  return (
    <AppShell
      wide
      eyebrow="Phar"
      title={storeRow.name}
      actions={
        <form action={signOut}>
          <input type="hidden" name="next" value="/phar/login" />
          <button className={secondaryBtnClass} type="submit">
            로그아웃
          </button>
        </form>
      }
    >
      <Notice error={params.error || error?.message} message={params.message} />
      <p className="mb-4 text-sm text-[var(--muted)]">
        로그인한 지점의 배정만 표시됩니다.
      </p>
      <PharListWithModal items={list} lockedStoreId={storeRow.id} />
    </AppShell>
  );
}
