/** 샤오홍슈 노트는 조회수 미제공이 흔함. 좋아요율로 역산. */

/** 공개 노트 좋아요/조회 실측에 가깝게. 5%는 조회수를 4배 낮춤 */
export const XHS_ASSUMED_ER = 0.012;
const LEGACY_ER = 0.05;

function engagementEstimate(
  er: number,
  likes: number,
  comments: number,
  saves: number,
) {
  const interact = likes + comments;
  if (interact > 0) return Math.round(interact / er);
  if (saves > 0) return Math.round(saves / er);
  return 0;
}

function isLegacyFivePercentEstimate(input: {
  views: number;
  likes: number;
  comments: number;
  saves: number;
}) {
  const legacy = engagementEstimate(
    LEGACY_ER,
    input.likes,
    input.comments,
    input.saves,
  );
  if (legacy <= 0 || input.views <= 0) return input.views <= 0;
  return Math.abs(input.views - legacy) / legacy <= 0.02;
}

export function estimateXiaohongshuViews(input: {
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  saves?: number | null;
  shares?: number | null;
}): number {
  const likes = Math.max(0, Number(input.likes) || 0);
  const comments = Math.max(0, Number(input.comments) || 0);
  const saves = Math.max(0, Number(input.saves) || 0);
  const shares = Math.max(0, Number(input.shares) || 0);
  const measured = Number(input.views) || 0;
  const keepMeasured =
    measured > 0 &&
    !isLegacyFivePercentEstimate({
      views: measured,
      likes,
      comments,
      saves,
    });
  if (keepMeasured) return Math.round(measured);

  const estimated = engagementEstimate(XHS_ASSUMED_ER, likes, comments, saves);
  return Math.max(estimated, likes + comments + saves + shares);
}

if (process.env.RUN_XHS_VIEWS_SELF_CHECK === "1") {
  const a = estimateXiaohongshuViews({ views: 1200, likes: 10, comments: 2 });
  const b = estimateXiaohongshuViews({ likes: 29, comments: 1, saves: 40 });
  const c = estimateXiaohongshuViews({ likes: 0, comments: 0, saves: 10 });
  const d = estimateXiaohongshuViews({
    views: 600,
    likes: 29,
    comments: 1,
    saves: 40,
  });
  const e = estimateXiaohongshuViews({ likes: 1400, comments: 50 });
  if (a !== 1200) throw new Error(`measured views ${a}`);
  if (b !== 2500) throw new Error(`er invert ${b}`);
  if (c !== 833) throw new Error(`saves invert ${c}`);
  if (d !== 2500) throw new Error(`legacy 5% ${d}`);
  if (e < 110_000 || e > 130_000) throw new Error(`nami-scale ${e}`);
  console.log("xiaohongshu-views self-check ok");
}
