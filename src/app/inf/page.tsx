import { InfAllocationList } from "@/components/inf-allocation-list";
import { InfLoginClient } from "@/components/inf-login-client";
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
        <p className="text-sm text-red-400">
          서버 설정 오류입니다. 잠시 후 다시 시도해 주세요.
        </p>
      </div>
    );
  }

  const influencerId = await getInfluencerSessionId();

  // 미로그인: 클라이언트에서 빠른 본인확인 → 환영 애니 → 병렬 부트스트랩
  if (!influencerId) {
    return <InfLoginClient initialError={params.error} />;
  }

  const supabase = await createClient();
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
  const allocations = (rows as AllocationWithRelations[]) || [];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex items-center justify-between px-5 pt-10 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/owm-logo.webp"
          alt="O.W.M 옵티마 웰니스 뮤지엄 약국"
          className="w-20"
          draggable={false}
        />
        <form action="/api/inf/clear" method="post">
          <button
            type="submit"
            className="rounded-full px-3 py-1.5 text-xs font-medium text-[#A07050] transition hover:bg-[#F0E6D8] active:bg-[#E8D8C8]"
          >
            로그아웃
          </button>
        </form>
      </header>
      <main className="flex flex-1 flex-col">
        <InfAllocationList
          influencer={influencer}
          initialAllocations={allocations}
        />
      </main>
    </div>
  );
}
