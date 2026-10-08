# Course overhaul: one spine, agenda → lesson → recap

Status: **APPROVED IN PRINCIPLE** (2026-10-08). Phases 0–6 built on branch `course-spine` (all 28 points signed off; the app plays the blueprint behind the `courseV2` switch, off by default). Phase 7 (cutover) done 2026-10-08: the new course is on by default, and both learners' progress was backed up and reset (Jake: fully fresh; Madison: 49 ★ saved items kept).

## 1. Why

An audit of the served Macedonian course found:

- **Three grammar orders that disagree:** the curriculum plan (`pipeline/output/curriculum-mk.json`), each chapter scenario's `requiredStructures` (the one the daily flow follows), and the order of `grammar.ts`.
- **Grammar used long before it's taught:** ли/дали first appears in ch 1 and is taught in ch 11. да + verb appears in ch 1 and is taught in ch 8. ќе appears in ch 4 and is taught in ch 11. The little pronouns (ми, му, се) are never taught.
- **Three lessons never reach Today** (-е verbs, little pronouns, aspect), because no chapter lists them.
- **Topic-tag word dumps:** 39 words in ch 3, 15 prepositions in ch 7, 12 verbs from all three groups in ch 5. A chapter has about 12 word slots but up to 39 words.
- **Day-to-day pacing isn't tied to the chapter:** the review day falls on every 4th session overall, so it can land on day 1 of a new chapter.

## 2. Principles

1. **One spine.** An ordered list of small grammar *points*, each owned by one chapter. Everything else derives from it: the chapter grammar, Today's grammar step, Build-a-sentence, the conjugation drill, the word budget, story lenses, the agenda and the recap.
2. **Explain at three depths.** The *agenda* names what's coming (one line per item). The *lesson* teaches it (a short rule and a pattern). The *recap* consolidates it using today's real lines. The *Library* holds the full detail. A day is never a textbook.
3. **Set phrases first, explanation later, with an explicit callback.** When a point is taught, it points back to the set phrases you already say ("You've said *Можете ли да повторите?* since chapter 1. Here's what ли and да are doing.").
4. **No new Macedonian, no new audio.** New material is English explanation text only. Every Macedonian example must already exist in the pack, and a lint check enforces this.
5. **Reuse goes backward.** Stories come back with a lens, but only stories whose words you already know.

## 3. The spine

The order was cross-checked against Kramer & Mitkovska, *Macedonian: A Course for Beginning and Intermediate Students* (UW Press, 3rd ed.):
- questions in L2
- plurals and adjectives in L3
- "the" and object pronouns in L4
- да constructions in L5
- future, се and aspect in L6
- comparatives and commands in L7, alongside directions
- past (aorist) in L8–9
- the "have done" past in L12

The ли/дали placement rules are confirmed by Stevkovska & Klemenchich (IJEP, 2021).

"Recognize" means the point is explained in the agenda, recap and Library but never drilled for production.

