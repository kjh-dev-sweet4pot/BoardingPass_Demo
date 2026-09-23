"use client";

import { useState } from "react";

type ChatMessageRow = {
  id: string;
  sender_display_name: string | null;
  text: string | null;
  create_time: string | null;
  thread_id: string | null;
};

function fmtTime(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export function AdminGoogleChatTab() {
  const [spaceId, setSpaceId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[] | null>(null);
  const [participantCounts, setParticipantCounts] = useState<{ name: string; count: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  async function sync() {
    if (!spaceId.trim()) {
      setError("스페이스 ID를 입력하세요 (예: spaces/AAAAxxxxxxx)");
      return;
    }
    setSyncing(true);
    setError(null);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/admin/google-chat/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaceId: spaceId.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setSyncMsg(`동기화 완료 — API에서 ${json.fetched}건 조회, DB ${json.savedCount}건 저장`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  async function load() {
    if (!spaceId.trim()) {
      setError("스페이스 ID를 입력하세요 (예: spaces/AAAAxxxxxxx)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ spaceId: spaceId.trim() });
      const res = await fetch(`/api/admin/google-chat/messages?${q.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setMessages(json.messages ?? []);
      setParticipantCounts(json.participantCounts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const filtered = (messages ?? []).filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      (m.text || "").toLowerCase().includes(q) ||
      (m.sender_display_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--surface-canvas,#fbfaf8)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-4 sm:px-7">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
              Admin Exclusive (Beta)
            </span>
            <span className="text-[11px] text-[var(--muted)]">Google Chat 방 원문 수집·분석</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
            Google Chat BETA
          </h1>
        </div>
      </div>

      <div className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3 sm:px-7">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="스페이스 ID (spaces/AAAAxxxxxxx)"
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            className="w-72 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--ink)] shadow-sm placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          <button
            type="button"
            onClick={sync}
            disabled={syncing}
            className="rounded-[6px] bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {syncing ? "동기화 중…" : "전체 동기화"}
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-4 py-1.5 text-xs font-semibold text-[var(--ink)] shadow-sm transition hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            {loading ? "불러오는 중…" : "DB에서 불러오기"}
          </button>
          {messages !== null && (
            <input
              type="text"
              placeholder="내용 / 보낸 사람 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--ink)] shadow-sm placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          )}
        </div>

        {error && (
          <div className="mt-2.5 rounded-[6px] border border-red-200 bg-red-50/50 p-2 text-xs font-medium text-red-600">
            ⚠ {error}
          </div>
        )}
        {syncMsg && (
          <div className="mt-2.5 rounded-[6px] border border-emerald-200 bg-emerald-50/50 p-2 text-xs font-medium text-emerald-700">
            {syncMsg}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-7">
        {messages === null ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-[8px] border border-dashed border-[var(--line)] bg-[var(--surface)] text-center">
            <p className="text-sm font-semibold text-[var(--ink)]">스페이스 ID를 입력하고 조회하세요</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              처음이면 [전체 동기화]로 Google Chat API에서 방 전체 기록을 가져오고,
              이후엔 [DB에서 불러오기]로 저장된 원문을 다시 볼 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="lg:w-56 shrink-0 rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--muted)]">참여자별 메시지 수</p>
              <ul className="space-y-1 text-xs">
                {participantCounts.map((p) => (
                  <li key={p.name} className="flex items-center justify-between">
                    <span className="truncate text-[var(--ink)]">{p.name}</span>
                    <span className="font-semibold tabular-nums text-[var(--accent)]">{p.count}</span>
                  </li>
                ))}
                {participantCounts.length === 0 && (
                  <li className="text-[var(--muted)]">데이터 없음</li>
                )}
              </ul>
            </div>

            <div className="min-w-0 flex-1 overflow-hidden rounded-[8px] border border-[var(--line)] bg-[var(--surface)]">
              <ul className="max-h-[70vh] divide-y divide-[var(--line)] overflow-y-auto text-xs">
                {filtered.map((m) => (
                  <li key={m.id} className="px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-[var(--ink)]">
                        {m.sender_display_name || "(알 수 없음)"}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-[var(--muted)]">
                        {fmtTime(m.create_time)}
                      </span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-[var(--ink)]">{m.text || "-"}</p>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="px-3 py-6 text-center text-[var(--muted)]">메시지가 없습니다.</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
