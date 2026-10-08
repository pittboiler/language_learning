// @ll/pack-schema — the contract between the language-agnostic core and any language pack.
// Core depends on these shapes; a pack is just data conforming to them. NO logic, NO language data.
//
// Every field here is GENERIC: it describes a capability any language pack might use, never a fact
// about a specific language. (e.g. `translit` is romanization for any non-Latin script; `unique`/
// `falseFriend` are glyph-difficulty hints for any script onboarding.) This is what keeps
// `packages/core` free of Macedonian — the Phase-3 Bulgarian test depends on it.

export type Skill = "listening" | "speaking" | "reading" | "writing" | "alphabet";
export type CefrBand = "pre-A1" | "A1" | "A2";

/** Trust level of a content item. `unreviewed` items are gated from being served as authoritative. */
export type Confidence = "authored" | "validated" | "unreviewed";

export type ItemKind = "vocab" | "phrase" | "grammar" | "glyph";

/** The atomic unit of practice + spaced repetition (vocab, phrases, grammar patterns, glyphs). */
export interface ReviewItem {
  id: string;
  kind: ItemKind;
  prompt: string; // what the learner is shown/asked
  answer: string; // expected production (target language)
  gloss: string; // English
  /** Romanization of `answer` for learners who can't yet read the script (generic, optional). */
  translit?: string;
  /** Short pedagogical note (stress, usage) — surfaced to the learner and to the feedback prompt. */
  note?: string;
  audioUrl?: string; // cached native TTS, produced offline by the pipeline
  i1Level: number; // for comprehensible-input (i+1) serving
  tags: string[];
  /** Multiple-choice options for a drill item (generic; e.g. grammar drills). */
  options?: string[];
  /** Why the drill answer is correct — shown after answering (generic). */
  why?: string;
  /** Word-by-word breakdown of a multi-word `answer`, shown on the flashcard reveal so the learner
   *  sees how each piece maps to the meaning. `part`s are surface chunks of `answer`, in order. */
  breakdown?: { part: string; gloss: string }[];
  /** One-line "how the pieces fit together" grammar takeaway for a phrase/chunk (learner-facing). */
  takeaway?: string;
  /** Trust level for generated items; gated until reviewed. Omit ⇒ treated as authored pack data. */
  confidence?: Confidence;
  /** Language-specific fields (gender, aspect, stress notes, …) live here so the schema stays generic. */
  meta?: Record<string, unknown>;
}

/** One example word for a glyph lesson. `text` is the word; gloss/translit are optional aids. */
export interface GlyphExample {
  text: string;
  gloss?: string;
  translit?: string;
}

export interface GlyphLesson {
  glyph: string; // e.g. "ѓ"
  name: string;
  sound: string; // informal IPA-ish description
  examples: GlyphExample[];
  /** This glyph is one of the script's distinctive letters worth dedicated focus (generic hint). */
  unique?: boolean;
  /** Looks like a Latin letter but sounds different — a common beginner trap (generic hint). */
  falseFriend?: boolean;
  confidence?: Confidence;
}

export interface PhonologyRules {
  notes: string;
  stressRule?: string; // e.g. Macedonian antepenultimate
  exceptions?: string[]; // e.g. loanwords like кафе → ka-FE
}

/** An at-a-glance paradigm table for a grammar concept. `rows` are aligned to `headers` (same
 *  length); `spotlightCol` (0-based) renders that column as an accent chip — e.g. the changing
 *  ending or the word that must agree. Optional: concepts that don't tabulate cleanly omit it. */
export interface GrammarPattern {
  headers: string[];
  rows: string[][];
  spotlightCol?: number;
}

export interface GrammarConcept {
  id: string;
  /** Plain-language title shown to the learner (e.g. "Saying 'the' — it goes on the end"). */
  name: string;
  /** The technically-correct term (e.g. "Postposed definite articles"), shown small as a subtitle. */
  technicalName?: string;
  /** One-line plain-English hook, shown prominently before the fuller explanation. */
  plain?: string;
  explanation: string;
  /** Optional paradigm table that makes the pattern visible at a glance. */
  pattern?: GrammarPattern;
  /** Example lines, each formatted "<target> — <English>" so the UI can show both. */
  examples: string[];
  drills: ReviewItem[];
  confidence?: Confidence;
}