| Ch | Theme | Points (in teaching order) | Built from existing grammar concept |
|---|---|---|---|
| 1 | Repair kit | question words · **yes/no with ли or дали** (сум takes дали) · **не** before the verb | questions (split) · negation |
| 2 | Greetings | **сум** + pronouns · **ти vs вие** | to-be · *new text* (the curriculum's `register-ti-vie`) |
| 3 | Survival | **three genders** (еден/една/едно) · **numbers** (два/две, counted nouns) | gender · numbers |
| 4 | Café | **-а verbs** · **"the" on the end** · **да after сакам / може** (Може ли да платам?) | verb-conjugation · definite-articles · da-modals |
| 5 | Introductions | **-е and -и verbs** · **се verbs** (се викам) | verb-conjugation-e + -i · clitics (split) |
| 6 | Market | **plurals** · **adjectives match** · **го / ја / ги** ("ќе ги земам") | noun-plurals · adjective-agreement · clitics (split) |
| 7 | Directions | **prepositions** · **commands** · **по- / нај-** | prepositions · imperatives · comparatives |
| 8 | Small talk | **ми / ти / му** + ми се допаѓа · **future: ќе / нема да** | clitics (split) · future-tense · negation (нема да) |
| 9 | Your day | **past tense** of common verbs · *aspect (recognize)* | past-tense · verb-aspect |
| 10 | Family | **мој… / мајка ми** · *irregular plurals (recognize)* | possessives · noun-plurals |
| 11 | Arranging | **telling time** (во … часот) · **ајде да** (да callback) | *new text* · da-modals |
| 12 | Problems | **има / нема** (there is / isn't) · *"have done" past (recognize)* | negation · perfect-tense |

That makes 28 points in total, two or three per chapter.

**Dropped:** би сакал (the polite "I would like"). No existing line uses it, so teaching it would require new Macedonian.

**Retitle ch 9** to "Your day: what happened", because the future moves to ch 8. Its ќе lines then become a callback.

### What a point contains (new pack data, `pack.points`)

- `id`, `chapterId`, `order`, and `grammarId` (the concept it draws from, so the existing pattern tables and drills are reused)
- `agenda`: one line, about 12 words ("Ask a yes/no question: ли after the verb, or дали up front")
- `rule`: two or three sentences for the in-lesson card
- `recap`: a fuller paragraph, filled at runtime with lines you met today
- `library`:
  - the full rule
  - **"Why it's like this"** notes (for example: ли vs дали; why сум can't start a sentence or take ли; да "yes" vs да "to"; why "you" and "he/she" look the same in the past)
  - common mistakes
- `examples`: references to *existing* lines (story, scenario or grammar example). These are never new strings.
- `callbacks`: set phrases from earlier chapters that this point explains
- `cards`: grammar-flashcard specs (§6)

The English text is authored in one Opus pass, then reviewed by me, then spot-checked by you. Estimated cost is a few dollars. No TTS is needed.

### Lints, run in the pipeline

- Every Macedonian string in `points` already exists in the pack.
- Every chapter has two or three points, and the points are in spine order.
- Any chapter line that uses a point from a *later* chapter has a set-phrase breakdown note, so it's flagged and not left unexplained.
- `curriculum-mk.json` grammar points and `requiredStructures` are regenerated from the spine, so the three sources can't drift apart again.

## 4. Chapter cadence: six to eight sessions, about a week

The chapter shape is counted in **sessions**, not calendar days, so a skipped day costs nothing. Each session is still about 15–20 minutes. The **baseline is six sessions**, shown below. Heavier chapters get one or two extra sessions (see "Chapter lengths").

| Session | Role | New grammar | New words | Story | Production |
|---|---|---|---|---|---|
| 1 | **Teach** | point A | 3 | home story, first read (lens on A) | build |
| 2 | **Teach** | point B | 3 | home story again (lens on B) | build |
| 3 | **Mid-chapter review** | none | 0 | an *earlier* chapter's story, with today's points lit up | build + conversation (first attempt) |
| 4 | **Teach / use** | point C (or none for a two-point chapter) | 3 | home story (lens on C, or on all points) | conversation |
| 5 | **Use it** | none | 0–3 (whatever required words remain) | backward reuse | conversation + short writing |
| 6 | **Checkpoint** | none | 0 | none | recall of the chapter's words + grammar cards, then a conversation re-run |

**Reinforcement within the chapter:**
- **Warm-up** every session: 8 due cards, 14 on review days. Grammar cards are mixed in.
- The **home story is read three times** (sessions 1, 2 and 4), each time with a different lens.
- **Earlier stories return** on sessions 3 and 5.
- Today's words reappear **in the same session** (story, then build), and then by spaced repetition.
- The **recap** closes every session.

**Chapter lengths (provisional; the blueprint in §11 Phase 0 sets the final numbers):**

The rule: every point gets a teach session. A *heavy* point (a new verb system, the little pronouns, the past) also gets a practice session: no new point, and the same point in a reuse story plus build. A chapter with three points adds a session.

| Ch | Sessions | Why |
|---|---|---|
| 1 Repair kit | 7 | 3 points, but light (they explain set phrases you already use) |
| 2 Greetings | 6 | |
| 3 Survival | 6 | |
| 4 Café | **8** | 3 points, including -а verbs and да |
| 5 Introductions | 7 | -е / -и verbs are heavy |
| 6 Market | 7 | 3 points |
| 7 Directions | 7 | 3 points |
| 8 Small talk | **8** | little pronouns and the future are both heavy |
| 9 Your day | **8** | the past tense is heavy |
| 10–12 | 6 each | |
| Stage reviews | 3 (one each after ch 3, 7 and 12) | §4a |

That adds up to about 85 sessions, roughly 17 weeks at 5 sessions a week.

**Word budget:** about 12–15 new words per chapter. Each chapter's list is trimmed to the words its points and its conversation actually use. The rest (for example ch 3's 16 adverbs) stays in Library → Words ("＋Learn"), or moves to the chapter whose point uses it.

**Checkpoint:**
- **Pass** (70% or more on recall, and the conversation's goals met): you get the chapter recap, a summary of all its points and words, and the next chapter opens.
- **Fail:** a targeted review session built from the misses, then a retry. Nothing is lost.

**Replaces:**
- the overall every-4th-session review day (`REVIEW_DAY_EVERY`)
- `UNIT_MIN_DAYS` (the story-days counter)

The new shape lives in `lib/daily.ts` as one pure, tested function: (chapter, session index, progress) → the session's roles.

> Note: this brings back fixed day roles, which you turned down in the pacing round of 2026-10-06. Back then the roles were global; here they're scoped to the chapter, with review days at fixed points inside it.

## 4a. Recall from earlier chapters (built into every session)

Earlier chapters keep coming back without you having to go looking for them:

1. **Warm-up spans the whole course.** It already pulls due cards from every chapter. New rule: at least 2 of the 8 cards (4 of 14 on review days) come from **earlier chapters**, weakest first. Otherwise a busy chapter's new cards can crowd older material out.
2. **Grammar cards stay in reviews** for every point once it's taught. Chapter 1's ли card keeps coming back on its own schedule.
3. **Backward story reuse** (sessions 3 and 5) brings earlier stories back with today's lens, so you reread old material in a new light.
4. **Production recycles earlier work.** The blueprint gives every session at least one Build-a-sentence item that uses an *earlier* point. Conversations already recycle earlier chapters (the curriculum's `recycles`).
5. **Callbacks** in the agenda and recap tie the new point to what you already know ("the same да as…").
6. **Stage reviews** after chapters 3, 7 and 12. One review session covers everything up to that point (words and grammar cards from every chapter so far, plus one earlier conversation per chapter), then a recap of the whole stage. Missed items are fed back into the next sessions' warm-ups.

## 5. The daily session

```
Agenda      "Today: ① ask yes/no questions — ли or дали  ② 3 new words  ③ spot them in Ana's story, then use them with the waiter"
            (each item taps through to its Library page; ~10 seconds)
Warm-up     due cards (words + grammar)
New words   3 at most
Lesson      the point's short rule + pattern table + matching game (existing GrammarExplainer, trimmed)
Story       today's lens: lines with the point are highlighted, plus "spot it" prompts
Build / Speak
Recap       ↓
```

**Recap**, more detailed than the agenda:
1. **What you learned:** each point's recap paragraph, illustrated with *the lines you actually read or said today*, and a callback ("the same да as *Можете ли да повторите?*").
2. **Every word from today:** the words taught today, plus any word you tapped or saved. Each has ☆ to save it to your Starred deck, and there's a **★ Save all** button. Taught words are already scheduled for review either way; saving puts them in your own deck for focused drilling.
3. **Grammar cards from today**, also with ☆ / Save all (§6).
4. **Slipped on:** the existing missed-items review, folded in here and no longer a separate screen.
5. **Next time:** one line ("Next: the same story, this time with да").

## 6. Grammar flashcards (deliberately simple)

Each point produces two kinds of card, and every card fits on one screen:

- **Rule card.** Front: a plain question ("Where does ли go in a yes/no question?"). Back: the one-line answer and one existing example with audio.
- **Blank card** (two or three per point). Front: an existing line with *one* blank where the point lives ("Имате ___ вода?"). You answer by tapping one of three choices, never by typing a full sentence. Back: the answer and the one-line reason.

They live in the same spaced-repetition system as words (key `grammar:<pointId>:<n>`), show up in the warm-up once the point has been taught, and get a **Grammar** filter in Flashcards next to Words and Sentences. The existing multiple-choice drills stay inside the lesson.

## 7. Library: one page per point

**Library → Grammar** is reorganized by chapter, then by point. Each page holds:
- the full rule and the "why it's like this" notes
- common mistakes
- every example from stories you've read
- the set phrases it explains
- its cards (☆)

Points you've learned are marked; upcoming points are greyed out but still readable. The page replaces the current per-concept reference (concepts stay as the underlying data).

## 8. Story reuse with a lens

- A one-time tagging pass (offline; one LLM pass, then lint and review) maps every story line to the points it uses.
- The **home story** is shown with today's point highlighted on sessions 1, 2 and 4.
- **Reuse sessions** (3 and 5) pick an earlier chapter's story with the most lines using the current chapter's points. This replaces the current rotation pick for rereads.
- **Backward only:** a story is reusable once its own chapter is done.
- A reread never advances the chapter (the same rule as today's revisit).

## 9. Align the other parts

- **Conjugation warm-up:** drills only verb groups whose point has been taught. For example, no -е/-и verbs before ch 5.
- **Build-a-sentence:** sentence scope is gated by points as well as words. A sentence using да isn't offered before ch 4. The tier ladder stays.
- **Word trickle:** draws from the chapter's trimmed list and the Library's leftover words.
- **Today's grammar step:** reads the spine. The fallback to "the next unseen concept in `grammar.ts` order" is removed.

## 10. Fresh start (at cutover)

For **both** partner accounts:
1. Back up each profile's progress row to a dated file.
2. Reset:
   - **Keep:** familiarity entries tagged ★ starred (with their review state), their example sentences (`contexts` / `contextGlosses`), settings, and the partner pairing.
   - **Clear:** all other familiarity entries, chapters and checkpoints, seenGrammar, storyReads/seenStories, scenarios, sessions, built and seen conjugations, the streak, and the last session day.
3. Deploy the new flow, so both of you open on chapter 1, session 1.

This writes to the live Supabase database, so it gets its own confirmation before it runs.

## 11. Build order: content first

**Phase 0, the course blueprint**, comes before any engine work. It is a reviewable, session-by-session lesson plan for every chapter, saved as data (`pack-mk/src/course.ts`). The engine then *plays* the blueprint instead of working out each day at runtime. That makes every lesson predictable and reviewable. The runtime still adapts in a few places: the warm-up content comes from spaced repetition, words you already know are skipped, and a failed checkpoint brings a targeted review.

For each chapter, the blueprint contains:
- **its points:** the full `Point` records from §3 (agenda, rule, recap, Library text, cards, callbacks)
- **its word list:** trimmed to about 12–15 words and assigned to the session that teaches each word
- **a session-by-session plan:** role; the point taught; the 3 words; which story and which lines are highlighted; the backward-reuse story (sessions 3 and 5); Build-a-sentence items, including at least one from an earlier point; when the conversation becomes available; agenda bullets; recap "next time"
- **the checkpoint contents**, plus the stage-review contents after chapters 3, 7 and 12
- **set-phrase notes** for any line that uses a later point

How Phase 0 runs:
1. A pipeline script (`run-course.ts`) drafts the blueprint with Opus from the existing pack. It uses the same no-new-Macedonian rule and the §3 lints.
2. I review the draft and fix it.
3. It's rendered as a readable review doc, one page per chapter.
4. **You sign off in three batches:** chapters 1–3, then 4–7, then 8–12. Feedback from the first batch shapes the next two.

| # | Phase | Main pieces |
|---|---|---|
| 0 | **Course blueprint** | `Point` + session-plan types, `run-course.ts`, lints, review docs, sign-off in 3 batches |
| 1 | Engine plays the blueprint | Today reads `course.ts`; chapter cadence in `lib/daily.ts` (tests); regenerated `requiredStructures`; earlier-chapter warm-up quota; stage reviews |
| 2 | Agenda + recap | agenda card; recap with words ☆ / Save all, points, cards and missed items |
| 3 | Grammar flashcards | rule and blank cards in spaced repetition, warm-up mix, Flashcards "Grammar" filter |
| 4 | Library point pages | grouped by chapter, learned vs upcoming |
| 5 | Story lenses (UI) | highlights and "spot it" prompts (the line tags already come from Phase 0) |
| 6 | Align drills | conjugation drill and Build-a-sentence gated by points |
| 7 | Cutover | backup, reset (with confirmation), deploy |

Phases 1–6 land behind one switch, so the live app stays on the current course until the cutover.

**Verification:**
- each phase: `tsc` and all core suites pass, and the pipeline lints are clean
- daily-plan logic is unit-tested headlessly (localhost uses the Supabase store, so seeded local profiles are ignored)
- the agenda, recap and Library pages are checked in the browser preview with a test account

## 11a. Revision after first use (2026-10-08)

Jake's first session prompted three changes:

- **Chapter 0: Letters & sounds.** The alphabet is now a chapter inside the course, not a gate in front of it. It's a "script" chapter (no words, stories or conversations; `Chapter.kind = "script"`, order 0, so the curriculum keeps chapters 1–12). Five sessions teach the letters in groups that build on each other:
  1. Like English: А Е К М О Т
  2. Look-alikes that fool you: В Н Р С У Х
  3. New shapes: Б Г Д З И Л П
  4. New shapes, part 2: Ф Ж Ц Ч Ш, plus the stress rule
  5. Special to Macedonian: Ѓ Ѕ Ј Љ Њ Ќ Џ

  Each session has a learn grid, a quiz until every letter is right, "Say it" with the example words, and a recap. The checkpoint quizzes the 13 tricky letters.
- **Foundations first.** Chapter 1 now teaches сум + pronouns, then не. Chapter 2 teaches question words, ти/вие, then ли/дали. The repair phrases stay set phrases (with notes) until their grammar comes up, and the later points now point back to them ("You've been saying Можете ли да повторите? since chapter 1").
- **"Say it" in every teach and practice session.** Two of today's new words plus two of the point's example lines, said out loud with the usual speech feedback. Before this, sessions 1–3 of a chapter had no speaking; the full conversation still waits for the review session.
- **Re-placing learners.** `Course.version` hashes the structure (chapters, session roles, points, letter groups), so wording changes don't count. A saved position made on another structure re-places the learner at the start, keeping their words, grammar seen and ★ cards.

## 12. Partnered sessions (built 2026-10-08)

The joint session takes the same agenda → lesson → recap shape, planned over where **both** partners are:

- **Published position:** each partner publishes their chapter, session and taught points alongside their familiarity. It's gated by "share activity".
- **Planner:** `@ll/core/partner/joint` (pure, tested). It finds the overlap: the latest grammar point both have been taught, the furthest chapter both have reached, the story (in reached chapters) with the most lines using that point, and the latest conversation both have unlocked.
  - Being ahead never pushes your material onto your partner. The drill stays both-studied-only, as before.
  - The **framing** says who's ahead and by how many points, and what that means for roles: the further-along partner mostly checks. A partner who didn't practise this window gets a lighter plan.
  - **"Next together"** names the next point you'll share and who it's waiting on ("after Madison has done chapter 3, session 2").
- **Agenda:**
  1. Warm up together (the live drill)
  2. Grammar together (an inline card: rule, examples, blank cards taken in turns)
  3. Read together (with the story lens: the lines that use the point are flagged as you reach them)
  4. Speak together (goes straight into the planned conversation)

  Coming back from an activity ticks it off in a shared per-day record, so both devices show the same ✓s.
- **Recap:** what you practised (the point's recap + today's story lines), every word from today's drill with who said it and how it went (☆ / ★ Save all), and next together.
- The old cadence plan (`buildPartnerSession`) remains for anyone on the old course.
