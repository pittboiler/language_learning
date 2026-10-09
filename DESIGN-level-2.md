# Level 2 — what a second course looks like

*Reference sketch, 2026-10-09. Not a curriculum and not scheduled. It records where a second Macedonian course would go once Level 1 (chapters 0–12, midterm after 6, final after 12) is finished, so the decisions don't have to be made from scratch.*

## Where Level 1 leaves a learner

Roughly **A1, edging into A2** for speaking and reading. They can:
- handle not understanding;
- greet and ask questions (ли);
- buy things with prices up to the thousands;
- order at a café and introduce themselves;
- shop at the market, with plurals, agreement and го/ја/ги;
- ask for and follow directions;
- say what they like, think and plan (ми, ќе / нема да);
- say what they did (the basic past, with aspect recognized);
- talk about family and home (мој, мајка ми);
- make plans by phone (time, days, ајде да);
- handle a problem (има / нема, the "have done" past recognized).

The 28 spine points are in `pipeline/src/course/spine.ts`; the gap-fill added in October 2026 is in `packages/pack-mk/src/additions.ts`.

What Level 1 deliberately **does not** do:
- produce the л-form pasts;
- build conditionals (би сакал is a set phrase);
- use two object pronouns together;
- distinguish the three "the" endings (-от / -ов / -он);
- join clauses beyond дека;
- go beyond short, scripted exchanges.

## Goals for Level 2

- **A2 → low B1**: keep a conversation going for a few minutes, tell a short story about something that happened, read a short real text (a menu, a sign, a text message), write a paragraph.
- Less scaffolding: romanization off by default, native-speed audio as the norm (slow on request), fewer English glosses in stories.
- The same daily shape (agenda → lesson → recap) and the same partnered session (warm-up → grammar → story → recap). The exams carry over too: midterm and final, open book.

## Grammar spine (candidate points, in a sensible order)

1. **The past, properly**: completed vs ongoing past (aorist / imperfect) with aspect pairs. Level 1 only introduces this; Level 2 makes it productive.
2. **Perfective in да-clauses and after ќе**: why сакам да дојдам, not да доаѓам, for one-off events.
3. **The "have done" pasts in production**: сум бил, имам видено (experience: "I've been to Ohrid").
4. **The hearsay / renarrated mood**: the л-form for things you didn't witness (Тој бил болен, "apparently he was sick"). Very Macedonian, and it's everywhere in news and gossip.
5. **Conditionals and polite requests**: би + л-form (би сакал, би можел), ако + present ("if"), да + past for the unreal (да имав време… "if I had time…").
6. **Two object pronouns together**: order and placement (Му ја дадов книгата, Дај ми го), and clitic doubling as a production rule (Го видов Марко).
7. **The three "the" endings**: -от / -ов / -он (this one / that one there) with овој / оној.
8. **Joining clauses**: што / кој / која / кое / кои (relative); ако, кога, бидејќи, за да, иако, додека, пред да, откако.
9. **Must, should, may**: мора, треба (personal and impersonal), смее, може.
10. **Numbers in full**: ordinals (прв, втор…), dates and months, years, "two days / three hours" count forms (два дена, три часа).
11. **Impersonal and passive се**: Тука се зборува англиски; and the verbal adjective passive (Продавницата е затворена).
12. **Commands in full**: negative commands (немој да…), polite plural, commands with pronouns.
13. **Calling people**: the vocative (Марко! мамо! друже!), plus diminutives (-че, кафенце), and filler words (бре, де, ма, ајде, абе) for recognizing natural speech.
14. **Wider prepositions and time expressions**: кај (at someone's place), за, пред, зад, меѓу, преку, по, околу, без; пред една недела, по ручекот.
15. **Recognize only**: the verbal noun (-ње) and the adverbial -јќи form, for reading.

## Situations (a possible 12-chapter arc)

| # | Chapter | Can-do by the end |
|---|---|---|
| 1 | Days, dates and appointments | Book and move an appointment; say dates, opening hours and "in two weeks" |
| 2 | A meal out | Order a full meal, ask about dishes and dietary needs, split the bill, complain about the food |
| 3 | A guest at a family table | Accept and decline food politely, toast (Наздравје, На здравје), compliment the host, small talk with relatives |
| 4 | Pharmacy and doctor | Say what hurts and since when, understand simple instructions, buy medicine |
| 5 | Travel and a room | Buy a bus/train ticket, book a room (Ohrid in summer), sort out a problem with a booking |
| 6 | Clothes and describing things | Colours, sizes, trying on, comparing; describe people and things in more detail |
| **Midterm** | | |
| 7 | My routine and free time | Habits in the present and past (I used to…), hobbies, sport |
| 8 | What happened | Tell a short story with the full past; react to someone else's story |
| 9 | Relatives and family history | Macedonian kinship terms (вујко / чичко / тетка / тетин…), where the family comes from |
| 10 | Holidays and customs | Божиќ, Велигден, name days, slava, weddings; the set phrases for each |
| 11 | Messages and the phone | Text and message register (including Latin-letter texting), voicemail, an email |
| 12 | Opinions and news | Agree and disagree, give reasons (бидејќи, затоа што), follow a simple news item (hearsay mood) |
| **Final** | | |

## Skills and formats that change

- **Listening**: native-speed dialogues, two speakers, some background; a "listen first, then read" default in stories.
- **Speaking**: 1–2 minute monologues (prepared, then spontaneous); freer AI-tutor conversations on the chapter's situation (the `/api/chat` route exists); partner info-gaps with less script.
- **Reading**: real-world texts written for the course (menus, signs, short messages, a news brief); longer stories (15–25 lines).
- **Writing**: a paragraph per chapter, marked like the exams (`/api/exam` / core/exam).

## Content and pipeline notes (learned in Level 1)

- **New Macedonian lines are expected** in Level 2. The "existing lines only" rule was a Level 1 constraint, already relaxed for the October 2026 gap-fill. Every new line needs native-level review, TTS pre-warm (`pipeline/src/prewarm-tts.ts`) and line tags.
- **Keep the course-structure hash stable** once learners are in a course. `Course.version` hashes each chapter's session roles and points; a change re-places everyone at the start. Add words to existing sessions, add exams outside the chapters, and save structural edits for before launch.
- **One blueprint per level**: probably `pack.courses: Course[]` (or `course` + `course2`), with `Progress.course` gaining a level id; Level 1's final unlocks Level 2. The partnered planner (`core/partner/joint`) already works off a course position, so it needs only the level.
- The same pipeline steps: spine → `run-course.ts points` (LLM drafts, human sign-off in batches) → `assemble` → `focus` → lint → review doc.

## Worth considering now (moved into Level 1, October 2026)

These were the Level 2 topics with the biggest payoff early. They now live in `additions.ts`:
- numbers 11–1000 and how they join;
- days of the week and во сабота;
- би сакал(а) as a set phrase;
- Ми треба … / Ме боли …;
- recognizing doubled object pronouns (Ги земам јаболката).

## Open questions

- Is the Level 2 audience the same pair (siblings, heritage context), or new learners? It changes how much family/heritage content leads.
- Dialect: standard (Skopje) throughout, with a recognition-only chapter on regional speech?
- Should Level 2 have a placement test (for learners who arrive already at A2)?
