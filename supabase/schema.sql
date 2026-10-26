-- AI Tools PAK: run once in Supabase Dashboard > SQL Editor > New query > Run.
-- The browser must NEVER access these tables or use the server secret key.
-- This simple study app stores its site state as a PostgreSQL JSONB document.

create table if not exists public.ai_tools_state (
  id integer primary key check (id = 1),
  revision bigint not null default 0 check (revision >= 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.ai_tools_state enable row level security;
revoke all on table public.ai_tools_state from anon, authenticated;
grant select, insert, update on table public.ai_tools_state to service_role;

insert into public.ai_tools_state (id, revision, payload)
values (1, 0, '{"clicks":[],"tokens":[],"reviews":[],"orders":[],"questions":[]}'::jsonb)
on conflict (id) do nothing;

-- Compare-and-set prevents parallel checkout requests from overwriting each other.
create or replace function public.ai_tools_compare_and_save(
  expected_revision bigint,
  next_payload jsonb
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare updated_count integer;
begin
  if next_payload is null or jsonb_typeof(next_payload) <> 'object' then
    raise exception 'Invalid site data';
  end if;
  update public.ai_tools_state
  set revision = revision + 1, payload = next_payload, updated_at = now()
  where id = 1 and revision = expected_revision;
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function public.ai_tools_compare_and_save(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.ai_tools_compare_and_save(bigint, jsonb) to service_role;

-- Global admin login throttle: persists across stateless Vercel function instances.
create table if not exists public.ai_tools_admin_attempts (
  ip_hash text primary key,
  failures integer not null default 0 check (failures >= 0),
  expires_at timestamptz not null
);
alter table public.ai_tools_admin_attempts enable row level security;
revoke all on table public.ai_tools_admin_attempts from anon, authenticated;
grant select, insert, update on table public.ai_tools_admin_attempts to service_role;

create or replace function public.ai_tools_admin_attempt(
  p_ip_hash text,
  p_failed boolean
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare result_count integer;
begin
  if length(p_ip_hash) <> 64 then
    raise exception 'Invalid request';
  end if;
  if p_failed then
    insert into public.ai_tools_admin_attempts as attempts (ip_hash, failures, expires_at)
    values (p_ip_hash, 1, now() + interval '15 minutes')
    on conflict (ip_hash) do update
      set failures = case when attempts.expires_at <= now() then 1
                          else least(attempts.failures + 1, 10000) end,
          expires_at = case when attempts.expires_at <= now() then now() + interval '15 minutes'
                            else attempts.expires_at end
    returning failures into result_count;
  else
    select failures into result_count from public.ai_tools_admin_attempts
    where ip_hash = p_ip_hash and expires_at > now();
  end if;
  return coalesce(result_count, 0);
end;
$$;

revoke all on function public.ai_tools_admin_attempt(text, boolean) from public, anon, authenticated;
grant execute on function public.ai_tools_admin_attempt(text, boolean) to service_role;

-- Rerunning this script does not delete orders, prices, reviews or admin settings.
