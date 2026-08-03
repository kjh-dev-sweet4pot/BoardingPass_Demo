# Boarding Pass (Alpha)

인플루언서가 인스타그램 핸들로 본인확인 후 수령 상품을 확인하는 Next.js + Supabase 앱입니다.

## 포털

| 경로 | 역할 |
|------|------|
| `/inf` | 인스타 핸들 본인확인 → 수령 상품 조회 |
| `/admin` | 매장·상품·인플루언서·배정 관리 (`admin` / `admin`) |
| `/phar` | 날짜·지점별 배정 조회 + 상세 팝업 |

## DB (4 tables)

`stores` · `products` · `influencers` · `allocations`

## 본인확인 흐름

1. Admin이 인플루언서(이름 + 인스타 핸들)와 배정 등록
2. Inf에서 핸들 입력 → 일치 시 수령 목록 표시
3. Phar에서 현황 조회
