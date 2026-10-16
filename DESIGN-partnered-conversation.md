# Design — **Guided conversation**, reviewed together at the end

> Status: **Phase 1 built (2026-10-16): engine, end review, API route, cue decks for chapters 1–3 (awaiting Jake's
> Macedonian review). No screens yet; Practice with AI (Phase 2) is next.** Extends
> [DESIGN-partnered-v2.md](DESIGN-partnered-v2.md) (the Together session) and reuses the speaking, exam and
> live-conversation engines. A solo version, "Practice with AI", lives in the Library.

## 1. The idea

> Jake: "a guided conversation. person 1 is instructed to ask a guided Q (instructed in english; person 1 has
> to say it in macedonian), person 2 responds ad hoc (in macedonian) and asks another guided Q, and so on …
> baking in live listening/grading/coaching (not just on pronunciation, but grammar/verbiage too)."
>
> And on how: "one master transcript that is pieced together from separate ongoing recordings from each side
> and analyzed at the end, with an engaging end review of items for correction (e.g., saying a corrected
> version of a sentence) together. that way, all the feedback/reviewing is at the end and users aren't split."

**Why it's worth building.** Every partnered activity today is *controlled* production: one right line,
someone checks it. Nothing makes a learner **understand a real question from a real person and answer in
their own words**. That's the step between drills and free conversation, and the English cue keeps it
scaffolded (v2 principle 3):

- The **ask** is guided: "Ask {partner} where they live" means producing the *function* from memory.
- The **answer** is free: listen, understand, say something true (or made up) in your own words.
- Cues cycle **every person** taught ("Ask whether {partner} and their friends are students" gives вие;
  "Tell them where you both live" gives ние). The lesson repeats, the exercise doesn't.

**Why feedback only at the end is the right call:**
- The conversation keeps flowing, and nobody reads a screen while the other talks.
- The whole transcript lets the coach judge each answer *against the question actually asked*.
- Per-turn coaching took 7–11 s; one end analysis is cheaper and better-informed.
- Studies comparing immediate and delayed correction find delayed works about as well, and it doesn't
  interrupt the talking.

## 2. Decisions (Jake, 2026-10-16)

| # | Decision |
|---|---|
| Setting | Partners are on **Zoom**: they hear each other there, and the app doesn't carry audio. **Both on their computers**: Zoom and the app (a browser tab) side by side. |
| Feedback | **All at the end**, in a review the two do **together**: only the one who made the mistake says the fix, and the other taps **"Got it" / "Not quite"**, as in the warm-up. |
| Timing | No feedback during the conversation. |
| Placement | In the partnered session, **after the story** (the finale before the recap). |
| Solo | Yes: **"Practice with AI"** in the Library, the app playing the partner. |
| Testing | They'll do the Phase 0 recordings "at some point". |

## 3. The partnered flow

### 3.1 Talk (~5 min, ~8 rounds)
Strict alternation. Each turn is **answer the last question, then ask the next one**: one tap per turn.

```
 Jake                                              Madison
 ───────────────────────────────                   ───────────────────────────────
 Turn 1 · You start.                               Jake starts — listen.
   Ask Madison where they live.
   [ I've asked → ]
                                                   Turn 2 · Answer Jake, then:
                                                     Ask Jake what work they do.
 Madison's turn — listen.                            (hint ▸ „Живеам во …“ on tap)
                                                     [ Done → ]
 Turn 3 · Answer Madison, then:
   Ask whether Madison's parents live there too.
 ...                                               ...
                                                   Last turn · Answer Jake.   [ Finish ]
```

