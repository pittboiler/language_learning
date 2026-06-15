# PROMPT 5 — Content & Curriculum
### Structured content generation toward *conversational* fluency
### Run AFTER Prompts 1–4 (core, comprehensible-input/familiarity, ASR spike, partnered layer)

> Paste below the line into the SAME Claude Code project. This is an ADDITIVE **content** increment — it
> does NOT re-architect anything. It turns today's thin reference content into a LARGE, sequenced,
> validated corpus that carries a learner from zero → holding real conversations. Same staged discipline
> as every prior prompt: **read the existing design/pipeline/pack first, design the curriculum game-plan
> and STOP for review, then generate content in reviewable, spot-checked waves.** Do NOT blind-generate
> ten thousand items. Be opinionated; state assumptions and continue.

---

## 0. First — read, then summarize how this fits
Read and internalize before proposing anything:
- **DESIGN.md** §5 (the offline content pipeline — the "trust layer") and §6 (phased roadmap).
- **DESIGN-comprehensible-input.md** (the familiarity engine, `lexKey`, computed i+1, mini-stories spine).
- **DESIGN-partnered-learning.md** (role-swap, info-gap, and live conversation all *consume* this content).
- The **`pipeline/`** agents: `profiler` (✓ built), **`architect` (STUBBED — `not implemented`)**,
  `generator` + `content` (✓), `validator` (✓), `run-batch` (✓), `import` (✓).
- **`packages/pack-mk`** (the current hand-authored + spot-checked data) and the
  **`packages/pack-schema`** contract (`ReviewItem`, `Scenario`, `MiniStory`, `Reader`, `GrammarConcept`,
  `WritingTask`, `InfoGapTask`, `LanguagePack`).

Summarize back: how this increment fits, what it **depends on**, and what already exists vs. what is thin.
Flag conflicts and propose reconciliation. Be opinionated.

---

## 1. Strategic frame — what is MOST useful for *conversational* fluency (read before planning)
We are not building a grammar course or a vocabulary dump. The north star is **holding a live
conversation in a bar/café (and beyond)**. That dictates *what* content matters and *in what order*. Bake
these opinionated, SLA-grounded priorities into the plan — pressure-test them, then sequence accordingly:

1. **Chunks beat words.** Fluency is fast retrieval of **formulaic sequences** — "колку чини?", "сакам…",
   "може ли…", "како се вели…". Teach high-frequency chunks as *whole units* (the familiarity engine's
   `chunk` kind), not just isolated words. A learner who owns 100 chunks can *say* far more than one who
   owns 100 words.
2. **Function beats topic.** Organize by communicative **functions** — what you DO with language (greet,
   request, offer, accept/decline, ask the price, ask the way, express want/like, clarify) — not by topic
   word-lists. Functions are reusable across every situation.
3. **Repair language is the conversational superpower — FRONT-LOAD it.** The single highest-leverage set
   for *sustaining* a real conversation is the **repair / strategic-competence kit**: "извини, не
   разбирам", "можеш ли да повториш?", "побавно, те молам", "како се вели … на македонски?", "што значи
   …?", "мојот македонски не е добар уште" + backchannels ("навистина?", "да-да", "аха"). Most courses
   bury these; **we teach them in Stage 0** so a beginner can keep a conversation *alive* through the
   inevitable gaps. This is the difference between "knows phrases" and "can actually talk."
4. **Frequency-first.** Prioritize the highest-frequency vocabulary/chunks — a small core covers the bulk
   of everyday speech. Tag every item with a frequency rank; let it drive `i1Level` + ordering.
5. **Build backwards from the goal, then radiate by frequency.** Anchor on the bar/café benchmark (it
   exists), then add the next-most-frequent real-life situations (greetings/introductions, shopping/
   market, directions/transport, arranging-to-meet/phone, home & family, small talk).
6. **Grammar = just-in-time, rule-first, minimal.** Only the grammar that changes meaning or
   comprehensibility, introduced the moment a chunk/scenario needs it. For MK the profiler already named
   what matters: **definite articles (книга→книгата/книгава/книгана), gender agreement, verb aspect,
   clitic order, antepenultimate stress — explicitly NOT a Slavic case system.**
7. **i+1 + relentless spiraling.** Sequence by *computed* comprehension (the familiarity `scoreText`);
   deliberately **recycle** core vocab across functions and situations so retention compounds (the
   SRS/familiarity engine rewards reuse).
8. **Speaking-first — every unit ends in output.** Each unit terminates in *production*: a scenario
   (task), a role-swap dialogue, an info-gap task, and/or a live-conversation scenario — all of which the
   partnered layer + speaking pipeline already consume. Comprehensible input feeds output; we don't delay
   speaking.

State where you'd move/add/cut these priorities, with reasons, before you build the curriculum on them.

---

## 2. The game plan = a CURRICULUM (deliver this FIRST, then STOP for review)
Implement the **stubbed Curriculum Architect** (`pipeline/src/architect.ts`): profile → a **sequenced
curriculum**, the spine everything else generates against. Produce it as a reviewable artifact and STOP
before any bulk generation. Proposed shape — critique it and firm it up:

