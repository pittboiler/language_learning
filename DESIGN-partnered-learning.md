# Design Δ — Partnered Learning Layer

> **Increment over [DESIGN.md](DESIGN.md) + [DESIGN-comprehensible-input.md](DESIGN-comprehensible-input.md).
> Additive — not a re-architecture.** Adds two-person (dyad) collaborative learning for people who
> already know and trust each other (target case: a pair of siblings). **Status: design + module
> stubs only. No full features built yet** — stubs throw `not implemented` until you green-light.
>
> North star is unchanged: **holding a live conversation.** A trusted partner is the single best
> practice tool for that goal, and trust removes the matching friction that makes stranger-pairing
> apps (Tandem/HelloTalk) clumsy. So we **bias hard toward genuine collaboration over parallel
> accountability, optimize for the trusted dyad, and treat learner-to-learner conversation as the
> crown jewel.** Language-agnostic like everything else: partnered features operate on any pack.

This document answers the six deliverables in order: **§0** fit + dependencies · **§1** conflicts +
reconciliation · **§2** validated/revised feature triage · **§3** data-model delta · **§4** deployment
sequencing · **§5** implementation plan · **§6** module stubs created.

---

## 0. How this fits the existing architecture (no duplication)

Everything partnered is built by **reusing** subsystems that already exist and are deployed. The
increment adds **one new concept** — a link between two users — and a handful of engines that read the
state both users already produce.

| Existing piece | What it does today | How this increment uses it |
|---|---|---|
| `@ll/core/speaking` — dual-ASR gate + `composeFeedback` | per-turn spoken coaching, ASR-error-aware | **reused verbatim** for every recorded line of role-swap and every teach-back recording. The crown-jewel feature is "two people's spoken turns," and the spoken-turn primitive is done. |
| `@ll/core/scenario` — `Scenario.script: DialogueTurn[]` with `speaker: 'learner'\|'partner'` | solo role-play (you vs. the app) | **role-swap needs zero schema change** — it reinterprets the existing two speaker roles as *two humans* at runtime. The hardest content (2-role dialogues) already ships in the pack. |
| `@ll/core/familiarity` — `FamiliarityIndex`, `status`/`strength` projection of the FSRS card | per-user, per-pack vocabulary state | **the substrate for complementary SRS + teach-back.** "Two people forget different things" is literally a diff of two `FamiliarityIndex`es. No new vocab store. |
| `@ll/core/familiarity/scoring` — `scoreText`, `rankByIPlusOne`, `computeMetrics` | computed i+1 + progress metrics | powers **pace handicapping**: the shared daily story is scored *per partner* so each engages at their own level; `computeMetrics` is what a partner sees as "activity." |
| `@ll/core/tutor` — `respond()` (reply + gloss + correction + suggestions) | live conversation coach | the **discreet rescue/hint** in info-gap and (later) live scaffolded conversation. |
| `@ll/core/srs` — FSRS card inside `FamiliarityEntry` | spaced repetition | complementary SRS **routes** existing due items by partner strength; it does not fork the scheduler. |
| `pipeline/` — `generator` + `validator` (Opus offline, `confidence`-gated) | offline pack content, human spot-checked | **info-gap asymmetric pairs** are a new generator flow that reuses `generator` + `validator` — exactly how `import.ts` was added. No parallel critic. |
| `apps/web/lib/store.ts` — one `Progress` JSONB blob per user in `user_state` (Supabase/local) | per-user persistence, **own-row-only RLS** | **not modified.** Partnered state lives in *new* tables; the private blob gains only one optional pointer (`partnerships`). See §1.1 — preserving the private-blob invariant is the load-bearing call. |
| `apps/web/lib/recorder.ts` — `makeRecorder()` (webm/opus) + `/api/asr`, `/api/feedback` | record → transcribe → coach | the exact client path role-swap and teach-back recording reuse, unchanged. |
| Supabase **anonymous auth** + RLS pattern (`auth.uid() = user_id`) | zero-friction start | mirrored for partnership tables; but anonymity *conflicts* with durable linking — see §1.2. |

**Depends on (hard prerequisites):**
- **Prompts 1 & 3 complete** (they are): speaking pipeline, scenario engine, familiarity engine + scoring,
  mini-stories spine, SRS, the pack contract, and the Supabase store all exist and are deployed.
