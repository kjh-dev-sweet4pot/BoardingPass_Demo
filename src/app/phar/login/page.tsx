import Link from "next/link";
import { redirect } from "next/navigation";
import { signInStore } from "@/app/actions/auth";
import { Notice, fieldClass, primaryBtnClass } from "@/components/ui";
import { getStoreSessionId } from "@/lib/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { type Store } from "@/lib/types";

const inputClass = `${fieldClass} h-auto w-full rounded-2xl border-[#E8D5BE] px-5 py-4 text-sm text-[#3D1F0A] placeholder:text-[#C9AA88] focus:border-[#6B3B1F] focus:ring-2 focus:ring-[#6B3B1F]/10`;

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
      <div className="owm-theme flex min-h-screen flex-col items-center justify-center px-8">
        <Notice error="환경변수가 설정되지 않았습니다." />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: stores, error } = await supabase
    .from("stores")
    .select("id, name")
    .order("name", { ascending: true });

  const storeList = (stores as Pick<Store, "id" | "name">[]) || [];
  const noticeError = params.error || error?.message;

  return (
    <div className="owm-theme flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-8">
        <div className="owm-login-logo mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/owm-logo.webp"
            alt="O.W.M 옵티마 웰니스 뮤"
            className="w-40"
            draggable={false}
          />
        </div>

        <div className="owm-login-divider mb-10 h-px w-10 bg-[#C4956A]" />

        <div className="owm-login-title mb-8 text-center">
          <p className="text-[0.62rem] font-medium tracking-[0.28em] text-[#C4956A] uppercase">
            Pharmacist
          </p>
          <h1 className="mt-3 text-[1.15rem] font-semibold tracking-wide text-[#3D1F0A]">
            지점 로그인
          </h1>
          <p className="mt-2 text-sm tracking-wide text-[#B09070]">
            지점을 선택한 뒤 비밀번호를 입력해 주세요
          </p>
        </div>

        {noticeError || params.message ? (
          <div className="mb-5 w-full max-w-[360px]">
            <Notice error={noticeError} message={params.message} />
          </div>
        ) : null}

        <form
          action={signInStore}
          className="owm-login-form w-full max-w-[360px] space-y-3"
        >
          <select
            className={inputClass}
            name="store_id"
            required
            defaultValue=""
            aria-label="지점"
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
          {storeList.length === 0 ? (
            <p className="text-xs text-[#9B2C2C]">
              등록된 지점이 없습니다. 지점을 먼저 추가해 주세요.
            </p>
          ) : null}
          <input
            className={inputClass}
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호"
            required
          />
          <button
            className={`${primaryBtnClass} h-auto w-full rounded-2xl bg-[#6B3B1F] py-4 text-sm font-semibold tracking-wide hover:bg-[#7D4726] disabled:opacity-50`}
            type="submit"
            disabled={storeList.length === 0}
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
