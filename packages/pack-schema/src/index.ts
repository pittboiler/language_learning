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

export interface GrammarConcept {
  id: string;
  name: string;
  explanation: string;
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
  spokenPrompt?: boolean; // route through core/speaking
  satisfies?: string[]; // criterion ids, if the answer meets a goal
}

export interface MiniStory {
  id: string;
  title: string;
  titleGloss?: string;
  i1Level: number;
  level: CefrBand;
  body: StorySegment[]; // synced audio + text
  audioUrl?: string; // full-story audio, cached offline
  audioSource: "native" | "tts"; // flag native recording vs TTS (quality signal)
  qa: StoryQA[]; // retrieval tail; spoken prompts route to the speaking pipeline
  registersVocab: string[]; // lexKeys this story teaches → seed the familiarity engine
  confidence: Confidence;
}

export type AsrEngine = "scribe" | "google";

export interface AsrConfig {
  engines: AsrEngine[];
  languageHints: string[]; // per-engine codes, e.g. ["mkd", "mk-MK"]
  gate: "agreement" | "single"; // dual-engine confidence gate (see core/speaking)
}

/** The generalization layer: everything language-specific lives in one validated, cached object. */
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
}
