"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type SpreadsheetColumn<T> = {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "right" | "center";
  render: (row: T) => React.ReactNode;
  /** 지정하면 셀 클릭으로 바로 수정할 수 있다. */
  edit?: {
    kind: "text" | "number" | "select";
    options?: string[];
    /** 편집 시작 시 입력창에 채울 값 */
    getValue: (row: T) => string;
    /** 수정 후 값(원본 문자열)을 화면에 보여줄 때 쓸 포맷 — 생략하면 입력값 그대로 */
    formatValue?: (raw: string) => string;
  };
};

export type SpreadsheetTableHandle = {
  isDirty: () => boolean;
  /** dirty하면 저장 확인 다이얼로그를 띄운다. 저장 없이 나가도 되면 proceed()를 바로 호출한다. */
  confirmLeave: (proceed: () => void) => void;
};

/** 한 탭에 편집 가능한 표가 여러 개일 때 하나의 handle로 합쳐서 쓴다 (dirty한 표부터 순서대로 확인). */
export function combineSpreadsheetHandles(
  ...handles: (SpreadsheetTableHandle | null)[]
): SpreadsheetTableHandle {
  return {
    isDirty: () => handles.some((h) => h?.isDirty()),
    confirmLeave: (proceed) => {
      const dirty = handles.filter((h): h is SpreadsheetTableHandle => !!h?.isDirty());
      function next(i: number) {
        if (i >= dirty.length) return proceed();
        dirty[i].confirmLeave(() => next(i + 1));
      }
      next(0);
    },
  };
}

const ALIGN_CLASS = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

const DEFAULT_WIDTH = 140;
const MIN_WIDTH = 56;

function loadPrefs(storageKey: string) {
  try {
    const raw = localStorage.getItem(`spreadsheet:${storageKey}`);
    if (!raw) return null;
    return JSON.parse(raw) as { hidden?: string[]; widths?: Record<string, number> };
  } catch {
    return null;
  }
}

function savePrefs(storageKey: string, hidden: Set<string>, widths: Record<string, number>) {
  try {
    localStorage.setItem(`spreadsheet:${storageKey}`, JSON.stringify({ hidden: [...hidden], widths }));
  } catch {
    // 프라이빗 모드 등 저장 실패는 무시 — 이번 세션에서만 적용된다.
  }
}

