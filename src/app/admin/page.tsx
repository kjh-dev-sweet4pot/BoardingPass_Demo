import { redirect } from "next/navigation";
import { createManualAllocation } from "@/app/actions/admin";
import { signOut } from "@/app/actions/auth";
import { AdminImportPanel } from "@/components/admin-import-panel";
import { PharListWithModal } from "@/components/phar-list-with-modal";
import {
  AppShell,
  Field,
  Notice,
  fieldClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/ui";
import { isAdminSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { type AllocationWithRelations, type Store } from "@/lib/types";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
}) {
  if (!(await isAdminSession())) redirect("/admin/login");

  const params = await searchParams;

  const supabase = await createClient();
  const [{ data: stores }, { data: allocations, error }] = await Promise.all([
    supabase.from("stores").select("*").order("name", { ascending: true }),
    supabase
      .from("allocations")
      .select("*, products(*), stores(*), influencers(*)")
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const list = (allocations as AllocationWithRelations[]) || [];
  const storeList = (stores as Store[]) || [];

  return (
    <AppShell
      full
      eyebrow="Admin"
      title="운영 콘솔"
      actions={
        <form action={signOut}>
          <input type="hidden" name="next" value="/" />
          <button className={secondaryBtnClass} type="submit">
            로그아웃
          </button>
        </form>
      }
    >
      <Notice error={params.error || error?.message} message={params.message} />

      <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-6 lg:sticky lg:top-6">
          <AdminImportPanel compact />

          <section className="border border-[var(--line)] bg-[var(--surface)] p-5">
            <h2
              className="text-lg"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              수동 등록
            </h2>
            <form action={createManualAllocation} className="mt-4 grid gap-3">
              <Field label="이름">
                <input 
                className={fieldClass} 
                name="name" 
                placeholder="김미나" />
              </Field>
              <Field label="SNS_handle">
                <input
                  className={fieldClass}
                  name="snsid"
                  placeholder="@velyMina"
                  required
                />
              </Field>
              <Field label="snsurl (선택)">
                <input
                  className={fieldClass}
                  name="snsurl"
                  placeholder="https://instagram.com/@velymMna..."
                />
              </Field>
              <Field label="방문 예정일">
                <input
                  className={fieldClass}
                  name="visit_date"
                  type="date"
                  required
                />
              </Field>
              <Field label="방문지점">
                <select className={fieldClass} name="store_id" required>
                  <option value="">지점 선택</option>
                  {storeList.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </Field>
              {storeList.length === 0 && (
                <p className="text-xs text-[var(--danger)]">
                  등록된 지점이 없습니다. DB 내 stores 테이블에 지점을 먼저 추가해
                  주세요.
                </p>
              )}
              <Field label="상품">
                <input
                  className={fieldClass}
                  name="product"
                  placeholder="OO뷰티 클렌징폼 2개"
                  required
                />
              </Field>
              <Field label="수량">
                <input
                  className={fieldClass}
                  name="quantity"
                  type="number"
                  min={1}
                  defaultValue={1}
                />
              </Field>
              <Field label="방문 코드 (선택)">
                <input className={fieldClass} name="visit_code" />
              </Field>
              <button
                className={primaryBtnClass}
                type="submit"
                disabled={storeList.length === 0}
              >
                등록
              </button>
            </form>
          </section>
        </aside>

        <section className="min-w-0 w-full">
          <div className="mb-4">
            <h2
              className="text-lg"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              배정 현황
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
            </p>
          </div>

          <PharListWithModal items={list} />
        </section>
      </div>
    </AppShell>
  );
}
