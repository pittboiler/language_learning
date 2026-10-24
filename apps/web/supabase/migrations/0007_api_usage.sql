-- Per-user usage ledger for the paid /api routes (speech, coaching, look-ups, AI review). One row per user,
-- UTC day and route: how many paid calls, and roughly what they cost. The server checks it before each paid
-- call (a per-route daily cap, and a total daily spend cap across routes) and adds the cost afterwards; the
-- caps themselves live in apps/web/lib/usage.ts. Calls that cost nothing (a cached clip or answer, a course
-- word, an exact-match spoken line) are never counted.
--
-- Only the server touches this, with the service-role key. RLS is on with NO policies, and the functions are
-- not callable by anon/authenticated clients, so nobody can read, reset or inflate another user's counts.
-- Replaces ai_ask_usage (0006) for the "Have a question?" limit; that table is no longer written.
create table if not exists public.api_usage (
  user_id  uuid    not null,
  day      date    not null,
  route    text    not null,
  calls    integer not null default 0,
  cost_usd numeric(10, 4) not null default 0,
  primary key (user_id, day, route)
);

alter table public.api_usage enable row level security;
-- (deliberately no policies: server-only via service role)

-- Count one paid call, if the user is under both caps for today. Returns false (counting nothing) when over.
-- The per-route check and the increment are one statement, so concurrent calls can't slip past the cap.
create or replace function public.api_usage_hit(p_user uuid, p_route text, p_call_cap integer, p_cost_cap numeric)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  spent numeric;
  n integer;
begin
  select coalesce(sum(cost_usd), 0) into spent from api_usage where user_id = p_user and day = today;
  if spent >= p_cost_cap then
    return false;
  end if;
  insert into api_usage as u (user_id, day, route, calls) values (p_user, today, p_route, 1)
  on conflict (user_id, day, route) do update set calls = u.calls + 1 where u.calls < p_call_cap
  returning u.calls into n;
  return n is not null;
end;
$$;

-- Add what a call cost to today's row for that route (best-effort; called after the response is sent).
create or replace function public.api_usage_cost(p_user uuid, p_route text, p_cost numeric)
returns void
language sql
security definer
set search_path = public
as $$
  insert into api_usage (user_id, day, route, calls, cost_usd)
  values (p_user, (now() at time zone 'utc')::date, p_route, 0, greatest(p_cost, 0))
  on conflict (user_id, day, route) do update set cost_usd = api_usage.cost_usd + greatest(excluded.cost_usd, 0);
$$;

revoke all on function public.api_usage_hit(uuid, text, integer, numeric) from public, anon, authenticated;
revoke all on function public.api_usage_cost(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.api_usage_hit(uuid, text, integer, numeric) to service_role;
grant execute on function public.api_usage_cost(uuid, text, numeric) to service_role;
