import type { PhonologyRules } from "@ll/pack-schema";

export interface LanguageProfile {
  languageCode: string;
  script: string;
  phonology: PhonologyRules;
  /** The grammar features that actually matter for THIS language — not a generic template. */
  grammarFeaturesThatMatter: { id: string; name: string; why: string }[];
  highFrequencyVocab: string[];
  socialNorms: string[];
}

/** Opus 4.8, offline. Given a target language, produce a structured teaching profile. */
export async function profile(_languageCode: string): Promise<LanguageProfile> {
  throw new Error("not implemented");
}
