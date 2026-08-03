-- Minimal Boarding Pass schema (4 tables)
-- Run in Supabase SQL Editor (fresh or after dropping old public tables)

create extension if not exists "pgcrypto";

create type public.allocation_status as enum (
  'pending',
  'verified',
  'ready',
  'picked_up',
  'cancelled'
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  description text,
  created_at timestamptz not null default now()
);

create table public.influencers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  instagram_handle text not null,
  instagram_handle_normalized text generated always as (
    lower(regexp_replace(instagram_handle, '^@+', ''))
  ) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instagram_handle_normalized)
);

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index allocations_influencer_idx on public.allocations (influencer_id);
create index allocations_store_idx on public.allocations (store_id);
create index allocations_status_idx on public.allocations (status);
create index allocations_created_idx on public.allocations (created_at);
create index influencers_handle_idx on public.influencers (instagram_handle_normalized);

-- Alpha: open anon access (Admin uses cookie auth, Inf/Phar use anon key)
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.influencers enable row level security;
alter table public.allocations enable row level security;

create policy "stores_anon_all" on public.stores for all to anon using (true) with check (true);
create policy "products_anon_all" on public.products for all to anon using (true) with check (true);
create policy "influencers_anon_all" on public.influencers for all to anon using (true) with check (true);
create policy "allocations_anon_all" on public.allocations for all to anon using (true) with check (true);

create policy "stores_auth_all" on public.stores for all to authenticated using (true) with check (true);
create policy "products_auth_all" on public.products for all to authenticated using (true) with check (true);
create policy "influencers_auth_all" on public.influencers for all to authenticated using (true) with check (true);
create policy "allocations_auth_all" on public.allocations for all to authenticated using (true) with check (true);

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