- **The familiarity engine being calibrated** (Prompt 3): complementary SRS and teach-back are only as
  trustworthy as the underlying `status`/`strength` — they inherit its known-good baseline for free.

**One-line fit:** the existing system already produces, per user, everything a partner needs to see
(familiarity state, activity metrics, spoken turns). This increment adds the **link** between two users
and the **engines that read across it** — it does not add a second source of truth for anything.

---

## 1. Conflicts with the existing design + proposed reconciliation

**These are proposals — nothing existing is overwritten in the stubs.** The reconciliations that touch
live persistence/auth are flagged ⚠ and await your go-ahead.

### 1.1 ⚠ The single-user persistence invariant (the load-bearing decision)
- **Today:** the *entire* system is one private JSONB blob per user (`user_state`), with RLS that says
  **"you can only ever read your own row."** This is the first time the product needs **one user to read
  another user's state** (complementary SRS, teach-back, activity visibility all require it). This is the
  partnered analogue of the CI layer's SRS-unification ⚠ — the one decision everything else rests on.
- **Rejected option:** widen `user_state` RLS so a partner can read your blob. This leaks *everything*
  (contexts, settings, raw familiarity), makes per-field privacy impossible, and couples two users' core
  state. No.
- **Reconciliation — the publish-projection model:** the raw blob **stays private and own-row-only,
  unchanged.** Each user writes an explicit, visibility-gated **projection** of their state to a
  partnership-scoped table (`partner_published_state`) that the partner *may* read. Privacy is enforced
  **twice**: at *publish time* (you only publish what your visibility settings permit) and at *read time*
  (RLS scopes the row to partnership members). The projection is deliberately thin — a learning-state
  vector (`lexKey → {status, strength}`) + activity metrics — never gloss, context, or settings. This is
  the surgical cross-user surface that powers every partnered read while preserving the private-blob
  invariant the whole app is built on. **This is the only structural change and the first thing to
  build + verify (plan §5.1).**

### 1.2 ⚠ Anonymous auth vs. durable linking
- **Today:** Supabase **anonymous** sessions deliver the zero-friction "start talking fast" edge
  (DESIGN.md §0/§7). An anonymous identity is tied to one device's storage.
- **Conflict:** a partnership is a *durable* two-account relationship. If an anonymous partner clears
  storage, their account — and half the partnership — evaporates.
- **Reconciliation:** make **"link with your sibling" one of the moments that prompts the email upgrade**
  DESIGN.md §7 already planned ("save progress" after the first success). The invite/consent flow assumes
  both sides can re-authenticate; nudging durability *at partnership creation* is the natural trigger.
  Invite codes themselves are durable (stored on the row), so the inviter can re-share if needed. No new
  auth system — just move the existing upgrade prompt to the partnering moment. **[ASSUMPTION]** acceptable
  to gently require (not hard-block) email upgrade before a partnership goes `active`.

### 1.3 Partnerships are pack-scoped (not global)
- **Today:** familiarity, progress, and the active pack are all per-pack; the app has one active pack.
- **Reconciliation:** a partnership is **scoped to one pack** (siblings learning Macedonian = a
  partnership on pack `mk`). Complementary SRS / shared story only make sense within one language. If the
  same pair later studies Bulgarian, that's a *separate* partnership row on pack `bg` — cheap, and it
  inherits every partnered feature for free (the engines are language-agnostic). No global "friends" graph.

### 1.4 No real-time infrastructure exists
- **Today:** `apps/web` is request/response on Vercel serverless — there is **no websocket/WebRTC
  primitive.** Every existing loop is "submit → process → respond."
- **Reconciliation:** **all Tier-1 async features fit the existing serverless model** (record → upload to
  Storage → process → partner fetches later). Only **live scaffolded conversation** needs new infra; it is
  the *sole* phase that adds genuine infra risk, which is exactly why it is deferred to last (§4 Phase 4).
  The async features must prove the collaboration model before we pay for real-time.

### 1.5 Shared streak vs. the existing solo streak
- **Today:** `Progress.streak = {count, lastDay}` is a solo, single-user counter.
- **Reconciliation:** the **shared** streak is a *computed* value over both partners' published activity
  (advances only when *both* were active; freezes grant grace without reset). It is **derived, not a second
  streak** — `@ll/core/partner.sharedStreak(a, b, …)` reads the two activity records; the solo streak is
  untouched. Decoupling shared mechanics from individual progress is the pace-handicapping principle in
  miniature.

