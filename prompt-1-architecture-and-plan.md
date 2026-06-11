# PROMPT 1 — Architecture & Build Plan
### Conversation-first language learning, web app, Macedonian-first but language-agnostic core

> Paste everything below the line into Claude Code. This asks it to act as an architect:
> design the system, surface key decisions, and produce a phased plan + scaffold — NOT to
> build the whole app in one pass. Run the speaking-pipeline spike (Prompt 2) before or
> alongside this so the plan is grounded in what's actually achievable for Macedonian speech.

---

You are my technical co-architect. Before writing feature code, produce a **design +
architecture document and a phased build plan**, then scaffold the project skeleton and stop.
If any constraint below is ambiguous, ask me clarifying questions first. Be opinionated;
where you assume, state the assumption and continue.

## North star
Get me from zero to **holding a simple, real conversation in Macedonian in a social setting
(e.g. at a bar)**. Every design decision must be justified against that spoken-conversation
outcome. Speaking and real-time listening are the primary outcomes; vocabulary and grammar
are supporting infrastructure, not the product.

## Strategic constraint that shapes the architecture
Build **Macedonian end-to-end first as a vertical slice**, BUT architect the core to be
**language-agnostic from day one**. Macedonian is the first "language pack," not a hardcoded
app. Generalizing to other languages later should be config + content generation, NOT a
rewrite. Design the data model, content pipeline, and tutor so a new language is added by
producing a new validated language pack, not by changing app code.

Do not over-engineer the multi-language framework now. The test: would adding a second
language (say, Bulgarian) require touching app logic, or only generating + validating a new
pack? Aim for the latter, but ship Macedonian first.

## Platform
Responsive **web app** (desktop + mobile browser). Native can come later. Must handle
microphone capture and audio playback in-browser. Note: a zero-friction web experience
(start talking fast, minimal signup) is a deliberate edge — design for it.

## The learner (me)
Technically fluent; I build apps and work in Claude Code regularly — write for a developer.
Complete beginner in Macedonian, no Cyrillic yet. I want daily use, so retention, motivation,
and low-friction practice matter as much as correctness.

## Pedagogy the app MUST encode (features, not philosophy)
For each, tell me WHERE in the architecture it lives:
1. **Comprehensible input at i+1** — a leveling system serving content just above my current
   ability; requires a model of my current level.
2. **Spaced repetition (SRS)** — engine applied to vocab, full phrases, AND grammar patterns.
   Specify the algorithm (FSRS or SM-2) and the review-item data model.
3. **Active retrieval / testing effect** — force recall before reveal; prefer production over
   recognition.
4. **Pushed output** — I must regularly produce language (speak + write) with targeted
   corrective feedback. Highest-priority subsystem given my goal.
5. **Interleaving** — sessions mix skills and topics rather than blocking them.
6. **Task-based scenarios** — a scenario engine around real communicative tasks (order a
   drink, small talk, introductions, asking directions, paying). Each scenario has goals,
   required vocab/structures, and success criteria.
7. **Low affective filter** — an AI partner I can fail in front of endlessly, with adjustable
   difficulty and optional English scaffolding.

## Language-pack model (the generalization layer)
Define a **language pack** as the unit that makes the app language-agnostic. It should
capture everything language-specific so the app core stays generic. At minimum a pack
includes: script/alphabet onboarding data, phonology + pronunciation rules, the grammar
features that actually matter for THIS language (not a generic template), high-frequency
conversational vocabulary, scenario library, graded reading content, and SRS seed items.

Design an **agentic content pipeline** that produces a validated language pack for any
sufficiently-resourced language. Sketch these agents and their I/O:
- **Language Profiler** — given a target language, produce a structured profile (script,
  phonology, the grammar features that matter, high-frequency vocab, social/cultural norms).
- **Curriculum Architect** — turn the profile into a leveled skill tree + scenario sequence,
  built backwards from conversational goals.
- **Content Generator** — produce graded dialogues, readers, drills, and SRS items at i+1.
- **Validator / Critic** — check every generated item for correctness, naturalness, and
  level-appropriateness; flag low-confidence items for native-speaker review. This is the
  trust layer; treat it as first-class, not an afterthought.
