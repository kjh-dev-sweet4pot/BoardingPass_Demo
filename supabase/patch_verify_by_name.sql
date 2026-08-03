-- Run this in Supabase SQL Editor if schema.sql was already applied earlier.
-- Adds name + Instagram handle verification (no SNS OAuth).

create or replace function public.verify_influencer_by_name_handle(
  p_name text,
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
  v_name text := lower(trim(p_name));
  v_allocations jsonb;
begin
  select i.* into v_influencer
  from public.influencers i
  join public.sns_identities si on si.influencer_id = i.id
  where lower(trim(i.name)) = v_name
    and si.platform = 'instagram'
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

grant execute on function public.verify_influencer_by_name_handle(text, text) to anon, authenticated;
grant execute on function public.get_influencer_pass(uuid) to anon, authenticated;
