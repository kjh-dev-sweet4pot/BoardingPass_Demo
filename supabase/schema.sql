-- Boarding Pass schema
-- Run in Supabase SQL Editor

create extension if not exists "pgcrypto";

-- Roles
create type public.app_role as enum ('admin', 'influencer', 'pharmacist');
create type public.sns_platform as enum ('instagram', 'xiaohongshu', 'facebook', 'other');
create type public.allocation_status as enum ('pending', 'verified', 'ready', 'picked_up', 'cancelled');

-- Auth-linked profile
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'influencer',
  display_name text,
  store_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_store_id_fkey
  foreign key (store_id) references public.stores (id) on delete set null;

-- Influencer master (may exist before they log in)
create table public.influencers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SNS handles used for identification / matching after OAuth
create table public.sns_identities (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers (id) on delete cascade,
  platform public.sns_platform not null,
  handle text not null,
  -- normalized: lowercase, strip leading @
  handle_normalized text generated always as (
    lower(regexp_replace(handle, '^@+', ''))
  ) stored,
  created_at timestamptz not null default now(),
  unique (platform, handle_normalized)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  description text,
  created_at timestamptz not null default now()
);

-- Who gets what at which store
create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  store_id uuid not null references public.stores (id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  status public.allocation_status not null default 'pending',
  visit_code text,
  verified_at timestamptz,
  picked_up_at timestamptz,
  picked_up_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index allocations_influencer_idx on public.allocations (influencer_id);
create index allocations_store_idx on public.allocations (store_id);
create index allocations_status_idx on public.allocations (status);
create index sns_identities_handle_idx on public.sns_identities (platform, handle_normalized);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'influencer'),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Link influencer row when SNS identity matches auth identity
create or replace function public.link_influencer_by_sns(
  p_platform public.sns_platform,
  p_handle text,
  p_visit_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_influencer_id uuid;
  v_uid uuid := auth.uid();
  v_norm text := lower(regexp_replace(p_handle, '^@+', ''));
  v_code_ok boolean := true;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select si.influencer_id into v_influencer_id
  from public.sns_identities si
  where si.platform = p_platform
    and si.handle_normalized = v_norm
  limit 1;

  if v_influencer_id is null then
    return null;
  end if;

  if p_visit_code is not null and length(trim(p_visit_code)) > 0 then
    select exists (
      select 1
      from public.allocations a
      where a.influencer_id = v_influencer_id
        and a.visit_code = trim(p_visit_code)
    ) into v_code_ok;

    if not v_code_ok then
      raise exception 'visit code mismatch';
    end if;
  end if;

  update public.influencers
  set profile_id = v_uid, updated_at = now()
  where id = v_influencer_id
    and (profile_id is null or profile_id = v_uid);

  update public.allocations
  set status = 'verified', verified_at = coalesce(verified_at, now()), updated_at = now()
  where influencer_id = v_influencer_id
    and status = 'pending';

  return v_influencer_id;
end;
$$;

grant execute on function public.link_influencer_by_sns(public.sns_platform, text, text) to authenticated;

-- Verify by Instagram handle only (no SNS OAuth / no login required)
create or replace function public.verify_influencer_by_handle(
  p_instagram_handle text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_influencer public.influencers%rowtype;
  v_norm text := lower(regexp_replace(trim(p_instagram_handle), '^@+', ''));
  v_allocations jsonb;
begin
  if v_norm is null or length(v_norm) = 0 then
    return null;
  end if;

  select i.* into v_influencer
  from public.influencers i
  join public.sns_identities si on si.influencer_id = i.id
  where si.platform = 'instagram'
    and si.handle_normalized = v_norm
  limit 1;

  if not found then
    return null;
  end if;

  update public.allocations
  set status = 'verified',
      verified_at = coalesce(verified_at, now()),
      updated_at = now()
  where influencer_id = v_influencer.id
    and status = 'pending';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'influencer_id', a.influencer_id,
        'product_id', a.product_id,
        'store_id', a.store_id,
        'quantity', a.quantity,
        'status', a.status,
        'visit_code', a.visit_code,
        'verified_at', a.verified_at,
        'picked_up_at', a.picked_up_at,
        'picked_up_by', a.picked_up_by,
        'created_at', a.created_at,
        'updated_at', a.updated_at,
        'product', to_jsonb(p),
        'store', to_jsonb(s),
        'products', to_jsonb(p),
        'stores', to_jsonb(s)
      )
      order by a.created_at desc
    ),
    '[]'::jsonb
  )
  into v_allocations
  from public.allocations a
  left join public.products p on p.id = a.product_id
  left join public.stores s on s.id = a.store_id
  where a.influencer_id = v_influencer.id;

  return jsonb_build_object(
    'influencer', to_jsonb(v_influencer),
    'allocations', v_allocations
  );
