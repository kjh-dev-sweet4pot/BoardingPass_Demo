import Link from "next/link";

const portals = [
  {
    href: "/inf",
    label: "Influencer",
    title: "인플루언서",
    body: "SNS 아이디로 본인확인 후 배정된 상품을 확인합니다.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/admin",
    label: "Admin",
    title: "관리자",
    body: "인플루언서·상품·매장 배정을 등록하고 관리합니다.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 6h16M4 12h16M4 18h10"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="17" cy="18" r="1.8" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    href: "/phar",
    label: "Pharmacist",
    title: "약사",
    body: "날짜·지점별로 매장 배정 현황을 조회합니다.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="4"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M12 8v8M8 12h8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <div className="owm-landing relative min-h-screen overflow-hidden">
      {/* 배경 그라디언트 레이어 */}
      <div className="owm-landing-bg" aria-hidden />
      <div className="owm-landing-blob owm-landing-blob-a" aria-hidden />
      <div className="owm-landing-blob owm-landing-blob-b" aria-hidden />
      <div className="owm-landing-blob owm-landing-blob-c" aria-hidden />
      <div className="owm-landing-grain" aria-hidden />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-14 sm:max-w-lg">
        {/* 상단 로고 */}
        <div className="flex flex-col items-center text-center owm-landing-header">
          <img
            src="/owm-logo.webp"
            alt="O.W.M 옵티마 웰니스 뮤지엄 약국"
            className="w-24 drop-shadow-[0_2px_18px_rgba(0,0,0,0.35)]"
            draggable={false}
          />
          <div className="mt-6 h-px w-10 bg-[#E8C79A]/60" />
          <p className="mt-6 text-[0.62rem] font-medium tracking-[0.32em] text-[#E8C79A]/90 uppercase">
            Boarding Pass
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-wide text-[#F7E9D5]">
            역할을 선택해주세요
          </h1>
          <p className="mt-2 text-sm tracking-wide text-[#D7B98F]/80">
            Optima Wellness Museum Pharmacy
          </p>
        </div>

        {/* 카드 목록 */}
        <div className="mt-12 space-y-4 owm-landing-cards">
          {portals.map((portal, i) => (
            <Link
              key={portal.href}
              href={portal.href}
              style={{ animationDelay: `${0.55 + i * 0.12}s` }}
              className="owm-landing-card group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/12 bg-white/8 px-5 py-5 backdrop-blur-xl transition hover:border-[#E8C79A]/50 hover:bg-white/12 active:scale-[0.98]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E8C79A]/15 text-[#F0D5AA] transition group-hover:bg-[#E8C79A]/25 group-hover:text-[#FAE9CE]">
                {portal.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.58rem] font-semibold tracking-[0.24em] text-[#D7B98F]/85 uppercase">
                  {portal.label}
                </p>
                <h2 className="mt-1 text-base font-semibold text-[#F7E9D5]">
                  {portal.title}
                </h2>
                <p className="mt-1 text-xs leading-5 text-[#D7B98F]/70">
                  {portal.body}
                </p>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className="shrink-0 text-[#E8C79A]/70 transition group-hover:translate-x-0.5 group-hover:text-[#F7E9D5]"
              >
                <path
                  d="M6 3l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          ))}
        </div>

        {/* 하단 워드마크 */}
        <div className="mt-auto pt-14 text-center owm-landing-footer">
          <p className="text-[0.55rem] tracking-[0.28em] text-[#D7B98F]/60 uppercase">
            Optima Wellness Museum Pharmacy
          </p>
        </div>
      </main>
    </div>
  );
}
