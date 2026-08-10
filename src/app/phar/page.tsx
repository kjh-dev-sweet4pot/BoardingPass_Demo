import { redirect } from "next/navigation";
import { PharHeaderActions } from "@/components/phar-header-actions";
import { PharListWithModal } from "@/components/phar-list-with-modal";
import { AppShell, Notice } from "@/components/ui";
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
      <AppShell wide theme="owm" eyebrow="Phar" title="매장 배정 현황">
        <Notice error="환경변수가 설정되지 않았습니다." />
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
      full
      fitViewport
      theme="owm"
      eyebrow="Phar"
      title={storeRow.name}
      actions={<PharHeaderActions />}
    >
      <Notice error={params.error || error?.message} message={params.message} />
      <PharListWithModal
        items={list}
        lockedStoreId={storeRow.id}
        fillHeight
      />
    </AppShell>
  );
}
