"use client";

import { useEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";
import { fieldClass, secondaryBtnClass } from "@/components/ui";
import { upcomingPlacement } from "@/lib/phar-calendar";
import { todayYmdKst } from "@/lib/inf-visit";
import type { AllocationWithRelations } from "@/lib/types";

export const PHAR_COUNTER_ROOT_ID = "phar-counter-root";

type Photo = { path: string; name: string; url: string };

export function PharFloorBox({ items }: { items: AllocationWithRelations[] }) {
  const recs = upcomingPlacement(items, todayYmdKst(), 7);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void loadPhotos();
  }, []);

  async function loadPhotos() {
    const res = await fetch("/api/phar/display-photos", { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    setPhotos(Array.isArray(j.photos) ? j.photos : []);
  }

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/phar/display-photos", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "업로드 실패");
      await loadPhotos();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setBusy(false);
    }
  }

  async function remove(path: string) {
    if (!confirm("이 사진을 삭제할까요?")) return;
    const res = await fetch(
      `/api/phar/display-photos?path=${encodeURIComponent(path)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "삭제 실패");
      return;
    }
    await loadPhotos();
  }

  return (
    <div className="shrink-0 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-wide text-[var(--ink)]">
            배치 권장
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            오늘부터 7일 수령 예정 · 앞으로 빼둘 상품
          </p>
          {recs.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">예정 상품 없음</p>
          ) : (
            <ul className="mt-2 max-h-28 space-y-1 overflow-auto">
              {recs.map((r) => (
                <li
                  key={r.name}
                  className="flex items-baseline justify-between gap-2 text-sm"
                >
                  <span className="truncate text-[var(--ink)]">{r.name}</span>
                  <span className="shrink-0 tabular-nums text-[var(--accent)]">
                    {r.qty}개 · {r.visitorCount}명
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-wide text-[var(--ink)]">
            사진 올리기
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            매대에 배치한 사진
          </p>
          <input
            className={`${fieldClass} mt-2`}
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          {err ? <p className="mt-1 text-xs text-[var(--danger)]">{err}</p> : null}
          {photos.length > 0 ? (
            <ul className="mt-2 flex gap-2 overflow-x-auto">
              {photos.map((p) => (
                <li key={p.path} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt=""
                    className="h-16 w-16 rounded-[6px] border border-[var(--line)] object-cover"
                  />
                  <button
                    type="button"
                    className="absolute right-0.5 top-0.5 rounded bg-black/55 px-1 text-[10px] text-white"
                    onClick={() => void remove(p.path)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PharHeaderActions() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFsChange() {
      const el = document.getElementById(PHAR_COUNTER_ROOT_ID);
      setIsFullscreen(Boolean(el) && document.fullscreenElement === el);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  async function toggleFullscreen() {
    const el = document.getElementById(PHAR_COUNTER_ROOT_ID);
    if (!el) return;
    try {
      if (document.fullscreenElement === el) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={signOut}>
        <input type="hidden" name="next" value="/phar/login" />
        <button className={secondaryBtnClass} type="submit">
          로그아웃
        </button>
      </form>
      <button
        type="button"
        aria-pressed={isFullscreen}
        className={secondaryBtnClass}
        onClick={() => void toggleFullscreen()}
      >
        {isFullscreen ? "전체화면 종료" : "전체화면"}
      </button>
    </div>
  );
}
