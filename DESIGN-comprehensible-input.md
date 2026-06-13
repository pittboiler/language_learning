# Design Δ — Comprehensible-Input Layer

> **Increment over [DESIGN.md](DESIGN.md). Additive — not a re-architecture.** Adds the
> vocabulary/content engine that turns the app into a true comprehensible-input (CI) system:
> a persistent familiarity state, a mini-stories spine, and import-anything. **Status: design +
> module stubs only. No full features built yet** — stubs throw `not implemented` until you green-light.
>
> Modeled on what LingQ gets right (a persistent vocabulary state that makes i+1 selection + SRS
> automatic) while rejecting its input-only, output-delaying philosophy: **input feeds output** —
> read/listen to build vocabulary, then immediately use it in scenarios + speaking.

---

## 0. How this fits the existing architecture (no duplication)

What already exists (Phases 0–3, built + deployed):

| Existing piece | What it does | How this increment uses it |
|---|---|---|
| `@ll/pack-schema` `ReviewItem` (`kind: vocab\|phrase\|grammar\|glyph`, `i1Level`, `meta`) | static, authored content units | **superset already covers words/chunks/grammar.** We add a normalized `lexKey` so items map into the familiarity index. `i1Level` becomes a *prior*, not the only difficulty signal. |
| `@ll/core/srs` — FSRS wrapper, `ReviewState {userId,itemId,due,card}` | spaced repetition; `card.state` (New/Learning/Review/Relearning) + `card.stability` | **the SRS card IS the familiarity strength.** Familiarity wraps `ReviewState`; no parallel store. |
| `@ll/core/leveling` — `selectAtIPlusOne(pool, level)` | filters by **static** `i1Level` | replaced/augmented by the **computed** difficulty score (Part A). `i1Level` stays as the cold-start fallback. |
| `@ll/core/session` — round-robin interleaver | mixes review/glyph/scenario/grammar/writing/reading | gains a `story` activity kind + familiarity-ranked reading. |
| `@ll/core/speaking` — dual-ASR gate + feedback | spoken-turn coaching | **reused verbatim** for each mini-story's spoken Q&A prompt (Part B). |
| `@ll/pack-schema` `Reader` (text + gloss) | simple graded reading | `MiniStory` is a richer *sibling* (synced audio + tokens + Q&A + spoken prompt). Reader stays. |
| `pipeline/` profiler→architect→generator/content→**validator**→run-batch | offline gen, gated by `confidence` | import-anything (Part C) is a **new pipeline flow that reuses `generator` (segment+gloss+TTS jobs) and `validator` (gloss confidence)** — no parallel critic. |
| `apps/web` store — one `Progress` JSONB blob in `user_state` | per-user persistence (Supabase/localStorage) | the `reviews` map migrates into a `familiarity` map (same blob for MVP; a `familiarity` table for scale — see §2). |

**One-line fit:** Part A is the *substrate* (a language-level vocabulary state unifying SRS),
Part B (mini-stories) *calibrates* it from a gold-standard baseline and is the validator's reference,
Part C (import) *scales* it outward through the existing agentic pipeline.

---

## 1. Conflicts with the existing design + proposed reconciliation

**These are proposals — nothing existing is overwritten in the stubs.** The reconciliations that
touch working code (the SRS/store migration) are flagged ⚠ and await your go-ahead.

### 1.1 ⚠ SRS state vs familiarity state — unify, don't fork (the load-bearing decision)
- **Today:** `Progress.reviews: Record<itemId, ReviewState>` keyed by an *arbitrary authored id*
  (`"v-zdravo"`, `"g-pivo"`). It's per-user, per-item, and (because item ids are pack-namespaced)
  already implicitly per-language.
- **Conflict:** the CI layer needs vocabulary keyed by *lexical form* (so a token in any text can be
  looked up), tracking words **and** chunks **and** grammar, including items captured from reading
  that were never authored as `ReviewItem`s.
- **Reconciliation — one store, lexically keyed, holding the SRS card:**
  ```ts
  FamiliarityEntry {
    lexKey: string            // THE unification key (normalized form / chunk / concept-id)
    kind: 'word'|'chunk'|'grammar'
    display, gloss?
    srs: ReviewState | null   // ← the EXISTING core/srs state, verbatim. null only for
                              //   "known-without-scheduling" or "ignored". The scheduler
                              //   reads/writes entry.srs.card — there is no second store.
    status: 'new'|'learning'|'known'|'ignored'  // DERIVED from srs.card (cached for fast scoring)
    strength: number          // 0..1 DERIVED from srs.card.stability (cached)
    createdAt, lastSeenAt, tags?
  }
  ```
  `status`/`strength` are a **projection** of the FSRS card, recomputed on every review — not a
  competing source of truth. Mapping: `new` = no card · `learning` = `card.state ∈ {Learning,
  Relearning}` or `stability < KNOWN_THRESHOLD` · `known` = `card.state = Review ∧ stability ≥
  KNOWN_THRESHOLD`. Authored `ReviewItem`s gain a `lexKey` so they fold into the same index.
