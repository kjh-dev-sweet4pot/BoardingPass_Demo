/** 미팅 데모용 지표 보정. 풀/발행/콘텐츠가 같이 씀. */

export function hash32(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mockInt(seed: string, min: number, max: number) {
  return min + (hash32(seed) % (max - min + 1));
}

/**
 * 실측 상대 순위를 유지하면서 미팅용으로 눈에 띄게 보정.
 * ponytail: 배수·캡은 데모 천장. Apify live 붙으면 이 함수 제거.
 */
export function polishDemoMetrics(input: {
  views: number | null | undefined;
  likes: number | null | undefined;
  comments: number | null | undefined;
  followers?: number;
  seed: string;
}) {
  const { seed, followers = 0 } = input;
  let views: number;
  let likes: number;
  let comments: number;

  if (input.views != null && input.views > 0) {
    const raw = input.views;
    const boost =
      raw < 200 ? 120 : raw < 500 ? 70 : raw < 2_000 ? 40 : raw < 10_000 ? 15 : 4;
    views = Math.min(920_000, Math.max(18_000, Math.round(raw * boost)));
  } else {
    const base =
      followers >= 100_000
        ? 180_000
        : followers >= 40_000
          ? 95_000
          : followers >= 10_000
            ? 48_000
            : followers >= 3_000
              ? 28_000
              : 16_000;
    views = base + mockInt(`${seed}:v`, 0, Math.round(base * 0.8));
  }

  if (
    input.likes != null &&
    input.likes > 0 &&
    input.views != null &&
    input.views > 0
  ) {
    const er = input.likes / Math.max(1, input.views);
    likes = Math.max(
      480,
      Math.round(views * Math.min(0.085, Math.max(0.018, er * 1.35))),
    );
  } else if (input.likes != null && input.likes > 0) {
    likes = Math.min(85_000, Math.max(520, Math.round(input.likes * 55)));
  } else {
    likes = Math.round(views * (mockInt(`${seed}:er`, 22, 55) / 1000));
  }

  if (
    input.comments != null &&
    input.comments > 0 &&
    input.likes != null &&
    input.likes > 0
  ) {
    const cr = input.comments / Math.max(1, input.likes);
    comments = Math.max(
      24,
      Math.round(likes * Math.min(0.12, Math.max(0.02, cr * 1.2))),
    );
  } else if (input.comments != null && input.comments > 0) {
    comments = Math.min(4_800, Math.max(28, Math.round(input.comments * 35)));
  } else {
    comments = Math.max(18, Math.round(likes * (mockInt(`${seed}:c`, 3, 12) / 100)));
  }

  return { views, likes, comments };
}