export interface DialogueTurn {
  speaker: "learner" | "partner";
  text: string; // the line, in the target language
  gloss: string; // English
  translit?: string; // romanization aid (generic)
  /** Criterion ids this turn satisfies when the learner produces it (learner turns only). */
  satisfies?: string[];
  audioUrl?: string;
}

export interface Criterion {
  id: string;
  description: string; // e.g. "ordered a drink"
}

/** A task-based communicative scenario — the heart of the pedagogy. */
export interface Scenario {
  id: string;
  title: string;
  goal: string;
  setting: string;
  /** Situational theme for Library grouping (e.g. "Café & bar"). Optional; ungrouped if absent. */
  theme?: string;
  requiredVocab: string[]; // ReviewItem ids
  requiredStructures: string[]; // GrammarConcept ids
  script: DialogueTurn[];
  successCriteria: Criterion[];
  confidence: Confidence;
}

export interface Reader {
  id: string;
  title: string;
  titleGloss?: string;
  theme?: string; // situational theme for Library grouping (optional)
  i1Level: number;
  body: DialogueTurn[]; // graded lines with gloss
  confidence: Confidence;
}

/** A short prompted-production task for the writing subsystem. `prompt` is an English instruction;
 *  the learner produces the target language, which the tutor then corrects. */
export interface WritingTask {
  id: string;
  prompt: string; // English instruction, e.g. "Order a coffee and ask the price"
  targetConcepts?: string[]; // GrammarConcept ids it exercises
  i1Level: number;
  confidence?: Confidence;
}

// ---- Mini-stories (comprehensible-input spine) ----
// A richer SIBLING of Reader (not a replacement): synced audio + text, segmented tokens for
// tap-to-capture + difficulty scoring, a retrieval Q&A tail, and a spoken prompt that routes into the
// speaking pipeline. Hand-authored or heavily validated. See DESIGN-comprehensible-input.md §2.3.

/** One synced line of a mini-story. `tokens` (optional) pre-segments surface words for tap-capture +
 *  scoring; `audioStart/End` (seconds) sync text to the story audio. */
export interface StorySegment {
  text: string; // the line, in the target language
  translit?: string;
  gloss: string; // English
  tokens?: string[]; // pre-segmented surface tokens (else derived at runtime)
  audioStart?: number; // seconds into the story audio
  audioEnd?: number;
}

/** A retrieval-practice question that re-uses the story's vocabulary in a new frame. When
 *  `spokenPrompt` is true it feeds the dual-ASR speaking pipeline (input → comprehension → output). */
export interface StoryQA {
  id: string;
  question: string; // target language
  questionGloss: string; // English
  answer: string; // expected production
  answerGloss: string;
  answerTranslit?: string; // romanization of the answer (shown for spoken prompts)
  spokenPrompt?: boolean; // route through core/speaking
  satisfies?: string[]; // criterion ids, if the answer meets a goal
}

export interface MiniStory {
  id: string;
  title: string;
  titleGloss?: string;
  i1Level: number;
  level: CefrBand;
  theme?: string; // situational theme for Library grouping (optional)
  body: StorySegment[]; // synced audio + text
  audioUrl?: string; // full-story audio, cached offline
  audioSource: "native" | "tts"; // flag native recording vs TTS (quality signal)
  qa: StoryQA[]; // retrieval tail; spoken prompts route to the speaking pipeline
  /** Vocab/chunks this story teaches → seeded into familiarity when read (moves the known-word count).
   *  lexKey = normalized surface form; gloss makes the seeded item reviewable. */
  registersVocab: { lexKey: string; gloss: string }[];
  confidence: Confidence;
}

export type AsrEngine = "scribe" | "google";

export interface AsrConfig {
  engines: AsrEngine[];
  languageHints: string[]; // per-engine codes, e.g. ["mkd", "mk-MK"]
  gate: "agreement" | "single"; // dual-engine confidence gate (see core/speaking)
}

