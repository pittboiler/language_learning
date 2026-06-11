# PROMPT 3 — Phase 2 & Beyond
### Conversation-first Macedonian learning app — continue the build in a fresh session

> Paste everything below the line into a new Claude Code session in this project. Phases 0–1 are
> built and running; this session does **Phase 2** (monorepo migration + writing + interleaving +
> content generation) and sets up **Phase 3** (the generalization test). The project memory loads
> automatically — but read the artifacts first to ground yourself.

---

You are my technical co-architect and builder, continuing an in-progress project. **Before writing
any code, ground yourself:**

1. Read **`DESIGN.md`** — the full architecture, data models, content pipeline, phased roadmap, and
   the decisions (model tiering, build sequencing, the bar=benchmark reframe).
2. Read my **memory files** (auto-loaded): `project-macedonian-app` (current state) and
   `spike-verdict-asr` (the key finding).
3. Skim the **runnable app** in `spike/` (`server.js`, `pack.js`, `public/index.html`) and the
   **monorepo scaffold** (`apps/web`, `packages/{pack-schema,core,pack-mk}`, `pipeline/`). Run the
   spike to see Phases 0–1 working: `cd spike && npm start` → http://localhost:5050 (use a real
   **Chrome** tab — the mic needs it). Keys are already in `spike/.env`.

## Where things stand
- **Goal:** general conversational ability in Macedonian (then any language). The bar/café
  conversation is **benchmark #1, not the product.** Two axes of generality, both data-driven:
  **languages = packs, situations = scenarios** — neither hardcoded in the engine.
- **Phases 0–1 are built** as a runnable app by extending the throwaway **spike** (plain Node +
  static HTML): 31-letter Cyrillic onboarding (focus on the 7 unique + the false-friends), 2 bar
  scenarios (transactional order-a-drink + social small-talk) run through a **dual-ASR speaking
  gate + LLM coaching + scaffolded spoken conversation**, grammar drills (gender, three-way
  articles), unified Leitner SRS over phrases+grammar, a graded reader, light i+1 leveling,
  localStorage persistence.
- **The target architecture** is in `DESIGN.md` + a pnpm monorepo scaffold (currently stubs):
  `packages/pack-schema` (the contract), `packages/core` (language-agnostic engines — verified to
  contain zero Macedonian), `packages/pack-mk` (data only), `pipeline/` (offline content agents),
  `apps/web` (Next.js).
- **The spike verdict:** speaking-first is viable **because of the dual-engine confidence gate**
  (ElevenLabs Scribe + Google STT). When the engines disagree, the LLM coach flags "likely ASR
  error" and hedges instead of marking correct speech wrong (the Teuida failure mode). **This gate
  is load-bearing — preserve it.**

## This session: Phase 2 — sequence it in this order
1. **Monorepo migration FIRST** (so writing/interleaving are built on the real architecture, not
   bolted onto the throwaway):
   - Implement `@ll/core` for real: `speaking` (dual-ASR gate + feedback composer), `tutor` (reply
     + gloss + correction + suggestions), `scenario` (runner + success criteria), `srs` (wrap
     `ts-fsrs`), `leveling` (i+1). The spike's `server.js` holds the proven prompts/schemas.
   - Move the Phase 0–1 content into `@ll/pack-mk` conforming to `@ll/pack-schema` (alphabet,
     scenarios, grammar+drills, readers, vocab). The spike's `pack.js` is the source of truth.
   - Wire `apps/web`: server route handlers hold the keys (mirror the spike's
     `/api/{tts,asr,feedback,chat}`); the UI ports the spike's views (`lib/recorder.ts` +
     `lib/api.ts` are stubbed for this).
   - **Persistence + auth — ask me first:** Supabase (Postgres + anonymous auth + Storage for
     cached audio) now, or keep localStorage one more phase? Default toward Supabase since
     accounts/sync/deploy start mattering here.
   - **Invariant to re-verify after:** `packages/core` stays language-agnostic — run a Cyrillic
     grep over `packages/core/src` and confirm it's empty. That's the generality guarantee.
2. **Writing subsystem** — short prompted production with correction that explains *why* (Sonnet).
3. **Interleaving** — sessions mix skills/topics (speak, grammar, read, write, review) rather than
   blocking them.
4. **Turn on the Content Generator** (`pipeline/`) — generate outward from the hand-authored
   `order-a-drink` reference: more scenarios across everyday situations (directions, shopping,
   introductions, phone — Phase 1's breadth), plus vocab/readers/drills. Every generated item
   starts `confidence: "unreviewed"` and is gated until I spot-check it. **Run generation on Opus
   4.8 offline; never regenerate at runtime.** Keep the automated **Validator deferred** unless I
   say otherwise — I'm the native-speaker-substitute spot-check for now.

## Phase 3 (set up now, execute once Phase 2 is solid): the generalization milestone
Generate + validate a **Bulgarian** pack (`packages/pack-bg`; ~90% lexically similar to Macedonian
= lowest-effort proof). **If anything in `packages/core` has to change, the abstraction leaked —
fix it then, cheaply.** This is the explicit test of the language-agnostic claim. (The *situation*
analogue — a new scenario must be pure pack data — should already hold from Phase 1; confirm it.)

## Beyond Phase 3
More language packs; broader scenario library across everyday situations; full SRS (FSRS) tuning;
deploy (Vercel + Supabase); and eventually the automated Validator as the trust layer scales.

## Guardrails (hard-won — carry them)
- **Model tiering (measured, not assumed):** **Opus 4.8** offline (content generation + validation);
  **Sonnet 4.6** live for anything that *generates Macedonian* (tutor, feedback); **Haiku 4.5**
  mechanical-only — Haiku makes gender-agreement errors generating Macedonian (verified:
  `Една/Која пиво` should be neuter `едно/кое`). Use the **claude-api skill** for SDK specifics
  (structured outputs via `output_config.format`, adaptive thinking, exact model ids).
- **Budget < $20/mo solo:** cache generated pack content **and its TTS audio** once, offline; run
  the live loop on the cheap model. Don't regenerate content at runtime.
- **Provider realities (don't re-discover):** ElevenLabs TTS needs a **paid** tier (Starter ~$6/mo)
  for library voices via API; **Google has no Macedonian TTS** (ElevenLabs only; Azure is the
  fallback); Google STT needs the *Cloud Speech-to-Text API* enabled and the recognize **encoding
  matched to the audio** (`WEBM_OPUS` for the browser mic, `MP3` for TTS). Same env vars as
  `spike/.env.example`.
- **Don't mass-generate unvalidated Macedonian.** Flag everything you author for my native
  spot-check. Existing spot-check queue: the 31 alphabet example words, the reader (*Во кафулето*),
  and the small-talk dialogue.
- **Self-verify each step** — I won't hand-test every phase: syntax-check, hit the endpoints, run
  the core grep, and report what you verified + what's deferred. Checkpoint at verified states;
  don't run context dry mid-edit and leave broken code.
- **Keep `packages/core` language-agnostic** and keep the **dual-ASR confidence gate** intact —
  these are the two structural commitments the whole design rests on.

## Decisions to put to me early (before investing heavily)
1. Next.js + Supabase now, or keep the lightweight Node+static stack + localStorage one more phase?
2. Build the Validator agent now, or keep deferring to my spot-checks?
3. How much to hand-author vs generate for the expanded Macedonian pack?
4. Deploy target (Vercel) this session, or stay local?

**Start by grounding yourself (DESIGN.md + memory + run the spike), then propose a short Phase-2
plan and ask me decisions 1–4 before building.**
