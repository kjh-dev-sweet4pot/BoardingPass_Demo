-- Mock seed data (~5 influencers)
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query → Run)

-- Clean previous mock rows (safe to re-run)
delete from public.allocations
where visit_code like 'MOCK-%';

delete from public.sns_identities
where handle_normalized in (
  'mina_beauty',
  'soyeon.daily',
  'jay_style',
  'yuna_looks',
  'haneul_pick'
);

delete from public.influencers
where name in ('김미나', '박소연', '이재윤', '최유나', '정하늘');

delete from public.products
where sku like 'MOCK-%';

delete from public.stores
where name like '목업%';

-- Stores
insert into public.stores (id, name, address) values
  ('11111111-1111-1111-1111-111111111101', '목업 강남점', '서울 강남구 테헤란로 1'),
  ('11111111-1111-1111-1111-111111111102', '목업 홍대점', '서울 마포구 양화로 2');

-- Products
insert into public.products (id, name, sku, description) values
  ('22222222-2222-2222-2222-222222222201', '선크림 50ml', 'MOCK-SC-50', '톤업 선크림'),
  ('22222222-2222-2222-2222-222222222202', '앰플 세트', 'MOCK-AMP-01', '히알루론 앰플 3입'),
  ('22222222-2222-2222-2222-222222222203', '립밤', 'MOCK-LIP-01', '보습 립밤'),
  ('22222222-2222-2222-2222-222222222204', '클렌징폼', 'MOCK-CL-01', '약산성 클렌징'),
  ('22222222-2222-2222-2222-222222222205', '마스크팩 5매', 'MOCK-MSK-05', '수분 마스크');

-- Influencers (5)
insert into public.influencers (id, name, notes) values
  ('33333333-3333-3333-3333-333333333301', '김미나', '뷰티 · 팔로워 12만'),
  ('33333333-3333-3333-3333-333333333302', '박소연', '라이프스타일'),
  ('33333333-3333-3333-3333-333333333303', '이재윤', '패션'),
  ('33333333-3333-3333-3333-333333333304', '최유나', '메이크업'),
  ('33333333-3333-3333-3333-333333333305', '정하늘', '스킨케어 리뷰');

-- Instagram handles (Inf 본인확인용)
insert into public.sns_identities (influencer_id, platform, handle) values
  ('33333333-3333-3333-3333-333333333301', 'instagram', '@mina_beauty'),
  ('33333333-3333-3333-3333-333333333302', 'instagram', '@soyeon.daily'),
  ('33333333-3333-3333-3333-333333333303', 'instagram', '@jay_style'),
  ('33333333-3333-3333-3333-333333333304', 'instagram', '@yuna_looks'),
  ('33333333-3333-3333-3333-333333333305', 'instagram', '@haneul_pick');

-- Allocations (pending — Inf에서 이름+핸들 확인 시 verified로 변경)
insert into public.allocations (
  influencer_id, product_id, store_id, quantity, status, visit_code
) values
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 'pending', 'MOCK-1001'),
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111101', 2, 'pending', 'MOCK-1001'),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102', 1, 'pending', 'MOCK-1002'),
  ('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111101', 1, 'pending', 'MOCK-1003'),
  ('33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111102', 1, 'pending', 'MOCK-1004'),
  ('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111102', 1, 'pending', 'MOCK-1005'),
  ('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102', 1, 'pending', 'MOCK-1005');