- **Recording runs for the whole section** on each device (its owner's mic only). Each tap cuts that
  person's recording into a **segment**: one turn, one clip. The clip goes to transcription *in the
  background straight away*, so by the end almost everything is already transcribed.
- **Ordering needs no clock sync.** Turns strictly alternate and each segment carries its turn number, so
  the master transcript is just the segments from both phones sorted by turn.
- **Never stuck:**
  - the answer's sentence starter is one tap away;
  - "Skip this one" passes a cue you can't do;
  - a soft timeout nudges whoever's turn it is.
- **During the talk the screen shows only the cue** (or "listen"). No transcript and no feedback, so eyes
  stay on Zoom.

### 3.2 The master transcript
```
T1 Jake    [cue: ask where they live · ref „Каде живееш?“]        „Каде живеете?“
T2 Madison [answer T1 · then cue: ask what work they do · ref „Што работиш?“]
                                                                  „Јас живеам во Скопје. Што работиш?“
T3 Jake    [answer T2 · then cue: ask about parents · ref „Дали твоите родители живеат таму?“]  …
```
Each segment keeps both engines' text (Scribe and Google) and, on its owner's device only, the audio, for
"hear what you said" in the review. Audio is never uploaded or kept after the session.

### 3.3 Analysis (one call, at the end)
- **Who runs it:** whichever device finishes last, once every segment is transcribed. A deterministic
  owner (the session starter) runs it and the other phone waits; if the owner is offline for 20 s, the
  other phone takes over. Exactly one writer for the result.
- **Input:**
  - the master transcript, with the cue, reference(s) and accepted variants for every ask;
  - the question actually asked for every answer;
  - **what each partner has been taught** (words + points, by their own course position, the way
    `/api/explain` already gets it);
  - the register (ти between partners).
- **Output** (`ConversationReview`):
  - per turn: whether the ask did its job, whether the answer answered, and its corrections;
  - **review items**, ranked and split fairly between the two (~6–8 total, at most 4 each):
    `{ turn, speaker, said, better, why, kind: grammar | word | person | meaning | sound, drill }`.
    `drill` is the corrected line to say aloud, in taught language only.
  - **highlights**: 1–2 things each did well (specific: "you used сме for ние every time");
  - `unclear` turns: ASR unreliable, so they're left out of the items.
- **Rules for the coach:**
  - Never mark down content.
  - Never correct toward untaught structures.
  - Short natural answers ("Во Скопје.") are right.
  - Prefer one recurring pattern over three one-offs.
  - When the two engines disagree on a word, don't build an item on it.
- **Model:** Opus 5.5 (`MODELS.grade`, like the exam grader). End-of-session latency is fine behind a
  "putting your review together…" screen. Phase 0 compares Sonnet 4.6.

### 3.4 The review, together (synced, ~3 min)
Item by item, alternating whose item it is, on both screens at once:
1. **What was said:** „Каде живеете?“, with the cue it answered ("Ask Madison where they live"). Its
   owner can tap ▶ to hear their own clip.
2. **Better:** „Каде живееш?“, and **why**, in one line: "живеете is for вие; to a friend, живееш."
   🔊 to hear it (tap, never autoplay).
3. **Say it:** the owner says the corrected line aloud (over Zoom). The partner's screen shows the line and
   **✓ Got it / ↻ Not quite**, exactly like the warm-up. No speech recognition in the review: the partner is
   the judge. Solo, you say it, hear the model (🔊) and tap "Got it" yourself.
4. **Saved:** each corrected line goes into its owner's Flashcards › Sentences (★ to unsave).
5. **Opening and close:** the review opens with the **highlights** and closes with a one-line score
   ("7 turns, 5 asks spot on, 4 fixes said right"), then the joint recap.

**"That's not what I said"** on any item dismisses it: ASR misheard, and the item drops out (logged, to
improve the coach).

## 4. Practice with AI (solo, Library)

The same deck, with the app as the partner ("Ана"):
- **The AI's turns are scripted from the deck, not generated live.** Each cue carries a `sampleReply`, so
  the AI's turn is the reply to your question plus the next cue's reference question, played by TTS. No
  LLM wait mid-conversation, and every AI line is Jake-reviewed Macedonian.
- **Your turns:** you answer the AI's question in your own words and ask the cued questions; one tap per
  turn, same as partnered.
- **The end is the same:** master transcript → one analysis → the review (you say each corrected line).
- **In the Library:** "Practice with AI", one deck per chapter, unlocked up to where you are; replayable.
  Each run draws a different subset and order of the chapter's cues.
- **Built first** (Phase 2): I can exercise it in the browser myself, and Jake can feel the end review
  before the two-phone work.

## 5. Content: cue decks

```ts
interface GuidedCue {
  id: string;
  en: string;                 // "Ask {partner} where they live."  ({partner} → the partner's name; "Ана" solo)
  answer: string;             // reference ask: „Каде живееш?“
  also?: string[];            // accepted variants
  person: Person;             // the person the ask exercises
  replyFrame?: string;        // the answerer's starter: „Живеам во …“
  replyEn: string;            // what a reply is about, for the coach: "where they live"
  sampleReply: string;        // a natural answer: the AI's line in solo, a model in the review
  uses: { points: string[]; words: string[] };
}
interface CourseGuided { chapterId: string; scene: string; cues: GuidedCue[] }   // ~12 per chapter
```

- **A thread, not a bag:** name → where from → where you live → work → family, so it reads as one
  conversation.
- **Hand-written** for chapters 1–3 (`pack-mk/src/guided-cues.ts`, like the writing lines), then linted
  (pipeline `lint.ts`, kind `guided`): every line taught by the end of its chapter, every cue names
  `{partner}`, ids unique, every person but at most one. Then **Jake's Macedonian review**. Later chapters
  the same way.
- **Level-matched** (`cp.guidedFor`): the newest deck both partners have mostly reached (¾ of its cues
  usable), only the cues both have the words for, in order, at most 8, always keeping the goodbye. Early in
  a chapter, that means the previous chapter's deck, whole.

## 6. Sync design

New pure module `@ll/core/partner/guided` (reducer + tests, no language data):
- **Session row** (`guided`): cues, members (starter first), phase `talk | analysing | review | done`, and
  the analysis result. **Written by its single owner** at start and at analysis time.
- **One row per member** (`guided:<session>:<userId>`), written only by that member: their segments
  (`{ turn, cueId, startedAt, endedAt, transcripts?, skipped? }`) and their review progress
  (`{ itemId, said: "right" | "retry" | "dismissed" }`).
- **Everything shared is derived from the merge**, so no lost updates:
  - whose turn it is: the next turn number;
  - the master transcript;
  - the current review item: the first item not finished by both.
  This matters because `partner_artifact` is a whole-JSON upsert with no locking, and both phones write
  within seconds of each other.
- **Turn hand-off:** the tap writes the segment's metadata immediately, and Realtime shows the partner
  their turn in about a second. The transcript is patched into the same row when ASR returns.
- **Session placement:**
  - In core: `JOINT_SECTIONS` gains **`talk` after `story`**, plus a `hasContent` branch, a ref field and
    a `stepOf` change.
  - In the app: the label, agenda, `JointSessionView` branch and row creation in the start handler.
  - No migration (artifact `kind` is free text).

## 7. Recording on Zoom (the setup)

Both partners are on their computers, Zoom and the app side by side. macOS and Windows let the Zoom app and a
browser use the same mic, so each person's app records them while Zoom carries the call.
- **Headphones are recommended.** With speakers, the app's mic also picks up the partner through them.
  Turns are tap-delimited and the partner is silent during yours, so the damage is small, but headphones
  remove it.
- The app runs a **mic check** first ("say „Здраво“") and says clearly if the mic is busy or blocked.

## 8. Latency and cost

**Latency:**
- **Talk:** a turn hands off in about a second (no waiting on ASR).
- **Analysis:** about 15–30 s after the last turn, behind the "putting your review together" screen.
  Almost all transcription is already done by then.
- **Review:** instant; the partner judges each fix. (`/api/asr` now runs the two engines in parallel, for
  the transcription during the talk.)

**Cost** (rough):
- one Opus analysis, about 4k tokens in and 1.5k out: **~$0.05**;
- ASR for ~16 segments: pennies;
- total **~$0.10 per session**, so **~$2 a month** for the two of you. Cheaper than per-turn coaching.

## 9. Risks (honest)

1. **ASR fidelity on learner speech is still the big one.** If Scribe "repairs" an error ("ние сум" comes
   back as "ние сме"), the review misses it. If it garbles a correct line, the review invents one.
   - Mitigations: the full context, dual-engine agreement, "That's not what I said", and leaving `unclear`
     turns out.
   - **Phase 0 measures this.**
2. **Pronunciation is inferred, not measured.** We only get text back, so "sound" items come from words the
   engines missed. Coaching is honestly mostly grammar and word choice.
3. **The Zoom mic setup** (§7). The mic check and setup advice cover it; Phase 0 tries it for real.
4. **One person going quiet.** Mitigated by the soft timeout, "Skip this one", and the sentence starter.

## 10. Phases

| Phase | What | Exit |
|---|---|---|
| **0 · Spike** | ~20 recorded cue answers each with some **deliberate mistakes** (wrong person, wrong gender, missing word), plus TTS-made error clips; one recording while on Zoom with headphones and one without. Run both engines; run the analysis prompt on Opus vs Sonnet; compare with Jake's judgement. | Error-preservation rate known; ≥~85% agreement on clear cases; setup advice confirmed |
| **1 · Engine + decks** ✅ built | Parallel ASR; `@ll/core/partner/guided` (turns, member rows, transcript, review) + `@ll/core/coach` (one end-of-conversation review, Opus 5.5) with tests; `/api/guided-review`; `GuidedCue` schema; decks for ch1–3 in `pack-mk/src/guided-cues.ts` (hand-written, linted: taught words, {partner}, persons) → **Jake reviews**. A live test with planted mistakes caught all four, skipped the one the engines disagreed on, 16 s, $0.04. | Decks reviewed |
| **2 · Practice with AI** | The solo version in the Library: scripted AI turns by TTS, continuous recording, the end review. | Jake tries it; I verify it in the browser |
| **3 · Partnered** | Member rows + `talk` section after the story + shared review + recap/Flashcards hooks. | Jake + Madison's first Zoom session |
| **4 · Later** | Follow-up cues that react to the answer; recurring-error tracking across sessions; graduating to open conversation. | — |

## 11. Answered (2026-10-16)

1. **Devices:** both on computers, Zoom and the app side by side.
2. **The review:** only the one who made the mistake says the fix; the partner taps "Got it" / "Not quite".
