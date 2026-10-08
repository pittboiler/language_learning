# Plan: every screen follows the course, and the story step teaches

Status: **built** (2026-10-08). PR #30 (phase 1), #31 (phase 2), #32 (phase 3, the story step), #33 (phase 4). See "Decisions (Jake, 2026-10-08)" at the end; where it differs from the phases below, the decisions win.

Built differently from the phases below:
- Phase 3: no story gate (D1). Highlighting is word by word from `course.lineFocus`; notes show with a line's English (D2).
- Phase 2: the Library's chapter headings were moved to PR 4.
- Phase 1: grammar tables show every example with its English; untaught examples are not hidden.

Inputs:
- the curriculum audit (2026-10-08): a session-by-session walk of all 87 lessons (chapters 1–12), plus a check of every other screen;
- Jake's notes from testing: the "Set phrase for now" banners, the "Reveal answer" questions, where the recaps live, and a curriculum drop-down in Progress.

## The one rule

The course blueprint and your place in it (`progress.course`) are the only source of truth for **where you are** and **what you've been taught**.

Today already works this way. Progress, the Library, Flashcards, Build-a-sentence, the grammar chips, the verb drill and the partner pickers still use the older chapter model, which is why they disagree with Today.

We'll write one helper, used by every screen. It answers three questions:
- Where am I? (chapter, session)
- Has the course taught this word or point yet? (the session that teaches it is before mine)
- What's in each chapter? (sessions, points, words)

**Nobody's place in the course moves.** None of this changes the course structure, so the `Course.version` hash stays the same. Each PR will check that.

---

## Phase 1: a check that catches mismatches before you see them

*Mostly invisible, but it's what makes everything after it safe.*

**Session-by-session lint (`pipeline/run-lint`).** The lint becomes a permanent version of the audit script. For every session it looks at every line the learner sees:
- the lesson's examples, quick checks and grammar table;
- the "Say it" lines;
- the story and its activities;
- Build-a-sentence;
- the conversation.

It flags any line that uses:
- a grammar point taught in a **later session**. Today's lint only catches points from a later *chapter*, which is how the ch7 story asks for "Свртете лево" one session before commands are taught.
- a word taught later. It will recognise inflected forms (it knows разбира is the same word as разбирам) and ignore names (Ана, Марко, Скопје).

**Fix what it finds in the lessons.** The audit found 37 places where a lesson's examples or quick checks use later grammar, plus about 40 lessons that quote untaught words. Each example or card gets swapped for an existing line that only uses what's been taught (no new Macedonian), reviewed the usual way (export → edit → import). Examples:
- The first сум quick check, "Како ___ Марко?", needs question words (chapter 2). Swap it for a сум line with nothing new.
- The да examples use -е verbs from chapter 5. Use -а verbs.
- The го/ја/ги examples quote "го испи кафето" (past tense, chapter 9). Use a present-tense line.

**Grammar tables:** a table row's example only shows if its words have been taught, and every example gets its English.

**Agenda gaps:**
- add "Build: N sentences from today" (Build-a-sentence currently runs in 72 sessions without ever appearing on the agenda);
- "Practice day: more of this chapter's patterns" names the actual point;
- ch1 s5 says "First try at the conversation", but s4 already had it;
- the reading bullet matches whatever Phase 3 decides.

**Done when:** the lint reports 0 issues, the course-player tests pass, and the course version is unchanged.

---

## Phase 2: Progress becomes the curriculum, and your lessons are kept (Jake's items 3 and 4)

**The course map is rebuilt from the course.** Every chapter becomes a drop-down, with the current chapter open:

```
▾ Chapter 1 · Repair kit                      session 3 of 8
  Grammar:  ✓ сум (am/is/are) ›   ✓ не (not) ›          ← opens the Library page
  ✓ 1  New: сум · јас, ти, Извинете                     ← tap: your notes from that lesson
  ✓ 2  New: не · Не разбирам, Не знам, Можете ли…
  ▶ 3  Practice: не · Побавно…, Уште еднаш…, Како се вели…   (today)
    4  Practice · тој, таа, ние · conversation
    5  Review day · first try at the conversation
    6  Put it together · Што значи…?, Сѐ уште учам, Во ред
    7  Put it together · write a few lines
    8  Checkpoint
  Words: 6 of 16 learned ›
▸ Chapter 2 · Greetings                       upcoming
  …
▸ Stage review (after chapter 3)
```

