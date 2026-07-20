// Runnable checks for tap-to-capture: proper-noun detection (names must NOT become flashcards) and
// captureWord's enrollment + context/gloss storage. This is the fix for "___ caka kafe" — the blank was
// on a name and there was no English. Run with: npx tsx apps/web/test/capture.test.ts
import assert from "node:assert/strict";
import type { LanguagePack } from "@ll/pack-schema";
import type { Progress } from "../lib/store.js";
import { properNounLike, captureWord, buildLineGlosses } from "../lib/capture.js";
import * as familiarity from "@ll/core/familiarity";

// Minimal pack: properNounLike only reads pack.vocab[].answer and pack.stories[].registersVocab[].lexKey.
const pack = {
  vocab: [{ answer: "кафе" }, { answer: "сака" }],
  stories: [{ registersVocab: [{ lexKey: "влегува" }, { lexKey: "кафуле" }] }],
} as unknown as LanguagePack;

// 1. Names (capitalized, not curated) are name-like; curated content words are not — even when the
//    curated word appears capitalized at the start of a sentence (normalize is case-insensitive).
assert.equal(properNounLike("Ана", pack), true, "'Ана' is a name → keep out of review");
assert.equal(properNounLike("Марко", pack), true, "'Марко' is a name");
assert.equal(properNounLike("кафе", pack), false, "vocab word is reviewable");
assert.equal(properNounLike("Сака", pack), false, "sentence-initial capitalized vocab word still matches (case-insensitive)");
assert.equal(properNounLike("Влегува", pack), false, "sentence-initial capitalized story word still matches");
assert.equal(properNounLike("пие", pack), false, "lowercase uncurated word is not name-like (reviewable)");
assert.equal(properNounLike("„", pack), false, "punctuation is not a name");

// 2. captureWord enrolls a reviewable word with its sentence + English, and leaves it as a live SRS card.
let p: Progress = { familiarity: {}, contexts: {}, contextGlosses: {} } as Progress;
const persist = (next: Progress) => { p = next; };
const key = captureWord(p, persist, "сака", "Ана сака кафе.", { gloss: "Ana likes coffee.", reviewable: true });
assert.equal(key, "сака", "returns the normalized lexKey");
assert.equal(p.contexts!["сака"], "Ана сака кафе.", "stores the MK sentence for the cloze blank");
assert.equal(p.contextGlosses!["сака"], "Ana likes coffee.", "stores the English so the card shows what to say");
assert.ok(p.familiarity["сака"]?.srs, "reviewable word gets a live SRS card");
assert.notEqual(p.familiarity["сака"]?.status, "ignored", "reviewable word is not ignored");

// 3. A name is captured but marked "ignored" (has meaning on tap, never a flashcard).
let q: Progress = { familiarity: {}, contexts: {}, contextGlosses: {} } as Progress;
const persistQ = (next: Progress) => { q = next; };
captureWord(q, persistQ, "Ана", "Ана сака кафе.", { gloss: "Ana likes coffee.", reviewable: false });
assert.equal(q.familiarity["ана"]?.status, "ignored", "name is captured as ignored");
assert.equal(q.familiarity["ана"]?.srs, null, "ignored name has no SRS card ⇒ never due in Flashcards");

// 4. buildLineGlosses lets a pre-fix capture (context stored, no gloss) get back-translated at review
//    time — the retroactive fix for cards like "___ сака кафе" that showed no English.
const glossPack = {
  stories: [{ body: [
    { text: "Ана сака кафе.", gloss: "Ana likes coffee." },
    { text: "Таа влегува во кафуле.", gloss: "She enters a café." },
  ] }],
  readers: [{ body: [{ text: "Добро утро.", gloss: "Good morning." }] }],
} as unknown as LanguagePack;
const lg = buildLineGlosses(glossPack);
assert.equal(lg.get("Ана сака кафе."), "Ana likes coffee.", "story line back-translates to its English");
assert.equal(lg.get("Добро утро."), "Good morning.", "reader lines are included too");
assert.equal(lg.get("unseen sentence"), undefined, "unknown sentence → no gloss (card falls back gracefully)");
// The render-time backfill is exactly: stored gloss, else the line lookup.
const backfill = (stored: string | undefined, ctx: string) => stored ?? lg.get(ctx.trim());
assert.equal(backfill(undefined, "Ана сака кафе."), "Ana likes coffee.", "missing stored gloss is backfilled from the pack");
assert.equal(backfill("already there", "Ана сака кафе."), "already there", "a stored gloss wins over the backfill");

// 5. studied vs exposed: a word only EXPOSED (e.g. seeded by reading a story) is not review-eligible;
//    tapping it (deliberate engagement) PROMOTES it to studied so it can enter warm-up/flashcards.
const exposed = familiarity.capture({ lexKey: "мачка", kind: "word", display: "мачка", tags: [familiarity.EXPOSED_TAG] });
assert.equal(familiarity.isStudied(exposed), false, "an exposed (story-seeded) word is not yet studied");
assert.equal(familiarity.isStudied(familiarity.capture({ lexKey: "x", kind: "word", display: "x" })), true, "a plain captured word is studied");
assert.equal(familiarity.isStudied(familiarity.markStudied(exposed)), true, "markStudied promotes an exposed word");

let r: Progress = { familiarity: { "мачка": exposed }, contexts: {}, contextGlosses: {} } as unknown as Progress;
const persistR = (next: Progress) => { r = next; };
captureWord(r, persistR, "мачка", "Мачка спие.", { gloss: "The cat sleeps.", reviewable: true });
assert.equal(familiarity.isStudied(r.familiarity["мачка"]!), true, "tapping an exposed word promotes it to studied");
assert.ok(r.familiarity["мачка"]?.srs, "promoted word keeps its live SRS card");

console.log("capture.test.ts: all assertions passed ✓");
