import type { GrammarConcept, LanguagePack } from "@ll/pack-schema";
import { alphabet } from "./alphabet.js";
import { phonology, grammar } from "./grammar.js";
import { vocab } from "./vocab.js";
import { readers } from "./readers.js";
import { writingTasks } from "./writing.js";
import { stories } from "./stories.js";
import { infoGapTasks } from "./infogap.js";
import { orderADrink } from "./scenarios/order-a-drink.js";
import { smallTalk } from "./scenarios/small-talk.js";
import { generatedScenarios, generatedVocab } from "./generated.js";
// Curriculum waves (DESIGN-content-and-curriculum.md), spot-checked + corrected → confidence:"validated".
import * as stage0 from "./promoted-stage0.js";
import * as stage1 from "./promoted-stage1.js";
import * as stage2 from "./promoted-stage2.js";

// Promoted from the offline generation batch after Jake's spot-check (unreviewed → validated).
const promotedScenarios = generatedScenarios.map((s) => ({ ...s, confidence: "validated" as const }));
const promotedVocab = generatedVocab.map((v) => ({ ...v, confidence: "validated" as const }));

// Merge grammar concepts by id: the first (hand-authored) concept owns the teaching fields
// (plain title, pattern table, explanation); drills from later same-id concepts (e.g. the
// scenario-tagged generated set) are appended for extra practice. Without this, the core and
// promoted sets each define `gender` + `definite-articles`, producing duplicate reference cards
// and duplicate React keys.
function mergeGrammar(...groups: GrammarConcept[][]): GrammarConcept[] {
  const byId = new Map<string, GrammarConcept>();
  for (const concept of groups.flat()) {
    const existing = byId.get(concept.id);
    if (!existing) {
      byId.set(concept.id, { ...concept, drills: [...concept.drills] });
      continue;
    }
    const seen = new Set(existing.drills.map((d) => d.id));
    existing.drills.push(...concept.drills.filter((d) => !seen.has(d.id)));
  }
  return [...byId.values()];
}

/** The Macedonian language pack — DATA ONLY. No app logic lives here. */
export const macedonian: LanguagePack = {
  id: "mk",
  languageCode: "mk",
  name: "Macedonian",
  // ElevenLabs multilingual voice (intelligible but lightly accented); swap for a more
  // native-sounding voice — or ElevenLabs v3 (mkd) when stable — and re-cache audio.
  voiceId: "21m00Tcm4TlvDq8ikWAM",
  asr: { engines: ["scribe", "google"], languageHints: ["mkd", "mk-MK"], gate: "agreement" },
  alphabet,
  phonology,
  grammar: mergeGrammar(grammar, stage1.promotedGrammar),
  vocab: [...vocab, ...promotedVocab, ...stage0.promotedVocab, ...stage1.promotedVocab, ...stage2.promotedVocab],
  scenarios: [orderADrink, smallTalk, ...promotedScenarios, ...stage0.promotedScenarios, ...stage1.promotedScenarios, ...stage2.promotedScenarios],
  readers: [...readers, ...stage1.promotedReaders],
  stories: [...stories, ...stage0.promotedStories, ...stage1.promotedStories, ...stage2.promotedStories],
  srsSeed: vocab.slice(0, 6),
  writingTasks: [...writingTasks, ...stage1.promotedWritingTasks, ...stage2.promotedWritingTasks],
  infoGapTasks: [...infoGapTasks, ...stage0.promotedInfoGapTasks, ...stage1.promotedInfoGapTasks, ...stage2.promotedInfoGapTasks],
};

export default macedonian;
