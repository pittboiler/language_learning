# @ll/web

The Next.js app: practice UI + **server route handlers that hold the provider keys**. The client
never sees a key — it calls same-origin routes that proxy ElevenLabs / Google / Anthropic, exactly
like the spike's Express server.

## Routes (port from `spike/server.js`)

| Route | Does | Backed by |
|---|---|---|
| `app/api/tts/route.ts` | ElevenLabs TTS (with `speed`), cache to Supabase Storage | pack `voiceId` |
| `app/api/asr/route.ts` | Scribe + Google STT in parallel | `@ll/core` speaking gate |
| `app/api/feedback/route.ts` | dual-ASR gate → coaching (Sonnet) | `@ll/core` speaking |
| `app/api/chat/route.ts` | tutor reply + gloss + correction + suggestions (Sonnet) | `@ll/core` tutor |

## Client (`lib/`)

- `recorder.ts` — browser mic capture (webm/opus), ported from the spike.
- `api.ts` — typed client for the routes above.

## Auth / data

Supabase **anonymous** sessions for the zero-friction start (no signup to begin); prompt to save
progress (upgrade to email) after the first completed scenario. SRS state, progress, and the cached
pack live in Supabase Postgres + Storage.

`pnpm install` at the repo root, then `pnpm dev`. Keys go in `.env.local` (see `spike/.env` for the
same variable names).
