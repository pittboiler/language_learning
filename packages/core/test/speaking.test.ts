// Runnable check for the confidence gate's COMPLETENESS signal + the score floor that fixes the
// "false start scored 50/100" bug — without regressing the spike's anti-false-negative net. Run with:
//   npx tsx packages/core/test/speaking.test.ts
import assert from "node:assert/strict";
import type { AsrConfig } from "@ll/pack-schema";
import { confidenceGate, clampScoreForCompleteness, type AsrResult } from "../src/speaking/index.js";

const dual: AsrConfig = { engines: ["scribe", "google"], languageHints: ["mkd", "mk-MK"], gate: "agreement" };
const r = (engine: "scribe" | "google", text: string): AsrResult => ({ engine, text, ms: 0, ok: text.length > 0 });

// 1. THE REPORTED BUG: one word of a two-word phrase, both engines agree on that one word.
//    Jaccard(1 of 2) = 0.5 ⇒ "high confidence" — which used to let Claude score it ~50/100.
const twoWord = "добро утро";
const g1 = confidenceGate([r("scribe", "добро"), r("google", "добро")], dual, twoWord);
assert.equal(g1.completeness, 0.5, "reproduced 1 of 2 target words");
assert.equal(g1.looksLikeFragment, true, "lone word of a multi-word phrase ⇒ fragment");
assert.equal(g1.confidence, "high", "engines agree ⇒ ASR is reliable");
assert.equal(clampScoreForCompleteness(50, g1), 20, "the 50/100 false start is now floored to 20");
assert.equal(clampScoreForCompleteness(8, g1), 8, "already-low scores are left untouched");

// 2. FULL correct attempt — not a fragment, no clamp.
const g2 = confidenceGate([r("scribe", twoWord), r("google", twoWord)], dual, twoWord);
assert.equal(g2.completeness, 1);
assert.equal(g2.looksLikeFragment, false);
assert.equal(clampScoreForCompleteness(95, g2), 95);

// 3. ANTI-FALSE-NEGATIVE: a fragment-looking read but ASR is UNRELIABLE (engines disagree, neither
//    matches the target — the words may simply not have been recognised). We must NOT hard-cap.
const g3 = confidenceGate([r("scribe", "среда"), r("google", "лето")], dual, twoWord);
assert.equal(g3.looksLikeFragment, true);
assert.equal(g3.confidence, "low", "disagree + no target match ⇒ hedge");
assert.equal(clampScoreForCompleteness(70, g3), 70, "low confidence ⇒ never hard-cap (preserve the spike net)");

// 4. GENEROUS-ENGINE PROTECTION: one engine dropped a word but the other heard the whole phrase ⇒ the
//    learner clearly attempted it, so it is NOT a fragment.
const g4 = confidenceGate([r("scribe", twoWord), r("google", "добро")], dual, twoWord);
assert.equal(g4.looksLikeFragment, false, "best engine heard 2 words ⇒ real attempt");
assert.equal(clampScoreForCompleteness(90, g4), 90);

// 5. SINGLE-WORD TARGET — a one-word answer is complete, never a fragment.
const g5 = confidenceGate([r("scribe", "здраво"), r("google", "здраво")], dual, "здраво");
assert.equal(g5.completeness, 1);
assert.equal(g5.looksLikeFragment, false);
assert.equal(clampScoreForCompleteness(88, g5), 88);

// 6. LONGER phrase, one matching word (Jaccard 1/3 < 0.5) but both engines agree ⇒ reliable fragment.
const g6 = confidenceGate([r("scribe", "кафе"), r("google", "кафе")], dual, "едно кафе молам");
assert.equal(g6.looksLikeFragment, true);
assert.equal(g6.confidence, "high");
assert.equal(clampScoreForCompleteness(45, g6), 20);

// 7. SILENCE / nothing recognised — completeness 0, not flagged as a (gradeable) fragment, hedge.
const g7 = confidenceGate([r("scribe", ""), r("google", "")], dual, twoWord);
assert.equal(g7.completeness, 0);
assert.equal(g7.looksLikeFragment, false);
assert.equal(g7.confidence, "low");

console.log("✓ speaking completeness gate + score floor: all assertions passed");
