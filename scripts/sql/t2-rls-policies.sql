-- T2. RLS 정책 및 권한 등급 (쿠키 인증 + 커스텀 JWT)
-- 선행: T1 스키마 적용 완료
-- 사전 준비 (서버 env, Vercel 포함):
--   SUPABASE_JWT_SECRET  — Supabase Dashboard → Settings → API → JWT Secret
--   SUPABASE_SERVICE_ROLE_KEY — 로그인·본인확인 시 service_role (서버 전용)
-- 적용 후 기존 세션은 재로그인 필요 (bp_auth_token 발급)

-- ---------------------------------------------------------------------------
-- 헬퍼 함수 (auth.jwt() app_metadata)
-- ---------------------------------------------------------------------------

create or replace function public.jwt_app_meta() returns jsonb
language sql stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata', '{}'::jsonb);
$$;

create or replace function public.auth_app_role() returns text
language sql stable
as $$
  select coalesce(public.jwt_app_meta() ->> 'role', '');
$$;

create or replace function public.auth_company_id() returns uuid
language sql stable
as $$
  select nullif(public.jwt_app_meta() ->> 'company_id', '')::uuid;
$$;

create or replace function public.auth_store_id() returns uuid
language sql stable
as $$
  select nullif(public.jwt_app_meta() ->> 'store_id', '')::uuid;
$$;

create or replace function public.auth_influencer_id() returns uuid
language sql stable
as $$
  select nullif(public.jwt_app_meta() ->> 'influencer_id', '')::uuid;
$$;

create or replace function public.is_admin_manager() returns boolean
language sql stable
as $$
  select public.auth_app_role() = 'admin_manager';
$$;

create or replace function public.is_admin_operator() returns boolean
language sql stable
as $$
  select public.auth_app_role() = 'admin_operator';
$$;

create or replace function public.is_any_admin() returns boolean
language sql stable
as $$
  select public.is_admin_manager() or public.is_admin_operator();
$$;

create or replace function public.allocation_visible(allocation_uuid uuid) returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allocations a
    where a.id = allocation_uuid
      and (
        public.is_any_admin()
        or (
          public.auth_app_role() = 'company'
          and a.company_id is not null
          and a.company_id = public.auth_company_id()
        )
        or (
          public.auth_app_role() = 'store'
          and a.store_id = public.auth_store_id()
        )
        or (
          public.auth_app_role() = 'influencer'
          and a.influencer_id = public.auth_influencer_id()
        )
      )
  );
$$;