- The header line reads like Today: "Chapter 1 · session 3 of 8", "2 of 87 sessions done". The "know 70% of the words" rule goes away.
- **"To review"** counts the same cards as Flashcards, grammar cards included.
- **Checkpoint-passed message:** names what really comes next (a stage review, the next chapter's title, or the end of the course).
- The old map stays only for anyone who switches the new course off in Settings.

**Lesson notes (the recaps you can come back to).** Today the end-of-lesson recap disappears once you leave it. What you saw under Reference → Grammar → Chapter 1 are the two **grammar pages** for the points you've done (сум, не). They're reference pages, not your lesson recaps.

- Each finished session saves a small record: which session, when, the words you tapped, and what you missed. It's a small addition to your saved progress, and nothing else in it changes.
- The recap is rebuilt from that record plus the course. It's the same screen you saw at the end of the lesson: the rule restated with that day's lines, the words with ▶ and ☆, the grammar cards, what you missed, and what's next.
- **Where to find them:**
  - tap a ✓ session in Progress;
  - **Library → Reference → "My notes"**: every lesson by date, plus **"Chapter at a glance"** for each chapter (each point's rule in a few lines, two example lines, every word with audio). This is the quick-refresh page.
- Each grammar page in the Library gets a link to the lesson that taught it, and each recap links to the grammar page.
- Lessons finished before this ships still get notes, rebuilt from the course, just without a date or missed items.

**Done when:** the map and Today agree for every position (tested headlessly from ch0 to the end of the course, and against your real progress, read-only). Checked in the browser with screenshots.

---

## Phase 3: the story step (Jake's items 1 and 2, plus the audit's story findings)

### 3a. Read the story once you can actually read it

Today each chapter reads its own story from session 1. On ch1 s1 you know about 6% of "Ана учи македонски", and you read it in all seven sessions of chapter 1.

- **A chapter's story first appears at the first session where:**
  - about 60% or more of its words have been taught (counting inflected forms; we'll tune this number on real data);
  - every grammar point from this chapter that its lines use has been taught.

  Grammar from later chapters stays as phrases you learn whole.
- **Before that: "Today's lines."** Two to four lines that use today's point and mostly taught words. They come from the upcoming story, the conversation or the lesson's examples, with audio and English. For ch1 s1 that means "Јас сум Ана", "Ана е во Скопје", "Ние сме тука". When the full story arrives later: "You've already met 3 of these lines."
- **Rereads:** at most three per chapter, each with a different job (first read; reread to spot the point; listen-and-shadow).
- **Lessons whose point isn't in the story** (4 today, e.g. ch6 s3 го/ја/ги): use lines or an earlier story that contain the point.

### 3b. "Set phrase for now" leaves the story

These notes are capped at three per session, so some lines get a banner and others don't. That's the inconsistency you noticed. Instead:

1. **On the phrase card when the phrase is taught.** In New words and on the flashcard back: "Learn this as a whole phrase. ли and да are explained in chapters 2 and 4." That's where you're actually learning it.
2. **On every story line, the same way.** Tapping a line's English shows its translation, and, for any line using later grammar, one short "why" line. Same treatment for every line, no banners.
3. **The payoff when the point is taught:** the lesson shows "You've been saying 'Можете ли да повторите?' since chapter 1. Here's why." (The recap and the Library already do this; the lesson will too.)

### 3c. "Reveal answer" becomes "Use it": short exercises on today's lesson

After reading, about four quick items built from today's lines. Every item practises **today's point**: the point that was taught or practised, or this chapter's points on review and put-it-together days. The items get harder as you go:

| # | Type | Example (ch1 s1, сум) |
|---|---|---|
| 1 | **Understand**: pick the right meaning, in English until the Macedonian question is readable | "Where is Ana?" → *in Skopje* |
| 2 | **Complete the line**: today's form blanked, tap one of 3 | Јас ___ Ана → сум / си / е |
| 3 | **Build the line**: put the tiles in order | [сум] [Ана] [Јас] → Јас сум Ана |
| 4 | **Say it**: aloud, with speech feedback (skippable if you can't talk right now) | "Ние сме тука" |

Why this order: understanding first, then picking the form, then building the sentence, then saying it. Each step asks you to produce a bit more. Retrieving or producing an answer sticks far better than tapping "reveal".

- **Content:** the blanks and their wrong options are prepared ahead of time by a new pipeline step and held to the same checks as grammar cards: the blank is in the line, the options exist in the pack, everything has been taught by that session. They also get the same sign-off. Build and Say it need no new content.
- **The current story questions** stay as material for "Understand" and "Say it" once their words have been taught. Some, like "Како се вели дека сакаш мажот да зборува пополека?" in chapter 1, simply won't be used early.
- **Misses** go into your reviews and onto the recap, like the grammar cards.
- **The Library's story view** gets the same exercises, without the focus on a single point.

### 3d. Grammar chips and "Have a question?" on stories and conversations

Today they use each conversation's old grammar list, so chapter 5 offers "Why possessives?" (taught in chapter 10). Instead:
- the chips show only the points the visible lines use **and** that you've been taught;
- the question helper is told what you've been taught, so it can say "that's chapter 8, for now treat it as a phrase" instead of explaining ahead.

**Done when:** the lint covers the new exercises with 0 issues; for each chapter we record the session where its story arrives and its coverage there; checked in the browser (ch1 s1, a chapter where the story arrives mid-chapter, a review day).

---

## Phase 4: practice tools follow the course

- **Build-a-sentence (Library):** uses your course chapter, not the old one, which keeps it on chapter 1 forever. Sentences also need their **grammar** taught, not just their words. So no "Ми треба вода" before ми (chapter 8), and no "Пијам кафе" before -е verbs.
- **Verb drill (warm-up):** only drills verbs the course has taught. No доаѓа, зема or спие out of nowhere.
- **Flashcards chapter filter and Library → Words:** grouped by the chapter that actually teaches each word. For example, јас/ти are in chapter 1, not 2, and сакам is in chapter 3, not 6. Words that aren't in any lesson go under "More words (not in lessons)". Number bundles ("два, три, четири, пет") count their words as learned, so chapter 3 doesn't keep offering "＋ Learn два".
- **Words you add with ＋Learn or ★:** see decision D4.
- **Partner screens:** the shared story, role-swap, live conversation and info-gap pickers offer what both of you have been taught, starting from your shared chapter. The shared story no longer defaults to the chapter 4 café story.
- **Bug:** Library → Reading always opens the café reader, whichever reader you tap.

**Done when:** a headless walk shows no tool offering anything untaught at any position.

---

## Order

| PR | What | Size |
|---|---|---|
| 1 | Phase 1: session lint, lesson content fixes, agenda gaps | small–medium |
| 2 | Phase 2: Progress curriculum + lesson notes | medium |
| 3 | Phase 3: story timing, notes moved, "Use it" exercises, chips | large (includes new content for sign-off) |
| 4 | Phase 4: practice tools and remaining screens | medium |

PR 1 goes first because every later phase relies on its "taught by now" check. PR 2 and PR 3 don't depend on each other, so their order is your call. Each PR ships after:
- tests, type check and lint are green;
- a browser check with screenshots;
- a read-only check against both your and Madison's real progress.

## Decisions (Jake, 2026-10-08)

- **D1: keep reading the full story with translations from session 1. No "Today's lines" gate.** Instead, highlight today's focus wherever it shows up: every line that uses today's point (this already happens), **and the exact words inside those lines** (e.g. the е in "Ана е во Скопје"). This applies in the story, its exercises and the conversation. The 3a timing gate is dropped.
- **D2: keep the set-phrase notes, but stop printing them under lines**, where they pull attention from the focus. A line's note now appears when you tap to reveal its English. That works for every line that has a note, not just the three picked per session. A phrase taught as a word (e.g. "Можете ли да повторите?") shows its note on its card.
- **D3: the four "Use it" exercise types as proposed.** Understand / complete the line / build the line / say it; about four per session; speaking skippable.
- **D4: the warm-up stays on the course.** ★ saved and ＋Learn words feed the **review days** (review sessions and stage reviews), not the daily warm-up. Words you only tapped stay in Flashcards.
- **D5: existing Macedonian lines only.**
- **D6: order left to me.** PR 1 → PR 2 → PR 3 → PR 4.

## Decisions as originally asked

- **D1. Before a story is readable:** show "Today's lines" from it (**recommended**), or read the full story with translations from session 1 as now.
- **D2. Set-phrase notes:** move them to the phrase card plus a consistent tap-a-line "why" (**recommended**), or drop them from stories entirely.
- **D3. "Use it" exercises:** the four types above, about four items, speaking skippable (**recommended**). Anything you'd add or drop?
- **D4. Warm-up and your own words:** after the course cards, include up to 2 due words you saved yourself with ★ or ＋Learn (**recommended**). Or keep the warm-up course-only, with your own words living in Flashcards. Words you only *tapped* in a story stay in Flashcards either way.
- **D5. New Macedonian:** keep the rule "existing lines only" (**recommended**). The cost is a couple of thin spots: the first sessions of chapter 1 have few usable lines. Or allow a handful of new lines, each needing a careful check plus new audio.
- **D6. Order:** PR 2 (Progress and notes) before PR 3 (story), or the other way round?

## Out of scope here

- New stories or conversations.
- Changing which words or points each session teaches.
- The Bulgarian pack.
