import { InfAllocationList } from "@/components/inf-allocation-list";
import {
  type AllocationWithRelations,
  type Influencer,
} from "@/lib/types";
import {
  AppShell,
  Field,
  Notice,
  fieldClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/ui";
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
      <AppShell eyebrow="Inf" title="내 수령 상품">
        <Notice error="Supabase 환경변수가 Vercel에 없습니다. NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_ANON_KEY 를 설정한 뒤 Redeploy 하세요." />
      </AppShell>
    );
  }

  const influencerId = await getInfluencerSessionId();
  const supabase = await createClient();

  let influencer: Influencer | null = null;
  let allocations: AllocationWithRelations[] = [];
  let loadError: string | undefined;

  if (influencerId) {
    const [{ data: inf, error: infError }, { data: rows, error: allocError }] =
      await Promise.all([
        supabase
          .from("influencers")
          .select("*")
          .eq("id", influencerId)
          .maybeSingle(),
        supabase
          .from("allocations")
          .select("*, products(*), stores(*)")
          .eq("influencer_id", influencerId)
          .order("created_at", { ascending: false }),
      ]);

    if (infError || allocError) {
      loadError = infError?.message || allocError?.message;
    } else if (inf) {
      influencer = inf as Influencer;
      allocations = (rows as AllocationWithRelations[]) || [];
    }
  }

  const verified = Boolean(influencer);

  return (
    <AppShell
      eyebrow="Inf"
      title="내 수령 상품"
      actions={
        verified ? (
          <form action="/api/inf/clear" method="post">
            <button className={secondaryBtnClass} type="submit">
              다시 확인
            </button>
          </form>
        ) : undefined
      }
    >
      <Notice error={params.error || loadError} />

      {!verified ? (
        <section className="mx-auto max-w-md border border-[var(--line)] bg-[var(--surface)] p-6">
          <h2
            className="text-xl"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            본인확인
          </h2>
          <p className="mt-2 mb-6 text-sm text-[var(--muted)]">
            인스타그램 핸들을 입력하면 수령할 상품이 표시됩니다.
          </p>
          <form action="/api/inf/verify" method="post" className="grid gap-4">
            <Field label="인스타그램 핸들">
              <input
                className={fieldClass}
                name="instagram_handle"
                placeholder="@mina_beauty"
                required
              />
            </Field>
            <button className={primaryBtnClass} type="submit">
              확인
            </button>
          </form>
        </section>
      ) : (
        <InfluencerPass
          influencer={influencer!}
          allocations={allocations}
        />
      )}
    </AppShell>
  );
}

function InfluencerPass({
  influencer,
  allocations,
}: {
  influencer: Influencer;
  allocations: AllocationWithRelations[];
}) {
  return (
    <div className="space-y-6">
      <section className="border border-[var(--line)] bg-[var(--surface)] p-6">
        <p className="text-xs tracking-[0.2em] text-[var(--accent)] uppercase">
          Verified
        </p>
        <h2
          className="mt-2 text-3xl"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          {influencer.name}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          본인확인 완료. 아래 상품을 확인한 후 매장에서 수령하세요. 
        </p>
      </section>

      <InfAllocationList initialAllocations={allocations} />
    </div>
  );
}