These run **offline and cache a validated pack** (cost + consistency). Do not regenerate
content live at runtime.

## Macedonian language pack — specific requirements (do NOT use a generic template)
- **Cyrillic onboarding first.** 31 letters incl. unique ones (ѓ, ќ, ѕ, џ, љ, њ, ј). Gate
  early content on alphabet fluency. Exploit that spelling is highly phonetic (≈ one letter,
  one sound).
- **Do NOT build a heavy noun-case system** — Macedonian is largely analytic and dropped the
  Slavic case system. Reallocate that budget to what's actually distinctive:
  - **Postposed definite articles with three-way deixis** (книга → книгата / книгава /
    книгана), encoding proximity. Unusual; needs dedicated teaching + drills.
  - **Gender agreement** (three genders) — always teach nouns with gender.
  - **Verb aspect (perfective/imperfective) and conjugation** across core tenses.
  - **Clitic pronoun ordering.**
  - **Antepenultimate stress rule** (stress on 3rd-from-last syllable) — teach as a rule and
    surface it in pronunciation feedback.
- Prioritize high-frequency conversational vocab and Balkan social/bar/café scenarios over
  thematic word lists. Teach the standard spoken register; note where colloquial usage
  diverges from textbook forms.

## Four skills — concrete subsystems
- **Listening:** native-quality audio for all content; varied speeds; dictation and
  listen-then-respond.
- **Speaking:** record voice → ASR (speech-to-text) → compare to target → feedback on
  pronunciation, stress, and word choice; plus open-ended spoken conversation with the AI
  partner. (See Prompt 2 — I'm de-risking this pipeline separately; integrate its findings.)
- **Reading:** graded readers / short dialogues at i+1 with tap-to-reveal gloss and SRS
  capture.
- **Writing:** short prompted production with correction and explanation of *why*.

## Tooling reality (Macedonian is lower-resource — verify, don't assume)
Recommend specific providers and justify each on confirmed Macedonian support, quality, cost,
and latency:
- **TTS:** ElevenLabs v3 (mkd), Google Cloud, Azure all list Macedonian.
- **ASR/STT:** Google Cloud Speech-to-Text and ElevenLabs Scribe support Macedonian —
  evaluate accuracy on non-native, error-prone learner speech specifically.
- **LLM tutor / content gen / grammar / correction:** design around an LLM (e.g. Claude) as
  conversation partner, scenario driver, content generator, and feedback engine. Specify
  prompt structures and how you keep its Macedonian accurate and level-appropriate.
- Flag where a provider's Macedonian support is weak and propose fallbacks. Note how provider
  choice generalizes to other language packs.

## Deliver in this response
1. **Clarifying questions** (only if genuinely needed): my monthly budget for paid APIs,
   timeline, and whether offline browser use matters.
2. **Recommended tech stack** + rationale (front end, back end, DB, auth, hosting, audio/LLM
   APIs). Bias toward what a solo developer can ship and maintain.
3. **System architecture** — components and data flow; how SRS engine, scenario engine,
   speaking-feedback pipeline, AI tutor, and the offline content pipeline interconnect.
   Diagram welcome (ASCII or mermaid). Clearly separate the **language-agnostic core** from
   the **language pack**.
4. **Core data models** — users, level model, vocab/phrase items, SRS review state, grammar
   concepts, scenarios, progress, and the language-pack schema.
5. **Content pipeline** — how the agents produce, validate, and store a language pack;
   hand-authored vs. generated vs. hybrid; how quality/accuracy is verified for a
   resource-scarce language.
6. **MVP definition + phased roadmap.** Smallest version that teaches me Cyrillic + one real
   bar scenario end-to-end, then phases out to full Macedonian coverage, then the
   generalization milestone (add a 2nd language with no app-code changes). Sequence by what
   most advances the bar-conversation goal.
7. **Key technical risks + open decisions**, each with your recommendation.
8. **Project scaffold** — directory structure and stub files for the MVP, with READMEs per
   module, clearly separating core from language pack. Then STOP and wait for me.
