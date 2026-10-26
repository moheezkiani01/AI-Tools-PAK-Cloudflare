-- OPTIONAL, ADDITIVE SQL: keep this disabled until tested on a staging project.
-- One dedicated row per checkout avoids rewriting/contending over ai_tools_state.
-- DOES NOT delete or move existing legacy orders. Existing orders remain accessible
-- from ai_tools_state. Only backend service_role may read/write this table.

create table if not exists public.ai_tools_checkout_orders (
  number text primary key check (length(number) between 8 and 32),
  idempotency_key text not null unique,
  date timestamptz not null default now(),
  status text not null default 'Pending' check (status in ('Pending','Completed','Cancelled')),
  customer jsonb not null check (jsonb_typeof(customer) = 'object'),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  total bigint not null check (total >= 0)
);
create index if not exists ai_tools_checkout_orders_by_date
  on public.ai_tools_checkout_orders(date desc);
alter table public.ai_tools_checkout_orders enable row level security;
revoke all on table public.ai_tools_checkout_orders from public, anon, authenticated;
grant select, insert, update on table public.ai_tools_checkout_orders to service_role;

-- Atomic idempotency: concurrent retries with the same key return the SAME order.
create or replace function public.ai_tools_create_checkout_order(
  p_number text, p_idempotency_key text, p_customer jsonb, p_items jsonb, p_total bigint
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare saved record;
begin
  if length(coalesce(p_number,'')) < 8
     or length(coalesce(p_idempotency_key,'')) < 32
     or jsonb_typeof(p_customer) is distinct from 'object'
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) < 1
     or p_total < 0 then
    raise exception 'Invalid order request';
  end if;
  insert into public.ai_tools_checkout_orders (number,idempotency_key,customer,items,total)
  values (p_number,p_idempotency_key,p_customer,p_items,p_total)
  on conflict (idempotency_key) do nothing
  returning number,total into saved;
  if saved.number is null then
    select number,total into saved from public.ai_tools_checkout_orders
      where idempotency_key = p_idempotency_key;
  end if;
  if saved.number is null then raise exception 'Could not confirm order'; end if;
  return jsonb_build_object('number',saved.number,'total',saved.total);
end $$;
revoke all on function public.ai_tools_create_checkout_order(text,text,jsonb,jsonb,bigint)
 from public, anon, authenticated;
grant execute on function public.ai_tools_create_checkout_order(text,text,jsonb,jsonb,bigint)
 to service_role;

-- Compact summary for the existing admin graphs; never sends customer PII.
create or replace function public.ai_tools_checkout_order_summary()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'total', (select count(*)::integer from public.ai_tools_checkout_orders),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('date',day,'count',count) order by day)
      from (
        select (date at time zone 'Asia/Karachi')::date::text as day,
               count(*)::integer as count
        from public.ai_tools_checkout_orders
        where date >= now() - interval '17 days'
        group by 1
      ) recent
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.ai_tools_checkout_order_summary()
 from public, anon, authenticated;
grant execute on function public.ai_tools_checkout_order_summary() to service_role;