/** One half of an asymmetric info-gap task: what THIS partner knows + is trying to do. The two roles'
 *  `secretInfo` differ — that gap is what forces real target-language exchange (see core/infogap). */
export interface InfoGapRole {
  role: "A" | "B";
  brief: string; // English: what this partner is trying to accomplish
  briefGloss?: string;
  secretInfo: string[]; // facts only THIS partner holds (never shown to the other)
  targetPhrases: { text: string; gloss: string; translit?: string }[]; // scaffolding for this role
}

/** Asymmetric paired task: each role holds different info; neither can finish alone (forced
 *  interdependence). Generated offline by pipeline/infogap; gated by `confidence` like all pack content. */
export interface InfoGapTask {
  id: string;
  title: string;
  goal: string; // the shared goal both partners work toward
  setting: string;
  roleA: InfoGapRole;
  roleB: InfoGapRole;
  successCriteria: Criterion[]; // satisfied only when the information gap is bridged
  confidence: Confidence;
}

// ---- Chapters (the orienting spine) ----
// A chapter NAMES a slice of the pack and fixes its order; it owns no content of its own. Artifacts
// belong to it by the id convention the generation pipeline already uses (`gen-<chapterId>…`) or by
// carrying the chapter id in `tags` — so a pack gains chapters without any content being rewritten.
// Resolution + progress live in core/chapters; this is just the declaration.
export interface Chapter {
  /** Stable id — the curriculum unit id (e.g. "s1-cafe-order"), which artifact ids are prefixed with. */
  id: string;
  order: number; // 1-based position in the course
  stage: number; // curriculum stage this chapter sits in (0, 1, 2 …)
  stageTitle: string; // e.g. "Core situations"
  title: string; // learner-facing, e.g. "Café & bar: order and pay"
  /** Short label for tight spaces (chips, headings) — e.g. "Café & bar". */
  shortTitle: string;
  cefr: CefrBand;
  goal: string; // one line: what the learner can do after it
  /** "script": a chapter about the writing system itself (letters + sounds), with no words, stories or
   *  scenarios of its own. Its progress is the alphabet; it never owes a content checkpoint. */
  kind?: "script";
  /** Artifact ids belonging here that DON'T follow the `gen-<chapterId>` convention (hand-authored
   *  scenarios/stories/readers predating the pipeline). */
  extraIds?: string[];
  /** `ReviewItem.tags` values whose words this chapter also teaches — how the semantically-tagged
   *  core word list ("food & drink", "numbers") is distributed across chapters. */
  wordTags?: string[];
}

/** The generalization layer: everything language-specific lives in one validated, cached object. */
/** One rung of a Build-a-sentence item: an English prompt and its target sentence. Verb items carry a
 *  `person` so the exercise can offer I/you/we/they tabs; non-verb items have a single variant. */
export interface SentenceVariant {
  person?: "1sg" | "2sg" | "3sg" | "1pl" | "2pl" | "3pl";
  en: string; // English prompt shown to the learner
  mk: string; // the target sentence to build from tiles
}

/** A tap-the-tiles "Build a sentence" item (see DESIGN plan). Scoped to taught words via `supportWords`,
 *  tagged by the grammar it exercises, and — when built around a conjugating verb — offered across all
 *  six persons so pronoun/conjugation coverage is systematic. Offline-generated + spot-checked. */
export interface SentenceItem {
  id: string;
  conceptIds: string[]; // grammar concepts this exercises (e.g. "verb-conjugation", "definite-articles")
  verbLemma?: string; // present ⇒ the item has person tabs (from pack.conjugations)
  supportWords: string[]; // the non-verb content words used — all must be "met" for the item to be in scope
  variants: SentenceVariant[]; // one per person for verb items; a single entry otherwise
  /** Complexity rung: 1 = verb + one word (2-3 words), 2 = 3-4 words, 3 = 5-6 words (object + place/time),
   *  4 = 7-9 words (two linked clauses). Absent ⇒ 1. The builder unlocks higher tiers as the learner builds. */
  tier?: 1 | 2 | 3 | 4;
  confidence?: "authored" | "validated" | "unreviewed";
}

