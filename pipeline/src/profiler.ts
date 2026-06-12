import type { PhonologyRules } from "@ll/pack-schema";
import { structuredCall, MODELS } from "@ll/core/llm";

// Language Profiler — Opus 4.8, offline. Given a target language, produces a structured TEACHING
// profile: what ACTUALLY matters for an absolute beginner (script inventory, the grammar features
// that carry load, stress, high-frequency vocab, social norms) — not a generic template. The
// downstream generators (alphabet / grammar / vocab / scenarios / reader) are all anchored to it.
// Language-agnostic: nothing about a specific language is hardcoded here; the model names the facts.

export interface AlphabetProfile {
  /** Inventory summary, incl. how it differs from closely related languages. */
  note: string;
  /** Letters worth dedicated beginner focus (distinctive to this language's script). */
  distinctiveLetters: string[];
  /** Letters that look like a Latin letter but sound different — a classic beginner trap. */
  falseFriends: string[];
}

export interface LanguageProfile {
  languageCode: string;
  languageName: string;
  script: string;
  alphabet: AlphabetProfile;
  phonology: PhonologyRules;
  /** The grammar features that actually matter for THIS language — including ones it notably LACKS. */
  grammarFeaturesThatMatter: { id: string; name: string; why: string }[];
  highFrequencyVocab: string[];
  socialNorms: string[];
  costUsd: number;
}

const PROFILER_SYSTEM = `You are an expert linguist and language pedagogue. Produce a structured TEACHING PROFILE for the given target language, aimed at an ABSOLUTE BEGINNER whose first language is English.

Be precise and factually correct — this profile is the source of truth that downstream content generation is anchored to, so errors propagate. Focus on what ACTUALLY matters for THIS specific language, not a generic template.

- script: name the writing system and its specific variant. State the EXACT inventory differences from closely related languages (which letters this language has that a sibling lacks, and vice-versa).
- alphabet.note: letter count + the distinctive inventory facts a learner must know.
- alphabet.distinctiveLetters: the letters that are special to this language's script and deserve dedicated drilling.
- alphabet.falseFriends: letters that look like a Latin letter but sound different (common beginner traps).
- phonology: highly practical notes; the stress rule (or that stress is unpredictable/lexical); real exceptions.
- grammarFeaturesThatMatter: the HANDFUL of features that genuinely carry load for a beginner. CRUCIALLY, also name major features the language NOTABLY LACKS if a learner coming from a related language would wrongly expect them (e.g. a lost case system). Give each a short stable id, a name, and a one-line "why it matters".
- highFrequencyVocab: ~15 of the highest-frequency words/phrases for early conversation (in the target script).
- socialNorms: a few register/politeness/cultural norms that affect how a beginner should speak.`;

const PROFILE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    languageName: { type: "string", description: "English name of the language." },
    script: { type: "string", description: "Writing system + variant, with exact inventory differences vs related languages." },
    alphabet: {
      type: "object",
      additionalProperties: false,
      properties: {
        note: { type: "string", description: "Letter count + distinctive inventory facts." },
        distinctiveLetters: { type: "array", items: { type: "string" }, description: "Letters special to this script (single glyphs)." },
        falseFriends: { type: "array", items: { type: "string" }, description: "Letters that look Latin but sound different (single glyphs)." },
      },
      required: ["note", "distinctiveLetters", "falseFriends"],
    },
    phonology: {
      type: "object",
      additionalProperties: false,
      properties: {
        notes: { type: "string" },
        stressRule: { type: "string", description: "The stress rule, or a clear statement that stress is unpredictable/lexical." },
        exceptions: { type: "array", items: { type: "string" } },
      },
      required: ["notes", "stressRule", "exceptions"],
    },
    grammarFeaturesThatMatter: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", description: "Short stable kebab-case id, e.g. 'definite-articles'." },
          name: { type: "string" },
          why: { type: "string", description: "One line: why it matters for a beginner (or that it's notably absent)." },
        },
        required: ["id", "name", "why"],
      },
    },
    highFrequencyVocab: { type: "array", items: { type: "string" }, description: "~15 highest-frequency early-conversation words/phrases, in target script." },
    socialNorms: { type: "array", items: { type: "string" } },
  },
  required: ["languageName", "script", "alphabet", "phonology", "grammarFeaturesThatMatter", "highFrequencyVocab", "socialNorms"],
};

interface ProfileData {
  languageName: string;
  script: string;
  alphabet: AlphabetProfile;
  phonology: { notes: string; stressRule: string; exceptions: string[] };
  grammarFeaturesThatMatter: { id: string; name: string; why: string }[];
  highFrequencyVocab: string[];
  socialNorms: string[];
}

/** Opus 4.8, offline. Given a target language code, produce a structured teaching profile. */
export async function profile(languageCode: string): Promise<LanguageProfile> {
  const { data, costUsd } = await structuredCall<ProfileData>({
    model: MODELS.offline,
    system: PROFILER_SYSTEM,
    user: `Target language code: "${languageCode}". Produce its beginner teaching profile.`,
    schema: PROFILE_SCHEMA,
    effort: "high",
    thinking: true,
    maxTokens: 4000,
  });

  return {
    languageCode,
    languageName: data.languageName,
    script: data.script,
    alphabet: data.alphabet,
    phonology: {
      notes: data.phonology.notes,
      stressRule: data.phonology.stressRule,
      exceptions: data.phonology.exceptions,
    },
    grammarFeaturesThatMatter: data.grammarFeaturesThatMatter,
    highFrequencyVocab: data.highFrequencyVocab,
    socialNorms: data.socialNorms,
    costUsd,
  };
}
