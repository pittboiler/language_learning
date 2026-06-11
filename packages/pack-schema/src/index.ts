// @ll/pack-schema — the contract between the language-agnostic core and any language pack.
// Core depends on these shapes; a pack is just data conforming to them. NO logic, NO language data.

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
  audioUrl?: string; // cached native TTS, produced offline by the pipeline
  i1Level: number; // for comprehensible-input (i+1) serving
  tags: string[];
  /** Language-specific fields (gender, aspect, stress notes, …) live here so the schema stays generic. */
  meta?: Record<string, unknown>;
}

export interface GlyphLesson {
  glyph: string; // e.g. "ѓ"
  name: string;
  sound: string; // informal IPA-ish description
  examples: string[];
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
}

export interface DialogueTurn {
  speaker: "learner" | "partner";
  text: string; // the line, in the target language
  gloss: string; // English
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
  i1Level: number;
  body: DialogueTurn[]; // graded lines with gloss
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
}
