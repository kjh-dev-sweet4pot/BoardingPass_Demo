import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAdmin } from "@/app/actions/auth";
import {
  AppShell,
  Field,
  Notice,
  fieldClass,
  primaryBtnClass,
} from "@/components/ui";
import { isAdminSession } from "@/lib/session";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (await isAdminSession()) redirect("/admin");

  const params = await searchParams;

  return (
    <AppShell eyebrow="Admin" title="관리자 로그인">
      <Notice error={params.error} message={params.message} />
      <div className="mx-auto max-w-md border border-[var(--line)] bg-[var(--surface)] p-6">
        <p className="mb-6 text-sm text-[var(--muted)]">
          관리자 로그인을 해주세요 ! 
        </p>
        <form action={signInAdmin} className="flex flex-col gap-4">
          <Field label="아이디">
            <input
              className={fieldClass}
              name="username"
              type="text"
              defaultValue="admin"
              autoComplete="username"
              required
            />
          </Field>
          <Field label="비밀번호">
            <input
              className={fieldClass}
              name="password"
              type="password"
              defaultValue="admin"
              autoComplete="current-password"
              required
            />
          </Field>
          <button className={primaryBtnClass} type="submit">
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
