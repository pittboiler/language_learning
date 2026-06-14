# @ll/core/infogap — forced-interdependence tasks

**Language-agnostic. Genuine interdependence a trusted dyad uniquely enables.** See
[DESIGN-partnered-learning.md](../../../../DESIGN-partnered-learning.md) §3.3 / §3.4 / §5.7.

## Responsibility
Run an **asymmetric** task: each partner gets different information and a shared goal neither can reach
alone, forcing real target-language communication with genuine stakes. No free-riding, no one partner
carrying the other — the gap *must* be bridged by talking.

## The core-vs-pack boundary rule
**Logic only, zero language data.** The asymmetric content is an `InfoGapTask` from the pack (two
`InfoGapRole`s, each with its own `secretInfo` + `targetPhrases`), generated offline by
`pipeline/infogap.generateInfoGapPair`. Spoken turns reuse `core/speaking`; the discreet rescue hint
reuses `core/tutor`. This module only tracks the session and — critically — **serves each partner only
their own half** (`briefFor`); never hand both roles to one client.

## Surface
- `startInfoGap(task, roles)` → `InfoGapSession` (each user pinned to A or B).
- `briefFor(task, role)` — this partner's half only (the asymmetry is the point).
- `markMet` / `isComplete` — done only when the information gap is closed.

## Status
**Stubs only** — interfaces stable; bodies throw `not implemented`. Phase 3 (highest content lift): needs
the new `InfoGapTask` pack type + the offline asymmetric-pair generator before it can run.
