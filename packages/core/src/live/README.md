# @ll/core/live — live scaffolded conversation

**Language-agnostic. The crown jewel (Phase 4): the app as a real-time coach *between* two learners.** See
[DESIGN-partnered-learning.md](../../../../DESIGN-partnered-learning.md) §2 / §1.4.

## Responsibility
The pure turn-state engine for a synchronous, scenario-driven conversation: assign roles, track whose
turn it is, record each spoken turn (transcript + score), advance, and complete. Both partners' screens
stay in sync because both read the same authoritative session.

## The core-vs-pack boundary rule
**Logic only, zero language data.** The dialogue is the existing `Scenario.script` (two human roles);
spoken turns reuse `core/speaking`; the discreet rescue hint reuses `core/tutor` — at the app layer.

## Real-time lives in the app, not here
This module is a pure reducer over `LiveSession`. The **real-time transport** is Supabase Realtime in
`apps/web`: the session is a `partner_artifact` (kind `live`, the durable source of truth), synced via
`postgres_changes` (live updates) + a presence channel ("partner is here"). Migration `0003` adds the
table to the realtime publication. The UI degrades to a manual refresh if realtime is unavailable.

## Surface
- `startLive(id, packId, scenario, assignment)` / `assignLiveRoles(a, b)`.
- `currentTurn` · `isMyTurn` · `roleOf` — whose turn, what line.
- `speakTurn(session, userId, transcript, score)` — record + advance (guards turn order).
- `isComplete` · `progress`.

## Status
**Implemented + unit-tested** (`packages/core/test/live.test.ts`). The remaining v2 step is **WebRTC
audio** so remote partners hear each other; today the live *state* (turns, transcripts, scores, presence)
syncs in real time, which already works co-located or alongside a phone call.
