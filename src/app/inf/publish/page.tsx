import { redirect } from "next/navigation";
import { InfAppHeader } from "@/components/inf-app-header";
import { InfBottomNav } from "@/components/inf-bottom-nav";
import { InfPublishClient } from "@/components/inf-publish-client";
import { InfServerMessage } from "@/components/inf-server-message";
import { getInfluencerSessionId } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { type AllocationWithRelations } from "@/lib/types";

export default async function InfPublishPage() {
  const influencerId = await getInfluencerSessionId();
  if (!influencerId) redirect("/inf");

  const { configured } = getSupabaseEnv();
  if (!configured) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
        <InfServerMessage kind="serverConfigError" />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("allocations")
    .select(
      "*, products(id, name, sku, description), stores(id, name, address), creator_links(*)",
    )
    .eq("influencer_id", influencerId)
    .eq("status", "picked_up")
    .order("picked_up_at", { ascending: false });

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <InfAppHeader />
      <main className="flex flex-1 flex-col px-5 pb-8">
        {error ? (
          <p className="text-sm text-red-400">{error.message}</p>
        ) : (
          <InfPublishClient
            initialAllocations={(rows as unknown as AllocationWithRelations[]) || []}
          />
        )}
      </main>
      <InfBottomNav />
    </div>
  );
}
