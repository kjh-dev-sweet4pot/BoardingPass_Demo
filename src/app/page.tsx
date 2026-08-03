import Link from "next/link";

const portals = [
  {
    href: "/inf",
    label: "Inf",
    title: "인플루언서",
    body: "인스타그램 핸들로 본인확인 후 수령 상품을 확인합니다.",
  },
  {
    href: "/admin",
    label: "Admin",
    title: "관리자",
    body: "인플루언서·상품·매장 배정을 등록하고 관리합니다.",
  },
  {
    href: "/phar",
    label: "Phar",
    title: "약사",
    body: "날짜·지점별로 매장 배정 현황을 조회합니다.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm tracking-[0.25em] text-[var(--muted)] uppercase">
        Brand Slam
      </p>
      <h1
        className="max-w-2xl text-5xl leading-tight text-[var(--ink)] sm:text-6xl"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Boarding Pass
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
       
      </p>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {portals.map((portal) => (
          <Link
            key={portal.href}
            href={portal.href}
            className="group border border-[var(--line)] bg-[var(--surface)] p-6 transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_12px_40px_rgba(20,32,26,0.08)]"
          >
            <span className="text-xs tracking-[0.2em] text-[var(--accent)] uppercase">
              {portal.label}
            </span>
            <h2
              className="mt-3 text-2xl text-[var(--ink)]"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              {portal.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {portal.body}
            </p>
            <span className="mt-6 inline-block text-sm font-medium text-[var(--accent)] group-hover:underline">
              입장 →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
