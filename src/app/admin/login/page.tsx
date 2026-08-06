import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAdmin } from "@/app/actions/auth";
import { Notice, fieldClass, primaryBtnClass } from "@/components/ui";
import { isAdminSession } from "@/lib/session";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (await isAdminSession()) redirect("/admin");

  const params = await searchParams;

  return (
    <div className="owm-theme flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-8">
        <div className="owm-login-logo mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/owm-logo.webp"
            alt="O.W.M 옵티마 웰니스 뮤지엄 약국"
            className="w-40"
            draggable={false}
          />
        </div>

        <div className="owm-login-divider mb-10 h-px w-10 bg-[#C4956A]" />

        <div className="owm-login-title mb-8 text-center">
          <p className="text-[0.62rem] font-medium tracking-[0.28em] text-[#C4956A] uppercase">
            Admin
          </p>
          <h1 className="mt-3 text-[1.15rem] font-semibold tracking-wide text-[#3D1F0A]">
            관리자 로그인
          </h1>
          <p className="mt-2 text-sm tracking-wide text-[#B09070]">
            관리자 로그인을 해주세요!
          </p>
        </div>

        {params.error || params.message ? (
          <div className="mb-5 w-full max-w-[360px]">
            <Notice error={params.error} message={params.message} />
          </div>
        ) : null}

        <form
          action={signInAdmin}
          className="owm-login-form w-full max-w-[360px] space-y-3"
        >
          <input
            className={`${fieldClass} h-auto w-full rounded-2xl border-[#E8D5BE] px-5 py-4 text-sm text-[#3D1F0A] placeholder:text-[#C9AA88] focus:border-[#6B3B1F] focus:ring-2 focus:ring-[#6B3B1F]/10`}
            name="username"
            type="text"
            defaultValue="admin"
            autoComplete="username"
            placeholder="아이디"
            required
          />
          <input
            className={`${fieldClass} h-auto w-full rounded-2xl border-[#E8D5BE] px-5 py-4 text-sm text-[#3D1F0A] placeholder:text-[#C9AA88] focus:border-[#6B3B1F] focus:ring-2 focus:ring-[#6B3B1F]/10`}
            name="password"
            type="password"
            defaultValue="admin"
            autoComplete="current-password"
            placeholder="비밀번호"
            required
          />
          <button
            className={`${primaryBtnClass} h-auto w-full rounded-2xl bg-[#6B3B1F] py-4 text-sm font-semibold tracking-wide hover:bg-[#7D4726]`}
            type="submit"
          >
            로그인
          </button>
        </form>

        <p className="mt-6 text-xs text-[#B09070]">
          <Link className="underline underline-offset-2" href="/">
            홈으로
          </Link>
        </p>
      </div>

      <div className="pb-10 text-center">
        <p className="text-[0.58rem] tracking-[0.2em] text-[#C4956A] uppercase">
          Optima Wellness Museum Pharmacy
        </p>
      </div>
    </div>
  );
}
