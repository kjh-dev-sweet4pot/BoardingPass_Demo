-- Alpha access: Admin uses cookie auth (no Supabase Auth email).
-- Allow anon key to read/write business tables so Admin/Phar work.
-- Run once in Supabase SQL Editor.

-- Stores
drop policy if exists "stores_anon_all" on public.stores;
create policy "stores_anon_all"
  on public.stores for all
  to anon
  using (true)
  with check (true);

-- Products
drop policy if exists "products_anon_all" on public.products;
create policy "products_anon_all"
  on public.products for all
  to anon
  using (true)
  with check (true);

-- Influencers
drop policy if exists "influencers_anon_all" on public.influencers;
create policy "influencers_anon_all"
  on public.influencers for all
  to anon
  using (true)
  with check (true);

-- SNS identities
drop policy if exists "sns_anon_all" on public.sns_identities;
create policy "sns_anon_all"
  on public.sns_identities for all
  to anon
  using (true)
  with check (true);

-- Allocations
drop policy if exists "allocations_anon_all" on public.allocations;
create policy "allocations_anon_all"
  on public.allocations for all
  to anon
  using (true)
  with check (true);
