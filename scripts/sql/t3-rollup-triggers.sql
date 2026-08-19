-- T3. 콘텐츠 -> 배정 -> 캠페인 롤업 트리거
-- Supabase SQL Editor에서 실행
--
-- 핵심:
-- - creator_links.content_status 변경 시 allocations.rollup_status 재계산
-- - allocations.rollup_status 변경 시 campaigns.status 재계산
-- - campaigns.status = '보류' | '취소' 는 롤업보다 우선
-- - campaigns.status = '취소' 일 때는 발행완료가 아닌 배정을 일괄 취소(= rollup_status='취소')

-- ---------------------------------------------------------------------------
-- 헬퍼: allocation 롤업 산출
-- ---------------------------------------------------------------------------

create or replace function public.compute_allocation_rollup_status(allocation_uuid uuid)
returns text
language plpgsql
stable
as $$
declare
  a public.allocations%rowtype;
  c_status text;
  submitted_cnt integer;
  published_cnt integer;
  target_cnt integer;
begin
  select * into a
  from public.allocations
  where id = allocation_uuid;

  if not found then
    return null;
  end if;

  select c.status into c_status
  from public.campaigns c
  where c.id = a.campaign_id;

  select count(*) into submitted_cnt
  from public.creator_links cl
  where cl.allocation_id = allocation_uuid
    and cl.content_status is not null;

  select count(*) into published_cnt
  from public.creator_links cl
  where cl.allocation_id = allocation_uuid
    and cl.content_status = '발행완료';

  target_cnt := a.target_content_count;

  -- 배정 자체 취소는 최우선
  if a.status = 'cancelled' then
    return '취소';
  end if;

  -- 캠페인 취소는 발행완료가 아닌 배정을 취소로 강제
  if c_status = '취소' then
    if target_cnt is not null
      and target_cnt > 0
      and published_cnt >= target_cnt then
      return '발행완료';
    end if;
    return '취소';
  end if;

  -- 롤업 규칙표 적용
  if submitted_cnt = 0 then
    return '제작중';
  end if;

  if target_cnt is not null
    and target_cnt > 0
    and published_cnt >= target_cnt then
    return '발행완료';
  end if;

  return '검수중';
end;
$$;

-- ---------------------------------------------------------------------------
-- 헬퍼: campaign 롤업 산출
-- ---------------------------------------------------------------------------

create or replace function public.compute_campaign_rollup_status(campaign_uuid uuid)
returns text
language plpgsql
stable
as $$
declare
  alloc_cnt integer;
  all_published boolean;
begin
  select count(*) into alloc_cnt
  from public.allocations a
  where a.campaign_id = campaign_uuid;

  if alloc_cnt = 0 then
    return '견적수립';
  end if;

  select bool_and(coalesce(a.rollup_status, '') = '발행완료')
    into all_published
  from public.allocations a
  where a.campaign_id = campaign_uuid;

  if all_published then
    return '결과';
  end if;

  return '시행';
end;
$$;

-- ---------------------------------------------------------------------------
-- 리프레시: allocation + 필요 시 campaign
-- ---------------------------------------------------------------------------

create or replace function public.refresh_allocation_rollups(allocation_uuid uuid)
returns void
language plpgsql
security definer
as $$
declare
  campaign_uuid uuid;
begin
  select a.campaign_id into campaign_uuid
  from public.allocations a
  where a.id = allocation_uuid;

  update public.allocations
  set rollup_status = public.compute_allocation_rollup_status(allocation_uuid),
      updated_at = now()
  where id = allocation_uuid;

  if campaign_uuid is not null then
    update public.campaigns c
    set status = public.compute_campaign_rollup_status(campaign_uuid)
    where c.id = campaign_uuid
      and c.status not in ('보류', '취소');
  end if;
end;
$$;