### 1.6 Where the engines live (the boundary rule, restated)
- Partnered **logic** (invite/consent state machine, visibility resolution, shared-streak math, the
  cross-partner familiarity diff, role-swap/teach-back/info-gap orchestration) → `@ll/core/*`,
  language-agnostic, operating on user-ids + `lexKey`s + FSRS strengths. Zero language data.
- Partnered **state** (the new rows) → the app + Supabase, exactly like `user_state` today.
- Partnered **content** (asymmetric info-gap tasks) → the **pack**, generated offline. Role-swap content is
  *already* in the pack (scenarios). This keeps the core/pack/app split intact.

---

## 2. Validated / revised feature triage

I **largely affirm** your classification — it is well-reasoned and architecture-aligned. Four opinionated
changes, each justified against the codebase:

### Tier 1 — DIFFERENTIATING (keep + two changes)
- **Async voice role-swap** — ✅ **affirm as the flagship.** Cheapest path to the highest value: the 2-role
  dialogue content already ships, and the spoken-turn primitive (`makeRecorder` → `/api/asr` →
  `confidenceGate` → `composeFeedback`) is done. It rehearses the literal north-star goal. Build first
  among collaboration features.
- **Teach-back** + **Complementary SRS** — ✅ keep both Tier 1, but **REFRAME: they are one engine, two
  surfaces.** Both consume a single `complementaryDiff(myFamiliarity, partnerFamiliarity)` — the set of
  `lexKey`s one partner knows and the other is new/learning/lapsing on. *Complementary SRS* is the
  **review surface** of that diff ("your partner knows this — ask them"); *teach-back* is the **production
  surface** ("you're ahead here — record an explanation"). Build the diff **once** (`@ll/core/partner/
  familiarity-diff`); the two features are thin consumers. This is an implementation insight, not a tier
  move — but it materially de-risks both.
- **➕ NEW Tier 1 — "Shared story, individually leveled."** Your pace-handicapping section *calls for* "a
  daily co-experienced story or task pitched via the i+1 engine so each partner engages at their own
  level," but never lists it as a feature. It should be one, and it belongs in Tier 1: it is the **purest
  embodiment of decoupling the shared activity from individual progress**, it **manufactures conversation
  fuel** (both read the same story today → they have something real to talk about — the north star), and
  it is **nearly free** — the mini-stories spine *and* `scoreText`/`rankByIPlusOne` already exist. Same
  story to both partners; comprehension scoring, tap-to-capture, and Q&A difficulty adapt per partner.
- **Information-gap / jigsaw** — ✅ keep Tier 1 (genuine interdependence is uniquely valuable and
  free-ride-proof), but I'll be honest: it is the **lowest differentiation-per-effort of the Tier-1 set**
  — it needs *new* asymmetric content generation (pipeline lift) on top of everything else. That ratio,
  not its value, is why it sequences late (§4 Phase 3). Not demoted.
- **Live scaffolded conversation** — ✅ keep Tier 1 / crown jewel, **explicitly Phase 4.** §1.4: it is the
  only feature needing real-time infra. Async role-swap likely captures the majority of the value at a
  fraction of the cost; gate live conversation on the async features proving the model.

### Tier 2 — TABLE STAKES (keep, two sharpenings)
- **Guilt-free shared streak + freezes** — ✅ affirm. Build cheap; it's a *derived* value (§1.5), not new
  infra. The "freeze / pause without guilt" is load-bearing for a dyad whose paces diverge — keep it.
- **Partner activity visibility + warm nudges** — ✅ affirm, but **sharpen DOWN: do not build a messaging
  system.** Visibility piggybacks on the publish-projection (`computeMetrics` is already the activity
  signal). Nudges are **canned reactions** (a tap that posts a pre-written `partner_artifact` of
  `kind:'nudge'`) — no inbox, no threads, no real-time. Make it the *first consumer* of the cross-user
  read (lowest-stakes data) to de-risk the RLS in Phase 0.
- **Co-created phrasebook / shared deck** — ✅ keep the Tier-2 *effort* label, but **flag it as secretly
  load-bearing.** It is the cheapest genuine co-ownership *and* it has real pedagogical teeth: a phrase
  either partner adds can **seed BOTH partners' familiarity indices** via `familiarity.capture` (shared
  capture → dual SRS enrollment). It is the emotional on-ramp; ship it in Phase 1 alongside role-swap (as
  you proposed). Borderline Tier 1 for engagement, exactly as you said — the capture→familiarity hook is
  what earns it.

