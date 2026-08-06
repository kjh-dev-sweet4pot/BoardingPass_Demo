import Link from "next/link";
import { redirect } from "next/navigation";
import { signInStore } from "@/app/actions/auth";
import {
  AppShell,
  Field,
  Notice,
  fieldClass,
  primaryBtnClass,
} from "@/components/ui";
import { getStoreSessionId } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { type Store } from "@/lib/types";

export default async function PharLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (await getStoreSessionId()) redirect("/phar");

  const params = await searchParams;
  const { configured } = getSupabaseEnv();

  if (!configured) {
    return (
      <AppShell eyebrow="Phar" title="지점 로그인">
        <Notice error="환경변수가 설정되지 않았습니다." />
      </AppShell>
    );
  }

  const supabase = await createClient();
  const { data: stores, error } = await supabase
    .from("stores")
    .select("id, name")
    .order("name", { ascending: true });

  const storeList = (stores as Pick<Store, "id" | "name">[]) || [];

  return (
    <AppShell eyebrow="Phar" title="지점 로그인">
      <Notice error={params.error || error?.message} message={params.message} />
      <div className="mx-auto max-w-md border border-[var(--line)] bg-[var(--surface)] p-6">
        <p className="mb-6 text-sm text-[var(--muted)]">
          지점을 선택한 뒤 비밀번호를 입력해주세요 ! 
        </p>
        <form action={signInStore} className="flex flex-col gap-4">
          <Field label="지점">
            <select
              className={fieldClass}
              name="store_id"
              required
              defaultValue=""
            >
              <option value="" disabled>
                지점 선택
              </option>
              {storeList.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </Field>
          {storeList.length === 0 && (
            <p className="text-xs text-[var(--danger)]">
              등록된 지점이 없습니다. 지점을 먼저 추가해 주세요.
            </p>
          )}
          <Field label="비밀번호">
            <input
              className={fieldClass}
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <button
            className={primaryBtnClass}
            type="submit"
            disabled={storeList.length === 0}
          >
            로그인
          </button>
        </form>

        <p className="mt-4 text-xs text-[var(--muted)]">
          <Link className="underline" href="/">
            홈으로
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
