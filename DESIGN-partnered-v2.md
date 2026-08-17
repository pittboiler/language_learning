# Design Δ — Partnered Learning **v2** (the "Together session")

> **Supersedes the delivered v1 UX; extends [DESIGN-partnered-learning.md](DESIGN-partnered-learning.md).**
> Same data spine and engines — a **re-envisioned surface**. v1 shipped a toolbox (six activities across
> Together / Practice / Manage). This replaces it with a single spine: a **live, two-device co-op session
> two people run at the same time.** Status: design only. No code changes yet.

## Why v2

v1 works but feels *clunky and all over the place*. The causes, precisely:

1. **No spine.** Six activities (live conversation, role-swap, info-gap, help-each-other, shared story,
   phrasebook) across three tabs. Nothing says what to do *now* or *why next*. A toolbox, not a path.
2. **A freeform mode two beginners can't sustain.** "Live conversation" (open-ended) is the headline, but
   two matched beginners stall into silence — neither can carry it. The crown jewel is aspirational, not
   day-one usable.
3. **Stage mismatch assumed away.** Every activity shows both people the same difficulty; the one thing
   that models the gap (the familiarity diff) is passive and buried.
4. **Pairing drops you into an empty room** — a code to retype, then a grid of features with no first move.

### The three decisions that shape v2

| Decision | Answer | Consequence for the design |
|---|---|---|
| Who pairs | **Two matched beginners**, learning in parallel | Balance a *small, shifting* gap; collaborative-first, not coaching. No permanent teacher role. |
| Sync realistic? | **Often together** (same household / co-schedulable) | The flagship is a **live session done at the same time**, not an async thread. Async becomes the backbone for days apart. |
| Multiple partners | **Optimize for one** | One partner is the whole design; multiple is a quiet switcher that never shapes the core flow. |

North star is unchanged from v1 — **holding a live conversation** — but the *route* is corrected: matched
beginners get there through **scaffolded co-op sessions**, graduating into free conversation, not being
dropped into it.

---

## 1. Principles

