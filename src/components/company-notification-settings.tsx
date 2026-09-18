"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_SETTING_LABELS,
  type NotificationSettings,
} from "@/lib/company-notifications";

export function CompanyNotificationSettingsButton() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch("/api/com/notification-settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setSettings(data.settings);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [open]);

  async function toggle(key: keyof NotificationSettings) {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/com/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSaved(true);
    } catch (e) {
      setSettings(settings);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="text-[15px] font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]"
        onClick={() => setOpen(true)}
      >
        알림 설정
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-[10px] bg-[var(--surface)] p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-semibold text-[var(--ink)]">알림 메일 설정</p>
              <button
                type="button"
                className="text-sm text-[var(--muted)]"
                onClick={() => setOpen(false)}
              >
                닫기
              </button>
            </div>
            {loading ? (
              <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
            ) : (
              <div className="space-y-3">
                {(Object.keys(NOTIFICATION_SETTING_LABELS) as (keyof NotificationSettings)[]).map((key) => {
                  const label = NOTIFICATION_SETTING_LABELS[key];
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-start gap-3 rounded-[6px] border border-[var(--line)] p-3"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={settings[key]}
                        disabled={saving}
                        onChange={() => void toggle(key)}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-[var(--ink)]">{label.title}</span>
                        <span className="block text-xs text-[var(--muted)]">{label.desc}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            {error ? <p className="mt-3 text-xs text-[var(--danger)]">{error}</p> : null}
            {saved && !error ? <p className="mt-3 text-xs text-[var(--accent)]">저장했습니다.</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
