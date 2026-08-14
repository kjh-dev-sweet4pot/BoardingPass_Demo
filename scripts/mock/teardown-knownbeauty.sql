-- KnownBeauty × 긴자점 데모 데이터만 삭제.
-- 강남/명동 등 기존 지점·인플루언서는 건드리지 않음.
-- Supabase SQL editor 에서 실행.
--
-- 회원사(login_id = company) 계정 자체는 남깁니다.
-- 계정까지 지우려면 맨 아래 주석을 해제하세요.

-- 1) 긴자점 배정 (+ creator_links 는 cascade)
delete from public.allocations
where store_id in (select id from public.stores where name = '긴자점');

-- 2) 시드 인플루언서
delete from public.influencers
where notes = 'seed:knownbeauty-jp';

-- 3) KnownBeauty SKU 상품 (다른 배정에 묶여 있으면 실패 → 그때는 배정부터)
delete from public.products
where sku like 'KB-%';

-- 4) 긴자점
delete from public.stores
where name = '긴자점';

-- 5) 회원사까지 삭제하려면 아래 주석 해제
-- delete from public.companies where login_id = 'company';
