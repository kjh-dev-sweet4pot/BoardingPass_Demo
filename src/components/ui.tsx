import Link from "next/link";

export function AppShell({
  eyebrow,
  title,
  children,
  actions,
  wide = false,
  full = false,
  fitViewport = false,
  compactHeader = false,
  hideHeader = false,
  theme = "default",
}: {
  eyebrow?: string;
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  wide?: boolean;
  /** 뷰포트 전체 폭 사용 (운영 콘솔 등) */
  full?: boolean;
  /** 페이지 전체 스크롤 없이 뷰포트 높이에 맞춤 */
  fitViewport?: boolean;
  /** 약사 카운터와 같은 컴팩트 헤더 (스크롤은 유지) */
  compactHeader?: boolean;
  /** 상단 헤더 숨김 — 좌측 사이드바 등이 헤더 역할 */
  hideHeader?: boolean;
  /** 홈·인플루언서와 맞춘 OWM 톤 */
  theme?: "default" | "owm";
}) {
  const owm = theme === "owm";
  const denseHeader = compactHeader || fitViewport;

  const shell = (
    <main
      className={`w-full ${
        fitViewport
          ? `flex h-dvh flex-col overflow-hidden ${hideHeader ? "py-0" : "py-2.5"}`
          : denseHeader
            ? "min-h-screen py-4"
            : "min-h-screen py-10"
      } ${
        full
          ? `mx-0 max-w-none ${hideHeader ? "px-0" : "px-4 sm:px-6 lg:px-8"}`
          : `mx-auto px-6 ${wide ? "max-w-6xl" : "max-w-5xl"}`
      }`}
    >
      {hideHeader ? null : (
      <div
        className={`flex flex-wrap items-end justify-between gap-3 border-b ${
          owm ? "border-[var(--line)]/80" : "border-[var(--line)]"
        } ${
          denseHeader
            ? "mb-2.5 shrink-0 pb-2.5"
            : "mb-8 pb-6"
        }`}
      >
        <div
          className={`flex ${
            denseHeader ? "items-center gap-3" : "items-start gap-4"
          }`}
        >
          {owm ? (
            <Link
              href="/"
              className={`shrink-0 ${denseHeader ? "" : "mt-1"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/owm-logo.webp"
                alt="O.W.M"
                className={`drop-shadow-sm ${denseHeader ? "w-10" : "w-14"}`}
                draggable={false}
              />
            </Link>
          ) : null}
          {denseHeader ? (
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <Link
                  href="/"
                  className="text-xs tracking-[0.22em] uppercase text-[var(--muted)]"
                >
                  Boarding Pass
                </Link>
                <span className="text-[var(--line)]" aria-hidden>
                  ·
                </span>
                <p
                  className={`text-xs tracking-[0.2em] uppercase ${
                    owm ? "text-[#C4956A]" : "text-[var(--accent)]"
                  }`}
                >
                  {eyebrow}
                </p>
              </div>
              <h1
                className="mt-0.5 text-3xl leading-tight text-[var(--ink)]"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                {title}
              </h1>
            </div>
          ) : (
            <div>
              <Link
                href="/"
                className="text-xs tracking-[0.22em] uppercase text-[var(--muted)]"
              >
                Boarding Pass
              </Link>
              <p
                className={`mt-3 text-xs tracking-[0.2em] uppercase ${
                  owm ? "text-[#C4956A]" : "text-[var(--accent)]"
                }`}
              >
                {eyebrow}
              </p>
              <h1
                className="mt-2 text-4xl text-[var(--ink)]"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                {title}
              </h1>
            </div>
          )}
        </div>
        {actions}
      </div>
      )}
      {fitViewport ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      ) : (
        children
      )}
    </main>
  );

  // OWM: 콘텐츠 max-width 밖 좌우에도 cream 배경이 보이도록 full-bleed 래퍼
  if (owm) {
    return (
      <div
        className={`owm-theme w-full ${
          fitViewport ? "h-dvh overflow-hidden" : "min-h-screen"
        }`}
      >
        {shell}
      </div>
    );
  }

  return shell;
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
          ? "rounded-2xl border-red-200 bg-red-50 text-[var(--danger)]"
          : "rounded-2xl border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]"
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
  "owm-btn-primary inline-flex h-11 items-center justify-center bg-[var(--accent)] px-5 text-sm font-medium text-white transition hover:brightness-110";

export const secondaryBtnClass =
  "owm-btn-secondary inline-flex h-11 items-center justify-center border border-[var(--line)] bg-[var(--surface)] px-5 text-sm font-medium transition hover:bg-[var(--surface-hover)]";

export { StateBadge } from "./state-badge";
export type { StateBadgeValue } from "./state-badge";

export { ProgressCount } from "./progress-count";
export { EmptyState } from "./empty-state";