**Stages → Units.**
- **Stage 0 — Decode & survive (pre-A1).** Cyrillic (exists) + the ~40–60 highest-leverage chunks:
  greetings, please/thanks/yes/no/sorry, **the repair kit (#3)**, numbers 1–10, "сакам… / колку чини? /
  каде е…?". Goal: survive *and sustain* a first exchange.
- **Stage 1 — Core situations (A1).** Café/bar (north star) · greetings & introductions · shopping/market
  · directions & getting around. ~300–500 core chunks/words. Just-in-time grammar: definite articles,
  gender agreement, present tense of high-frequency verbs, an aspect introduction.
- **Stage 2 — Connect & sustain (A2).** Small talk · likes/opinions · past & future (your day, your
  plans) · phone & arranging to meet · home/family/work · problems & complaints. Aspect deepened, clitic
  order, connectives. Multi-turn, longer conversations.

**Per unit, the curriculum must specify:**
- the communicative **function(s)** + the **situation**;
- **core lexis** (chunks + words), frequency-ranked, each with an `i1Level`;
- the **grammar point(s)** introduced (rule-first, minimal) + their prerequisite units;
- the **content artifacts** to generate (§3);
- the **recycled vocab** (which earlier items spiral back in);
- **dependencies** (prerequisite units) → yielding a **dependency-ordered unit sequence** the app's i+1
  engine can serve progressively.

---

## 3. What to generate per unit (mapped to the pack schema + app surfaces)
For each unit the generators emit, all stamped `confidence:'unreviewed'` until spot-checked → `validated`:
- **`ReviewItem`s** — vocab + **chunks** (kind `vocab|phrase`) + grammar drills; with `i1Level`, `gloss`,
  `translit`, `tags`, and a frequency rank in `meta`.
- **`Scenario`s** — task-based 2-role dialogues with a goal + success criteria. These **also feed
  role-swap and live conversation** (partnered layer) at no extra cost.
- **`MiniStory`s** — the comprehensible-input spine: synced audio, segmented tokens, a Q&A tail, pitched
  at i+1; `registersVocab` seeds the familiarity index.
- **`Reader`s** — short graded reading.
- **`GrammarConcept`s** — rule + examples + drills (only the just-in-time points from #6).
- **`WritingTask`s** — prompted production with correction.
- **`InfoGapTask`s** — asymmetric paired tasks for the partner layer (hand-author the references, then
  turn on `pipeline/infogap.generateInfoGapPair` to scale).
- **TTS audio jobs** — synthesized + cached offline per item (never regenerated at runtime).

---

## 4. Generation, quality gates, and batching
- **Flow:** `profiler (✓) → architect (NEW: curriculum) → generator/content (per unit) → validator →
  run-batch (waves) → human spot-check → promote unreviewed→validated`.
- **Model tiering is correctness-critical.** **Opus 4.8 offline** for generation *and* validation: Haiku
  makes gender-agreement errors generating Macedonian (`Една/Која пиво` — both should be neuter
  `едно/кое`), the exact invisible-to-a-beginner mistakes that teach wrong. Never generate target
  language on a cheap tier. The **validator** checks grammar (esp. gender agreement + article forms),
  naturalness, level-appropriateness, beginner-safety, and cultural norms; it stamps `confidence`.
- **Reviewable WAVES, not a blind dump.** Generate the **curriculum first** (review it). Then content
  **stage-by-stage / unit-by-unit**; spot-check each wave; promote `unreviewed→validated`. You're fine
  generating a *lot* — but in gated waves so trust + correctness hold (low-resource language, no native
  validator yet; you are the spot-checker until one is found).
- **Cost:** Opus offline + cache everything (content + audio, one-time). Surface per-wave token/$ cost.
- **Language-agnostic.** The architect + generators operate on the **profile**, so the same flow yields
  `pack-bg` (or any pack). MK first; then a thin BG pass re-proves the generality claim (DESIGN §6).

---

## 5. Deliver in this response
1. **Summary** of how this fits + what exists vs. thin + dependencies + conflicts/reconciliation.
2. Your **validated/refined pedagogical strategy** (§1 — what you'd move/add/cut, and why).
3. The **curriculum game-plan** (§2): stages → units (function, situation, core lexis w/ frequency +
   `i1Level`, grammar, artifacts, recycled vocab, dependencies) + the **sequencing rationale** + a
   **dependency-ordered unit list**. *This is the core deliverable — produce it, then STOP for review
   before bulk generation.*
4. The **generation + validation + batching plan** (§4: flow, waves, model tiering, spot-check, cost).
5. **Implementation plan**, riskiest/most load-bearing first: implement `architect.ts` (profile →
   curriculum), extend the generators to emit per-unit content against the curriculum, and the
   `run-batch` wave runner with `confidence` gating.
6. Generate **ONE small sample wave** end-to-end as a concrete proof of format + quality — e.g. Stage 0's
   **repair kit** + one **café** unit: its vocab/chunks + a scenario + a mini-story + an info-gap task,
   validated and spot-checkable. **Then STOP** for review before generating the full corpus.