create or replace function public.refresh_campaign_rollup(campaign_uuid uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.campaigns c
  set status = public.compute_campaign_rollup_status(campaign_uuid)
  where c.id = campaign_uuid
    and c.status not in ('보류', '취소');
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists trg_creator_links_rollup on public.creator_links;
drop trigger if exists trg_allocations_rollup on public.allocations;
drop trigger if exists trg_campaigns_rollup on public.campaigns;

-- creator_links: content_status 변경/삽입/삭제 -> allocation rollup 재계산
create or replace function public.trg_creator_links_rollup()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    perform public.refresh_allocation_rollups(new.allocation_id);
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    if (new.allocation_id is distinct from old.allocation_id)
      or (new.content_status is distinct from old.content_status) then
      perform public.refresh_allocation_rollups(old.allocation_id);
      perform public.refresh_allocation_rollups(new.allocation_id);
    end if;
    return new;
  end if;

  if TG_OP = 'DELETE' then
    perform public.refresh_allocation_rollups(old.allocation_id);
    return old;
  end if;

  return null;
end;
$$;

create trigger trg_creator_links_rollup
after insert or update or delete on public.creator_links
for each row
execute function public.trg_creator_links_rollup();

-- allocations: target_content_count/campaign_id/status 변경 -> rollup 재계산
create or replace function public.trg_allocations_rollup()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    perform public.refresh_allocation_rollups(new.id);
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    if (new.target_content_count is distinct from old.target_content_count)
      or (new.campaign_id is distinct from old.campaign_id)
      or (new.status is distinct from old.status) then
      perform public.refresh_allocation_rollups(new.id);

      -- 캠페인이 바뀌면 양쪽 캠페인을 모두 재계산
      if new.campaign_id is distinct from old.campaign_id then
        if old.campaign_id is not null then
          perform public.refresh_campaign_rollup(old.campaign_id);
        end if;
        if new.campaign_id is not null then
          perform public.refresh_campaign_rollup(new.campaign_id);
        end if;
      end if;
    end if;
    return new;
  end if;

  return null;
end;
$$;

create trigger trg_allocations_rollup
after insert or update on public.allocations
for each row
execute function public.trg_allocations_rollup();

-- campaigns: 보류/취소 변경 -> 하위 배정 또는 상위 재계산
create or replace function public.trg_campaigns_rollup()
returns trigger
language plpgsql
as $$
declare
  a record;
begin
  if TG_OP = 'UPDATE' then
    -- 취소 진입/이탈: 하위 배정 롤업 강제 반영
    if new.status = '취소' and old.status is distinct from '취소' then
      for a in select id from public.allocations where campaign_id = new.id loop
        perform public.refresh_allocation_rollups(a.id);
      end loop;
    elsif old.status = '취소' and new.status is distinct from '취소' then
      for a in select id from public.allocations where campaign_id = new.id loop
        perform public.refresh_allocation_rollups(a.id);
      end loop;
    end if;

    -- 보류 해제(또는 취소 해제) 시 재계산
    if new.status not in ('보류', '취소') then
      perform public.refresh_campaign_rollup(new.id);
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_campaigns_rollup
after update of status on public.campaigns
for each row
execute function public.trg_campaigns_rollup();

-- ---------------------------------------------------------------------------
-- Index (조회 성능)
-- ---------------------------------------------------------------------------

create index if not exists creator_links_allocation_content_status_idx
  on public.creator_links (allocation_id, content_status);

create index if not exists allocations_campaign_rollup_idx
  on public.allocations (campaign_id, rollup_status);

-- ponytail: self-check (실행 후 정책 존재 여부 확인)
-- select proname from pg_proc where proname in (
--   'compute_allocation_rollup_status',
--   'compute_campaign_rollup_status',
--   'refresh_allocation_rollups',
--   'refresh_campaign_rollup'
-- );
-- select tgname from pg_trigger where tgrelid = 'public.creator_links'::regclass;
-- select tgname from pg_trigger where tgrelid = 'public.allocations'::regclass;
-- select tgname from pg_trigger where tgrelid = 'public.campaigns'::regclass;

