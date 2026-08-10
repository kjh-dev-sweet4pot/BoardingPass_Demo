"use client";

import { useEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";
import { secondaryBtnClass } from "@/components/ui";

export const PHAR_COUNTER_ROOT_ID = "phar-counter-root";

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
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // 브라우저 정책·미지원 시 무시
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