### Tier 3 — UNNECESSARY (affirm all skips, with a sharper reason)
- **Competitive leaderboards / head-to-head XP / rivalry** — ✅ skip, and note the *architectural* reason,
  not just "commodity": these would require the very cross-user **comparison** surface we are deliberately
  shaping as **cooperative** (complementary, "help each other") rather than **competitive**. Building them
  would re-introduce the pace-divergence wound the entire design fights. Skipping them is **protective**,
  not merely a non-investment.
- **Large-group / community / public ranking** — ✅ skip. The research favors the dyad; no group infra now.
- **Gamified currency / gifting economies** — ✅ skip. Unnecessary complexity for a trusted pair.

**Pace handicapping** (your connective principle) is treated as first-class throughout: the shared story is
per-partner leveled; teach-back *converts* a pace gap into the protégé-effect benefit; every shared
mechanic has a no-shame `pause`; info-gap and role-swap are interdependent (no free-riding); per-partner
**visibility controls** gate every cross-user read.

---

## 3. Data-model delta

Generalizable beyond two users **where cheap** (artifacts reference a `partnership_id`, not specific
users; the publish model is member-agnostic), but **optimized for the dyad** where it pays (two explicit
member slots → simple RLS + a two-way diff). Generalizing to N members later = swap the two columns for a
`partner_member` join table; the change stays localized.

### 3.1 New core types — `@ll/core/partner` (the partnership primitive; language-agnostic)
```ts
type PartnershipStatus = 'pending' | 'active' | 'paused' | 'ended'
Partnership {
  id; packId                         // pack-scoped (§1.3)
  members: [string, string?]         // dyad-optimized: [inviter, invitee?] — invitee null until claimed
  status: PartnershipStatus
  inviteCode?                        // short code the invitee redeems (durable on the row)
  createdAt; updatedAt
}
VisibilitySettings {                 // per-member; each member controls what the OTHER sees
  shareActivity; shareFamiliarity; shareStreak; allowTeachBack
}
// invite/consent as a pure state machine; the app persists the result:
invite(packId, inviterId, code, now) → Partnership            // status 'pending'
accept(p, inviteeId, now) → Partnership                       // pending → active (mutual consent)
pause(p) / resume(p) / end(p) → Partnership                   // no-shame exit
sharedStreak(a: ActivityRecord, b: ActivityRecord, today, prev?, freezes?) → { count; lastDay }
```

### 3.2 New core types — `@ll/core/partner/familiarity-diff` (the cross-partner substrate)
```ts
FamiliarityProjection {              // the PRIVACY-SAFE thing one partner publishes (§1.1)
  packId
  entries: Record<lexKey, { status: FamiliarityStatus; strength: number }>   // learning-state vector only
}
projectFamiliarity(index: FamiliarityIndex, packId) → FamiliarityProjection   // strip to {status,strength}
ComplementaryDiff {
  partnerCanHelpMe: ComplementaryItem[]   // partner known/strong, I'm new/learning/lapsed
  iCanHelpPartner:  ComplementaryItem[]   // the mirror — drives teach-back
}
complementaryDiff(mine: FamiliarityProjection, theirs: FamiliarityProjection, opts?) → ComplementaryDiff
```
**This is how complementary SRS reads cross-partner familiarity** (your deliverable-3 ask): each partner
publishes a `FamiliarityProjection`; `complementaryDiff` computes the two asymmetric help-sets; the review
router (`partner/complementary-srs`) and teach-back both consume it. No raw index ever crosses the boundary.

### 3.3 New core types — role-swap, teach-back, info-gap session artifacts (language-agnostic)
```ts
// roleswap — splits a 2-role Scenario across two humans
RoleSwapSession { id; scenarioId; packId; assignment: Record<userId,'learner'|'partner'>
                  turns: RoleSwapTurn[]; status: 'recording'|'complete' }
RoleSwapTurn    { index; speaker; recordedBy?; audioUrl?; transcripts?; feedback? }  // feedback = SpeakingFeedback

// teachback — the protégé-effect artifact
TeachBackArtifact { id; lexKey; teacher: userId; learner: userId
                    audioUrl?; transcript?; note?; status: 'requested'|'recorded'|'seen'; createdAt }

// infogap — a run of an asymmetric task by a specific pair
InfoGapSession  { id; taskId; packId; roles: Record<userId,'A'|'B'>; metCriteria; status: 'open'|'complete' }
```

