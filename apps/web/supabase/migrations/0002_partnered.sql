-- Partnered learning (Phase 0): the cross-user tables + the publish-projection model.
-- The single-user invariant is preserved — public.user_state (0001) is UNCHANGED and stays own-row-only.
-- This is the FIRST place one user may read another's data, so the privacy surface is deliberate:
--   • partner_published_state — ANY partnership member may READ; only the OWNER may WRITE.
--   • member identity (a/b_user_id) is set ONLY via security-definer RPCs, never by a direct UPDATE.
-- Safe to re-run (mirrors 0001): create-if-not-exists, create-or-replace, drop-then-create policies.
-- See DESIGN-partnered-learning.md §1.1 / §3.5. Run in the Supabase SQL editor (or `supabase db push`).

-- ─────────────────────────────────────── tables ───────────────────────────────────────

-- The link. Pack-scoped, dyad-optimized: two explicit member slots (invitee null until redeemed).
create table if not exists public.partnership (
  id          uuid primary key default gen_random_uuid(),
  pack_id     text not null,
  a_user_id   uuid not null references auth.users(id) on delete cascade,   -- inviter
  b_user_id   uuid          references auth.users(id) on delete cascade,   -- invitee (null until claimed)
  status      text not null default 'pending',                            -- pending | active | paused | ended
  invite_code text unique,                                                -- short code the invitee redeems
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists partnership_a_idx on public.partnership (a_user_id);
create index if not exists partnership_b_idx on public.partnership (b_user_id);

-- Per-member privacy controls (each member writes only their own row).
create table if not exists public.partner_visibility (
  partnership_id uuid not null references public.partnership(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  settings       jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now(),
  primary key (partnership_id, user_id)
);

-- The publish-projection: each member writes a visibility-gated snapshot the PARTNER may read.
-- The raw user_state blob never crosses the boundary — only this projection does.
create table if not exists public.partner_published_state (
  partnership_id uuid not null references public.partnership(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  pack_id        text not null,
  data           jsonb not null default '{}'::jsonb,  -- { activity, familiarity? } (familiarity is Phase 2)
  updated_at     timestamptz not null default now(),
  primary key (partnership_id, user_id)
);

-- Collaborative artifacts both members read + write: phrasebook | roleswap | teachback | infogap | nudge.
-- One kind-discriminated table for the MVP (splits per-kind only if volume demands — §3.5 scale note).
create table if not exists public.partner_artifact (
  id             uuid primary key default gen_random_uuid(),
  partnership_id uuid not null references public.partnership(id) on delete cascade,
  pack_id        text not null,
  kind           text not null,
  created_by     uuid not null references auth.users(id) on delete cascade,
  status         text not null default 'open',
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists partner_artifact_lookup_idx on public.partner_artifact (partnership_id, kind, created_at);

-- ─────────────────────────── membership predicate + mutation RPCs ───────────────────────────

-- "Is the caller a member of this partnership?" — the spine of every cross-user policy.
create or replace function public.is_partner_member(pid uuid)
  returns boolean language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from public.partnership p
      where p.id = pid and auth.uid() in (p.a_user_id, p.b_user_id)
    );
$$;

-- Redeem an invite: the ONLY way b_user_id is ever set (definer bypasses RLS; the invitee isn't a
-- member yet, so they can't see the pending row directly). Guards: pending, unclaimed, not self.
create or replace function public.redeem_partner_invite(code text)
  returns public.partnership language plpgsql security definer set search_path = public as $$
declare claimed public.partnership;
begin
  update public.partnership
     set b_user_id = auth.uid(), status = 'active', updated_at = now()
   where invite_code = code and status = 'pending' and b_user_id is null and a_user_id <> auth.uid()
  returning * into claimed;
  if claimed.id is null then
    raise exception 'invalid or already-used invite code';
  end if;
  insert into public.partner_visibility (partnership_id, user_id, settings)
  values (claimed.id, auth.uid(),
          '{"shareActivity":true,"shareFamiliarity":true,"shareStreak":true,"allowTeachBack":true}'::jsonb)
  on conflict (partnership_id, user_id) do nothing;
  return claimed;
end;
$$;

-- Status transitions (pause / resume / end). Members only; member identity columns never change here.
create or replace function public.set_partnership_status(pid uuid, new_status text)
  returns public.partnership language plpgsql security definer set search_path = public as $$
declare updated public.partnership;
begin
  if new_status not in ('active', 'paused', 'ended') then
    raise exception 'invalid status %', new_status;
  end if;
  update public.partnership set status = new_status, updated_at = now()
   where id = pid and auth.uid() in (a_user_id, b_user_id)
  returning * into updated;
  if updated.id is null then raise exception 'not a member of this partnership'; end if;
  return updated;
end;
$$;

-- ─────────────────────────────────────── RLS ───────────────────────────────────────

alter table public.partnership            enable row level security;
alter table public.partner_visibility      enable row level security;
alter table public.partner_published_state enable row level security;
alter table public.partner_artifact        enable row level security;

-- partnership: members SELECT their own row; an inviter may INSERT a pending invite as themselves.
-- No direct UPDATE/DELETE — status changes + invite redemption go through the definer RPCs above,
-- so a_user_id / b_user_id can never be rewritten by a member.
drop policy if exists "partnership read"   on public.partnership;
drop policy if exists "partnership insert" on public.partnership;
create policy "partnership read"   on public.partnership for select using (auth.uid() in (a_user_id, b_user_id));
create policy "partnership insert" on public.partnership for insert
  with check (auth.uid() = a_user_id and status = 'pending' and b_user_id is null);

-- visibility: own-row only (you never need to read your partner's toggles).
drop policy if exists "visibility own" on public.partner_visibility;
create policy "visibility own" on public.partner_visibility for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_partner_member(partnership_id));

-- published_state: THE surgical asymmetry — any member READS, only the OWNER WRITES.
drop policy if exists "published read"   on public.partner_published_state;
drop policy if exists "published insert" on public.partner_published_state;
drop policy if exists "published update" on public.partner_published_state;
create policy "published read"   on public.partner_published_state for select
  using (public.is_partner_member(partnership_id));
create policy "published insert" on public.partner_published_state for insert
  with check (user_id = auth.uid() and public.is_partner_member(partnership_id));
create policy "published update" on public.partner_published_state for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- artifacts: both members read + write (truly shared); inserts are stamped with the creator.
drop policy if exists "artifact read"   on public.partner_artifact;
drop policy if exists "artifact insert" on public.partner_artifact;
drop policy if exists "artifact update" on public.partner_artifact;
drop policy if exists "artifact delete" on public.partner_artifact;
create policy "artifact read"   on public.partner_artifact for select using (public.is_partner_member(partnership_id));
create policy "artifact insert" on public.partner_artifact for insert
  with check (public.is_partner_member(partnership_id) and created_by = auth.uid());
create policy "artifact update" on public.partner_artifact for update
  using (public.is_partner_member(partnership_id)) with check (public.is_partner_member(partnership_id));
create policy "artifact delete" on public.partner_artifact for delete using (public.is_partner_member(partnership_id));

-- ─────────────────────────────────── grants + storage ───────────────────────────────────

-- Table privileges for the API roles (RLS gates rows; without GRANTs PostgREST hides the tables).
grant select, insert, update, delete
  on public.partnership, public.partner_visibility, public.partner_published_state, public.partner_artifact
  to anon, authenticated;
grant execute on function public.is_partner_member(uuid)            to anon, authenticated;
grant execute on function public.redeem_partner_invite(text)        to anon, authenticated;
grant execute on function public.set_partnership_status(uuid, text) to anon, authenticated;

-- Private bucket for role-swap / teach-back audio (object policies land with Phase 1, when audio exists).
insert into storage.buckets (id, name, public) values ('partner-media', 'partner-media', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
