export function ProgressCount({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-soft)]/60 px-3 py-1.5">
      {label ? (
        <span className="text-xs font-semibold text-[var(--accent)]">{label}</span>
      ) : null}
      <span className="tabular-nums text-sm font-semibold text-[var(--accent)]">
        {current} / {total}
      </span>
    </div>
  );
}

