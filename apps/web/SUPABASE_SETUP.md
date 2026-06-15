# Supabase setup (~3 min)

The persistence/auth/storage wiring is already built. It activates automatically once these env vars
are present — no code change needed, just paste creds and restart the dev server.

## 1. Create a project
[supabase.com](https://supabase.com) → **New project** (free tier is fine).

## 2. Enable anonymous auth
**Authentication → Sign In / Providers → Anonymous** → enable. (Zero-friction "start talking fast".)

## 3. Paste the 3 creds
**Project Settings → API**, then fill these into `apps/web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>   # server-only; used later by the pipeline for audio caching
```

(`NEXT_PUBLIC_*` are client-safe — Row-Level Security protects the data. The service-role key is
only read server-side and is **not** needed for progress sync.)

## 4. Run the migration
**SQL Editor → New query** → paste all of `supabase/migrations/0001_init.sql` → **Run**.
Creates `public.user_state` (RLS: each user sees only their own row) + the `tts-cache` storage bucket.

## 5. Restart
Restart the dev server. `getStore()` now sees the env vars and uses Supabase (anonymous session +
synced progress) instead of localStorage. Tell me when this is done and I'll verify an anon session
round-trips a progress write.

## 6. Partnered learning (Phase 0)
For the two-person partner features, also run **`supabase/migrations/0002_partnered.sql`** in the SQL
editor (creates the `partnership` / visibility / published-state / artifact tables + their RLS + the
invite-redeem RPC). Until it's applied, the rest of the app works normally and the **Me → Learning
partner** panel shows a "run migration 0002" hint.

Verify the privacy-critical RLS end-to-end (creates + cleans up 3 throwaway anon users):

```
npx tsx apps/web/scripts/verify-partner-rls.ts
```

Expect five green checks — partner-can-read-projection, raw-user_state-stays-private, non-member-sees-
nothing, revoke-hides-data, owner-only-writes.

## 7. Live conversation (Phase 4)
For the real-time **live conversation**, also run **`supabase/migrations/0003_partner_realtime.sql`**
(adds `partner_artifact` to Supabase's realtime publication so a live session syncs across both
devices; RLS still gates which rows each partner receives). Then verify:

```
npx tsx apps/web/scripts/verify-partner-realtime.ts
```

Expect two green checks — live-sync (postgres_changes) + presence. Until it's applied, the live UI
still works but falls back to the manual ↻ refresh instead of updating instantly.
