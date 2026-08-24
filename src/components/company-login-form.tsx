"use client";

import { useFormStatus } from "react-dom";
import { signInCompany } from "@/app/actions/auth";
import { fieldClass, primaryBtnClass } from "@/components/ui";

const inputClass = `${fieldClass} h-auto w-full rounded-2xl border-[#E8D5BE] px-5 py-4 text-sm text-[#3D1F0A] placeholder:text-[#C9AA88] focus:border-[#6B3B1F] focus:ring-2 focus:ring-[#6B3B1F]/10 disabled:opacity-60`;

function Fields() {
  const { pending } = useFormStatus();
  return (
    <div className={`space-y-3 transition ${pending ? "opacity-70" : ""}`}>
      <input
        className={inputClass}
        name="login_id"
        type="text"
        autoComplete="username"
        placeholder="아이디"
        required
        disabled={pending}
      />
      <input
        className={inputClass}
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="비밀번호"
        required
        disabled={pending}
      />
      <button
        className={`${primaryBtnClass} h-auto w-full rounded-2xl bg-[#6B3B1F] py-4 text-sm font-semibold tracking-wide hover:bg-[#7D4726] disabled:cursor-wait disabled:opacity-90`}
        type="submit"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden
            />
            로그인 중…
          </span>
        ) : (
          "로그인"
        )}
      </button>
      {pending ? (
        <p className="text-center text-xs tracking-wide text-[#B09070]">
          잠시만 기다려 주세요
        </p>
      ) : null}
    </div>
  );
}

export function CompanyLoginForm() {
  return (
    <form action={signInCompany} className="owm-login-form w-full max-w-[360px]">
      <Fields />
    </form>
  );
}
