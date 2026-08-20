"use client";

import { useEffect, useMemo, useState } from "react";
import {
  creatorAvatarCandidates,
  type PoolCreator,
} from "@/lib/creator-pool-mock";

export type CreatorPhotoSize = "card" | "detail" | "avatar" | "thumb";

function sizeClass(size: CreatorPhotoSize) {
  if (size === "detail") return "h-28 w-28 rounded-2xl";
  if (size === "avatar") return "h-[26px] w-[26px] shrink-0 rounded-full";
  if (size === "thumb") return "h-11 w-11 shrink-0 rounded-xl";
  return "aspect-square w-full rounded-xl";
}

/** 크리에이터 탭 카드와 동일한 SNS 사진 후보·fallback */
export function CreatorPhoto({
  creator,
  size = "card",
}: {
  creator: PoolCreator;
  size?: CreatorPhotoSize;
}) {
  const candidates = useMemo(
    () => creatorAvatarCandidates(creator),
    [creator.id, creator.handle, creator.posts.length],
  );
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setIdx(0);
    setFailed(false);
  }, [creator.id, creator.handle, creator.posts.length]);

  const exhausted = candidates.length === 0 || failed;
  const src = exhausted
    ? null
    : candidates[Math.min(idx, candidates.length - 1)];
  const box = sizeClass(size);
  const compact = size === "avatar" || size === "thumb";

  return (
    <div className={`relative overflow-hidden bg-[#efe4d6] ${box}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={`${creator.name} SNS`}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            setIdx((i) => {
              const next = i + 1;
              if (next >= candidates.length) {
                setFailed(true);
                return i;
              }
              return next;
            });
          }}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center text-center ${
            compact ? "px-0.5" : "flex-col gap-1 px-2"
          }`}
        >
          {compact ? (
            <span className="text-[8px] font-semibold text-[var(--accent)]">SNS</span>
          ) : (
            <>
              <p className="text-xs font-semibold text-[var(--accent)]">SNS</p>
              <p className="line-clamp-2 text-[10px] text-[var(--muted)]">
                {creator.handle}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