/** A verb's present-tense paradigm, backing the Build-a-sentence conjugation tabs (I/you/we/they). Person
 *  keys: 1sg (I), 2sg (you), 3sg (he/she/it), 1pl (we), 2pl (you all), 3pl (they). Offline-generated
 *  (pipeline/src/run-conjugations.ts) + spot-checked like other pack content. */
export interface ConjugationSet {
  lemma: string; // dictionary/base form shown as the verb label
  gloss: string; // English meaning
  group: string; // verb class: "a" | "e" | "i" | "irregular"
  forms: { "1sg": string; "2sg": string; "3sg": string; "1pl": string; "2pl": string; "3pl": string };
  conceptId?: string; // grammar concept exercised (e.g. "verb-conjugation")
  confidence?: "authored" | "validated" | "unreviewed";
}

// ---- Course blueprint (the grammar spine + session-by-session plan) ----
// See DESIGN-course-spine.md. A pack's course fixes WHAT is taught WHEN: an ordered list of small grammar
// points, each owned by one chapter, and a planned sequence of sessions per chapter. The daily flow plays
// the blueprint; only review content (what's due) is decided at runtime. Every target-language string
// here is a REFERENCE to a line that already exists in the pack — the blueprint never introduces new text
// in the target language (enforced by the pipeline lint).

/** A pointer to an existing target-language line. `source` names where it lives so the UI can play its
 *  cached audio and the lint can check `text` still matches: `story:<id>#<i>`, `qa:<storyId>#<qaId>`,
 *  `scenario:<id>#<i>`, `grammar:<conceptId>#<i>`, or `vocab:<itemId>`. */
export interface LineRef {
  text: string;
  gloss: string;
  source: string;
}

/** A deliberately simple grammar flashcard. `rule`: a plain-English question and a one-line answer.
 *  `blank`: an existing line with ONE gap where the point lives, answered by tapping one of the options
 *  (never by typing a sentence). */
export type GrammarCard =
  | { kind: "rule"; front: string; back: string; example?: LineRef }
  | { kind: "blank"; line: LineRef; blank: string; options: string[]; why: string };

/** One small, teachable grammar point — the unit of the course spine (finer than a GrammarConcept, which
 *  stays the home of pattern tables and drills). Explained at three depths: `agenda` names it, `rule`
 *  teaches it, `recap` consolidates it, and `library` holds the full detail. */
export interface GrammarPoint {
  id: string;
  chapterId: string;
  /** 1-based position in the whole spine. */
  order: number;
  /** GrammarConcepts this point draws its pattern table and drills from (may be empty). */
  grammarIds: string[];
  /** `recognize` = explained and recapped but never drilled for production. */
  depth: "produce" | "recognize";
  /** A heavy point gets a practice session of its own after it's taught. */
  heavy?: boolean;
  /** Plain-English name, e.g. "Yes/no questions: ли or дали". */
  title: string;
  /** One line for the session agenda (~12 words). */
  agenda: string;
  /** Two or three sentences for the in-lesson card. */
  rule: string;
  /** A fuller paragraph for the end-of-session recap. */
  recap: string;
  library: {
    rule: string;
    /** "Why is it like this?" notes — the nuances that trip learners up. */
    why: string[];
    mistakes: string[];
  };
  examples: LineRef[];
  /** Set phrases met earlier that this point finally explains ("you've been saying … since chapter 1"). */
  callbacks: LineRef[];
  cards: GrammarCard[];
  confidence: Confidence;
}

/** What one session of a chapter is for. */
export type SessionRole = "teach" | "practice" | "review" | "use" | "checkpoint";

export interface CourseWord {
  lexKey: string;
  display: string;
  gloss: string;
}

