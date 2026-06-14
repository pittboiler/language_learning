# @ll/core/teachback — protégé-effect teaching

**Language-agnostic. The production surface of the cross-partner familiarity diff.** See
[DESIGN-partnered-learning.md](../../../../DESIGN-partnered-learning.md) §2 / §3.3 / §5.6.

## Responsibility
When one partner is ahead on a concept (per the `complementaryDiff` from `core/partner`), prompt that
partner to record a short explanation for the other. The **teacher** gets the larger learning gain — so
this turns a pace gap into a benefit instead of a wound.

## The core-vs-pack boundary rule
**Logic only, zero language data.** Inputs are the diff's `iCanHelpPartner` items (`lexKey`s) + two user
ids. The recording reuses `core/speaking` (optional self-coaching) and the `partner-media` bucket; the
result persists as a `partner_artifact` (`kind: 'teachback'`). No language facts here.

## Sibling to complementary-SRS
Teach-back and `@ll/core/partner/complementary-srs` are **the two surfaces of one engine** — both consume
`complementaryDiff`. Complementary SRS routes *review* ("your partner knows this"); teach-back routes
*production* ("you're ahead — explain it"). Build the diff once.

## Surface
- `proposeTeachBacks(diff, teacherId, learnerId, opts?)` → capped, ranked `TeachBackPrompt[]`.
- `TeachBackArtifact` — the recorded (or typed) explanation, `requested → recorded → seen`.

## Status
**Stubs only** — interfaces stable; bodies throw `not implemented`. Phase 2 (familiarity-driven
collaboration); depends on the publish-projection carrying the gated `FamiliarityProjection`.
