# Boarding Pass (Alpha)

인플루언서가 매장 방문 후 SNS 본인확인을 거쳐 수령 상품을 확인하는 Next.js + Supabase 앱입니다.

## 포털

| 경로 | 역할 |
|------|------|
| `/inf` | 인플루언서 — SNS/핸들 본인확인, 수령 상품 조회 |
| `/admin` | 관리자 — 매장·상품·인플루언서·배정 관리 |
| `/phar` | 약사 — 배정 현황 조회 (반출 확정은 후속) |

## 설정

1. [Supabase](https://supabase.com) 프로젝트 생성
2. `supabase/schema.sql` 을 SQL Editor에서 실행
3. `.env.local.example` 을 `.env.local` 로 복사 후 URL/anon key 입력
4. Auth → URL Configuration 에 Redirect URL 추가: `http://localhost:3000/auth/callback`
5. `npm run dev`

### Admin 역할

이메일 가입 시 `raw_user_meta_data.role` 로 프로필이 만들어집니다. 필요하면 SQL로 승격:

```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

### SNS OAuth (Instagram / 샤오홍슈)

Supabase 내장 목록에 없으므로 **Custom OAuth/OIDC Provider** 로 연결합니다.

1. Dashboard → Authentication → Providers → New Provider
2. identifier 예: `custom:instagram`, `custom:xiaohongshu`
3. `.env.local` 에 동일 identifier 설정

Facebook은 내장 provider입니다. Dashboard에서 켠 뒤 `NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED=true`.

OAuth 전에 **핸들 본인확인**(Admin 등록 핸들 일치)으로 플로우를 검증할 수 있습니다.

## 본인확인 흐름

1. Admin이 인플루언서 + SNS 핸들 + 상품 배정 등록
2. Inf 로그인 후 플랫폼/핸들(선택: 방문 코드) 입력
3. DB 일치 시 `allocations` 가 `verified` 로 바뀌고 수령 목록 표시
4. Phar는 현황 조회 (반출 버튼은 다음 단계)
