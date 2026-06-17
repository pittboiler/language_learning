-- 0004_tts_audio.sql — offline TTS audio cache (see DESIGN-tts-caching.md).
-- A PUBLIC bucket of content-addressed clips named <sha256(text|voiceId|model)>.mp3. Public READ so the
-- browser/CDN can play clips directly by URL; WRITES happen only via the service role (the offline
-- pre-warm script + the cache-aside uploader in /api/tts use SUPABASE_SERVICE_ROLE_KEY, which bypasses
-- RLS — so no insert/update policy is needed). Mirrors the partner-media bucket pattern in 0002.

insert into storage.buckets (id, name, public)
  values ('tts-audio', 'tts-audio', true)
  on conflict (id) do nothing;

-- Public buckets already serve objects at /storage/v1/object/public/...; this makes the read explicit
-- (and covers the authenticated client path) without granting any write access.
drop policy if exists "tts-audio public read" on storage.objects;
create policy "tts-audio public read" on storage.objects
  for select using (bucket_id = 'tts-audio');

notify pgrst, 'reload schema';