- **Migration:** `Progress.reviews` → `Progress.familiarity: Record<lexKey, FamiliarityEntry>`; each
  existing `ReviewState` wraps into `{lexKey: deriveKey(item), srs: state, …}`. One-time, reversible,
  and the FSRS math is untouched. **This is the only change to existing persistence — needs your OK.**

### 1.2 Static `i1Level` vs computed difficulty
- **Today:** `leveling.selectAtIPlusOne` filters purely on authored `i1Level`.
- **Reconciliation:** add `scoreText(text, index) → {knownPct, knownChunkPct, iPlusOneFit, newItems…}`.
  The selector ranks by **computed comprehension** (target ≈ 85–95 % known = i+1) and **falls back to
  `i1Level`** when the learner has too little familiarity data (cold start). Additive — `selectAtIPlusOne`
  keeps working; a new `selectByComprehension` supersedes it once data exists.

### 1.3 Capture mechanism
- **Today:** items enter review only by doing an authored drill/scenario.
- **Reconciliation:** add `capture(lexKey, kind, gloss)` → enrolls a `FamiliarityEntry` via
  `srs.initState`. Works for a tapped **word or a selected chunk**, from any reader/story/import.
  Purely additive to the authored-drill path.

### 1.4 `Reader` vs `MiniStory`
- **Today:** `Reader.body: DialogueTurn[]` (text + gloss only).
- **Reconciliation:** `MiniStory` is a **new sibling type** (not a mutation of `Reader`) adding audio
  timing, segmented tokens, a Q&A tail, and a spoken-prompt link. `Reader` stays for lightweight
  graded text. `LanguagePack.stories?: MiniStory[]` is an optional new field (back-compatible).

### 1.5 Where the engine lives
- Familiarity **logic** → `@ll/core/familiarity` (language-agnostic: operates on `lexKey`s + FSRS).
- Familiarity **state** → the store (`Progress`/Supabase), exactly like today.
- **Tokenization/normalization** is mostly generic (lowercase, strip punctuation/clitics) and lives in
  core; true **lemmatization is language-specific** and is deferred — MVP uses surface-form
  normalization, with an optional pack-supplied `normalizeHints`. **[ASSUMPTION]** surface-form keys are
  good enough for MK/BG at MVP; flag for upgrade when stems/inflection hurt scoring.

---

## 2. Data-model delta (schemas / migrations)

### 2.1 New core types — `@ll/core/familiarity` (engine state, language-agnostic)
`FamiliarityEntry`, `FamiliarityStatus`, `LexKind` (§1.1) + the index:
```ts
type FamiliarityIndex = Map<string /*lexKey*/, FamiliarityEntry>
capture(index, {lexKey,kind,display,gloss}, now): FamiliarityEntry      // enroll (srs.initState)
recordEncounter(index, lexKey, grade, now): FamiliarityEntry            // delegates to srs.schedule; re-derives status/strength
deriveStatus(srs: ReviewState | null): {status, strength}              // the projection
toReviewStates(index): ReviewState[]                                   // adapter → existing srs.dueItems/nextBatch
```

### 2.2 New core types — `@ll/core/familiarity/scoring` (the reusable difficulty service)
```ts
Token { surface; lexKey; isWord }
tokenize(text, hints?): Token[]                                        // generic normalizer → lexKeys
TextScore { totalTokens; knownTokens; knownPct; knownChunkPct; newItems[]; learningItems[]; iPlusOneFit }
scoreText(text, index, opts?): TextScore                              // ← what makes i+1 computable
rankByIPlusOne<T extends {text:string}>(items, index): T[]            // for scenario engine + content selector
ProgressMetrics { knownWordCount; learningCount; movedToKnownThisWeek; comprehensionOf?(text) }
computeMetrics(index, window?): ProgressMetrics                       // compounding, not streaks
```
**Consumed by:** `core/leveling` (computed i+1), `core/session` (content ranking), the scenario engine
(gate a scenario on its required-vocab comprehension), and the import recommender (Part C).

### 2.3 New pack-schema types — mini-stories (authored content; added to the contract)
```ts
StorySegment { text; translit?; gloss; tokens?: string[]; audioStart?: number; audioEnd?: number }
StoryQA { id; question; questionGloss; answer; answerGloss; spokenPrompt?: boolean; satisfies?: string[] }
MiniStory {
  id; title; titleGloss?; i1Level; level: CefrBand
  body: StorySegment[]                       // synced audio+text, per-segment timing
  audioUrl?; audioSource: 'native'|'tts'     // flag native vs TTS (prompt requirement)
  qa: StoryQA[]                              // retrieval tail; spokenPrompt routes to core/speaking
  registersVocab: string[]                   // lexKeys this story teaches → seed familiarity
  confidence: Confidence
}
// LanguagePack gains:  stories?: MiniStory[]
```

