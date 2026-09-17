# 작업 지시서 — 마진 관리 (1단계)

이 저장소는 `kjh-dev-sweet4pot/BoardingPass_Demo` 브랜치 `v1.2.1`이다.
전체 기획 배경은 `docs/margin-spec.md` (동봉)를 참조하되, 실제 작업은 아래 순서를 그대로 따른다.
막히는 지점이 생기면 스펙 문서의 해당 장 번호를 찾아 확인하고, 그래도 불명확하면 진행을 멈추고 질문한다 — 추측으로 스키마나 계산식을 바꾸지 않는다.

## 0. 시작 전에 반드시 확인할 것

- [ ] `src/lib/types.ts`, `src/lib/company-budget-rounds.ts`, `src/components/admin-sidebar-nav.tsx`, `src/app/api/admin/dashboard/route.ts`, `src/lib/admin-casting-accept.ts`를 먼저 읽는다. 이 문서의 가정과 실제 코드가 다르면 **실제 코드가 맞다.**
- [ ] `supabase/migrations/20260916_margin_management.sql`의 `v_campaign_margin` 뷰는 컬럼명 추정이 섞여 있다. 실행 전 `allocations` / `allocation_pricing` / `creator_links`의 실제 컬럼명과 대조해 고친다. 특히:
  - `allocation_pricing`이 `allocation_id`로 조인되는지, 아니면 `casting_id`로 바로 붙는지
  - `creator_links`가 `allocation_id`를 갖는지, `casting_id`를 갖는지
  - `castings.status` enum 값이 정확히 `'Accept'`인지 (대소문자 포함)
  - `campaigns.status`의 취소 값이 정확히 `'취소'`인지

## 1. 마이그레이션 적용

1. `supabase/migrations/20260916_margin_management.sql`을 Supabase SQL 에디터에 붙여넣기 전에 0번 항목을 반영해 수정한다.
2. `company_budget_rounds.campaign_id` 컬럼 추가는 예산 탭 코드와 충돌하지 않는지 `src/lib/company-budget-rounds.ts`를 먼저 훑고 실행한다.
3. 적용 후 `select * from v_campaign_margin limit 5;`로 값이 나오는지 확인한다. 매출·원가가 전부 0이면 조인이 잘못된 것이다.

## 2. 타입 통합

- `src/lib/margin-types.ts`를 그대로 복사해 넣거나, 기존 `src/lib/types.ts`에 병합한다.
- `calcMarginRate`, `calcBurnRate`, `marginState`, `MARGIN_STATE_COLOR`는 **클라이언트 미리보기와 서버 계산이 반드시 같은 함수를 써야 한다.** 캐스팅 확정 모달(§9.6)과 API 응답(§10) 양쪽에서 이 함수를 import해서 쓰고, 마진율 계산식을 두 번 구현하지 않는다.

## 3. 구현 순서 (스펙 §12.1 순서와 동일)

각 항목 완료 후 다음으로 넘어간다. 순서를 바꾸지 않는다 — 4번(캠페인 상세)이 3번(사이드바)보다 먼저 되면 라우팅이 없는 화면을 만들게 된다.

1. [ ] 마이그레이션 적용 (`supabase/migrations/20260916_margin_management.sql`)
2. [ ] `castings.budget_plan_item_id`, `influencers.tier`, `company_budget_rounds.campaign_id` 컬럼 확인
3. [ ] `admin-sidebar-nav.tsx`에 `MARGIN_NAV` 그룹 추가 (스펙 §6.2 코드 스니펫 그대로)
   - `AdminSection` 유니온에 5개 값 추가: `marginOverview | marginCampaign | marginQuote | marginRateCard | marginRollup`
   - `admin_manager`가 아니면 그룹을 렌더링하지 않는 가드 추가
4. [ ] 마진 현황 화면 (`marginOverview`) — 스펙 §9.1
   - `GET /api/admin/margin/overview` : `v_campaign_margin` + `campaigns` + `companies` 조인, 필터(`company_id`, `status`, `margin_state`, `q`), 페이지네이션
   - 정렬 기본값: `committed_margin_rate` 오름차순, null은 맨 뒤
5. [ ] 캠페인 마진 화면 (`marginCampaign`) — 스펙 §9.3
   - 4개 탭: 개요 / 예산·계획 / 배치 / 기타 소요비용
   - `campaigns.budget_amount` 수정은 **기존 캠페인 편집 API를 재사용**한다. 새 엔드포인트를 만들지 않는다
6. [ ] 레이트카드 화면 (`marginRateCard`) — 스펙 §9.4
7. [ ] 견적 제안 (`marginQuote`) — 스펙 §9.5. 계산 로직은 순수 함수로 분리해 `src/lib/quote-engine.ts` 같은 파일에 두고, 화면 컴포넌트에 계산식을 직접 넣지 않는다. 유닛 테스트를 이 함수에 붙인다.
8. [ ] 캐스팅 확정 모달 마진 미리보기 — 스펙 §9.6. `src/lib/admin-casting-accept.ts` 및 `admin-campaign-casting-panel.tsx` 수정
9. [ ] `stripPricingFields()`에 `MARGIN_PRICING_KEYS` 병합, 회원사·크리에이터 세션으로 모든 신규 API를 호출해 보고 값이 새지 않는지 확인
10. [ ] `admin-dashboard` KPI 라벨을 `집행 기준 마진`으로 변경 (스펙 §4.1.1)

## 4. 하지 말 것 (스펙과 어긋나는 흔한 실수)

- 회원사 예산 입력 화면을 새로 만들지 않는다. `company_budget_rounds`는 읽기 전용 참조다.
- 매출을 Accept 노출가 합계로 계산하지 않는다. 매출은 `campaigns.budget_amount` 하나다.
- 원가에 인건비·판관비를 자동으로 배부하지 않는다. 운영자가 입력한 값의 단순 합계만 쓴다.
- 마진율 경고를 hard block으로 만들지 않는다. 항상 사유 입력 후 저장 가능(soft warn).
- `admin`(운영담당자) 권한에 마진 데이터를 노출하지 않는다. `/com`, `/inf` 응답에도 노출하지 않는다.

## 5. 완료 판정 (스펙 §12.1과 동일)

> 관리자가 캠페인에 예산·목표·슬롯을 입력하면, 캐스팅 확정 시마다 마진율이 자동 재계산되어 60~80% 이탈 시 경고가 뜨고, 담당자가 수기 계산을 하지 않는다.

수동 테스트 시나리오는 `docs/margin-spec.md` §12.1의 5개 검증 항목을 그대로 쓴다.

## 6. 미해결 항목 (구현 중 발견 시 진행을 멈추고 보고)

- 티어 기준값(`influencers.tier`)의 팔로워 구간이 실제 데이터와 맞는지 미확인 — 스펙 §8.1
- 콘텐츠 유형 코드가 `carousel/visit/seeding`으로 확정되었는지 재확인 필요 — 스펙 §8.5, §13.2
