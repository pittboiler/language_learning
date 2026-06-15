# @ll/core/roleswap — async voice role-swap

**Language-agnostic. The flagship collaborative feature.** See
[DESIGN-partnered-learning.md](../../../../DESIGN-partnered-learning.md) §3.3 / §5.3.

## Responsibility
Serve a 2-role dialogue to a dyad: each partner records *their* role's lines (async, on their own time),
the app stitches the recordings into one replayable conversation, and every line gets dual-ASR coaching.
It rehearses the actual conversational goal between two real humans.

## The core-vs-pack boundary rule
**Logic only, zero language data.** The 2-role content is the existing `Scenario.script`
(`speaker: 'learner' | 'partner'`) straight from the pack — **role-swap needs no schema change**, it just
reassigns both roles to humans. Recording reuses `apps/web/lib/recorder.ts` → `/api/asr`; coaching reuses
`core/speaking` (`confidenceGate` + `composeFeedback`). Audio blobs live in the `partner-media` bucket; the
session persists as a `partner_artifact`. This module only orchestrates turns over those primitives.

## Surface
- `startRoleSwap(scenario, assignment)` → a `RoleSwapSession` (one turn per scripted line).
- `nextOpenTurn(session, userId)` — the next line this partner owes.
- `recordTurn(...)` / `attachFeedback(...)` — fold in a recording + its dual-ASR coaching.
- `isStitchable(session)` — all turns recorded ⇒ replayable end-to-end.

## Status
**Stubs only** — interfaces stable; bodies throw `not implemented`. Phase 1 (first real collaboration),
built directly on the shipped speaking + scenario subsystems — no new dependencies.
