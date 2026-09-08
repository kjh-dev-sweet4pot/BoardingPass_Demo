"use client";

import { useEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";
import { fieldClass, primaryBtnClass, secondaryBtnClass } from "@/components/ui";
import { upcomingPlacement } from "@/lib/phar-calendar";
import { todayYmdKst } from "@/lib/inf-visit";
import type { AllocationWithRelations } from "@/lib/types";

export const PHAR_COUNTER_ROOT_ID = "phar-counter-root";

type Photo = { path: string; name: string; url: string };
type Modal = "guide" | "photos" | null;

export function PharHeaderActions() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [recs, setRecs] = useState<{ name: string; qty: number; visitorCount: number }[]>(
    [],
  );
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  async function openGuide() {
    setModal("guide");
    setErr(null);
    try {
      const res = await fetch("/api/phar/allocations", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      const items = (j.allocations || []) as AllocationWithRelations[];
      setRecs(upcomingPlacement(items, todayYmdKst(), 7));
    } catch {
      setRecs([]);
    }
  }

  async function loadPhotos() {
    const res = await fetch("/api/phar/display-photos", { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    setPhotos(Array.isArray(j.photos) ? j.photos : []);
  }

  async function openPhotos() {
    setModal("photos");
    setErr(null);
    await loadPhotos();
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
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={secondaryBtnClass} onClick={() => void openGuide()}>
        배치 권장
      </button>
      <button type="button" className={secondaryBtnClass} onClick={() => void openPhotos()}>
        사진 올리기
      </button>
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

      {modal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--ink)]">
                {modal === "guide" ? "배치 권장" : "배치된 사진"}
              </h2>
              <button
                type="button"
                className="text-sm text-[var(--muted)]"
                onClick={() => setModal(null)}
              >
                닫기
              </button>
            </div>

            {modal === "guide" ? (
              recs.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  앞으로 7일 안에 수령 예정인 상품이 없습니다.
                </p>
              ) : (
                <ul className="space-y-2">
                  <p className="text-[12px] text-[var(--muted)]">
                    오늘부터 7일 수령 예정 · 앞으로 빼둘 상품
                  </p>
                  {recs.map((r) => (
                    <li
                      key={r.name}
                      className="flex items-baseline justify-between gap-3 rounded-[6px] border border-[var(--line)] px-3 py-2"
                    >
                      <span className="text-sm font-medium text-[var(--ink)]">{r.name}</span>
                      <span className="shrink-0 text-sm tabular-nums text-[var(--accent)]">
                        {r.qty}개 · {r.visitorCount}명
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <div className="space-y-3">
                <p className="text-[12px] text-[var(--muted)]">
                  매대에 배치한 사진을 올리면 지점 PC에서 다시 볼 수 있습니다.
                </p>
                <input
                  className={fieldClass}
                  type="file"
                  accept="image/*"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(f);
                    e.target.value = "";
                  }}
                />
                {err ? <p className="text-sm text-[var(--danger)]">{err}</p> : null}
                {busy ? <p className="text-sm text-[var(--muted)]">올리는 중…</p> : null}
                {photos.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">올린 사진이 없습니다.</p>
                ) : (
                  <ul className="grid grid-cols-2 gap-2">
                    {photos.map((p) => (
                      <li key={p.path} className="overflow-hidden rounded-[6px] border border-[var(--line)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt="" className="h-32 w-full object-cover" />
                        <button
                          type="button"
                          className="w-full py-1 text-xs text-[var(--danger)]"
                          onClick={() => void remove(p.path)}
                        >
                          삭제
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <button
              type="button"
              className={`${primaryBtnClass} mt-4 w-full`}
              onClick={() => setModal(null)}
            >
              확인
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
