"use client";

import { useMemo, useState } from "react";
import { fieldClass, primaryBtnClass, secondaryBtnClass } from "@/components/ui";
import { type Company } from "@/lib/types";

export function AdminCompanyPanel({
  companies,
  compact = true,
}: {
  companies: Company[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(companies);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [contact, setContact] = useState("");
  const [aliases, setAliases] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const editing = useMemo(
    () => list.find((c) => c.id === editingId) || null,
    [list, editingId],
  );

  async function loadList() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/companies", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "회원사 조회 실패");
      setList(body.companies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원사 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) void loadList();
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setLoginId("");
    setPassword("");
    setContact("");
    setAliases("");
  }

  function startEdit(company: Company) {
    setEditingId(company.id);
    setName(company.name);
    setLoginId(company.login_id);
    setPassword("");
    setContact(company.contact || "");
    setAliases((company.aliases || []).join(", "));
    setOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        login_id: loginId,
        password,
        contact,
        aliases: aliases
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
      };
      const res = await fetch(
        editingId
          ? `/api/admin/companies/${editingId}`
          : "/api/admin/companies",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editingId && !password
              ? { ...payload, password: undefined }
              : payload,
          ),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "저장 실패");
      const next = body.company as Company;
      setList((prev) => {
        const exists = prev.some((c) => c.id === next.id);
        return exists
          ? prev.map((c) => (c.id === next.id ? next : c))
          : [...prev, next].sort((a, b) => a.name.localeCompare(b.name, "ko"));
      });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(company: Company) {
    const res = await fetch(`/api/admin/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !company.is_active }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "상태 변경 실패");
      return;
    }
    setList((prev) =>
      prev.map((c) => (c.id === company.id ? (body.company as Company) : c)),
    );
  }

  return (
    <section className="owm-panel border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      {compact ? (
        <button
          type="button"
          onClick={() => toggleOpen()}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
          aria-expanded={open}
        >
          <h2
            className="text-lg text-[var(--ink)]"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            회원사 관리
          </h2>
          <span className="text-xs font-medium text-[var(--muted)]">
            {open ? "접기 ▲" : `${list.length}곳 ▼`}
          </span>
        </button>
      ) : null}

      {open ? (
        <div className="space-y-4 border-t border-[var(--line)] px-5 pb-5 pt-4">
          <ul className="max-h-48 space-y-2 overflow-auto">
            {loading ? (
              <li className="text-sm text-[var(--muted)]">불러오는 중…</li>
            ) : list.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">등록된 회원사가 없습니다.</li>
            ) : (
              list.map((company) => (
              <li
                key={company.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{company.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {company.login_id}
                    {!company.is_active ? " · 비활성" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="text-xs text-[var(--accent)]"
                    onClick={() => startEdit(company)}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="text-xs text-[var(--muted)]"
                    onClick={() => void toggleActive(company)}
                  >
                    {company.is_active ? "비활성" : "활성"}
                  </button>
                </div>
              </li>
              ))
            )}
          </ul>

          <form onSubmit={onSubmit} className="grid gap-2">
            <p className="text-xs font-medium text-[var(--muted)]">
              {editing ? `${editing.name} 수정` : "회원사 등록"}
            </p>
            <input
              className={fieldClass}
              placeholder="표시명"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className={fieldClass}
              placeholder="로그인 아이디"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
            />
            <input
              className={fieldClass}
              type="password"
              placeholder={editing ? "비밀번호 재설정 (선택)" : "비밀번호"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!editing}
            />
            <input
              className={fieldClass}
              placeholder="담당자 연락처 (선택)"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
            <input
              className={fieldClass}
              placeholder="별칭, 쉼표로 구분"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
            />
            {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
            <div className="flex gap-2">
              <button className={primaryBtnClass} type="submit" disabled={saving}>
                {saving ? "저장 중…" : editing ? "수정 저장" : "등록"}
              </button>
              {editing ? (
                <button
                  type="button"
                  className={secondaryBtnClass}
                  onClick={resetForm}
                >
                  취소
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