### 3.4 New pack-schema types — info-gap content (added to the contract; additive)
```ts
InfoGapRole { role: 'A'|'B'; brief; briefGloss?; secretInfo: string[]      // facts only THIS partner holds
              targetPhrases: {text;gloss;translit?}[] }                     // scaffolding
InfoGapTask { id; title; goal; setting; roleA: InfoGapRole; roleB: InfoGapRole
              successCriteria: Criterion[]; confidence: Confidence }
// LanguagePack gains:  infoGapTasks?: InfoGapTask[]
```
Role-swap needs **no** pack-schema change (reuses `Scenario`). Phrasebook / teach-back / complementary-SRS
need **no** pack-schema change (they operate on familiarity `lexKey`s + user-generated content).

### 3.5 Storage delta (⚠ the changes to live persistence)
Mirrors the existing `user_state` RLS/grant pattern verbatim. **`user_state` itself is unchanged**; the
private blob gains one optional pointer.
```sql
-- 0002_partnered.sql  (PROPOSED — created + applied on go-ahead, NOT in this stub increment)

create table public.partnership (
  id uuid primary key default gen_random_uuid(),
  pack_id text not null,
  a_user_id uuid not null references auth.users(id) on delete cascade,   -- inviter
  b_user_id uuid          references auth.users(id) on delete cascade,   -- invitee (null until claimed)
  status text not null default 'pending',                                -- pending|active|paused|ended
  invite_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.partner_visibility (                                 -- each member writes only their own
  partnership_id uuid not null references public.partnership(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  primary key (partnership_id, user_id)
);

create table public.partner_published_state (                            -- the publish-projection (§1.1)
  partnership_id uuid not null references public.partnership(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id text not null,
  data jsonb not null default '{}'::jsonb,        -- { metrics, familiarityProjection?, activity }
  updated_at timestamptz not null default now(),
  primary key (partnership_id, user_id)
);

create table public.partner_artifact (                                   -- phrasebook|roleswap|teachback|infogap|nudge
  id uuid primary key default gen_random_uuid(),
  partnership_id uuid not null references public.partnership(id) on delete cascade,
  pack_id text not null,
  kind text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- membership predicate (security definer) so RLS can ask "is the caller in this partnership?"
create function public.is_partner_member(pid uuid) returns boolean
  language sql security definer stable as $$
    select exists (select 1 from public.partnership p
                   where p.id = pid and auth.uid() in (p.a_user_id, p.b_user_id)) $$;

alter table public.partnership            enable row level security;
alter table public.partner_visibility     enable row level security;
alter table public.partner_published_state enable row level security;
alter table public.partner_artifact       enable row level security;

-- partnership: members see/update their own row; redeeming an invite is via an RPC (security definer)
create policy "partnership members" on public.partnership for select using (auth.uid() in (a_user_id,b_user_id));
-- visibility + published_state: ANY member may READ; only the OWNER may WRITE (the surgical asymmetry)
create policy "vis read"  on public.partner_visibility      for select using (public.is_partner_member(partnership_id));
create policy "vis write" on public.partner_visibility      for all    using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "pub read"  on public.partner_published_state for select using (public.is_partner_member(partnership_id));
create policy "pub write" on public.partner_published_state for all    using (user_id = auth.uid()) with check (user_id = auth.uid());
-- artifacts: both members read AND write (truly shared)
create policy "artifact members" on public.partner_artifact for all
  using (public.is_partner_member(partnership_id)) with check (public.is_partner_member(partnership_id));

grant select, insert, update, delete on public.partnership, public.partner_visibility,
  public.partner_published_state, public.partner_artifact to anon, authenticated;
notify pgrst, 'reload schema';

-- private Storage bucket for role-swap + teach-back audio (policies scoped to partnership members)
insert into storage.buckets (id, name, public) values ('partner-media','partner-media',false)
  on conflict (id) do nothing;
```
**The one change to the `Progress` blob** (`apps/web/lib/store.ts`) is additive and tiny — far lighter than
the CI layer's SRS migration:
```ts
Progress {
  …existing…
  partnerships?: Record<string /*packId*/, string /*partnershipId*/>   // pointer only; all real state is in the new tables
}
```
**Scale note (flagged, not now):** the unified `partner_artifact` table splits into per-kind tables, and
the two member columns become a `partner_member` join table, only when volume or N>2 demands it — same
MVP-blob → scale-table discipline as the CI layer.

