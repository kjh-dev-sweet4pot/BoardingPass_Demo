import { InfAllocationList } from "@/components/inf-allocation-list";
import { InfAppHeader } from "@/components/inf-app-header";
import { InfLoginClient } from "@/components/inf-login-client";
import { InfServerMessage } from "@/components/inf-server-message";
import { applyInfluencerStoreVisit } from "@/lib/inf-visit";
import { type AllocationWithRelations, type Influencer } from "@/lib/types";
import { getInfluencerSessionId } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function InfPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const { configured } = getSupabaseEnv();

  if (!configured) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
        <InfServerMessage kind="serverConfigError" />
      </div>
    );
  }

  const influencerId = await getInfluencerSessionId();

  // 미로그인: 클라이언트에서 빠른 본인확인 → 환영 애니 → 병렬 부트스트랩
  if (!influencerId) {
    return <InfLoginClient initialError={params.error} />;
  }

  const supabase = await createClient();

  // 세션으로 재진입해도 오늘 방문 / 미수령 재방문일 반영
  await applyInfluencerStoreVisit(supabase, influencerId);

  const [{ data: inf, error: infError }, { data: rows, error: allocError }] =
    await Promise.all([
      supabase
        .from("influencers")
        .select(
          "id, name, instagram_handle, instagram_handle_normalized, sns_url, notes, created_at, updated_at",
        )
        .eq("id", influencerId)
        .maybeSingle(),
      supabase
        .from("allocations")
        .select(
          "id, influencer_id, product_id, store_id, quantity, status, visit_code, visit_date, verified_at, picked_up_at, created_at, updated_at, products(id, name, sku, description), stores(id, name, address)",
        )
        .eq("influencer_id", influencerId)
        .order("created_at", { ascending: false }),
    ]);

  if (infError || allocError || !inf) {
    return (
      <InfLoginClient
        initialError={
          params.error ||
          infError?.message ||
          allocError?.message ||
          "세션이 만료되었습니다. 다시 로그인해 주세요."
        }
      />
    );
  }

  const influencer = inf as Influencer;
  const allocations = (rows as unknown as AllocationWithRelations[]) || [];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <InfAppHeader />
      <main className="flex flex-1 flex-col">
        <InfAllocationList
          influencer={influencer}
          initialAllocations={allocations}
        />
      </main>
    </div>
  );
}