1. **Together-first.** The flagship is a short session two people run **at the same time, each on their own
   phone, live-synced.** (v1's async pieces become supporting, not co-equal.)
2. **One shared thing at a time.** A single active session with an obvious next action for each person — not
   a menu of six.
3. **Scaffolded, never freeform.** Every turn ships a frame / prompt / answer-on-screen. Free conversation is
   an *endpoint you graduate into*, gated behind demonstrated readiness — never the first offering.
4. **Balance per item, not per person.** With a small, shifting gap, roles flip **each turn** based on who's
   momentarily more familiar — so it always feels even and collaborative.
5. **Tiny per-turn cost, no long blocking.** Each turn is seconds; the session never strands one person
   waiting on the other for long (soft timeouts hand the turn back).
6. **Value on arrival.** The moment you pair, a first session is ready to start.

---

## 2. The model: one "Together" screen

Replace the three tabs with **one screen**:

```
Together with [partner]                       🤝🔥 6-day shared streak
┌───────────────────────────────────────────┐
│   ▶  Start a session together               │   ← the whole product, one button
│      ~6 min · you're both here now          │
└───────────────────────────────────────────┘
   Since you're apart →  2 things waiting in your thread   (async backbone, small)
   ⚙ partner settings · switch partner
```

Everything else (info-gap, role-swap, call-response) is a **mode of the one session**, chosen
automatically — not a separate destination. Phrasebook becomes a save-target for good lines. Manage/visibility
collapse into settings.

---

## 3. The flagship: a live-synced co-op session (two-device)

Two people, two phones, **at the same time**, sharing one session state over Supabase Realtime (the exact
mechanism `LiveConvo` already uses — reuse it, don't rebuild). ~6 minutes, ~10–14 turns.

### 3.1 Session anatomy

- **Lobby.** One taps *Start*; the partner gets a live "join now?" prompt (or a nudge if not open). Both
  in → session begins. A soft "waiting for [partner]…" state, never a dead end.
- **A queue of turns**, each a small unit drawn from the **shared-gap content** (§4.2). Each turn assigns
  **one producer and one checker** (§4.1).
- **Turn loop:** producer sees the prompt + their scaffold; checker sees the *same* prompt **plus the answer**
  and a one-tap ✓/↻. Producer answers (spoken via the existing dual-ASR gate, or tap) → checker confirms →
  next turn, **roles flip.**
- **Wrap:** one shared score ("you cleared 12 together"), the shared streak ticks, 1–2 lines offered to save
  to the phrasebook, and the async thread is seeded for next time.

### 3.2 Session modes (auto-selected, same shell)

| Mode | What happens | Why it works for two matched beginners |
|---|---|---|
| **Call-and-response** | Producer says the target line; checker holds the answer + audio, confirms. | Real speaking practice with a partner who *can't* judge you — the checker just matches the screen. |
| **Quiz-each-other** | Producer recalls a due word/phrase; checker holds the card. | The balancer: the checker always has the answer, so nobody needs to be ahead to "teach." |
| **Info-gap** | Each sees *half* a task (menu, map); they must use the language to complete it together. | Genuinely *requires* two people; the app supplies the frames so low level is fine. Reuses v1's info-gap generator. |
| **Co-op clear** | "Together, produce these 8 phrases," tag-team, one score. | Collaborative, shared win, no head-to-head. |

Day-one build target: **call-and-response + quiz-each-other** (they share one shell). Info-gap and co-op
clear are additive modes on the same session, not new screens.

### 3.3 The graduation path (protecting the north star)

Free conversation stays the crown jewel but is **earned**: once a pair has cleared enough scaffolded turns on
a scenario's vocabulary, the session offers a **"try it for real"** coda — a 60-second open exchange on that
exact scenario, with the tutor engine (`@ll/core/tutor`) on standby for a one-tap rescue. Scaffold → semi-open
→ open, never open cold.

---

## 4. Balancing two matched beginners

The gap is small and *shifts item to item*, so balance is mechanical and per-turn, not a mode you pick.

### 4.1 Flipping micro-roles

For each turn, the app compares both partners' `familiarity` strength for that item and makes the **more
familiar one the checker** (answer on screen) and the other the **producer**. Because it flips every turn and
the checker is *always armed with the answer*, neither person needs to actually be ahead for it to feel fair —
and it self-corrects as they drift slightly apart. When strengths tie, alternate.

### 4.2 Shared-gap content selection

Draw the queue from the **union of both partners' due/learning items**, weighted toward what **both** need
(intersection first). Matched beginners benefit most from learning the *same* words at the *same* time — then
they can actually use them with each other. This is the familiarity-diff engine from v1, repointed from a
passive "here's what your partner knows" panel to the **active source of the session queue.**

### 4.3 Collaborative scoring, one shared streak

- Default is **collaborative**: "we cleared 12 together," one joint streak (reuse the shared-streak artifact).
- **Head-to-head comparison is opt-in and light.** Between a couple or close friends a leaderboard sours fast;
  keep score-against-each-other behind a toggle, off by default.

---

## 5. The async thread (backbone for days apart)

Small, secondary — the connective tissue when you're *not* together, and the queue that feeds the next live
session. One prompt tied to the current unit; one person takes a turn (record/type), the other responds when
they can, scaffolded to each level. Accumulates as a visible little dialogue. It exists to **keep the streak
alive and pre-load the next Together session**, not to be a second product.

---

## 6. Setup & onboarding

- **Share-link pairing, not a typed code.** Invite = a deep link sent over SMS/WhatsApp; tapping it opens the
  app and auto-pairs. (Keep the 6-char code as a fallback.) This is the single biggest setup-friction win.
- **Value on arrival.** The instant you pair, a first session is queued from the joiner's current unit — no
  empty state.
- **"You're both here" start.** Because you're often together, a one-tap start that live-pings the partner to
  join, with a graceful "waiting…" if they're not open.
- **Placement is inferred**, not a quiz — both partners already have a computed level; role-sizing uses it
  from turn one.

---

## 7. Data-model delta (mostly reuse)

Nothing here needs a new source of truth — v1's spine already carries it.

| Piece | Reuse / change |
|---|---|
| `partnership` table (dyad) + RLS ([0002_partnered.sql](apps/web/supabase/migrations/0002_partnered.sql)) | **Unchanged.** One partner is the target; the v1 multi-partner switcher stays as a quiet control. |
| `partner_artifact` + Realtime ([0003_partner_realtime.sql](apps/web/supabase/migrations/0003_partner_realtime.sql)) | **The session lives here.** A new artifact kind `session` holds shared state (mode, queue, current index, per-turn role, turn owner, scores). Both clients subscribe — same pattern as `LiveConvo`. Consider a dedicated `partner_session` table if the artifact JSON gets hot (many rapid writes); start with an artifact. |
| `@ll/core/speaking` dual-ASR gate | **Reused verbatim** for every spoken producer turn. |
| `@ll/core/familiarity` + `/scoring` diff | **Repointed** from a passive panel to the **session-queue source** (§4.2) and the per-turn role decision (§4.1). |
| `@ll/core/tutor` | The one-tap rescue in the §3.3 "try it for real" coda. |
| info-gap generator (v1) | Reused as one session **mode**, not a standalone tab. |
| shared-streak / phrasebook artifacts | Reused — streak on the session wrap, phrasebook as save-target. |

**Sync model:** the session is a small state machine mirrored to both phones via Realtime. The **turn owner**
mutates state (answer submitted / checked); the partner's client watches and takes over when the turn flips.
Soft per-turn timeout hands the turn back so one idle person never stalls the session. This is the same
authority pattern `LiveConvo` already implements — extend it, don't invent a new one.

---

## 8. What we cut or fold from v1

- **Three tabs → one screen** (§2).
- **Freeform "live conversation" as a headline** → demoted to the earned §3.3 coda.
- **Role-swap / info-gap / call-response** → *modes* of the one session, auto-selected, not destinations.
- **"Help each other" panel** → becomes the invisible **queue source**, not a thing you visit.
- **Phrasebook** → a save-target, not a tab.
- **Visibility toggles / Manage** → collapse into partner settings.
- **Multi-partner** → a quiet switcher; never shapes the main flow.

---

## 9. Phasing

1. **Live-synced session shell + call-and-response + quiz-each-other**, flipping micro-roles, shared-gap
   queue, one shared streak. This is the whole re-envisioned value in one screen.
2. **Info-gap + co-op clear** as additional modes on the same shell.
3. **Share-link pairing** + "you're both here" start + value-on-arrival first session.
4. **Async thread** for days apart, seeded from sessions.
5. **The §3.3 graduation coda** into scaffolded-then-open conversation.

---

## 10. Open questions / risks

- **Realtime write volume.** Rapid turn-by-turn writes to a `partner_artifact` JSON may argue for a dedicated
  `partner_session` table with a tighter row. Decide when we see the write pattern; artifact first.
- **Idle-partner UX.** Soft timeouts + "waiting for [partner]…" must feel graceful, never punishing — the most
  likely place clunk creeps back in.
- **Spoken vs tapped turns.** Speaking is the point, but two beginners self-conscious together may prefer tap
  early; offer both per turn and nudge toward speaking as the streak grows.
- **Content depth for modes.** Info-gap needs generated asymmetric pairs; day-one modes (call-response,
  quiz-each-other) need none — they run off existing vocab + the familiarity diff. Sequence accordingly.
- **When does "graduation" trigger?** Needs a concrete readiness threshold before building §3.3.
