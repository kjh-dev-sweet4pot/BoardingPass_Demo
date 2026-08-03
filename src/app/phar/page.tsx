import Link from "next/link";
import { PharListWithModal } from "@/components/phar-list-with-modal";
import {
  AppShell,
  Field,
  Notice,
  fieldClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/ui";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  type AllocationWithRelations,
  type Store,
} from "@/lib/types";

function dayRangeUtc(dateYmd: string) {
  const start = new Date(`${dateYmd}T00:00:00+09:00`);
  const end = new Date(`${dateYmd}T23:59:59.999+09:00`);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function PharPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
    date?: string;
    store?: string;
  }>;
}) {
  const params = await searchParams;
  const { configured } = getSupabaseEnv();

  if (!configured) {
    return (
      <AppShell eyebrow="Phar" title="매장 배정 현황">
        <Notice error="ERR ENV..." />
      </AppShell>
    );
  }

  const selectedDate = (params.date || "").trim();
  const selectedStore = (params.store || "").trim();

  const supabase = await createClient();
  const { data: stores } = await supabase
    .from("stores")
    .select("*")
    .order("name", { ascending: true });

  let query = supabase
    .from("allocations")
    .select("*, products(*), stores(*), influencers(*)")
    .order("created_at", { ascending: false });

  if (selectedStore) {
    query = query.eq("store_id", selectedStore);
  }

  if (selectedDate) {
    const { start, end } = dayRangeUtc(selectedDate);
    query = query.gte("created_at", start).lte("created_at", end);
  }

  const { data: allocations, error } = await query;
  const list = (allocations as AllocationWithRelations[]) || [];
  const storeList = (stores as Store[]) || [];

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

      <form
        method="get"
        action="/phar"
        className="mb-8 grid gap-4 border border-[var(--line)] bg-[var(--surface)] p-5 md:grid-cols-[1fr_1fr_auto_auto] md:items-end"
      >
        <Field label="날짜">
          <input
            className={fieldClass}
            type="date"
            name="date"
            defaultValue={selectedDate}
          />
        </Field>
        <Field label="지점">
          <select
            className={fieldClass}
            name="store"
            defaultValue={selectedStore}
          >
            <option value="">전체 지점</option>
            {storeList.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </Field>
        <button className={primaryBtnClass} type="submit">
          조회
        </button>
        <Link href="/phar" className={`${secondaryBtnClass} text-center`}>
          초기화
        </Link>
      </form>

      <p className="mb-4 text-sm text-[var(--muted)]">
        {selectedDate ? `${selectedDate} · ` : "전체 날짜 · "}
        {selectedStore
          ? storeList.find((s) => s.id === selectedStore)?.name || "선택 지점"
          : "전체 지점"}
        {" · "}
        {list.length}건
      </p>

      <PharListWithModal items={list} />
    </AppShell>
  );
}
