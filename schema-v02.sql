-- Boarding Pass v0.2
-- Supabase SQL editor 에서 실행.
-- 기존 배정 상태는 소급 변경하지 않음. visit_source 만 auto 로 채움.

-- 11. 회원사
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  login_id text not null unique,
  password_hash text not null,
  aliases text[] not null default '{}',
  contact text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.allocations
  add column if not exists company_id uuid references public.companies (id) on delete restrict;

alter table public.allocations
  add column if not exists visit_source text;

alter table public.allocations
  add column if not exists visit_confirmed_by text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'allocations_visit_source_check'
  ) then
    alter table public.allocations
      add constraint allocations_visit_source_check
      check (visit_source is null or visit_source in ('auto', 'pharmacist', 'admin'));
  end if;
end $$;

create index if not exists allocations_company_id_idx
  on public.allocations (company_id);

-- 기존 unique (influencer + product + store + visit_date) 를
-- company_id 포함 키로 교체
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'allocations'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) not ilike '%company_id%'
  loop
    execute format('alter table public.allocations drop constraint if exists %I', r.conname);
  end loop;
end $$;

create unique index if not exists allocations_uniq_with_company
  on public.allocations (
    influencer_id,
    product_id,
    store_id,
    visit_date,
    company_id
  )
  where company_id is not null;

create unique index if not exists allocations_uniq_without_company
  on public.allocations (
    influencer_id,
    product_id,
    store_id,
    visit_date
  )
  where company_id is null;

-- 12. 크리에이터 콘텐츠 링크
create table if not exists public.creator_links (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.allocations (id) on delete cascade,
  influencer_id uuid not null references public.influencers (id),
  url text not null,
  platform text not null check (
    platform in ('instagram', 'tiktok', 'youtube', 'naver_blog', 'etc')
  ),
  status text not null default 'submitted' check (
    status in ('submitted', 'approved', 'rejected')
  ),
  memo text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (allocation_id, url)
);

create index if not exists creator_links_allocation_id_idx
  on public.creator_links (allocation_id);

create index if not exists creator_links_influencer_id_idx
  on public.creator_links (influencer_id);

create index if not exists creator_links_status_idx
  on public.creator_links (status);

-- 13.7 기존 방문 건의 확정 주체는 auto
update public.allocations
set visit_source = 'auto'
where visit_source is null
  and status in ('visited', 'ready', 'picked_up');

-- 이 앱은 anon key 로 서버에서 직접 조회함.
-- Table Editor 가 아닌 SQL 로 만든 테이블은 anon GRANT 가 없어 permission denied 가 남.
grant usage on schema public to anon, authenticated, service_role;
grant all on table public.companies to anon, authenticated, service_role;
grant all on table public.creator_links to anon, authenticated, service_role;

alter table public.companies enable row level security;
alter table public.creator_links enable row level security;

drop policy if exists companies_all on public.companies;
create policy companies_all on public.companies for all using (true) with check (true);

drop policy if exists creator_links_all on public.creator_links;
create policy creator_links_all on public.creator_links for all using (true) with check (true);
