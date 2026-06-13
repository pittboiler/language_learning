# @ll/core/familiarity — comprehensible-input substrate

**Language-agnostic. The vocabulary-state engine the CI layer is built on.** See
[DESIGN-comprehensible-input.md](../../../../DESIGN-comprehensible-input.md) for the full delta.

## Responsibility
A persistent, per-user, **language-level** familiarity state over **words, chunks, and grammar
patterns** — the substrate that makes i+1 content selection and SRS automatic.

## The core-vs-pack boundary rule
This module holds **logic only, zero language data**. It operates on normalized `lexKey`s and the
FSRS card from `@ll/core/srs`. Language-specific normalization (lemmas, clitics) is deferred and, when
added, comes from the pack as `NormalizeHints` — never hardcoded here. State (the per-user index) is
persisted by the app (`Progress`/Supabase), not by this module.

## The unification (why there's no second vocab store)
A `FamiliarityEntry` **holds** the existing `core/srs` `ReviewState` (`entry.srs`). The SRS scheduler
reads/writes `entry.srs.card`; `status`/`strength` are a cached **projection** of that card. One source
of truth — see DESIGN-CI §1.1. The legacy `Progress.reviews` map migrates in via `migrateFromReviews`.

## Surface
- `index.ts` — `FamiliarityEntry`/`FamiliarityIndex`, `capture`, `recordEncounter`, `setStatus`,
  `deriveStatus`, `toReviewStates` (adapter to `srs.dueItems`/`nextBatch`), `migrateFromReviews`.
- `scoring.ts` — `tokenize`, `scoreText` (known-% / i+1 fit), `rankByIPlusOne`, `computeMetrics`.
  Consumed by `core/leveling` (computed i+1), `core/session` (ranking), the scenario engine, and the
  Part-C import recommender.

## Status
**Stubs only** — interfaces are stable; bodies throw `not implemented`. Build order: see DESIGN-CI §4
(familiarity store + SRS unification is step 1, riskiest, and must stay backward-compatible).
