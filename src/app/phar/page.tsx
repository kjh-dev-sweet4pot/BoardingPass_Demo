import Link from "next/link";
import {
  AppShell,
  Notice,
  secondaryBtnClass,
} from "@/components/ui";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  ALLOCATION_STATUS_LABEL,
  type AllocationWithRelations,
} from "@/lib/types";

export default async function PharPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const { configured } = getSupabaseEnv();

  if (!configured) {
    return (
      <AppShell eyebrow="Phar" title="매장 배정 현황">
        <Notice error="Supabase 환경변수가 설정되지 않았습니다." />
      </AppShell>
    );
  }

  const supabase = await createClient();
  const { data: allocations, error } = await supabase
    .from("allocations")
    .select("*, products(*), stores(*), influencers(*)")
    .order("created_at", { ascending: false });

  const list = (allocations as AllocationWithRelations[]) || [];

  return (
    <AppShell
      eyebrow="Phar"
      title="매장 배정 현황"
      actions={
        <Link href="/" className={secondaryBtnClass}>
          홈으로
        </Link>
      }
    >
      <Notice error={params.error || error?.message} message={params.message} />
      <p className="mb-6 text-sm text-[var(--muted)]">
        로그인 없이 배정 현황을 조회합니다. 반출 확정은 다음 단계에서
        추가합니다.
      </p>

      <ul className="space-y-3">
        {list.length === 0 && (
          <li className="text-sm text-[var(--muted)]">표시할 배정이 없습니다.</li>
        )}
        {list.map((item) => (
          <li
            key={item.id}
            className="grid gap-2 border border-[var(--line)] bg-[var(--surface)] p-5 md:grid-cols-[1fr_auto]"
          >
            <div>
              <p className="text-lg font-medium">
                {item.influencers?.name || "인플루언서"} ·{" "}
                {item.products?.name || "상품"}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {item.stores?.name || "매장"} · 수량 {item.quantity}
                {item.visit_code ? ` · code ${item.visit_code}` : ""}
              </p>
            </div>
            <div className="text-sm text-[var(--accent)]">
              {ALLOCATION_STATUS_LABEL[item.status]}
            </div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
