// Runnable checks for the flashcard deck's pack data: every bundled card ("еден / една / едно") is drilled
// one part per card, and no two cards ask the same English for different answers (Jake, 2026-10-31).
//   Run with: npx tsx apps/web/test/flashcards.test.ts
import assert from "node:assert/strict";
import { macedonian } from "@ll/pack-mk";
import * as familiarity from "@ll/core/familiarity";

const vocab = macedonian.vocab;
// 1. Every "x / y" card has its parts (a new one needs an entry in pack-mk/src/flashcard-splits.ts).
const unsplit = vocab.filter((v) => / \/ /.test(v.answer) && !v.parts?.length).map((v) => `${v.id}: ${v.answer}`);
assert.deepEqual(unsplit, [], "bundled cards without parts");
// 2. Parts are pieces of their card, each with its own prompt.
for (const v of vocab) for (const pt of v.parts ?? []) {
  assert.ok(v.answer.includes(pt.answer.replace(/\s*…$/, "")), `${v.id}: “${pt.answer}” isn't in “${v.answer}”`);
  assert.ok(pt.prompt.trim() && !/ \/ /.test(pt.prompt), `${v.id}: one prompt per part`);
}
const numbers = vocab.find((v) => v.answer.startsWith("два, три"));
assert.deepEqual(numbers?.parts?.map((p) => p.answer), ["два", "три", "четири", "пет"], "a comma list of single words splits on its own");
assert.equal(vocab.find((v) => v.answer.startsWith("Едно пиво"))?.parts, undefined, "a sentence with a comma is not a list");
// 3. The deck as drilled: a card per key (bundles replaced by their parts), and no English prompt with two answers.
const deck = new Map<string, { gloss: string; id: string }>();
for (const v of vocab) if (!v.parts?.length) { const k = familiarity.deriveKeyForItem(v).lexKey; if (!deck.has(k)) deck.set(k, { gloss: v.gloss, id: v.id }); }
for (const v of vocab) for (const pt of v.parts ?? []) { const k = familiarity.normalize(pt.answer); if (!deck.has(k)) deck.set(k, { gloss: pt.prompt, id: `${v.id}~` }); }
const byPrompt = new Map<string, string[]>();
for (const [k, c] of deck) { const g = c.gloss.toLowerCase().replace(/[.!?]/g, "").trim(); byPrompt.set(g, [...(byPrompt.get(g) ?? []), `${k} (${c.id})`]); }
const clashes = [...byPrompt].filter(([, ks]) => ks.length > 1).map(([g, ks]) => `“${g}” → ${ks.join(", ")}`);
assert.deepEqual(clashes, [], "the same English asks for different answers");
// 4. A "you", "thanks" or "please" card says which register it wants when the answer has one.
const casualPolite = /(?<!\p{L})(ти|те|твој\p{L}*|фала|чао|ве|вие|ваш\p{L}*|благодарам|извинете|повелете|имате|можете|свртете|оставете)(?!\p{L})/iu;
const marked = /formal|casual|polite|friend|you all|waiter|one person|\(m|\(f|\(n/i;
const unmarked = vocab.filter((v) => casualPolite.test(` ${v.answer.toLowerCase()} `) && /\byou|thank|please|sorry|here you|turn|leave|bye/i.test(v.gloss) && !marked.test(v.gloss)).map((v) => `${v.id}: ${v.gloss} → ${v.answer}`);
assert.ok(vocab.filter((v) => casualPolite.test(v.answer)).length > 20, "the register check sees the forms");
assert.deepEqual(unmarked, [], "formal/casual not said");
console.log("flashcards.test.ts: all assertions passed ✓");
