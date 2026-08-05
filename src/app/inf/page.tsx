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
          <p className="text-sm text-red-400">서버 설정 오류입니다. 잠시 후 다시 시도해 주세요.</p>
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

/* ─── OWM 로고 ─────────────────────────────────────────── */
function OWMLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      {/* 실제 OWM 로고 이미지 사용 */}
      <img
        src="/owm-logo.webp"
        alt="O.W.M 옵티마 웰니스 뮤지엄 약국"
        className={compact ? "w-20" : "w-52"}
        draggable={false}
      />
    </div>
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
        <header className="flex items-center justify-between px-5 pt-10 pb-4">
          <OWMLogo compact />
          <form action="/api/inf/clear" method="post">
            <button
              type="submit"
              className="rounded-full px-3 py-1.5 text-xs font-medium text-[#A07050] transition hover:bg-[#F0E6D8] active:bg-[#E8D8C8]"
            >
              로그아웃
            </button>
          </form>
        </header>
      )}
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

/* ─── 로그인 화면 ──────────────────────────────────────── */
function LoginScreen({ error }: { error?: string }) {
  return (
    <div className="flex flex-1 flex-col">
      {/* 중앙 콘텐츠 */}
      <div className="flex flex-1 flex-col items-center justify-center px-8">
        {/* OWM 로고 */}
        <div className="owm-login-logo mb-10">
          <OWMLogo />
        </div>

        {/* 구분선 */}
        <div className="owm-login-divider mb-10 h-px w-10 bg-[#C4956A]" />

        {/* 안내 문구 */}
        <div className="owm-login-title mb-8 text-center">
          <h1 className="text-[1.15rem] font-semibold tracking-wide text-[#3D1F0A]">
            SNS 아이디를 입력해주세요
          </h1>
          <p className="mt-2 text-sm tracking-wide text-[#B09070]">
            샤오홍슈 · 인스타그램 · 틱톡
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-5 w-full max-w-[320px] rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        {/* 폼 */}
        <form
          action="/api/inf/verify"
          method="post"
          className="owm-login-form w-full max-w-[320px] space-y-3"
        >
          <input
            name="instagram_handle"
            placeholder="@your_id"
            required
            autoComplete="off"
            className="w-full rounded-2xl border border-[#E8D5BE] bg-white px-5 py-4 text-sm text-[#3D1F0A] outline-none transition placeholder:text-[#C9AA88] focus:border-[#6B3B1F] focus:ring-2 focus:ring-[#6B3B1F]/10"
          />
          <button
            type="submit"
            className="w-full rounded-2xl bg-[#6B3B1F] py-4 text-sm font-semibold tracking-wide text-white transition hover:bg-[#7D4726] active:brightness-90"
          >
            확인
          </button>
        </form>
      </div>

      {/* 하단 브랜드 워드마크 */}
      <div className="pb-10 text-center">
        <p className="text-[0.58rem] tracking-[0.2em] text-[#C4956A] uppercase">
          Optima Wellness Museum Pharmacy
        </p>
      </div>
    </div>
  );
}
