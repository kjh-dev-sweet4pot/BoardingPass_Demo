export function EmptyState({
  title,
  message,
  positive = false,
}: {
  title: string;
  message?: string;
  /** 긍정형(예: 처리 대기 0건은 정상 상태) */
  positive?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--line)] px-6 py-10 text-center ${
        positive ? "bg-[var(--accent-soft)]/40" : "bg-[var(--surface)]"
      }`}
    >
      <p className={`text-base font-semibold ${positive ? "text-[var(--accent)]" : "text-[var(--ink)]"}`}>
        {title}
      </p>
      {message ? (
        <p className="mt-2 text-sm text-[var(--muted)]">{message}</p>
      ) : null}
    </div>
  );
}

