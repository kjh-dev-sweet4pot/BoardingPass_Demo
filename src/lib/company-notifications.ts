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

if (process.env.RUN_COMPANY_NOTIFICATIONS_SELF_CHECK === "1") {
  const keys = Object.keys(DEFAULT_NOTIFICATION_SETTINGS);
  if (Object.keys(NOTIFICATION_SETTING_LABELS).sort().join() !== [...keys].sort().join()) {
    throw new Error("company-notifications label/default key mismatch");
  }
  console.log("company-notifications self-check ok");
}
