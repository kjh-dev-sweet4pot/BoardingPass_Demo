import { ALLOCATION_STATUS_LABEL } from "@/lib/types";

export type StateBadgeValue =
  | "Pending"
  | "Nego"
  | "Accept"
  | "결렬"
  | "제출"
  | "승인"
  | "발행완료"
  | "반려"
  | "대기"
  | "수령완료"
  | "제작중"
  | "검수중"
  | "취소"
  | "pending"
  | "visited"
  | "ready"
  | "picked_up"
  | "cancelled"
  | "견적수립"
  | "시행"
  | "결과"
  | "보류"
  | "실행중"
  | "성공"
  | "실패";

type Tone = "neutral" | "warn" | "ok" | "danger";

function labelFor(value: StateBadgeValue) {
  if (value in ALLOCATION_STATUS_LABEL) {
    return ALLOCATION_STATUS_LABEL[value as keyof typeof ALLOCATION_STATUS_LABEL];
  }

  const map: Partial<Record<StateBadgeValue, string>> = {
    // 섭외
    Pending: "대기",
    Nego: "협의",
    Accept: "확정",
    결렬: "결렬",

    // 콘텐츠
    제출: "제출",
    승인: "승인",
    발행완료: "발행완료",
    반려: "반려",

    // 배정 롤업
    대기: "대기",
    수령완료: "수령완료",
    제작중: "제작중",
    검수중: "검수중",
    취소: "취소",

    // 캠페인
    견적수립: "견적수립",
    시행: "시행",
    결과: "결과",
    보류: "보류",

    // 수집 작업
    실행중: "실행중",
    성공: "성공",
    실패: "실패",
  };

  return map[value] ?? value;
}

function toneFor(value: StateBadgeValue): Tone {
  // 이탈(에러) 계열
  if (value === "결렬" || value === "반려" || value === "취소" || value === "실패") {
    return "danger";
  }

  // 성공/완료 계열
  if (
    value === "Accept" ||
    value === "발행완료" ||
    value === "결과" ||
    value === "성공" ||
    value === "수령완료" ||
    value === "picked_up"
  ) {
    return "ok";
  }

  // 진행/대기 계열 (중립~주의)
  if (
    value === "Nego" ||
    value === "제출" ||
    value === "승인" ||
    value === "제작중" ||
    value === "검수중" ||
    value === "보류" ||
    value === "시행" ||
    value === "견적수립" ||
    value === "실행중" ||
    value === "pending" ||
    value === "visited" ||
    value === "ready"
  ) {
    return "warn";
  }

  // legacy cancelled는 기존 UI처럼 중립형으로 유지
  if (value === "cancelled") return "neutral";

  return "neutral";
}

export function StateBadge({
  value,
  className = "",
}: {
  value: StateBadgeValue;
  className?: string;
}) {
  const tone = toneFor(value);
  const label = labelFor(value);

  const toneClass =
    tone === "ok"
      ? "bg-[var(--badge-ok-bg)] text-[var(--badge-ok-fg)]"
      : tone === "warn"
        ? "bg-[var(--badge-warn-bg)] text-[var(--badge-warn-fg)]"
        : tone === "danger"
          ? "bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]"
          : "bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)]";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClass} ${className}`}
      aria-label={label}
    >
      {label}
    </span>
  );
}

