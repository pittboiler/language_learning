-- Generic per-user state — language-agnostic (one JSONB Progress blob per user, mirroring the
-- Store interface). Run this once in the Supabase SQL editor (or `supabase db push`).

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

-- Each user (including anonymous sessions) can only touch their own row.
-- drop-then-create makes this whole file safe to re-run (fixes a stale PostgREST schema cache).
drop policy if exists "own state read"   on public.user_state;
drop policy if exists "own state insert" on public.user_state;
drop policy if exists "own state update" on public.user_state;
create policy "own state read"   on public.user_state for select using (auth.uid() = user_id);
create policy "own state insert" on public.user_state for insert with check (auth.uid() = user_id);
create policy "own state update" on public.user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Table-level privileges for the API roles. RLS gates ROWS; without these GRANTs PostgREST hides the
-- table from the anon/authenticated roles entirely ("not found in schema cache"). Required.
grant select, insert, update, delete on public.user_state to anon, authenticated;

-- Public bucket for cached TTS audio — populated OFFLINE by the pipeline (never at runtime).
insert into storage.buckets (id, name, public)
values ('tts-cache', 'tts-cache', true)
on conflict (id) do nothing;

-- Force PostgREST to reload its schema cache so the REST API sees the table immediately.
notify pgrst, 'reload schema';
