-- Partnered learning Phase 4: enable Supabase Realtime on partner_artifact so a live conversation
-- session stays in sync across both partners' devices (postgres_changes), with RLS still gating which
-- rows each partner receives (the existing "artifact read" members policy from 0002). No new infra —
-- this just adds the table to Supabase's built-in realtime publication. Safe to re-run.
-- See DESIGN-partnered-learning.md §1.4 (real-time is the only phase that touches infra).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'partner_artifact'
  ) then
    alter publication supabase_realtime add table public.partner_artifact;
  end if;
end $$;

-- Emit the full row on update/delete so realtime filters (partnership_id=eq.…) work on every event.
alter table public.partner_artifact replica identity full;

notify pgrst, 'reload schema';