function SpreadsheetTableInner<T>(
  {
    storageKey,
    columns,
    rows,
    rowKey,
    rowLabel,
    onRowClick,
    onSave,
    emptyText = "데이터가 없습니다.",
  }: {
    storageKey: string;
    columns: SpreadsheetColumn<T>[];
    rows: T[];
    rowKey: (row: T) => string;
    /** 저장 확인 다이얼로그에 보여줄 행 이름 (기본: rowKey) */
    rowLabel?: (row: T) => string;
    onRowClick?: (row: T) => void;
    /** 편집 가능한 컬럼이 하나라도 있으면 필수 — 변경분을 저장한다. */
    onSave?: (edits: { row: T; rowKey: string; values: Record<string, string> }[]) => Promise<void>;
    emptyText?: string;
  },
  ref: React.ForwardedRef<SpreadsheetTableHandle>,
) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const dragRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const [editingCell, setEditingCell] = useState<{ rowKey: string; columnKey: string } | null>(null);
  const [drafts, setDrafts] = useState<Map<string, Record<string, string>>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [leavePrompt, setLeavePrompt] = useState<null | { proceed: () => void; showList: boolean }>(null);

  useEffect(() => {
    const prefs = loadPrefs(storageKey);
    if (!prefs) return;
    if (Array.isArray(prefs.hidden)) setHidden(new Set(prefs.hidden));
    if (prefs.widths && typeof prefs.widths === "object") setWidths(prefs.widths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const isDirty = drafts.size > 0;

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function pendingEdits() {
    return [...drafts.entries()].map(([rk, values]) => {
      const row = rows.find((r) => rowKey(r) === rk)!;
      return { row, rowKey: rk, values };
    });
  }

  async function save(): Promise<boolean> {
    if (!onSave || drafts.size === 0) return true;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(pendingEdits());
      setDrafts(new Map());
      setLeavePrompt(null);
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  useImperativeHandle(ref, () => ({
    isDirty: () => isDirty,
    confirmLeave: (proceed) => {
      if (!isDirty) {
        proceed();
        return;
      }
      setLeavePrompt({ proceed, showList: false });
    },
  }));

  function toggleColumn(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      savePrefs(storageKey, next, widths);
      return next;
    });
  }

  function widthOf(key: string) {
    return widths[key] ?? columns.find((c) => c.key === key)?.width ?? DEFAULT_WIDTH;
  }

  function onResizeStart(e: React.MouseEvent, key: string) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { key, startX: e.clientX, startWidth: widthOf(key) };
    window.addEventListener("mousemove", onResizeMove);
    window.addEventListener("mouseup", onResizeEnd);
  }
  function onResizeMove(e: MouseEvent) {
    const d = dragRef.current;
    if (!d) return;
    const next = Math.max(MIN_WIDTH, d.startWidth + (e.clientX - d.startX));
    setWidths((prev) => ({ ...prev, [d.key]: next }));
  }
  function onResizeEnd() {
    window.removeEventListener("mousemove", onResizeMove);
    window.removeEventListener("mouseup", onResizeEnd);
    setWidths((prev) => {
      savePrefs(storageKey, hidden, prev);
      return prev;
    });
    dragRef.current = null;
  }

  function draftValue(row: T, col: SpreadsheetColumn<T>) {
    const rk = rowKey(row);
    return drafts.get(rk)?.[col.key] ?? col.edit?.getValue(row) ?? "";
  }

  function commitEdit(row: T, col: SpreadsheetColumn<T>, value: string) {
    const rk = rowKey(row);
    const original = col.edit?.getValue(row) ?? "";
    setDrafts((prev) => {
      const next = new Map(prev);
      const rowDrafts = { ...(next.get(rk) ?? {}) };
      if (value === original) {
        delete rowDrafts[col.key];
      } else {
        rowDrafts[col.key] = value;
      }
      if (Object.keys(rowDrafts).length === 0) next.delete(rk);
      else next.set(rk, rowDrafts);
      return next;
    });
  }

  const visible = columns.filter((c) => !hidden.has(c.key));
  const dirtyCount = drafts.size;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-2">
        {onSave ? (
          <>
            {saveError ? <p className="text-xs text-red-600">{saveError}</p> : null}
            <button
              type="button"
              disabled={!isDirty || saving}
              onClick={() => void save()}
              className="rounded-[6px] bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
            >
              {saving ? "저장 중…" : dirtyCount > 0 ? `저장 (${dirtyCount})` : "저장"}
            </button>
          </>
        ) : null}
        <div className="relative">
          <button
            type="button"
            className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            onClick={() => setMenuOpen((v) => !v)}
          >
            컬럼 {visible.length}/{columns.length}
          </button>
          {menuOpen ? (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 max-h-72 w-52 overflow-auto rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-2 shadow-md">
                {columns.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 rounded-[4px] px-1 py-1 text-xs hover:bg-[var(--surface-hover)]">
                    <input type="checkbox" checked={!hidden.has(c.key)} onChange={() => toggleColumn(c.key)} />
                    {c.label}
                  </label>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 overflow-auto rounded-[8px] border border-[var(--line)]">
        <table
          className="border-collapse text-sm"
          style={{ tableLayout: "fixed", width: visible.reduce((s, c) => s + widthOf(c.key), 0) }}
        >
          <colgroup>
            {visible.map((c) => (
              <col key={c.key} style={{ width: widthOf(c.key) }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-[1] bg-[var(--surface)] text-[var(--muted)]">
            <tr>
              {visible.map((c) => (
                <th
                  key={c.key}
                  className={`relative select-none border border-[var(--line)] px-3 py-2 ${ALIGN_CLASS[c.align ?? "left"]}`}
                >
                  <span className="block truncate">{c.label}</span>
                  <div
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-[var(--accent-soft)]"
                    onMouseDown={(e) => onResizeStart(e, c.key)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const rk = rowKey(row);
              return (
                <tr
                  key={rk}
                  className={`${onRowClick ? "cursor-pointer hover:bg-[var(--surface-hover)]" : ""} ${
                    i % 2 === 1 ? "bg-[var(--surface-hover)]/40" : ""
                  }`}
                  onClick={() => {
                    if (!onRowClick) return;
                    if (isDirty) setLeavePrompt({ proceed: () => onRowClick(row), showList: false });
                    else onRowClick(row);
                  }}
                >
                  {visible.map((c) => {
                    const isEditing = editingCell?.rowKey === rk && editingCell.columnKey === c.key;
                    const isDirtyCell = drafts.get(rk)?.[c.key] !== undefined;
                    if (c.edit && isEditing) {
                      const value = draftValue(row, c);
                      const commonProps = {
                        autoFocus: true,
                        className:
                          "w-full border border-[var(--accent)] bg-[var(--surface)] px-1 py-0.5 text-sm outline-none",
                        onClick: (e: React.MouseEvent) => e.stopPropagation(),
                        onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
                          commitEdit(row, c, e.target.value);
                          setEditingCell(null);
                        },
                        onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
                          if (e.key === "Enter") (e.target as HTMLElement).blur();
                          if (e.key === "Escape") setEditingCell(null);
                        },
                      };
                      return (
                        <td key={c.key} className="border border-[var(--line)] p-0">
                          {c.edit.kind === "select" ? (
                            <select
                              defaultValue={value}
                              {...commonProps}
                              onChange={(e) => {
                                commitEdit(row, c, e.target.value);
                                setEditingCell(null);
                              }}
                            >
                              {(c.edit.options ?? []).map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={c.edit.kind === "number" ? "number" : "text"}
                              defaultValue={value}
                              {...commonProps}
                            />
                          )}
                        </td>
                      );
                    }
                    const draft = drafts.get(rk)?.[c.key];
                    return (
                      <td
                        key={c.key}
                        className={`overflow-hidden text-ellipsis whitespace-nowrap border border-[var(--line)] px-3 py-1.5 tabular-nums ${
                          ALIGN_CLASS[c.align ?? "left"]
                        } ${isDirtyCell ? "bg-[var(--accent-soft)]" : ""}`}
                      >
                        <span className="inline-flex w-full items-center gap-1">
                          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis">
                            {isDirtyCell && draft !== undefined ? (
                              <span className="whitespace-nowrap">
                                <span className="text-[var(--muted)] line-through">{c.render(row)}</span>
                                <span className="mx-1">→</span>
                                <span className="font-semibold text-red-600">
                                  {c.edit?.formatValue ? c.edit.formatValue(draft) : draft}
                                </span>
                              </span>
                            ) : (
                              c.render(row)
                            )}
                          </span>
                          {c.edit ? (
                            <button
                              type="button"
                              aria-label={`${c.label} 수정`}
                              title="수정"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCell({ rowKey: rk, columnKey: c.key });
                              }}
                              className="shrink-0 rounded p-0.5 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--accent)]"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-3.5 w-3.5"
                              >
                                <path d="M14.69 2.98a1.75 1.75 0 0 1 2.475 2.475l-.97.97-2.475-2.475.97-.97Z" />
                                <path d="M12.664 4.007 3.75 12.92a1.75 1.75 0 0 0-.46.813l-.68 2.858a.5.5 0 0 0 .6.6l2.858-.68a1.75 1.75 0 0 0 .813-.46l8.913-8.913-2.475-2.475Z" />
                              </svg>
                            </button>
                          ) : null}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-4 text-center text-sm text-[var(--muted)]">{emptyText}</p>
        ) : null}
      </div>

      {leavePrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-[10px] bg-[var(--surface)] p-5 shadow-lg">
            <p className="font-semibold text-[var(--ink)]">저장하지 않은 항목이 있습니다</p>
            <button
              type="button"
              className="mt-1 text-xs text-[var(--accent)] underline"
              onClick={() => setLeavePrompt((p) => (p ? { ...p, showList: !p.showList } : p))}
            >
              {leavePrompt.showList ? "숨기기" : "저장하지 않은 항목 보여주기"}
            </button>
            {leavePrompt.showList ? (
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto rounded-[6px] border border-[var(--line)] p-2 text-xs text-[var(--muted)]">
                {pendingEdits().map(({ row, rowKey: rk, values }) =>
                  Object.entries(values).map(([colKey, value]) => {
                    const col = columns.find((c) => c.key === colKey);
                    const before = col?.edit?.getValue(row) ?? "";
                    const after = col?.edit?.formatValue ? col.edit.formatValue(value) : value;
                    return (
                      <li key={`${rk}-${colKey}`}>
                        {rowLabel?.(row) ?? rk} · {col?.label ?? colKey}: {before} → {after}
                      </li>
                    );
                  }),
                )}
              </ul>
            ) : null}
            {saveError ? <p className="mt-2 text-xs text-red-600">{saveError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-[6px] border border-[var(--line)] px-3 py-1.5 text-sm"
                onClick={() => setLeavePrompt(null)}
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                className="rounded-[6px] bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                onClick={async () => {
                  const proceed = leavePrompt.proceed;
                  if (await save()) proceed();
                }}
              >
                {saving ? "저장 중…" : "저장하기"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const SpreadsheetTable = forwardRef(SpreadsheetTableInner) as <T>(
  props: {
    storageKey: string;
    columns: SpreadsheetColumn<T>[];
    rows: T[];
    rowKey: (row: T) => string;
    rowLabel?: (row: T) => string;
    onRowClick?: (row: T) => void;
    onSave?: (edits: { row: T; rowKey: string; values: Record<string, string> }[]) => Promise<void>;
    emptyText?: string;
  } & { ref?: React.ForwardedRef<SpreadsheetTableHandle> },
) => ReturnType<typeof SpreadsheetTableInner>;
