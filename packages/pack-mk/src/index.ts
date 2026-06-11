import type { LanguagePack } from "@ll/pack-schema";
import { alphabet } from "./alphabet.js";
import { phonology, grammar } from "./grammar.js";
import { vocab } from "./vocab.js";
import { readers } from "./readers.js";
import { orderADrink } from "./scenarios/order-a-drink.js";
import { smallTalk } from "./scenarios/small-talk.js";

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
  grammar,
  vocab,
  scenarios: [orderADrink, smallTalk],
  readers,
  srsSeed: vocab.slice(0, 6),
};

export default macedonian;
