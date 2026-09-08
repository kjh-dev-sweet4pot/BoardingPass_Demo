/** 샤오홍슈 노트는 조회수 미제공이 흔함. 가정 ER로 역산. */

export const XHS_ASSUMED_ER = 0.05;

export function estimateXiaohongshuViews(input: {
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  saves?: number | null;
  shares?: number | null;
}): number {
  const measured = input.views;
  if (typeof measured === "number" && measured > 0) return Math.round(measured);

  const likes = Math.max(0, Number(input.likes) || 0);
  const comments = Math.max(0, Number(input.comments) || 0);
  const saves = Math.max(0, Number(input.saves) || 0);
  const shares = Math.max(0, Number(input.shares) || 0);
  const interact = likes + comments;
  const estimated =
    interact > 0
      ? Math.round(interact / XHS_ASSUMED_ER)
      : saves > 0
        ? Math.round(saves / XHS_ASSUMED_ER)
        : 0;
  return Math.max(estimated, likes + comments + saves + shares);
}

if (process.env.RUN_XHS_VIEWS_SELF_CHECK === "1") {
  const a = estimateXiaohongshuViews({ views: 1200, likes: 10, comments: 2 });
  const b = estimateXiaohongshuViews({ likes: 29, comments: 1, saves: 40 });
  const c = estimateXiaohongshuViews({ likes: 0, comments: 0, saves: 10 });
  if (a !== 1200) throw new Error(`measured views ${a}`);
  if (b !== 600) throw new Error(`er invert ${b}`);
  if (c !== 200) throw new Error(`saves invert ${c}`);
  console.log("xiaohongshu-views self-check ok");
}