revoke all on function public.allocation_visible(uuid) from public;
grant execute on function public.allocation_visible(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 기존 정책 제거 (T1 anon_all 포함)
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'companies', 'products', 'stores', 'influencers', 'allocations',
        'creator_links', 'campaigns', 'castings', 'negotiation_logs',
        'guidelines', 'content_metrics', 'content_feedback',
        'collection_jobs', 'allocation_pricing'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS 활성화
-- ---------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.products enable row level security;
alter table public.stores enable row level security;
alter table public.influencers enable row level security;
alter table public.allocations enable row level security;
alter table public.creator_links enable row level security;
alter table public.campaigns enable row level security;
alter table public.castings enable row level security;
alter table public.negotiation_logs enable row level security;
alter table public.guidelines enable row level security;
alter table public.content_metrics enable row level security;
alter table public.content_feedback enable row level security;
alter table public.collection_jobs enable row level security;
alter table public.allocation_pricing enable row level security;

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------

create policy companies_select on public.companies
  for select to authenticated
  using (
    public.is_any_admin()
    or id = public.auth_company_id()
  );

create policy companies_insert on public.companies
  for insert to authenticated
  with check (public.is_admin_manager());

create policy companies_update on public.companies
  for update to authenticated
  using (public.is_admin_manager())
  with check (public.is_admin_manager());

-- ---------------------------------------------------------------------------
-- products · stores (참조 데이터)
-- ---------------------------------------------------------------------------

create policy products_select on public.products
  for select to authenticated
  using (true);

create policy products_write on public.products
  for all to authenticated
  using (public.is_any_admin())
  with check (public.is_any_admin());

create policy stores_anon_select on public.stores
  for select to anon
  using (true);

create policy stores_select on public.stores
  for select to authenticated
  using (true);

create policy stores_write on public.stores
  for all to authenticated
  using (public.is_any_admin())
  with check (public.is_any_admin());

-- ---------------------------------------------------------------------------
-- influencers
-- ---------------------------------------------------------------------------

create policy influencers_select on public.influencers
  for select to authenticated
  using (
    public.is_any_admin()
    or (
      public.auth_app_role() = 'influencer'
      and id = public.auth_influencer_id()
    )
    or (
      public.auth_app_role() = 'company'
      and exists (
        select 1 from public.allocations a
        where a.influencer_id = influencers.id
          and a.company_id = public.auth_company_id()
      )
    )
    or (
      public.auth_app_role() = 'store'
      and exists (
        select 1 from public.allocations a
        where a.influencer_id = influencers.id
          and a.store_id = public.auth_store_id()
      )
    )
  );

create policy influencers_write on public.influencers
  for all to authenticated
  using (public.is_any_admin())
  with check (public.is_any_admin());

create policy influencers_self_update on public.influencers
  for update to authenticated
  using (
    public.auth_app_role() = 'influencer'
    and id = public.auth_influencer_id()
  )
  with check (
    public.auth_app_role() = 'influencer'
    and id = public.auth_influencer_id()
  );

-- ---------------------------------------------------------------------------
-- allocations
-- ---------------------------------------------------------------------------

create policy allocations_select on public.allocations
  for select to authenticated
  using (
    public.is_any_admin()
    or (
      public.auth_app_role() = 'company'
      and company_id is not null
      and company_id = public.auth_company_id()
    )
    or (
      public.auth_app_role() = 'store'
      and store_id = public.auth_store_id()
    )
    or (
      public.auth_app_role() = 'influencer'
      and influencer_id = public.auth_influencer_id()
    )
  );

create policy allocations_insert on public.allocations
  for insert to authenticated
  with check (public.is_any_admin());

create policy allocations_update on public.allocations
  for update to authenticated
  using (
    public.is_any_admin()
    or (
      public.auth_app_role() = 'store'
      and store_id = public.auth_store_id()
    )
    or (
      public.auth_app_role() = 'influencer'
      and influencer_id = public.auth_influencer_id()
    )
  )
  with check (
    public.is_any_admin()
    or (
      public.auth_app_role() = 'store'
      and store_id = public.auth_store_id()
    )
    or (
      public.auth_app_role() = 'influencer'
      and influencer_id = public.auth_influencer_id()
    )
  );

create policy allocations_delete on public.allocations
  for delete to authenticated
  using (public.is_admin_manager());

-- ---------------------------------------------------------------------------
-- creator_links
-- ---------------------------------------------------------------------------

create policy creator_links_select on public.creator_links
  for select to authenticated
  using (
    public.is_any_admin()
    or (
      public.auth_app_role() = 'influencer'
      and influencer_id = public.auth_influencer_id()
    )
    or public.allocation_visible(allocation_id)
  );

create policy creator_links_insert on public.creator_links
  for insert to authenticated
  with check (
    public.is_any_admin()
    or (
      public.auth_app_role() = 'influencer'
      and influencer_id = public.auth_influencer_id()
    )
  );

create policy creator_links_update on public.creator_links
  for update to authenticated
  using (
    public.is_any_admin()
    or (
      public.auth_app_role() = 'influencer'
      and influencer_id = public.auth_influencer_id()
    )
  )
  with check (
    public.is_any_admin()
    or (
      public.auth_app_role() = 'influencer'
      and influencer_id = public.auth_influencer_id()
    )
  );

create policy creator_links_delete on public.creator_links
  for delete to authenticated
  using (public.is_any_admin());

-- ---------------------------------------------------------------------------
-- campaigns · castings · guidelines · negotiation_logs
-- ---------------------------------------------------------------------------

create policy campaigns_all on public.campaigns
  for all to authenticated
  using (
    public.is_any_admin()
    or company_id = public.auth_company_id()
  )
  with check (
    public.is_any_admin()
    or company_id = public.auth_company_id()
  );

create policy castings_all on public.castings
  for all to authenticated
  using (
    public.is_any_admin()
    or company_id = public.auth_company_id()
  )
  with check (
    public.is_any_admin()
    or company_id = public.auth_company_id()
  );

create policy guidelines_all on public.guidelines
  for all to authenticated
  using (
    public.is_any_admin()
    or exists (
      select 1 from public.campaigns c
      where c.id = guidelines.campaign_id
        and c.company_id = public.auth_company_id()
    )
  )
  with check (
    public.is_any_admin()
    or exists (
      select 1 from public.campaigns c
      where c.id = guidelines.campaign_id
        and c.company_id = public.auth_company_id()
    )
  );

create policy negotiation_logs_all on public.negotiation_logs
  for all to authenticated
  using (
    public.is_any_admin()
    or exists (
      select 1 from public.castings c
      where c.id = negotiation_logs.casting_id
        and c.company_id = public.auth_company_id()
    )
  )
  with check (
    public.is_any_admin()
    or exists (
      select 1 from public.castings c
      where c.id = negotiation_logs.casting_id
        and c.company_id = public.auth_company_id()
    )
  );

-- ---------------------------------------------------------------------------
-- content_metrics · content_feedback · collection_jobs
-- ---------------------------------------------------------------------------

create policy content_metrics_all on public.content_metrics
  for all to authenticated
  using (
    public.is_any_admin()
    or exists (
      select 1 from public.creator_links cl
      where cl.id = content_metrics.creator_link_id
        and public.allocation_visible(cl.allocation_id)
    )
  )
  with check (
    public.is_any_admin()
    or exists (
      select 1 from public.creator_links cl
      where cl.id = content_metrics.creator_link_id
        and public.allocation_visible(cl.allocation_id)
    )
  );

create policy content_feedback_all on public.content_feedback
  for all to authenticated
  using (
    public.is_any_admin()
    or company_id = public.auth_company_id()
  )
  with check (
    public.is_any_admin()
    or company_id = public.auth_company_id()
  );

create policy collection_jobs_all on public.collection_jobs
  for all to authenticated
  using (public.is_any_admin())
  with check (public.is_any_admin());

-- ---------------------------------------------------------------------------
-- allocation_pricing — 운영관리자만 (R3, S6)
-- ---------------------------------------------------------------------------

create policy allocation_pricing_select on public.allocation_pricing
  for select to authenticated
  using (public.is_admin_manager());

create policy allocation_pricing_write on public.allocation_pricing
  for all to authenticated
  using (public.is_admin_manager())
  with check (public.is_admin_manager());

-- ponytail: self-check — 아래로 정책 수 확인 (각 테이블 1건 이상)
-- select tablename, count(*) from pg_policies
--   where schemaname = 'public'
--     and tablename in (
--       'companies','products','stores','influencers','allocations',
--       'creator_links','campaigns','castings','negotiation_logs',
--       'guidelines','content_metrics','content_feedback',
--       'collection_jobs','allocation_pricing'
--     )
--   group by tablename order by tablename;
