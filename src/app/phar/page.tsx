import Link from "next/link";
import { PharListWithModal } from "@/components/phar-list-with-modal";
import { AppShell, Notice, secondaryBtnClass } from "@/components/ui";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { type AllocationWithRelations } from "@/lib/types";

export default async function PharPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
}) {
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
  const { data: allocations, error } = await supabase
    .from("allocations")
    .select("*, products(*), stores(*), influencers(*)")
    .order("created_at", { ascending: false });

  const list = (allocations as AllocationWithRelations[]) || [];

  return (
    <AppShell
      wide
      eyebrow="Phar"
      title="매장 배정 현황"
      actions={
        <Link href="/" className={secondaryBtnClass}>
          홈으로
        </Link>
      }
    >
      <Notice error={params.error || error?.message} message={params.message} />
      <PharListWithModal items={list} />
    </AppShell>
  );
}
