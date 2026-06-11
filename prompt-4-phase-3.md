# PROMPT 4 — Phase 3: The Generalization Milestone (Bulgarian)
### Conversation-first language app — continue the build in a fresh session

> Paste everything below the line into a new Claude Code session in this project. Phases 0–2 are
> built and running; this session does **Phase 3** — the explicit test of the language-agnostic
> claim: add **Bulgarian** as a validated language pack while touching **zero `packages/core` code.**
> The project memory loads automatically — but read the artifacts first to ground yourself.

---

You are my technical co-architect and builder, continuing an in-progress project. **Before writing
any code, ground yourself:**

1. Read **`DESIGN.md`** (architecture, data models, the two generality axes) and my **memory files**
   (`project-macedonian-app`, `spike-verdict-asr`).
2. Skim the **built code**: `packages/pack-schema` (the contract), `packages/core` (8 engines —
   speaking/tutor/scenario/srs/leveling/session/writing/llm; verified language-agnostic),
   `packages/pack-mk` (the Macedonian data, incl. `generated.ts` promoted into the pack),
   `apps/web` (Next.js: 6 route handlers + 7 views + an env-gated Supabase/localStorage `Store`),
   `pipeline/` (profiler/architect stubs + a working **generator** + **validator** + `run-mk-batch.ts`).
3. Run it: `npx --yes pnpm@latest install` then `npx --yes pnpm@latest --filter @ll/web dev` →
   http://localhost:3000 (use a real **Chrome** tab — the mic needs it). Keys live in
   `apps/web/.env.local`.

## Where things stand (Phase 2 complete)
- The monorepo migration is done and verified. The proven spike loop runs on `@ll/core` (prompts
  parameterized by the pack, so core has **zero hardcoded language** — `grep -rlP '[\x{0400}-\x{04FF}]'
  packages/core/src` is empty). Writing, interleaving (a "▶ Session" mode), an Opus-4.8 Validator, and
  an offline Content Generator are all built. A gated batch generated 4 Macedonian scenarios
  (directions/shopping/introductions/phone) which were Validator-passed and **promoted** into the pack.
- **The situation-generality axis is already proven**: those 4 scenarios were added as pure pack data,
  touching **zero `core` code**. Phase 3 is the **other** axis — **language generality**.

## Phase 3 goal
Produce + validate a **Bulgarian** pack (`packages/pack-bg`; ~90% lexically similar to Macedonian =
the lowest-effort proof). **Win condition: `git diff packages/core` is empty after Bulgarian works.**
If `core` needs changes, the abstraction leaked — that's the finding; fix it there, cheaply, and the
fix makes every future language easier.

## The plan (sequence it in this order)

1. **Pack registry + active-pack selection FIRST — this is the probable leak point, and it's
   app-level, not core.** Today `apps/web` route handlers and `page.tsx` import `macedonian` directly.
   Introduce a registry (`packId → LanguagePack`) and select by the user's active pack
   (`LevelState.activePackId` already exists in the schema). Route handlers + the UI read the *active*
   pack instead of a hardcoded import. **`packages/core` should not change at all** — its functions
   already take the pack/context as parameters. Confirm with a core diff.

2. **Language Profiler (`pipeline/profiler.ts`, Opus 4.8 offline).** Implement `profile("bg")` → a
   Bulgarian teaching profile: Cyrillic **but a different inventory** than Macedonian (BG has `ъ щ ь`,
   lacks the MK-unique `ѓ ќ ѕ ј љ њ џ`); **postposed definite articles** like MK but different forms
   (`-ът/-та/-то/-те`), no noun cases, its own stress rules. The profiler names what actually matters.

3. **Architect.** Reuse the existing situation set (bar order, small talk, directions, shopping,
   introductions, phone) so the comparison to MK is clean.

4. **Generator + Validator (offline, Opus 4.8).** Generalize `run-mk-batch.ts` → a `run-batch.ts`
   that takes a pack/profile. Generate the BG alphabet onboarding, scenarios, grammar concepts +
   drills, vocab, and a reader; validate every line (`languageName: "Bulgarian"`). Everything starts
   `confidence:"unreviewed"`. Estimated ~$1–3 Opus, one-time, cached — **show me the cost before
   running**, same as the MK batch.

5. **Assemble `packages/pack-bg`** conforming to `@ll/pack-schema` (same shape as `pack-mk`). Pick a
   Bulgarian-capable ElevenLabs voice + the BG ASR hints (`bg`, `bg-BG`).

6. **THE TEST.** `git diff --stat packages/core` must be empty. Re-run the Cyrillic grep over
   `packages/core/src` (still empty). If either isn't clean, document exactly what leaked and fix it
   in `core`/`pack-schema` (a generic field, never a Bulgarian special-case).

7. **Wire `pack-bg` into the registry** + a small language-picker in the UI. Verify both packs run
   through the same engines.

8. **Spot-check.** I don't speak Bulgarian — so lean on the Validator + cross-checks, keep everything
   gated/`unreviewed`, and flag what needs a native review before promotion.

## Guardrails (carry from Phase 2)
- **Model tiering:** Opus 4.8 offline (generate + validate), Sonnet 4.6 live (tutor/feedback/writing),
  Haiku 4.5 mechanical-only. Structured output via `output_config.format` json_schema (SDK types it).
- **Never serve `unreviewed` content as authoritative.** Generate offline, cache, gate.
- **Budget < $20/mo.** The MK batch cost $0.31 total — BG will be similar. Cache; don't regenerate
  at runtime.
- **Tooling (non-obvious):** pnpm via `npx --yes pnpm@latest` (corepack can't write `/usr/local/bin`);
  pnpm 11 needs `allowBuilds: {esbuild, sharp, protobufjs}` in `pnpm-workspace.yaml`; Next consumes the
  raw-TS workspace packages via `transpilePackages` + a webpack `extensionAlias` mapping `.js`→`.ts`;
  `@google-cloud/speech` is in `serverExternalPackages`.
- **Self-verify each step** (typecheck, run the batch on 1 situation to calibrate, the core-diff test)
  and report what's verified vs deferred.

## Decisions to put to me early
1. **Fully generate BG** (Opus + Validator + my limited spot-check) vs. find a Bulgarian speaker first?
   (I lean fully-generate — it's the honest test of the pipeline; gate everything.)
2. **Language-picker UX**: a real switcher in the app, or just swap the active pack for the test?
3. **Same situations as MK** (cleanest generality proof) vs. BG-specific situations?
4. **Deploy** (Vercel) before or after BG? (Deploy needs `vercel login` + Supabase live.)

## The deeper point
This phase isn't about Bulgarian content quality — it's about proving the **seam**. The whole design
bet is that `packages/core` is language-agnostic. Phase 3 cashes that bet: if the core diff is empty,
the architecture generalizes and language #3, #4, #5 are cheap; if it isn't, you've found the exact
line where the abstraction leaked.

---

### Also pending from Phase 2 (quick, do alongside or first)
- **Supabase**: anon auth is enabled and verified; the `user_state` table needs the migration SQL
  re-run (`apps/web/supabase/migrations/0001_init.sql` — idempotent; refreshes the PostgREST schema
  cache). Then restart `web` and confirm an anonymous session syncs progress.
- **Deploy**: `npx vercel login`, then wire the env vars (Anthropic/ElevenLabs/Google-JSON/Supabase)
  and ship to Vercel. The repo is already on GitHub (`pittboiler/language_learning`).