export interface CourseSession {
  /** 1-based within the chapter. */
  n: number;
  /** A script chapter's session: the letters taught (or, on its checkpoint, quizzed). */
  letters?: { title: string; glyphs: string[]; note?: string };
  role: SessionRole;
  /** The point introduced (teach) or practised (practice) in this session. */
  pointId?: string;
  /** New words taught this session (a hard cap applies). */
  words: CourseWord[];
  /** The story read today, with the lines that exemplify the lens points highlighted. `reuse` marks a
   *  story from an earlier chapter brought back for consolidation (it never advances its own chapter). */
  story?: { id: string; lens: string[]; highlight: number[]; reuse?: boolean };
  /** Build-a-sentence candidates (SentenceItem ids), in priority order. */
  build: string[];
  /** Conversation to attempt today (Scenario id). */
  speak?: string;
  writing?: boolean;
  /** Set-phrase notes (ChunkNote sources) surfaced for the first time today — capped per session so a
   *  beginner meets them a few at a time. Notes not listed anywhere stay available on tap. */
  notes?: string[];
  /** The agenda bullets shown at the start. */
  agenda: string[];
  /** One line for the recap's "next time". */
  next: string;
}

export interface CourseChapter {
  chapterId: string;
  /** The pack chapter's order (0 for a script chapter that precedes the curriculum). */
  order: number;
  pointIds: string[];
  /** The trimmed word list the chapter teaches, in teaching order. */
  words: CourseWord[];
  /** Words the chapter used to carry that now live in the Library only (＋Learn on demand). */
  extraWords: CourseWord[];
  sessions: CourseSession[];
  checkpoint: { wordKeys: string[]; pointIds: string[]; scenarioId?: string };
}

/** A cumulative review after a stage: everything taught so far, one session. */
export interface StageReview {
  afterChapterId: string;
  chapterIds: string[];
  wordKeys: string[];
  pointIds: string[];
  scenarioIds: string[];
}

/** A line that uses a point taught LATER than the chapter it appears in — it's served as a set phrase,
 *  with a short note so it isn't left unexplained. */
export interface ChunkNote {
  source: string;
  text: string;
  pointIds: string[];
  note: string;
}

export interface Course {
  /** Changes only when the chapter/session STRUCTURE changes (not wording) — a learner whose saved
   *  position was made on another structure is re-placed. */
  version?: string;
  points: GrammarPoint[];
  chapters: CourseChapter[];
  stageReviews: StageReview[];
  /** Which spine points each existing line uses, keyed by LineRef `source`. Powers story lenses, the
   *  backward-reuse picker and the Library's "every example you've read". */
  lineTags: Record<string, string[]>;
  chunkNotes: ChunkNote[];
}

export interface LanguagePack {
  id: string; // e.g. "mk"
  languageCode: string; // e.g. "mk"
  name: string; // "Macedonian"
  voiceId: string; // ElevenLabs voice id for TTS
  asr: AsrConfig;
  alphabet: GlyphLesson[];
  phonology: PhonologyRules;
  grammar: GrammarConcept[];
  vocab: ReviewItem[];
  scenarios: Scenario[];
  readers: Reader[];
  srsSeed: ReviewItem[];
  writingTasks?: WritingTask[];
  /** Mini-stories spine (comprehensible-input on-ramp + validator gold standard). Optional/additive. */
  stories?: MiniStory[];
  /** Asymmetric info-gap tasks for forced-interdependence partnered practice. Optional/additive. */
  infoGapTasks?: InfoGapTask[];
  /** Present-tense verb paradigms for the Build-a-sentence conjugation tabs. Optional/additive. */
  conjugations?: ConjugationSet[];
  /** Tap-the-tiles "Build a sentence" items. Optional/additive. */
  sentences?: SentenceItem[];
  /** The course spine: named, ordered chapters over the content above. Optional/additive — a pack
   *  without chapters just has no chapter grouping in the UI. */
  chapters?: Chapter[];
  /** Retrieval hints, keyed by lexKey (the normalized surface form core/familiarity derives). A hint
   *  points at a word without containing it ("the opposite of лево") — shown when a learner is stuck,
   *  and to the producing partner in a dyad drill. Keyed rather than inlined on items so captured
   *  words and partner turns, which only carry a lexKey, resolve to the same hint. Optional/additive. */
  hints?: Record<string, string>;
  /** The course blueprint: grammar spine + per-chapter session plan. Optional/additive — without it the
   *  daily flow keeps its runtime planner. */
  course?: Course;
}
