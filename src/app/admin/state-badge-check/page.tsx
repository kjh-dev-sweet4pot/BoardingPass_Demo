import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { isAdminSession } from "@/lib/session";
import { StateBadge, type StateBadgeValue } from "@/components/state-badge";

const VALUES: StateBadgeValue[] = [
  // 섭외
  "Pending",
  "Nego",
  "Accept",
  "결렬",

  // 콘텐츠
  "제출",
  "승인",
  "발행완료",
  "반려",

  // 배정 롤업
  "대기",
  "수령완료",
  "제작중",
  "검수중",
  "취소",

  // 캠페인
  "견적수립",
  "시행",
  "결과",
  "보류",

  // 수집 작업
  "실행중",
  "성공",
  "실패",

  // legacy 호환(기존 화면에 이미 존재)
  "pending",
  "visited",
  "ready",
  "picked_up",
  "cancelled",
];

export default async function StateBadgeCheckPage() {
  if (!(await isAdminSession())) redirect("/admin/login");

  return (
    <AppShell
      full
      theme="owm"
      eyebrow="Admin"
      title="State Badge Check"
      compactHeader
    >
      <div className="space-y-6 px-2">
        <p className="text-sm text-[var(--muted)]">
          상태 배지 렌더링 확인용 페이지입니다. (T4)
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {VALUES.map((value) => (
            <div
              key={value}
              className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-white px-4 py-3"
            >
              <StateBadge value={value} />
              <span className="ml-3 shrink-0 text-xs text-[var(--muted)]">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

