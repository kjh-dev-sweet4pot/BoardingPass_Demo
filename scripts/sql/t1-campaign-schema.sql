-- T1. 데이터베이스 스키마 (비파괴)
-- Supabase SQL Editor에서 실행. 기존 /inf · /phar 동작을 깨지 않도록
-- 신규 테이블 추가 + 기존 테이블 컬럼 추가만 수행한다.
-- allocation_status enum · creator_links.status(submitted|approved|rejected)는 변경하지 않는다.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 신규 테이블 7종
-- ---------------------------------------------------------------------------

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  status text not null default '견적수립'
    check (status in ('견적수립', '시행', '결과', '보류', '취소')),
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_company_idx on public.campaigns (company_id);
create index if not exists campaigns_product_idx on public.campaigns (product_id);
create index if not exists campaigns_status_idx on public.campaigns (status);

comment on table public.campaigns is '회원사 × 상품 1건 단위 캠페인';

create table if not exists public.castings (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete restrict,
  influencer_id uuid not null references public.influencers (id) on delete restrict,
  status text not null default 'Pending'
    check (status in ('Pending', 'Nego', 'Accept', '결렬')),
  allocation_id uuid references public.allocations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, influencer_id)
);

create index if not exists castings_campaign_idx on public.castings (campaign_id);
create index if not exists castings_company_idx on public.castings (company_id);
create index if not exists castings_influencer_idx on public.castings (influencer_id);
create index if not exists castings_status_idx on public.castings (status);

comment on table public.castings is '섭외(인플루언서 × 캠페인 후보)';

create table if not exists public.negotiation_logs (
  id uuid primary key default gen_random_uuid(),
  casting_id uuid not null references public.castings (id) on delete cascade,
  proposed_amount bigint,
  memo text,
  proposer text not null default 'company'
    check (proposer in ('company', 'operator')),
  operator_label text,
  created_at timestamptz not null default now()
);

create index if not exists negotiation_logs_casting_idx
  on public.negotiation_logs (casting_id, created_at desc);

comment on table public.negotiation_logs is '섭외 1건 : 협상 이력 N건';

