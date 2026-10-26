-- AI TOOLS PAK: 25% markup migration for EXISTING imported products.
-- IMPORTANT: This works on the Supabase database in which you run it.
-- If that database is shared with your LIVE website, public prices change IMMEDIATELY.
-- Run once ONLY when you are ready to change the existing catalogue prices.
-- No tables are dropped; orders, reviews, discounts and manual_price_pkr are untouched.
-- It is safe to re-run: every price is calculated from original private USD cost_cents.

begin;

-- Fail clearly when the catalog migration was not run earlier.
do $$
begin
 if to_regclass('public.ai_tools_catalog') is null or to_regclass('public.ai_tools_catalog_settings') is null then
   raise exception 'Missing catalog tables. Apply supabase/catalog_migration.sql first.';
 end if;
 if not exists(select 1 from public.ai_tools_catalog_settings where id=1) then
   raise exception 'Missing exchange-rate settings row (id=1).';
 end if;
end $$;

-- Replace the existing 15% functions, preserving all their other behavior.
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

-- Recalculate ONLY calculated selling prices from private USD costs.
-- Preserve manual_price_pkr, discounts, customer orders and all other fields.
-- The per-site exchange rate is read from existing settings (default 300 PKR/USD).
update public.ai_tools_catalog as c
set price_pkr = round((c.cost_cents::numeric / 100) * 1.25 * settings.usd_to_pkr)::bigint,
    updated_at = now()
from public.ai_tools_catalog_settings as settings
where settings.id=1
  and c.price_pkr is distinct from round((c.cost_cents::numeric / 100) * 1.25 * settings.usd_to_pkr)::bigint;

commit;

-- Read-only summary for confirmation (does not expose private costs).
select count(*) as total_imported_variants,
       count(*) filter (where manual_price_pkr is not null) as manual_price_overrides_unchanged
from public.ai_tools_catalog;
