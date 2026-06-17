# Design Δ — Content & Curriculum Layer

> **Increment over [DESIGN.md](DESIGN.md) + [DESIGN-comprehensible-input.md](DESIGN-comprehensible-input.md)
> + [DESIGN-partnered-learning.md](DESIGN-partnered-learning.md). Additive — not a re-architecture.**
> Turns today's thin reference content into a LARGE, sequenced, validated corpus that carries a learner
> from zero → holding real conversations. It does NOT re-architect anything: it implements the **stubbed
> Curriculum Architect**, drives the existing generators/validator from the curriculum, and runs
> generation in **reviewable, spot-checked waves**. North star unchanged: **holding a live conversation
> in a bar/café and beyond.**
>
> **Status: curriculum spine + architect implemented; ONE sample wave produced (gated, spot-checkable).
> Bulk generation STOPS for review** — same staged discipline as every prior prompt.

This document answers the prompt's six deliverables in order: **§0** fit + exists-vs-thin + dependencies
+ conflicts · **§1** pedagogical strategy (validated/refined) · **§2** the curriculum game-plan · **§3**
per-unit artifacts · **§4** generation/validation/batching · **§5** implementation plan · **§6** the
sample wave + STOP.

---

## 0. How this fits — exists vs. thin, dependencies, conflicts

This increment is the **content** layer the prior three designs always assumed. The app surfaces
(scenario runner, mini-stories, familiarity/i+1, partnered role-swap/info-gap/shared-story) are built;
they are **starved of content**. Everything below produces that content **offline, gated, cached** —
runtime never regenerates it (DESIGN.md §3 cost rule).

### What already EXISTS (built, working)

| Piece | State |
|---|---|
| `pack-schema` contract | ✓ `ReviewItem` (kind `vocab\|phrase\|grammar\|glyph`, `i1Level`, `tags`, `meta`, `confidence`, `options/why`), `Scenario` (+`theme`), `MiniStory` (`registersVocab: {lexKey,gloss}[]`), `GrammarConcept`, `Reader`, `WritingTask`, `InfoGapTask`, `GlyphLesson`, `LanguagePack`. **Rich enough — needs no change.** |
| `pipeline/profiler.ts` | ✓ Opus 4.8. language code → `LanguageProfile` (script, phonology+stress, `grammarFeaturesThatMatter`, high-freq vocab, social norms). Cached to `pipeline/output/profile-<code>.json`. |
| `pipeline/generator.ts` | ✓ `generateScenario(situation, ctx)` → scenario + vocab, anchored to the authored `order-a-drink` reference, `confidence:"unreviewed"`. |
| `pipeline/content.ts` | ✓ `generateAlphabet / generateGrammar / generateVocab / generateReader` — Opus, profile-anchored, gated. |
| `pipeline/validator.ts` | ✓ Opus critic; per-line grammar/gloss/naturalness/level check; stamps `validated\|unreviewed`; guards echo-corrections. |
| `pipeline/lint.ts` | ✓ free structural drill lint (dup options / answer-missing / too-few). |
| `pipeline/run-batch.ts` | ✓ one-shot full-pack runner (alphabet+grammar+vocab+6 scenarios+reader) → gated `generated.ts` + `review-<code>.md`; `CALIBRATE` cost mode. |
| `pipeline/import.ts` | ✓ import-anything → `MiniStory` (reuses generator-style call + validator). |
| `core/llm` | ✓ `structuredCall` + `MODELS {offline: opus-4-8, live: sonnet-4-6, mechanical: haiku-4-5}` + cost meter. |
| `core/familiarity` | ✓ `normalize`, `deriveKeyForItem`, `capture`, `LexKind word\|chunk\|grammar`, status/strength projection. |
| `pack-mk` (hand-authored gold) | ✓ 31-letter alphabet, 4 grammar concepts, 11 vocab, `order-a-drink` + `small-talk` scenarios, `ana-coffee` mini-story, café reader, 4 writing tasks, `cafe-order-gap` info-gap. Plus promoted generated scenarios (directions/shopping/introductions/phone). |

### What was THIN / MISSING (the gap this closes)

