# @ll/pack-mk — Macedonian language pack

**Data only.** No app logic. Everything here conforms to `@ll/pack-schema` and is consumed by
`@ll/core`. This is the vertical slice that proves the pack model; a second language (Bulgarian,
DESIGN.md §6 Phase 3) should be a sibling package with *no* `core` changes.

## Macedonian-specific decisions (not a generic template)

- **Cyrillic first.** 31 letters; the 7 unique ones (ѓ ќ ѕ џ љ њ ј) get dedicated lessons. Spelling
  is ~phonetic (one letter ≈ one sound) — exploited in onboarding.
- **No heavy case system** — Macedonian is largely analytic. That budget is reallocated to what's
  actually distinctive:
  - **Postposed definite articles with three-way deixis** (книга → книгата / книгава / книгана).
  - **Three genders + agreement** (always learn a noun with its gender).
  - **Verb aspect** (perfective/imperfective) across core tenses.
  - **Clitic pronoun ordering.**
  - **Antepenultimate stress** + loanword exceptions (кафе → ka-FE) — surfaced in speaking feedback.

## What's hand-authored vs generated

`scenarios/order-a-drink.ts` is **hand-authored** (`confidence: "authored"`) — the known-good
reference everything generated is validated against. The pipeline generates outward from it; every
generated item starts `confidence: "unreviewed"` and is gated until a human (you) spot-checks it.