end;
$$;

create or replace function public.get_influencer_pass(p_influencer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_influencer public.influencers%rowtype;
  v_allocations jsonb;
begin
  select * into v_influencer
  from public.influencers
  where id = p_influencer_id;

  if not found then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'influencer_id', a.influencer_id,
        'product_id', a.product_id,
        'store_id', a.store_id,
        'quantity', a.quantity,
        'status', a.status,
        'visit_code', a.visit_code,
        'verified_at', a.verified_at,
        'picked_up_at', a.picked_up_at,
        'picked_up_by', a.picked_up_by,
        'created_at', a.created_at,
        'updated_at', a.updated_at,
        'product', to_jsonb(p),
        'store', to_jsonb(s),
        'products', to_jsonb(p),
        'stores', to_jsonb(s)
      )
      order by a.created_at desc
    ),
    '[]'::jsonb
  )
  into v_allocations
  from public.allocations a
  left join public.products p on p.id = a.product_id
  left join public.stores s on s.id = a.store_id
  where a.influencer_id = v_influencer.id;

  return jsonb_build_object(
    'influencer', to_jsonb(v_influencer),
    'allocations', v_allocations
  );
end;
$$;

grant execute on function public.verify_influencer_by_handle(text) to anon, authenticated;
grant execute on function public.get_influencer_pass(uuid) to anon, authenticated;

-- RLS helpers (must exist before policies / grants that reference them)
create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.influencers enable row level security;
alter table public.sns_identities enable row level security;
alter table public.products enable row level security;
alter table public.allocations enable row level security;

-- Profiles
create policy "profiles_select_own_or_staff"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.current_role() in ('admin', 'pharmacist')
  );

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (id = auth.uid() or public.current_role() = 'admin');

-- Stores
create policy "stores_read_authenticated"
  on public.stores for select
  to authenticated
  using (true);

create policy "stores_admin_write"
  on public.stores for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "stores_anon_all"
  on public.stores for all
  to anon
  using (true)
  with check (true);

-- Influencers
create policy "influencers_admin_all"
  on public.influencers for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "influencers_self_read"
  on public.influencers for select
  using (profile_id = auth.uid() or public.current_role() = 'pharmacist');

create policy "influencers_anon_all"
  on public.influencers for all
  to anon
  using (true)
  with check (true);

-- SNS identities
create policy "sns_admin_all"
  on public.sns_identities for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "sns_self_read"
  on public.sns_identities for select
  using (
    exists (
      select 1 from public.influencers i
      where i.id = influencer_id and i.profile_id = auth.uid()
    )
    or public.current_role() = 'pharmacist'
  );

create policy "sns_anon_all"
  on public.sns_identities for all
  to anon
  using (true)
  with check (true);

-- Products
create policy "products_read_authenticated"
  on public.products for select
  to authenticated
  using (true);

create policy "products_admin_write"
  on public.products for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "products_anon_all"
  on public.products for all
  to anon
  using (true)
  with check (true);

-- Allocations
create policy "allocations_admin_all"
  on public.allocations for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "allocations_influencer_read"
  on public.allocations for select
  using (
    exists (
      select 1 from public.influencers i
      where i.id = influencer_id and i.profile_id = auth.uid()
    )
  );

create policy "allocations_pharmacist_read"
  on public.allocations for select
  using (public.current_role() = 'pharmacist');

create policy "allocations_anon_all"
  on public.allocations for all
  to anon
  using (true)
  with check (true);

-- Seed helper: after first admin signs up via email, promote in SQL:
-- update public.profiles set role = 'admin' where id = '<user-uuid>';