create table if not exists public.guidelines (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text,
  body text,
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guidelines_campaign_idx on public.guidelines (campaign_id);

comment on table public.guidelines is '캠페인별 콘텐츠 가이드라인';

create table if not exists public.content_metrics (
  id uuid primary key default gen_random_uuid(),
  creator_link_id uuid not null references public.creator_links (id) on delete cascade,
  collected_at timestamptz not null,
  views bigint not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  created_at timestamptz not null default now(),
  unique (creator_link_id, collected_at)
);

create index if not exists content_metrics_link_collected_idx
  on public.content_metrics (creator_link_id, collected_at desc);

comment on table public.content_metrics is '콘텐츠 × 수집시점 성과 지표(조회·좋아요·댓글)';

create table if not exists public.content_feedback (
  id uuid primary key default gen_random_uuid(),
  creator_link_id uuid not null references public.creator_links (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists content_feedback_link_idx
  on public.content_feedback (creator_link_id, created_at desc);

comment on table public.content_feedback is '발행 전 콘텐츠에 대한 회원사 의견';

create table if not exists public.collection_jobs (
  id uuid primary key default gen_random_uuid(),
  creator_link_id uuid not null references public.creator_links (id) on delete cascade,
  status text not null default '대기'
    check (status in ('대기', '실행중', '성공', '실패')),
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists collection_jobs_link_idx
  on public.collection_jobs (creator_link_id, created_at desc);
create index if not exists collection_jobs_status_idx on public.collection_jobs (status);

comment on table public.collection_jobs is '지표 수집 실행 이력';

-- 원가·마진 분리 (R3, S6). 회원사 API에서는 이 테이블을 조회하지 않는다.
create table if not exists public.allocation_pricing (
  allocation_id uuid primary key references public.allocations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete restrict,
  display_price bigint,
  cost_amount bigint,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists allocation_pricing_company_idx
  on public.allocation_pricing (company_id);

comment on table public.allocation_pricing is '배정 단위 노출가·원가 (회원사 노출 API 제외)';

-- ---------------------------------------------------------------------------
-- 기존 테이블 확장 (컬럼 추가만)
-- ---------------------------------------------------------------------------

-- influencers
alter table public.influencers
  add column if not exists sns_url text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists scale_band text;

comment on column public.influencers.scale_band is '규모 구간 (T4·TS에서 값 정의)';

-- allocations (운영 alpha 컬럼 + T1)
alter table public.allocations
  add column if not exists company_id uuid references public.companies (id) on delete set null,
  add column if not exists visit_date date,
  add column if not exists last_visited_at timestamptz,
  add column if not exists visit_source text,
  add column if not exists visit_confirmed_by text,
  add column if not exists campaign_id uuid references public.campaigns (id) on delete set null,
  add column if not exists target_content_count integer,
  add column if not exists rollup_status text;

comment on column public.allocations.target_content_count is '목표 콘텐츠 수';
comment on column public.allocations.rollup_status is
  '롤업 산출 상태(대기|수령완료|제작중|검수중|발행완료|취소). T3에서 채움. 기존 status enum은 유지';

create index if not exists allocations_campaign_idx on public.allocations (campaign_id);
create index if not exists allocations_company_idx on public.allocations (company_id);

-- creator_links (링크 검수 status 유지 + 콘텐츠 엔티티 필드 추가)
alter table public.creator_links
  add column if not exists submitted_file_path text,
  add column if not exists publish_url text,
  add column if not exists content_status text
    check (content_status is null or content_status in ('제출', '승인', '발행완료', '반려')),
  add column if not exists verification_failed boolean not null default false;

comment on column public.creator_links.status is '링크 검수: submitted | approved | rejected (기존 유지)';
comment on column public.creator_links.content_status is '콘텐츠 도메인 상태: 제출|승인|발행완료|반려 (T3 롤업용)';
comment on column public.creator_links.verification_failed is '검증실패 플래그 (상태와 동시 표시 가능)';

-- ---------------------------------------------------------------------------
-- RLS (alpha: anon 전체 허용 — T2에서 company_id 기반으로 교체)
-- ---------------------------------------------------------------------------

alter table public.campaigns enable row level security;
alter table public.castings enable row level security;
alter table public.negotiation_logs enable row level security;
alter table public.guidelines enable row level security;
alter table public.content_metrics enable row level security;
alter table public.content_feedback enable row level security;
alter table public.collection_jobs enable row level security;
alter table public.allocation_pricing enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'campaigns' and policyname = 'campaigns_anon_all'
  ) then
    create policy campaigns_anon_all on public.campaigns for all to anon using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'castings' and policyname = 'castings_anon_all'
  ) then
    create policy castings_anon_all on public.castings for all to anon using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'negotiation_logs' and policyname = 'negotiation_logs_anon_all'
  ) then
    create policy negotiation_logs_anon_all on public.negotiation_logs for all to anon using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'guidelines' and policyname = 'guidelines_anon_all'
  ) then
    create policy guidelines_anon_all on public.guidelines for all to anon using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'content_metrics' and policyname = 'content_metrics_anon_all'
  ) then
    create policy content_metrics_anon_all on public.content_metrics for all to anon using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'content_feedback' and policyname = 'content_feedback_anon_all'
  ) then
    create policy content_feedback_anon_all on public.content_feedback for all to anon using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'collection_jobs' and policyname = 'collection_jobs_anon_all'
  ) then
    create policy collection_jobs_anon_all on public.collection_jobs for all to anon using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'allocation_pricing' and policyname = 'allocation_pricing_anon_all'
  ) then
    create policy allocation_pricing_anon_all on public.allocation_pricing for all to anon using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.campaigns to anon, authenticated;
grant select, insert, update, delete on public.castings to anon, authenticated;
grant select, insert, update, delete on public.negotiation_logs to anon, authenticated;
grant select, insert, update, delete on public.guidelines to anon, authenticated;
grant select, insert, update, delete on public.content_metrics to anon, authenticated;
grant select, insert, update, delete on public.content_feedback to anon, authenticated;
grant select, insert, update, delete on public.collection_jobs to anon, authenticated;
grant select, insert, update, delete on public.allocation_pricing to anon, authenticated;

-- ponytail: self-check — 아래를 실행해 7종 테이블 존재 확인
-- select tablename from pg_tables
--   where schemaname = 'public'
--     and tablename in (
--       'campaigns','castings','negotiation_logs','guidelines',
--       'content_metrics','content_feedback','collection_jobs'
--     )
--   order by tablename;
