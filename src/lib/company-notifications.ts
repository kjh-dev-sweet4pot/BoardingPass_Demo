/** 회원사가 /com에서 직접 켜고 끄는 자동 알림 메일 종류. */
export type NotificationSettings = {
  weekly_report: boolean;
  on_publish: boolean;
  high_engagement: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  weekly_report: true,
  on_publish: true,
  high_engagement: true,
};

export const NOTIFICATION_SETTING_LABELS: Record<keyof NotificationSettings, { title: string; desc: string }> = {
  weekly_report: { title: "주간 리포트", desc: "매주 금요일 오후, 한 주 성과를 요약해서 보내드립니다." },
  on_publish: { title: "콘텐츠 발행 알림", desc: "인플루언서가 콘텐츠를 발행하면 바로 알려드립니다." },
  high_engagement: {
    title: "고인게이지 알림",
    desc: "한 콘텐츠의 반응(좋아요+댓글/조회수)이 평소보다 훨씬 좋으면 알려드립니다.",
  },
};

/** 다음 주간 리포트 발송 시각(금요일 18:00 KST) — cron(vercel.json)의 "0 9 * * 5" UTC와 짝. */
export function nextWeeklyReportAt(from = new Date()): Date {
  const kstNow = new Date(from.getTime() + 9 * 60 * 60 * 1000);
  const day = kstNow.getUTCDay(); // 0=일 ... 5=금
  let daysUntilFriday = (5 - day + 7) % 7;
  const todayAt18 = new Date(
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 18, 0, 0),
  );
  if (daysUntilFriday === 0 && kstNow.getTime() >= todayAt18.getTime()) daysUntilFriday = 7;
  const targetKst = new Date(todayAt18.getTime() + daysUntilFriday * 24 * 60 * 60 * 1000);
  return new Date(targetKst.getTime() - 9 * 60 * 60 * 1000);
}

if (process.env.RUN_COMPANY_NOTIFICATIONS_SELF_CHECK === "1") {
  const keys = Object.keys(DEFAULT_NOTIFICATION_SETTINGS);
  if (Object.keys(NOTIFICATION_SETTING_LABELS).sort().join() !== [...keys].sort().join()) {
    throw new Error("company-notifications label/default key mismatch");
  }
  // 2026-09-16(수) 기준 다음 금요일은 2026-09-18 18:00 KST = 09:00 UTC
  const wed = new Date("2026-09-16T03:00:00Z");
  const next = nextWeeklyReportAt(wed);
  if (next.toISOString() !== "2026-09-18T09:00:00.000Z") {
    throw new Error(`nextWeeklyReportAt failed: ${next.toISOString()}`);
  }
  // 금요일 18:30 KST(09:30 UTC, 발송 직후)엔 다음 주 금요일로 넘어가야 한다
  const friAfter = new Date("2026-09-18T09:30:00Z");
  const nextAfter = nextWeeklyReportAt(friAfter);
  if (nextAfter.toISOString() !== "2026-09-25T09:00:00.000Z") {
    throw new Error(`nextWeeklyReportAt rollover failed: ${nextAfter.toISOString()}`);
  }
  console.log("company-notifications self-check ok");
}
