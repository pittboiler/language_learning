-- Generic per-user state — language-agnostic (one JSONB Progress blob per user, mirroring the
-- Store interface). Run this once in the Supabase SQL editor (or `supabase db push`).

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

-- Each user (including anonymous sessions) can only touch their own row.
create policy "own state read"   on public.user_state for select using (auth.uid() = user_id);
create policy "own state insert" on public.user_state for insert with check (auth.uid() = user_id);
create policy "own state update" on public.user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Public bucket for cached TTS audio — populated OFFLINE by the pipeline (never at runtime).
insert into storage.buckets (id, name, public)
values ('tts-cache', 'tts-cache', true)
on conflict (id) do nothing;
