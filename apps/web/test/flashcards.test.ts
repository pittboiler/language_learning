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
assert.deepEqual(numbers?.parts?.map((p) => p.answer), ["два", "три", "четири"], "a comma list of single words splits on its own");
// 2b. No card bundles more than three words (Jake, 2026-11-16: "no more than 2-3 max"): not in the pack, not in a
// lesson. A split card is retired (card-splits.ts) and every card that replaces it exists.
const big = vocab.filter((v) => (v.parts?.length ?? 0) > 3).map((v) => `${v.id}: ${v.answer}`);
assert.deepEqual(big, [], "cards with more than three parts");
const course = macedonian.course!;
// A lesson card's pieces: "x / y / z", or a comma list of single words ("два, три, четири"); a sentence with a
// comma ("Добро сум, фала.") is one piece.
const pieces = (d: string) => (d.includes(" / ") ? d.split(" / ") : d.split(/\s*,\s*/).every((w) => w && !/\s/.test(w)) && !/[.!?…]/.test(d) ? d.split(/\s*,\s*/) : [d]);
assert.equal(pieces("Добро сум, фала.").length, 1);
assert.equal(pieces("осум, девет, десет").length, 3);
const bigInLessons = course.chapters.flatMap((c) => c.sessions.flatMap((s) => s.words.filter((w) => pieces(w.display).length > 3).map((w) => `${c.chapterId} s${s.n}: ${w.display}`)));
assert.deepEqual(bigInLessons, [], "lesson words bundling more than three");
for (const [old, news] of Object.entries(macedonian.retiredCards ?? {})) {
  assert.ok(!vocab.some((v) => v.answer.trim() === old), `retired “${old}” is still in the pack`);
  for (const n of news) assert.ok(vocab.some((v) => v.answer.trim() === n), `“${n}” (replacing “${old}”) isn't in the pack`);
  const oldParts = old.split(/ \/ |, /).sort(), newParts = [...new Set(news.flatMap((n) => n.split(/ \/ |, /)))];
  assert.ok(oldParts.every((p) => newParts.includes(p)), `every word of “${old}” is on a card that replaces it`);
}
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
