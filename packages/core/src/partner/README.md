# @ll/core/partner — two-person collaborative learning

**Language-agnostic. The relationship layer + the cross-partner familiarity substrate.** See
[DESIGN-partnered-learning.md](../../../../DESIGN-partnered-learning.md) for the full delta.

## Responsibility
The **partnership primitive** for a trusted dyad: the invite/consent state machine, per-member
visibility, and the derived shared streak; **plus** the cross-partner familiarity **diff** that powers
complementary SRS and teach-back ("two people forget different things").

## The core-vs-pack boundary rule
**Logic only, zero language data.** This module operates on user ids, `lexKey`s, FSRS-derived
`{status, strength}`, and generic activity metrics. Partnership **state** (the new rows) is persisted by
the app (`apps/web/lib/partner-store.ts` + Supabase), never by this module — exactly like
`core/familiarity`'s index lives in the store. Partnered **content** (info-gap tasks) lives in the pack.

## The privacy model (why a partner can't read your raw state)
The app's single-user invariant is **"you only ever read your own `user_state`."** Partnered features
need cross-user reads, so each member **publishes a visibility-gated projection** — `ActivityRecord`
(`index.ts`) + `FamiliarityProjection` (`familiarity-diff.ts`, just `{status,strength}` per `lexKey`) —
that the partner may read. The raw blob never crosses the boundary. Privacy is enforced at publish time
(visibility settings) **and** read time (RLS). See DESIGN-partnered §1.1.

## One engine, two surfaces
`complementaryDiff(mine, theirs)` is computed **once**. Complementary SRS (`complementary-srs.ts`) is its
**review** surface ("your partner knows this"); teach-back (`@ll/core/teachback`) is its **production**
surface ("you're ahead — explain it"). Build the diff; both features are thin consumers.

## Surface
- `index.ts` — `Partnership` / `VisibilitySettings` / `ActivityRecord`; `invite`/`accept`/`pause`/
  `resume`/`end`/`partnerOf`; `sharedStreak` (derived, freeze-aware; the solo streak is untouched).
- `familiarity-diff.ts` — `FamiliarityProjection`, `projectFamiliarity`, `complementaryDiff`.
- `complementary-srs.ts` — `routeComplementary` (annotates the learner's own due queue).

## Status
**Stubs only** — interfaces are stable; bodies throw `not implemented`. Build order: see DESIGN-partnered
§5 — the partnership primitive + cross-user RLS (§5.1) is the riskiest piece and must be verified
privacy-correct **first**; the familiarity diff arrives in Phase 2.
