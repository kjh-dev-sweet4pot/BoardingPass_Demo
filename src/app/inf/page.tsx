import { InfAllocationList } from "@/components/inf-allocation-list";
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
      <MobileShell showHeader={false}>
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-[#e55]">서버 설정 오류입니다. 잠시 후 다시 시도해 주세요.</p>
        </div>
      </MobileShell>
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
        supabase.from("influencers").select("*").eq("id", influencerId).maybeSingle(),
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

  if (!verified) {
    return (
      <MobileShell showHeader={false}>
        <LoginScreen error={params.error || loadError} />
      </MobileShell>
    );
  }

  return (
    <MobileShell showHeader>
      <InfAllocationList influencer={influencer!} initialAllocations={allocations} />
    </MobileShell>
  );
}

/* ─── Shell ─────────────────────────────────────────── */
function MobileShell({
  showHeader,
  children,
}: {
  showHeader: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {showHeader && (
        <header className="flex items-center justify-between px-5 pt-12 pb-4">
          <span className="text-sm font-bold tracking-wide text-[#7c6ef5]">
            OWM
          </span>
        </header>
      )}
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

/* ─── 로그인 화면 ──────────────────────────────────────── */
function LoginScreen({ error }: { error?: string }) {
  return (
    <div className="flex flex-1 flex-col px-6">
      {/* 상단 헤더 영역 */}
      <div className="pt-14 pb-10">
        <p className="mb-2 text-xs font-semibold tracking-widest text-[#7c6ef5] uppercase">
          Inf.
        </p>
        <h1 className="text-[1.75rem] font-bold leading-snug text-[#1a1a2e]">
          인스타그램 아이디를<br />입력해주세요
        </h1>
        <p className="mt-2 text-sm text-[#999]">
          입력한 계정으로 수령 가능한 상품을 확인합니다.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <form action="/api/inf/verify" method="post" className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#333]">
            Instagram ID
          </label>
          <input
            name="instagram_handle"
            placeholder="@mina_beauty"
            required
            autoComplete="off"
            className="w-full rounded-2xl border border-[#e8e8e8] bg-[#f9f9f9] px-4 py-4 text-sm text-[#1a1a2e] outline-none transition placeholder:text-[#bbb] focus:border-[#7c6ef5] focus:bg-white focus:ring-2 focus:ring-[#7c6ef5]/20"
          />
          <p className="mt-1.5 text-xs text-[#bbb]">%) @mina_beauty</p>
        </div>

        <button
          type="submit"
          className="w-full rounded-2xl bg-[#7c6ef5] py-4 text-sm font-semibold text-white transition active:brightness-90"
        >
          확인
        </button>
      </form>
    </div>
  );
}