---

## 4. Deployment sequencing (refined)

I **affirm your phase order** — it is dependency-correct (primitive → async collab → familiarity collab →
interdependence → real-time) and ordered by differentiation-per-effort. Four refinements, justified:

- **Phase 0 — Partnership primitive + first cross-user read.** Linking (invite + mutual consent), per-member
  visibility/privacy, the guilt-free shared streak + freezes, **and** partner activity visibility + canned
  nudges. *Refinement:* pull activity-visibility **into Phase 0** (you had it implicit) so the publish-
  projection + cross-user RLS is exercised end-to-end on the **lowest-stakes data** (activity counts) before
  any familiarity data flows. This de-risks §1.1 — the riskiest thing — as early and cheaply as possible.
  Foundational; unblocks everything. Ship first.
- **Phase 1 — First real collaboration (MVP differentiator).** Async voice role-swap **+** co-created
  phrasebook **+ (added) shared-story-individually-leveled.** *Refinement:* add the shared story here — it
  is nearly free (mini-stories + familiarity already exist) and is the cleanest pace-handicapping mechanic.
  Role-swap is the flagship; phrasebook gives co-ownership and feeds familiarity. All three reuse only
  shipped subsystems.
- **Phase 2 — Familiarity-driven collaboration.** Teach-back **+** complementary SRS, built on the **single**
  `complementaryDiff` engine (§2 reframe). *Refinement:* this is where the publish-projection **extends** from
  activity-metrics (Phase 0) to the gated `FamiliarityProjection`. One engine, two surfaces — build the diff,
  then wire both consumers.
- **Phase 3 — Forced interdependence.** Information-gap / jigsaw. Needs the **new** asymmetric content flow
  (`pipeline/infogap.generateInfoGapPair`, reusing `generator` + `validator`) + the `InfoGapTask` pack type +
  the runtime session engine. Highest content lift → last among async features, as you had it.
- **Phase 4 (later / v2) — Live synchronous scaffolded conversation.** Real-time infra (websockets/WebRTC) —
  the **only** phase that adds infra (§1.4). Defer until the async features prove the dyad model. Stub the
  seam only; do not build now.

Dependency spine that makes this order forced: **publish-projection (Phase 0) → familiarity projection
(Phase 2) → asymmetric content (Phase 3)**; and **shipped speaking/scenario/familiarity → role-swap/story
(Phase 1)** with no new dependencies, which is why Phase 1 can be the first *visible* differentiator.

No conflict with DESIGN.md Phase 3 (Bulgarian): the partnered engines are language-agnostic, so a second
pack inherits every feature for free — partnerships are simply created per pack (§1.3).

---

## 5. Implementation plan (riskiest / most load-bearing first)

1. **⚠ Partnership primitive + cross-user persistence/RLS (riskiest — first-ever cross-user read).**
   Build `partnership` (invite/consent/pause state machine), `partner_visibility`, `partner_published_state`,
   the `is_partner_member` predicate + RLS, the invite-redeem RPC, and the app-side `PartnerStore`
   (publish / read-partner-projection / artifacts). **Acceptance:** two anonymous accounts link via an
   invite code; each reads only what the other *published* per visibility; revoking a visibility toggle
   immediately hides that data; `user_state` remains own-row-private (verify the raw blob never crosses).
   Privacy-correctness here is the worst failure mode — verify before anything else reads cross-partner data.
2. **Shared streak + activity visibility + nudges (first consumer; cheap; proves the spine).**
   `sharedStreak` over both published activity records; render partner weekly activity + canned-reaction
   nudges (`partner_artifact kind:'nudge'`). **Acceptance:** both partners' activity shows; the shared streak
   advances only when both meet the bar; a freeze grants grace without reset; a nudge tap posts + appears.
3. **Async voice role-swap (flagship differentiator).** `@ll/core/roleswap` over the existing
   `Scenario.script` two-speaker structure; reuse `makeRecorder` → `/api/asr` → `confidenceGate` →
   `composeFeedback`; store audio in `partner-media`; persist the session as a `partner_artifact`.
   **Acceptance:** a 2-role scenario splits across partners; each records their lines async; the app stitches
   a replayable conversation; both get per-line dual-ASR coaching.
