-- ADDITIVE migration: run after schema.sql. Does not touch ai_tools_state or orders.
-- Back up Supabase data first. Server-only access via service-role/secret key.
create table if not exists public.ai_tools_catalog_settings (
 id integer primary key default 1 check (id=1), usd_to_pkr integer not null default 300 check (usd_to_pkr between 1 and 100000), updated_at timestamptz not null default now()
);
insert into public.ai_tools_catalog_settings(id,usd_to_pkr) values (1,300) on conflict(id) do nothing;
create table if not exists public.ai_tools_catalog (
 slug text primary key check(length(slug) between 4 and 150),
 group_slug text not null, brand text not null, name text not null,
 description text not null default '', category text not null,
 variant text not null default '', product_type text not null default '',
 cost_cents bigint not null check (cost_cents > 0 and cost_cents <= 1000000000),
 price_pkr bigint not null check (price_pkr > 0),
 manual_price_pkr bigint check (manual_price_pkr is null or manual_price_pkr > 0),
 discount_percent integer not null default 0 check (discount_percent between 0 and 90),
 source_ids jsonb not null default '[]'::jsonb,
 review_flags jsonb not null default '[]'::jsonb,
 status text not null default 'pending' check (status in ('pending','published','hidden','rejected')),
 featured boolean not null default false,
 unavailable boolean not null default false,
 updated_at timestamptz not null default now()
);
create index if not exists ai_tools_catalog_group_idx on public.ai_tools_catalog(group_slug,status);
create index if not exists ai_tools_catalog_category_idx on public.ai_tools_catalog(category,status);
create index if not exists ai_tools_catalog_featured_idx on public.ai_tools_catalog(featured,status);

alter table public.ai_tools_catalog enable row level security;
alter table public.ai_tools_catalog_settings enable row level security;
revoke all on public.ai_tools_catalog from anon,authenticated;
revoke all on public.ai_tools_catalog_settings from anon,authenticated;
grant select,insert,update,delete on public.ai_tools_catalog to service_role;
grant select,insert,update on public.ai_tools_catalog_settings to service_role;

-- Repeated imports: retain manual edits, publish decisions and discounts.
-- Highest cost wins. Existing review workflow remains intact.
-- Selling price = ROUND(USD cost * 1.25 * admin USD/PKR rate).
create or replace function public.ai_tools_import_catalog(rows jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare item jsonb; updated_count int := 0; rate int; matching_slug text;
begin
 select usd_to_pkr into rate from public.ai_tools_catalog_settings where id=1;
 if rate is null then raise exception 'Run catalog migration first'; end if;
 if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) > 30 then raise exception 'Batch must contain up to 30 rows'; end if;
 for item in select value from jsonb_array_elements(rows) loop
   if coalesce(item->>'slug','') !~ '^import-[a-z0-9-]{5,140}$' then raise exception 'Invalid import slug'; end if;
   if (item->>'cost_cents')::bigint not between 1 and 1000000000 then raise exception 'Invalid cost'; end if;
   matching_slug := null;
   select c.slug into matching_slug from public.ai_tools_catalog c
     where c.source_ids ? (item->'source_ids'->>0) limit 1;
   if matching_slug is not null then
     item := jsonb_set(item,'{slug}',to_jsonb(matching_slug));
   end if;
   insert into public.ai_tools_catalog(slug,group_slug,brand,name,description,category,variant,product_type,cost_cents,price_pkr,source_ids,review_flags,unavailable)
   values (
      item->>'slug', item->>'group_slug', left(item->>'brand',100), left(item->>'name',230),
      left(item->>'description',540), item->>'category', left(item->>'variant',230), left(item->>'product_type',50),
      (item->>'cost_cents')::bigint,
      round(((item->>'cost_cents')::numeric / 100) * 1.25 * rate)::bigint,
      item->'source_ids', item->'flags', coalesce((item->>'unavailable')::boolean,false)
   )
   on conflict(slug) do update set
      cost_cents = greatest(public.ai_tools_catalog.cost_cents,excluded.cost_cents),
      price_pkr = round((greatest(public.ai_tools_catalog.cost_cents,excluded.cost_cents)::numeric / 100) * 1.25 * rate)::bigint,
      source_ids = (select jsonb_agg(distinct value) from jsonb_array_elements(public.ai_tools_catalog.source_ids || excluded.source_ids) as e(value)),
      review_flags = excluded.review_flags,
      updated_at=now();
   updated_count := updated_count+1;
 end loop;
 return updated_count;
end $$;
revoke all on function public.ai_tools_import_catalog(jsonb) from public,anon,authenticated;
grant execute on function public.ai_tools_import_catalog(jsonb) to service_role;

-- Reprice all imported records after an ADMIN chooses another rate. Manual price overrides stay unchanged.
create or replace function public.ai_tools_reprice_catalog()
returns integer language plpgsql security invoker set search_path=public as $$
declare rate int; affected int;
begin
 select usd_to_pkr into rate from public.ai_tools_catalog_settings where id=1;
 update public.ai_tools_catalog set price_pkr=round((cost_cents::numeric/100)*1.25*rate)::bigint, updated_at=now();
 get diagnostics affected = row_count;
 return affected;
end $$;
revoke all on function public.ai_tools_reprice_catalog() from public,anon,authenticated;
grant execute on function public.ai_tools_reprice_catalog() to service_role;