### 2.4 New pipeline types — import-anything (`pipeline/import.ts`)
```ts
ImportRequest { source: 'paste'|'url'|'transcript'; raw: string; title? }
ImportedReader { reader: MiniStory; verdicts: Verdict[]; ttsJobs: {segmentId,text}[]; difficulty: TextScore }
importContent(req, ctx): Promise<ImportedReader>   // REUSES generator (segment+gloss+TTS) + validator (gloss confidence)
```

### 2.5 Storage migration (⚠ the one change to live persistence)
- **MVP (now):** extend the `Progress` JSONB blob: `reviews → familiarity: Record<lexKey, FamiliarityEntry>`.
  Fine to a few-thousand items; no schema change to `user_state`. A small one-time in-app migration
  reshapes existing blobs.
- **Scale (later, flagged):** a dedicated table —
  `familiarity(user_id uuid, pack_id text, lex_key text, kind text, gloss text, status text,
  strength real, card jsonb, due timestamptz, created_at, last_seen_at, primary key (user_id,pack_id,lex_key))`
  with the same RLS/grant pattern as `user_state`. Migrate when blob size or query needs demand it.

---

## 3. Roadmap slot (relative to DESIGN.md §6)

The CI layer is **Phase 2.5** — it lands after the Phase-0 core exists and reuses the Phase-2 pipeline,
and it is the substrate Phase-1 leveling always wanted. Sequencing (matches the prompt):

```
Cyrillic onboarding (Phase 0)
   └─ first bar scenario  ──┐  (mini-stories land HERE, alongside — never before script decoding)
   └─ mini-stories spine  ──┘
        └─ familiarity engine calibrated on that core vocab + stories   ← Part A, foundational
             └─ tap-to-capture in reader/story → known-word count grows
                  └─ import-anything + bulk generation outward          ← Part C, scales last
```

- **Mini-stories** start as soon as Cyrillic is done (Phase 0/1 boundary), authored/validated.
- **Familiarity engine** is calibrated on the existing authored vocab + the stories' `registersVocab`
  (a known-good baseline → trustworthy i+1 from day one).
- **Import-anything** is last — it depends on Part A's scoring and the mature pipeline.

No conflict with Phase 3 (Bulgarian): the CI layer is language-agnostic (`core/familiarity`), so a second
pack inherits it for free — mini-stories + an import flow per pack, zero core change.

---

## 4. Implementation plan (sequenced, riskiest / most load-bearing first)

1. **⚠ Familiarity store + SRS unification (riskiest — touches persistence + SRS).**
   Define `FamiliarityEntry`; migrate `Progress.reviews → familiarity`; make `core/srs` read/write the
   card *inside* the entry via adapters. Acceptance: existing review/grammar flows behave identically
   (FSRS math unchanged); a captured word round-trips new→learning→known. Verify before anything else.
2. **Scoring service (`scoreText`/`tokenize`/metrics).** Generic normalizer; wire computed i+1 into
   `leveling` with `i1Level` fallback. Acceptance: `scoreText` on a known reader returns a sane known-%;
   selector ranks i+1 above too-hard/too-easy.
3. **Tap-to-capture in the reader/story UI.** One tap → gloss + `capture()` → familiarity + SRS queue.
   Chunk selection = drag/tap-range. Acceptance: tapping a new word increments known-word metrics.
4. **Mini-story content model + ONE hand-authored MK reference story** (synced audio player, Q&A tail,
   spoken-prompt → `core/speaking`). Acceptance: a story plays synced, registers its vocab, and its final
   spoken question runs the dual-ASR feedback loop. This is also the validator's gold standard.
5. **Import-anything flow** (pipeline reuse). Paste/URL/transcript → `generator` segments+glosses+TTS →
   `validator` gates glosses → `scoreText` tags difficulty → slots into the familiarity-tracked reader.
   Acceptance: a pasted MK paragraph becomes a readable, glossed, difficulty-scored, gated reader.

Risk order rationale: everything downstream reads the familiarity state, so (1) must be rock-solid and
backward-compatible first; (2) unlocks the "computable i+1" promise; (3) makes capture frictionless;
(4) calibrates + validates; (5) scales. Stop after each for review.

---

## 5. Module stubs created with this delta (interfaces only — `not implemented`)
- `packages/core/src/familiarity/index.ts` + `scoring.ts` + `README.md` — engine + difficulty service.
- `packages/pack-schema/src/index.ts` — `StorySegment` / `StoryQA` / `MiniStory` types + `stories?` on `LanguagePack` (additive).
- `pipeline/src/import.ts` — import flow stub (reuses `generator` + `validator`).
- `packages/core/package.json` — adds the `./familiarity` export.

**Nothing in `core/srs`, `core/leveling`, the store, or any pack data is modified yet.** The SRS↔familiarity
migration (§1.1 / §2.5 / plan step 1) is the first thing to build **on your go-ahead.**