4. **Co-created phrasebook + shared story.** Phrasebook entries are `partner_artifact`s; adding one optionally
   `capture()`s into **both** familiarity indices. Shared story = same `MiniStory` to both, with per-partner
   `scoreText` / `rankByIPlusOne` / Q&A difficulty. **Acceptance:** a phrase A adds appears for B and can
   enroll in both SRS queues; the daily shared story renders for both with individually-scored comprehension.
5. **Cross-partner familiarity projection + `complementaryDiff` (the Phase-2 substrate).** Extend `publish`
   to include the gated `FamiliarityProjection`; build `projectFamiliarity` + `complementaryDiff`.
   **Acceptance:** given two projections, the engine returns correct `partnerCanHelpMe` / `iCanHelpPartner`
   sets; nothing but `{status,strength}` leaves a user's boundary.
6. **Teach-back + complementary SRS (both read the diff).** Teach-back: prompt the ahead partner to record
   an explanation (`partner-media` audio) for a diff item → `TeachBackArtifact`. Complementary SRS: route the
   learner's due items that the partner knows well into review, tagged "your partner knows this."
   **Acceptance:** a pace gap produces a teach-back prompt for the ahead partner; a lapsed item the partner
   is strong on surfaces in review as a collaborative prompt.
7. **Info-gap tasks (highest content lift).** `pipeline/infogap.generateInfoGapPair` (reuse `generator` +
   `validator`) → validated `InfoGapTask` pack content; `@ll/core/infogap` session (each partner sees only
   their half; complete only when the gap is bridged); `core/tutor` for the discreet rescue hint.
   **Acceptance:** a generated, spot-checked info-gap pair runs; each partner sees only their brief +
   secret-info; success requires real target-language exchange.
8. **(Later) Live scaffolded conversation — real-time infra; out of scope for this increment.** Stub the seam.

**Risk-order rationale:** (1) is the load-bearing, privacy-critical, never-before-done cross-user read —
everything downstream depends on it and a privacy bug is catastrophic; (2) proves the spine on harmless
data; (3) is the flagship value on already-shipped primitives; (4) is cheap co-ownership + pace handicapping;
(5)–(6) are the familiarity-driven crown (one engine, two surfaces); (7) is the heaviest content lift; (8)
is deferred infra. **Stop after each for review** — same staged discipline as Prompts 1 & 3.

---

## 6. Module stubs created with this delta (interfaces only — `not implemented`)

New, clearly separated from the language-agnostic core's existing subsystems, and wired into the scaffold:

- `packages/core/src/partner/index.ts` + `README.md` — partnership primitive: invite/consent state machine,
  visibility, shared-streak math.
- `packages/core/src/partner/familiarity-diff.ts` — the cross-partner substrate (`FamiliarityProjection`,
  `projectFamiliarity`, `complementaryDiff`) shared by teach-back + complementary SRS.
- `packages/core/src/partner/complementary-srs.ts` — routes review through the diff (consumer; no new store).
- `packages/core/src/roleswap/index.ts` + `README.md` — async role-swap over `Scenario` + `core/speaking`.
- `packages/core/src/teachback/index.ts` + `README.md` — protégé-effect artifacts; reads the diff.
- `packages/core/src/infogap/index.ts` + `README.md` — asymmetric-task session over `InfoGapTask` + speaking/tutor.
- `packages/pack-schema/src/index.ts` — `InfoGapRole` / `InfoGapTask` types + `infoGapTasks?` on `LanguagePack` (additive).
- `pipeline/src/infogap.ts` — offline `generateInfoGapPair` (reuses `generator` + `validator`), mirroring `import.ts`.
- `apps/web/lib/partner-store.ts` — the app-side `PartnerStore` seam (Supabase/local), bodies throw until the 0002 migration.
- `packages/core/package.json` — adds the `./partner`, `./partner/*`, `./roleswap`, `./teachback`, `./infogap` exports.
- `packages/core/src/index.ts` — root re-exports for the new subsystems.

**Nothing in `core/speaking`, `core/scenario`, `core/familiarity`, `core/srs`, the existing store, the
Supabase migrations, or any pack *data* is modified.** The cross-user persistence/RLS (§1.1 / §3.5 / plan
§5.1) is the first thing to build **on your go-ahead.**
