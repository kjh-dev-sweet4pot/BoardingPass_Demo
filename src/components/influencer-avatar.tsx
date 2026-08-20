"use client";

import { useState } from "react";

function sizeClass(size: "avatar" | "thumb" | "md") {
  if (size === "thumb") return "h-11 w-11 shrink-0 rounded-xl";
  if (size === "md") return "h-14 w-14 shrink-0 rounded-xl";
  return "h-[26px] w-[26px] shrink-0 rounded-full";
}

export function InfluencerAvatar({
  influencerId,
  name,
  size = "avatar",
  cacheBust = 0,
  onLoadError,
}: {
  influencerId: string;
  name?: string | null;
  size?: "avatar" | "thumb" | "md";
  cacheBust?: number;
  onLoadError?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const box = sizeClass(size);
  const src =
    cacheBust > 0
      ? `/api/admin/influencers/${influencerId}/avatar?v=${cacheBust}`
      : `/api/admin/influencers/${influencerId}/avatar`;

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-[#efe4d6] text-[10px] font-semibold text-[var(--accent)] ${box}`}
        aria-hidden
      >
        {initial}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[#efe4d6] ${box}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt={name ? `${name} 프로필` : "프로필"}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          setFailed(true);
          onLoadError?.();
        }}
      />
    </div>
  );
}