1. **No curriculum spine.** `architect.ts` was `throw "not implemented"`; its `Curriculum` type was two fields (`skillTree`, `scenarioSequence`). Content was a flat topic-bag with no stages, units, functions, dependency order, or spiraling.
2. **No repair / strategic-competence kit — at all.** The single highest-leverage conversational set (priority #3) was absent. This is the biggest pedagogical hole.
3. **No Stage 0 survival layer** (numbers, want/can/where-is, yes/no/please/thanks as a sequenced unit).
4. **Generators are single-topic & hardcoded.** `generateVocab`/`generateReader` are café-only and stamp `v-bg-…`/`id:"cafe"`; they take a profile, not a **unit spec**. They can't emit per-unit content for a 12-unit curriculum.
5. **`run-batch` is a single pass**, not a **wave runner** (no per-unit gating / per-wave cost / promote loop).
6. **No frequency ranks** on items; `i1Level` is set by hand, not derived from frequency.
7. **`infogap.generateInfoGapPair` is stubbed**; there is no per-unit mini-story generator (only import).
8. **MK has no profile** (`profile-mk.json` absent — the pack predates the profiler).

### Dependencies (hard prerequisites — all met except one shim)

- **profiler ✓** feeds the architect. **The one gap:** MK needs a profile. Two options (§5): run `profiler('mk')` (~$0.05, proves generality), or hand-write `profile-mk.json` from the pack's already-authored facts (free). Recommend running the profiler — it exercises the language-agnostic path end-to-end.
- **The authored `order-a-drink` scenario** stays the generator's style anchor (DESIGN.md §5 "hand-author the reference; validate generated against it").
- **familiarity engine (calibrated, Prompt 3)** consumes `i1Level` + `registersVocab`; the curriculum stamps both coherently so computed i+1 works from day one.
- **partnered layer (Prompt 4)** consumes `scenarios` (role-swap), `infoGapTasks` (info-gap), `stories` (shared story) — so each unit emits those artifact types.

### Conflicts + reconciliation

| Conflict | Reconciliation |
|---|---|
| **`Curriculum` type too thin** for the prompt's unit spec. | **Expanded it** in `architect.ts` (additive — nothing consumed the old type; only the stubbed `buildPack` re-exported it). New shape: `Curriculum {stages, units[], sequence[]}` where each `CurriculumUnit` carries `functions`, `situation`, frequency-ranked `coreLexis` (each with `i1Level`), `grammarPoints` (rule-first, `produce` flag, `prereqUnits`), `artifacts`, `recycles`, `dependsOn`, `rationale`. |
| **Generators hardcode café + ids.** | Refactor to take a **`UnitSpec`** (from the curriculum) — `generateUnitVocab/Scenario/MiniStory/Grammar(unit, ctx)` — keeping the authored reference as the style anchor. The café-only functions become the cold-start/calibration path. (Design here; built on go-ahead — §5 step 2.) |
| **Frequency rank has no schema home.** | Use `meta.freqRank` (schema already allows arbitrary `meta`). No schema change. `i1Level` is derived from `freqRank` + chunk-ness as a prior; the familiarity engine's computed score supersedes it once data exists (DESIGN-CI §1.2). |
| **`run-batch` is one-shot.** | Generalize into a **wave runner** driven by `curriculum.sequence`, gating per wave, reusing `writeGenerated/writeReview/lintDrills/validate`. (§5 step 3.) |
| **MK has no profile.** | Add `profile-mk.json` (run profiler or hand-write from authored facts). (§5 step 1.) |
| **Trust for a low-resource language.** | Unchanged and reinforced: every generated item is `confidence:"unreviewed"` → validator stamps → **human spot-check** promotes. Even the sample wave below (authored at the Opus tier) is presented gated + spot-checkable, never auto-served. |

**One-line fit:** the architect produces the **spine**; the existing generators/validator, driven per-unit
off that spine and run in gated waves, produce the **corpus**; the human spot-check promotes it. No new
runtime, no new critic, no schema change.

---

## 1. Pedagogical strategy — validated & refined

The prompt's eight priorities are **SLA-grounded and I affirm all eight**: chunks-beat-words (formulaic
sequences — Wray/Nattinger), function-beats-topic (notional-functional syllabus — Wilkins), repair =
strategic competence (Canale & Swain), frequency-first (Nation), build-backwards + i+1 (Krashen),
just-in-time minimal grammar, relentless spiraling (spaced retrieval), speaking-first output (Swain).
Four **opinionated refinements**, each baked into the curriculum and the architect's system prompt:

- **➕ SHARPEN #3 — repair is literally unit 0, and it spirals back as a late unit.** Don't just put repair
  "in Stage 0" — make it the **first thing taught**, before greetings, because the very first real exchange
  breaks and `не разбирам / побавно / можете ли да повторите` is what keeps the learner *in* the
  conversation. Then **close the loop**: the same kit returns, leveled up, as the Stage-2 "problems &
  complaints" unit (`s2-problems` recycles `s0-repair`). Repair is the spine's bookends.
