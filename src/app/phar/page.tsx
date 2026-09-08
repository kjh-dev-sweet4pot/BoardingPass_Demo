import { redirect } from "next/navigation";
import { PharConsole } from "@/components/phar-console";
import { PharHeaderActions } from "@/components/phar-header-actions";
import { AppShell, Notice } from "@/components/ui";
import { fetchPharAllocations } from "@/lib/phar-store-allocations";
import { getStoreSessionId, clearStoreSession } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { type AllocationWithRelations, type Store } from "@/lib/types";

export default async function PharPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
    tab?: string;
    date?: string;
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

  const supabase = hasServiceRoleKey()
    ? createServiceClient()
    : await createClient();
  const [{ data: store }, allocRes] = await Promise.all([
    supabase
      .from("stores")
      .select("id, name")
      .eq("id", storeId)
      .maybeSingle(),
    fetchPharAllocations(supabase, storeId),
  ]);
  const allocations = allocRes.data;
  const error = allocRes.error ? { message: allocRes.error } : null;

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
      <PharConsole
        items={list}
        storeId={storeRow.id}
        initialTab={params.tab}
        initialDate={params.date}
      />
    </AppShell>
  );
}
