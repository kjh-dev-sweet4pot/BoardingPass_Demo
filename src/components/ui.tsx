import Link from "next/link";

export function AppShell({
  eyebrow,
  title,
  children,
  actions,
  wide = false,
  full = false,
  fitViewport = false,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  wide?: boolean;
  /** 뷰포트 전체 폭 사용 (운영 콘솔 등) */
  full?: boolean;
  /** 페이지 전체 스크롤 없이 뷰포트 높이에 맞춤 */
  fitViewport?: boolean;
}) {
  return (
    <main
      className={`w-full ${
        fitViewport
          ? "flex h-dvh flex-col overflow-hidden py-4"
          : "min-h-screen py-10"
      } ${
        full
          ? "mx-0 max-w-none px-4 sm:px-6 lg:px-8"
          : `mx-auto px-6 ${wide ? "max-w-6xl" : "max-w-5xl"}`
      }`}
    >
      <div
        className={`flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-4 ${
          fitViewport ? "mb-4 shrink-0" : "mb-8 pb-6"
        }`}
      >
        <div>
          <Link href="/" className="text-xs tracking-[0.22em] text-[var(--muted)] uppercase">
            Boarding Pass
          </Link>
          <p className="mt-3 text-xs tracking-[0.2em] text-[var(--accent)] uppercase">
            {eyebrow}
          </p>
          <h1
            className={`mt-2 text-[var(--ink)] ${fitViewport ? "text-3xl" : "text-4xl"}`}
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {title}
          </h1>
        </div>
        {actions}
      </div>
      {fitViewport ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      ) : (
        children
      )}
    </main>
  );
}

export function Notice({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  if (!error && !message) return null;
  return (
    <div
      className={`mb-6 border px-4 py-3 text-sm ${
        error
          ? "border-red-300 bg-red-50 text-[var(--danger)]"
          : "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
      }`}
    >
      {error || message}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

export const fieldClass =
  "h-11 border border-[var(--line)] bg-white px-3 outline-none focus:border-[var(--accent)]";

export const primaryBtnClass =
  "inline-flex h-11 items-center justify-center bg-[var(--accent)] px-5 text-sm font-medium text-white transition hover:brightness-110";

export const secondaryBtnClass =
  "inline-flex h-11 items-center justify-center border border-[var(--line)] bg-[var(--surface)] px-5 text-sm font-medium transition hover:bg-[var(--surface-hover)]";
