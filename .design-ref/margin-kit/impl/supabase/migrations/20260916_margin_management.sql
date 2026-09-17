-- Margin management (1단계) — additive migration
-- Base: kjh-dev-sweet4pot/BoardingPass_Demo v1.2.1
-- Run in Supabase SQL editor. Idempotent-ish: guards with IF NOT EXISTS where possible.
-- Does NOT touch: companies, campaigns, castings, allocations, allocation_pricing,
-- creator_links, influencers, products, company_budget_rounds (existing).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Column additions on existing tables
-- ---------------------------------------------------------------------------

alter table public.castings
  add column if not exists budget_plan_item_id uuid;

alter table public.influencers
  add column if not exists tier text; -- 'nano' | 'micro' | 'mid' | 'macro' | 'mega' | null

-- CONFIRM WITH BUDGET-TAB OWNER before running this one (Q9: 승인됨, but touches
-- a table owned by another feature — coordinate deploy timing).
alter table public.company_budget_rounds
  add column if not exists campaign_id uuid references public.campaigns (id);
-- Only 'usage' kind rows should ever have this set; enforce in application code
-- (a DB CHECK constraint referencing another column's value across kind is
-- possible via a trigger if you want it enforced at the DB level — optional).

-- ---------------------------------------------------------------------------
-- 2. New tables
-- ---------------------------------------------------------------------------

create table if not exists public.campaign_targets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null unique references public.campaigns (id) on delete cascade,
  target_publish_count integer not null default 0 check (target_publish_count >= 0),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_plan_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  tier text not null,                    -- nano | micro | mid | macro | mega
  content_type text,                     -- carousel | visit | seeding | null
  platform text,                         -- instagram | tiktok | youtube | naver_blog | etc | null
  unit_cost bigint not null check (unit_cost >= 0),
  slot_count integer not null check (slot_count > 0),
  expected_publish_per_slot integer not null default 1 check (expected_publish_per_slot >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists budget_plan_items_campaign_idx
  on public.budget_plan_items (campaign_id);

alter table public.castings
  add constraint if not exists castings_budget_plan_item_fk
  foreign key (budget_plan_item_id) references public.budget_plan_items (id);

create table if not exists public.campaign_other_costs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  cost_type text not null,               -- 광고비 | 상품제공가 | 대행수수료 | 기타
  amount bigint not null check (amount >= 0),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaign_other_costs_campaign_idx
  on public.campaign_other_costs (campaign_id);

create table if not exists public.creator_rate_cards (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers (id) on delete cascade,
  content_type text not null,            -- carousel | visit | seeding
  platform text not null,                -- instagram | tiktok | youtube | naver_blog | etc
  standard_cost bigint not null check (standard_cost >= 0),
  source text not null default 'manual', -- invoice | manual
  effective_from date not null default current_date,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_rate_cards_lookup_idx
  on public.creator_rate_cards (influencer_id, content_type, platform, effective_from desc);

create table if not exists public.margin_override_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  casting_id uuid references public.castings (id) on delete set null,
  margin_before numeric(5, 1),
  margin_after numeric(5, 1),
  warn_type text not null,               -- margin_low | margin_high | budget_over | slot_over
  reason text not null check (length(trim(reason)) > 0),
  actor text not null,
  created_at timestamptz not null default now()
);

create index if not exists margin_override_logs_campaign_idx
  on public.margin_override_logs (campaign_id);

-- 2단계 (참고용, 1단계에서는 생성만 하고 화면은 만들지 않음)
create table if not exists public.casting_cost_splits (
  id uuid primary key default gen_random_uuid(),
  casting_id uuid not null references public.castings (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  amount bigint not null check (amount >= 0),
  is_manual boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (casting_id, campaign_id)
);

-- ---------------------------------------------------------------------------
-- 3. Aggregate view
-- ---------------------------------------------------------------------------
-- NOTE: adjust join keys/column names to match the real castings/allocations
-- schema in BoardingPass_Demo before running — this assumes the shapes
-- described in the spec (verify against `src/lib/types.ts`).

create or replace view public.v_campaign_margin as
with committed as (
  select
    a.campaign_id,
    coalesce(sum(ap.cost_amount), 0) as committed_cost,
    coalesce(sum(ap.display_price), 0) as spent_display
  from public.allocations a
  join public.castings c on c.allocation_id = a.id
  join public.allocation_pricing ap on ap.allocation_id = a.id
  where c.status = 'Accept'
  group by a.campaign_id
),
realized as (
  select
    a.campaign_id,
    coalesce(sum(
      case when a.target_content_count > 0 then
        ap.cost_amount * least(
          (select count(*) from public.creator_links cl
            where cl.allocation_id = a.id and cl.content_status = '발행완료'),
          a.target_content_count
        )::numeric / a.target_content_count
      else 0 end
    ), 0) as realized_cost,
    coalesce(sum(
      (select count(*) from public.creator_links cl
        where cl.allocation_id = a.id and cl.content_status = '발행완료')
    ), 0) as published_count
  from public.allocations a
  join public.castings c on c.allocation_id = a.id
  join public.allocation_pricing ap on ap.allocation_id = a.id
  where c.status = 'Accept'
  group by a.campaign_id
),
other as (
  select campaign_id, coalesce(sum(amount), 0) as other_cost
  from public.campaign_other_costs
  group by campaign_id
),
planned as (
  select campaign_id, coalesce(sum(unit_cost * slot_count), 0) as planned_cost
  from public.budget_plan_items
  group by campaign_id
),
slots as (
  select
    bpi.campaign_id,
    coalesce(sum(bpi.slot_count), 0) as slot_total,
    coalesce(sum((
      select count(*) from public.castings c2 where c2.budget_plan_item_id = bpi.id
    )), 0) as slot_filled
  from public.budget_plan_items bpi
  group by bpi.campaign_id
)
select
  cam.id as campaign_id,
  cam.company_id,
  cam.budget_amount as revenue,
  coalesce(pl.planned_cost, 0) as planned_cost,
  coalesce(co.committed_cost, 0) as committed_cost,
  coalesce(co.spent_display, 0) as spent_display,
  coalesce(re.realized_cost, 0) as realized_cost,
  coalesce(ot.other_cost, 0) as other_cost,
  case when cam.budget_amount > 0
    then round(
      (cam.budget_amount - coalesce(co.committed_cost, 0) - coalesce(ot.other_cost, 0))
      / cam.budget_amount::numeric * 100, 1)
    else null end as committed_margin_rate,
  case when cam.budget_amount > 0
    then round(
      (cam.budget_amount - coalesce(re.realized_cost, 0) - coalesce(ot.other_cost, 0))
      / cam.budget_amount::numeric * 100, 1)
    else null end as realized_margin_rate,
  case when cam.budget_amount > 0
    then round(coalesce(co.committed_cost, 0) / (cam.budget_amount * 0.30) * 100, 1)
    else null end as burn_rate,
  case when cam.budget_amount > 0
    then round(coalesce(co.spent_display, 0) / cam.budget_amount::numeric * 100, 1)
    else null end as spend_pct,
  ct.target_publish_count,
  coalesce(re.published_count, 0) as published_count,
  coalesce(sl.slot_total, 0) as slot_total,
  coalesce(sl.slot_filled, 0) as slot_filled
from public.campaigns cam
left join committed co on co.campaign_id = cam.id
left join realized re on re.campaign_id = cam.id
left join other ot on ot.campaign_id = cam.id
left join planned pl on pl.campaign_id = cam.id
left join slots sl on sl.campaign_id = cam.id
left join public.campaign_targets ct on ct.campaign_id = cam.id
where cam.status <> '취소';
