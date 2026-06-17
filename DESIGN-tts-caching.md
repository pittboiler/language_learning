# Design Δ — Offline TTS Audio Cache

> **Increment over [DESIGN.md](DESIGN.md) §3 ("cache generated content + audio"). Additive.**
> Today `/api/tts` re-synthesizes on **every** play — recurring ElevenLabs per-character cost +
> ~1–2 s latency per line. This caches each unique line once and serves it thereafter (~$0 ongoing,
> instant). It also turns audio into a **reviewable, fixable asset** — a pronunciation trust layer
> mirroring the content `confidence` gate.
>
> **Status: design + the ⚠ Storage migration. Build on go-ahead** (the migration touches live Supabase).

## 0. Decisions already made (A/B + prior discussion)
- **Model = `eleven_v3`** — A/B winner (more consistent pronunciation, less rushed; handles the MK
  stress traps + unique letters well). One known miss: **`ѕвезда`** (the `ѕ`/dz sound) → §3.
- **Speed = Option A** — cache **one** clip per line at v3-natural; the slow/normal toggle becomes
  client-side `audio.playbackRate` (pitch-preserved). Halves the cache, covers both speeds.
- **Voice = current (Rachel) for now** — v3 made it acceptable to the ear; a better/native voice is a
  **one-time re-warm** later (the cache key includes `voiceId`, so a swap invalidates cleanly).

## 1. Architecture — content-addressed cache-aside
- **Key** `sha256(text | voiceId | model)`; **bucket** `tts-audio` (public); **object** `<hash>.mp3`.
  Content-addressed → works for authored + generated + dynamic (tutor/import) audio, **no schema change**.
- **Runtime `/api/tts`:** hash the text → if the object exists, **302-redirect to its public URL**
  (browser- + CDN-cacheable); on a miss, synthesize once → upload via the **service role** → redirect.
  **Safe fallback:** any Storage error ⇒ synthesize and return bytes directly = today's behavior, so the
  route can ship *before* the bucket exists with zero regression.
- **Pre-warm (offline script):** enumerate the pack's ~517 lines → synthesize + upload the misses, so the
  first real play is already a hit. Pure optimization on top of the self-healing route.
- **Player:** fetch the (cached) clip and set `playbackRate` from the slow/normal setting (Option A);
  drop the per-call ElevenLabs `speed`. Tune `normal`/`slow` rates by ear (≈0.9 / 0.7 to match today).

## 2. ⚠ Storage migration (the one live-infra change)
`apps/web/supabase/migrations/0004_tts_audio.sql` — a **public** `tts-audio` bucket (mirrors the
`partner-media` precedent in 0002): public READ (audio isn't sensitive; enables direct/CDN playback);
WRITES only via the **service role** (`SUPABASE_SERVICE_ROLE_KEY`, already set — used by the pre-warm
script and the route's cache-aside uploader). No anon/authenticated writes. **Must be applied to Supabase**
(their `supabase db push` / dashboard) — the single action that needs the user.

## 3. Pronunciation quality — the "to start" + "over time" layer
v3 is good across the A/B **except `ѕвезда`** (1 of 517 lines; the `Ѕ` alphabet example, so it must teach
the dz sound correctly). The mechanism that fixes it generalizes:

- **Pronunciation override map** (generalizes the "alias dictionary"): per problem line, override
  `{ model | voice | speakText }`. Because the cache is per-line + model-keyed, **mixing models is free**.
  - `ѕвезда` → first entry. Try `{ model: 'eleven_multilingual_v2' }` (which didn't glitch); if the ear
    still objects, fall back to a respelling (`speakText: 'дзвезда'`) or a v3 IPA-phoneme rule.
- **To start (cheap, this increment):** the override map (seed `ѕвезда`); keep the **written stress
  notes** (already shown in the UI, so audio isn't the sole stress authority); the **slow mode** we're
  adding; a **👎 "sounds off"** tap on each clip that appends the line to a review queue.
- **Over time (compounds):** **ASR round-trip QA** in the pre-warm — synthesize → run back through the
  existing dual-ASR gate (Scribe + Google); low recovery/agreement auto-flags a clip for human review
  (catches gross phoneme errors, not stress). Flagged → human approves or adds an override → re-warm that
  one key. An **`audio: unreviewed | validated`** flag mirrors the content `confidence` gate. A
  voice/model upgrade = a one-time re-warm. Eventually **harvest native partner audio**
  (`audioSource:'native'`) for the high-frequency core.

## 4. Cost & caveats
- **One-time pre-warm:** ~11,000 characters (Option A, 1 clip/line). [**Verify v3 per-char pricing** — may
  exceed multilingual_v2; still a bounded one-time spend.] Then ~$0 ongoing; Storage ≈ 517 × ~25 KB ≈ 13 MB.
- **v3 latency** is higher → the *uncached/live* path (esp. dynamic **tutor replies**, which rarely repeat
  so caching helps them least) is slower. Option to watch: use a **faster model for live tutor TTS**, v3
  for cached pack content. Flagged, not decided.

## 5. Implementation phases (riskiest/most load-bearing first; stop after each)
1. **⚠ Migration `0004` + cache-aside `/api/tts` on v3** (with the safe fallback). *Acceptance:* 1st call
   to a line synthesizes+uploads; 2nd call is a cache hit (no ElevenLabs request — verify via network/logs);
   Storage down ⇒ still plays (fallback).
2. **Player `playbackRate`** (Option A) — small `playTts`/`playClip` change; tune normal/slow by ear.
3. **Pre-warm script** over the 517 lines (+ the ASR-QA hook). *Acceptance:* the library plays with zero
   ElevenLabs calls afterward.
4. **Override map** (seed `ѕвезда`) + **👎 report** + the `audio` confidence flag.

## 6. Risks
- v3 pricing/latency (live path) — verify; consider a split model for live tutor.
- Option-A slow quality — tune by ear; fall back to caching the slow speed separately if needed.
- `ѕвезда` override correctness — confirm by ear when built (it's the letter-teaching example).
- Hash must include `voiceId` + `model` so a swap re-warms cleanly (it does).