- **➕ SHARPEN #6 — recognition-before-production for the hardest grammar.** Add an explicit `produce` flag
  to every grammar point. The two hardest-to-produce Macedonian features — **verb aspect** and **clitic
  ordering** — are set `produce:false` (recognition-only) until late, and even then taught as frozen
  chunks (`ми се допаѓа`) rather than drilled paradigms. Aspect is near-zero leverage for café fluency and
  the highest production cost in any Slavic language; teaching it early teaches frustration. The profiler
  already flags these as load-bearing *for comprehension* — we honor that as **recognition**, not drill.
- **➕ ADD — a "numbers → quantity → price → time" spiral thread.** Prices (`сто и педесет денари`) are
  load-bearing for the café benchmark and were implicit. Promote it to a **named recurring thread**:
  numbers 1–10 (`s0-survive`) → prices to ~200 (`s1-cafe-order`, `s1-market`) → time-of-day
  (`s2-arrange`). Each unit spirals the prior numbers forward. This is the clearest example of compounding
  reuse.
- **➕ ADD — listening-under-pressure as a first-class competence.** The north star includes *real-time
  listening*, not just speaking. The repair kit is partly a **listening-load coping kit**; `s1-directions`
  is deliberately the unit that leans hardest on it (directions are where beginners most need "slower /
  repeat"). Every unit's mini-story has a `spokenPrompt` Q&A so input → comprehension → output is exercised
  each unit (priority #8), and the dual-ASR speaking gate runs on it.

**Nothing cut.** One thing *demoted to recognition* (aspect/clitics production), which sharpens #6 rather
than removing it.

---

## 2. The curriculum game-plan (the core deliverable)

The full machine-readable spine — every unit's frequency-ranked lexis, grammar points, artifacts, recycled
vocab, and dependencies — is in **[`pipeline/output/curriculum-mk.json`](pipeline/output/curriculum-mk.json)**
(the exact shape `architect('mk')` emits). Summary below; see the JSON for complete `coreLexis`.

**Three stages, 12 units** (built backwards from the café benchmark, then radiated by frequency):

| # | Unit | Stage / CEFR | Function(s) | Situation | Just-in-time grammar (`produce`) | Recycles | Depends on |
|---|---|---|---|---|---|---|---|
| 1 | **`s0-repair`** | 0 / pre-A1 | clarify, repeat, slow-down, elicit-a-word, backchannel | any breakdown | — (chunks whole) | — | — *(Cyrillic only)* |
| 2 | `s0-greet` | 0 / pre-A1 | greet, thank, affirm/decline, take-leave | meeting/parting | register ти/вие ✓ | repair | s0-repair |
| 3 | `s0-survive` | 0 / pre-A1 | request, locate, ask-price, quantify | first tiny transaction | gender (еден/една/едно) ✓ | greet, repair | s0-greet |
| 4 | **`s1-cafe-order`** | 1 / A1 | order, ask-price, pay, toast | bar/café **(anchor)** | gender ✓, definite article ✓ | survive, greet, repair | s0-survive |
| 5 | `s1-greet-intro` | 1 / A1 | introduce, ask name/origin/work, state-learning | meeting a patron | сум ✓, 1st-sg present ✓ | greet, repair, café | s0-greet |
| 6 | `s1-market` | 1 / A1 | request-item, quantity, price, buy | shop / pazar | gender spiral ✓, definite ✓ | survive, café, repair | s0-survive, s1-cafe-order |
| 7 | `s1-directions` | 1 / A1 | ask-the-way, understand, transport | a street | place prepositions ✓, imperative ✗(recog) | survive, repair, café | s0-survive |
| 8 | `s2-smalltalk` | 2 / A2 | like/dislike, opinion, agree, connect | lingering chat | clitic chunk ми се допаѓа ✓, да-clause ✓ | intro, café, repair | s1-greet-intro |
| 9 | `s2-pasttime` | 2 / A2 | narrate past, state plans | your day | past set-forms ✓, future ќе ✓, aspect ✗(recog) | intro, smalltalk, café | s2-smalltalk |
| 10 | `s2-home-family` | 2 / A2 | describe family/home/work, age | about your life | possessive ✓, plural ✗(recog) | intro, survive, smalltalk | s1-greet-intro |
| 11 | `s2-arrange` | 2 / A2 | open-call, propose time/place, confirm | a phone call | telling-time ✓, ајде да ✓ | survive, directions, pasttime | s2-pasttime, s1-directions |
| 12 | **`s2-problems`** | 2 / A2 | report problem, complain, ask-help, resolve | something went wrong | negation ✓, polite conditional ✗(recog) | **repair**, market, smalltalk | s2-smalltalk, s1-market |

**Dependency-ordered unit list** (the spine the i+1 engine serves; a valid topological order, verified by
`lintCurriculum`):

```
Cyrillic onboarding (Phase 0, exists)
  → s0-repair → s0-greet → s0-survive
  → s1-cafe-order  → s1-greet-intro → s1-market → s1-directions
  → s2-smalltalk → s2-pasttime → s2-home-family → s2-arrange → s2-problems
```

**Sequencing rationale.** (1) Repair first so the learner can *sustain* before they can *say much*.
(2) Greet/survive complete a self-rescuing pre-A1 who can run a tiny transaction. (3) The **café anchor is
built first in Stage 1** — it is the benchmark and the place the most hand-authored gold already lives
(`order-a-drink`, `ana-coffee`, café reader, `cafe-order-gap`), so generation has the strongest style
anchor. (4) The other A1 units **radiate from café by frequency** and each **recycles the café's number/
price/gender machinery** (compounding retention). (5) Stage 2 fans out from introductions into the four
sustain-a-conversation situations, and **ends by spiraling the repair kit back** as problem-handling —
the bookend that turns "knows phrases" into "can actually talk."

---

## 3. What to generate per unit (mapped to the schema + app surfaces)

Each unit's `artifacts` list (in the JSON) names exactly what the generators emit, all stamped
`confidence:"unreviewed"` until spot-checked → `validated`:

- **`ReviewItem`s** — the unit's `coreLexis` as `vocab`/`phrase` items + grammar drills; `i1Level`,
  `gloss`, `translit`, `tags` (incl. recycled-unit tags), `meta.freqRank`, `meta.gender` for nouns.
- **`Scenario`** — a task-based 2-role dialogue (goal + success criteria), anchored to `order-a-drink`'s
  style. **Also feeds role-swap + live conversation** (partnered layer) for free.
- **`MiniStory`** — the CI spine: synced segments, a Q&A tail with ≥1 `spokenPrompt` (→ `core/speaking`),
  pitched at the unit's i+1; `registersVocab` seeds the familiarity index.
- **`Reader`** — short graded reading (café/market/directions units).
- **`GrammarConcept`** — rule-first explanation + examples + MC drills, **only** the unit's
  `produce:true` grammar points; passes `lintDrills`.
- **`WritingTask`** — prompted production (intro/smalltalk/pasttime/family units).
- **`InfoGapTask`** — asymmetric paired task (`pipeline/infogap.generateInfoGapPair`, to be un-stubbed),
  hand-author the references first then scale.
- **TTS audio jobs** — one per item/segment, synthesized + cached offline (`audioSource:"tts"`), never
  regenerated at runtime.

---

## 4. Generation, quality gates & batching

**Flow:** `profiler ✓ → architect (NEW: curriculum) → per-unit generators → validator ✓ → wave runner →
human spot-check → promote unreviewed→validated`.

**Reviewable WAVES, not a blind dump.** One wave ≈ one unit (or a small group). The curriculum is wave 0
(review it — this STOP). Then content unit-by-unit in `sequence` order; spot-check each wave; promote.
You're fine generating a lot — but gated so trust + correctness hold (low-resource language, you are the
spot-checker until a native validator is found).

**Model tiering is correctness-critical (DESIGN.md §0).** **Opus 4.8 offline for generation AND
validation.** Haiku makes gender-agreement errors generating Macedonian (`Една/Која пиво` — both should be
neuter `едно/кое`) — the exact invisible-to-a-beginner mistakes that teach wrong. Never generate target
language on a cheap tier. The validator (also Opus) checks grammar (esp. gender + article forms),
naturalness, level-appropriateness, beginner-safety, cultural norms. Defense in depth: **even the sample
wave below — authored at the Opus tier — still gets the independent validator pass + human spot-check**,
because even Opus slipped once (DESIGN.md §0).

**Cost (one-time, cached).** Calibrated from `run-batch` CALIBRATE numbers (gen ≈ $0.05–0.08/call,
validation ≈ $0.01–0.02/line):

| Wave | Calls | Est. cost |
|---|---|---|
| 0 · curriculum (architect) | 1 big Opus call | ~$0.25 |
| 1 · Stage 0 (3 units) | ~4 gen + ~20 val / unit | ~$1.8 |
| 2 · Stage 1 (4 units) | ~5 gen + ~25 val / unit | ~$2.8 |
| 3 · Stage 2 (5 units) | ~5 gen + ~25 val / unit | ~$3.5 |
| **Total corpus (12 units)** | | **≈ $8–12 one-time** |

Plus ElevenLabs TTS (one-time, cheap at this volume). Well within the `<$20/mo` budget for a one-time
build, and **cached forever** (runtime never regenerates). Each wave prints a running `$` meter and writes
a `review-mk-<wave>.md` spot-check queue.

**Language-agnostic.** The architect + generators operate on the **profile**, so the same flow yields
`pack-bg` (or any pack). MK first; a thin BG pass re-proves the generality claim (DESIGN.md §6).

---

## 5. Implementation plan (riskiest / most load-bearing first)

1. **✅ DONE — expand `Curriculum` + implement `architect.ts`** (the spine; everything downstream reads it).
   Profile → curriculum via one Opus `structuredCall` whose **system prompt bakes in the eight priorities +
   four refinements (language-agnostic pedagogy)**; the **language facts come from the profile** (nothing MK
   is hardcoded). Includes a pure `lintCurriculum` (orphan deps / non-topological sequence / missing
   repair-kit) mirroring `lint.ts`. **Sub-task:** provide `profile-mk.json` (run `profiler('mk')` ~$0.05, or
   hand-write from the authored pack facts). *Acceptance:* `architect(mkProfile)` yields a dependency-ordered
   list with repair as unit 0, café as the Stage-1 anchor, no orphan deps. (The reviewable artifact is
   already produced: `pipeline/output/curriculum-mk.json`.)
2. **Curriculum-driven generators** (the bulk engine — build on go-ahead). Refactor `content.ts` +
   `generator.ts` to take a `UnitSpec`: `generateUnitVocab/Scenario/MiniStory/Grammar(unit, ctx)` + un-stub
   `infogap.generateInfoGapPair`. Each stamps `meta.freqRank`, `i1Level` from the unit, recycled-unit tags,
   `confidence:"unreviewed"`. *Acceptance:* the café unit spec regenerates café-shaped content; the repair
   unit spec emits repair chunks (proving function-driven, not topic-hardcoded).
3. **Wave runner** (`pipeline/src/run-wave.ts`). Drive generation off `curriculum.sequence`, gate per wave,
   write per-unit gated output + a per-wave `review-mk-<wave>.md` + running cost; reuse
   `writeGenerated/writeReview/lintDrills/validate`. *Acceptance:* the Stage-0 wave produces 3 units of gated
   content + a spot-check sheet + cost, touching no served pack.
4. **Promotion path** (on spot-check). Mirror the existing `generated.ts → index.ts` promotion: spot-checked
   `unreviewed → validated`, wired into `pack-mk/src`. The "⚠ unreviewed" badge gates anything not yet
   promoted (as in `spotcheck-bg.md`).
5. **TTS jobs** — synthesize + cache per item offline (`audioSource:"tts"`), flagged for a human voice later.

**Risk order:** (1) is the spine everything generates against → done + reviewable first. (2)/(3) are the
bulk engine → built only **after** the curriculum is approved (this is the "STOP before bulk generation"
the prompt demands). (4)/(5) are mechanical once content exists.

---

## 6. The sample wave (proof of format + quality) — then STOP

A single small wave is produced end-to-end as a concrete proof, in
**[`pipeline/output/sample-wave-mk.md`](pipeline/output/sample-wave-mk.md)**:

- **`s0-repair`** (net-new, the highest-leverage missing content): repair **chunks** (`ReviewItem`s) + a
  repair **mini-story** ("a conversation that breaks and gets repaired", with a `spokenPrompt`) + a repair
  **scenario** (sustain an exchange using ≥3 repair moves) + a repair **info-gap** (teach each other words
  via `како се вели…? / што значи…?` — forced interdependence on the elicitation kit).
- **`s1-cafe-order`** (the anchor, shown EXTENDING the authored gold): a new **scenario** "order for two &
  split the bill" that spirals the repair kit + numbers + gender, plus its vocab — demonstrating the
  curriculum→artifact mapping and spiraling without duplicating `order-a-drink`/`ana-coffee`/`cafe-order-gap`
  (which already map to this unit).

Every target-language line carries a **self-validation verdict** (the same checks `validator.ts` runs) and
the doc ends with a **spot-check sheet** mirroring `spotcheck-bg.md`. All items are `confidence:"unreviewed"`
and **NOT wired into the served `macedonian` pack** — the trust gate holds.

**STOP for review.** On go-ahead: provide `profile-mk.json`, build steps 2–3 (curriculum-driven generators +
wave runner), and generate the full corpus wave-by-wave with spot-checks. No bulk generation, no pack wiring,
and no API spend happens before this review.
