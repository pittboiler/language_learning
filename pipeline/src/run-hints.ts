// Offline generator: one HINT per taught word/phrase — the nudge a learner (or their partner) gets when
// the English prompt alone isn't enough to retrieve the target. A hint points AT the word without saying
// it: a contrast with another word from the same chapter ("the opposite of лево"), or the situation it
// belongs to ("what you say when you didn't catch something"). Never the answer, never a spelling clue —
// the point is to make retrieval possible, not to hand it over.
//
// Keyed by lexKey (normalized surface form), the same join key familiarity/SRS/partner turns use, so a
// captured word and a pack item resolve to the same hint. Idempotent: only fills gaps.
// Writes packages/pack-mk/src/hints.ts.
//
// Run:  pipeline/node_modules/.bin/tsx pipeline/src/run-hints.ts [--limit N] [--chapter s1-cafe-order]
import "./env.js";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReviewItem } from "@ll/pack-schema";
import { macedonian } from "@ll/pack-mk";
import { resolveChapters } from "@ll/core/chapters";
import { deriveKeyForItem } from "@ll/core/familiarity";
import { structuredCall, MODELS } from "@ll/core/llm";
import { romanize } from "./romanize.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "packages", "pack-mk", "src", "hints.ts");
const BATCH = 10;
const pack = macedonian;
const argVal = (flag: string) => { const i = process.argv.indexOf(flag); return i === -1 ? undefined : process.argv[i + 1]; };
const LIMIT = Number(argVal("--limit") ?? Infinity);
const ONLY_CHAPTER = argVal("--chapter");

let existing: Record<string, string> = {};
try { ({ hints: existing } = await import(OUT)); } catch { /* first run */ }

// Every taught word/phrase, with the chapter that teaches it — the chapter's OTHER words are what a
// contrast hint can safely reference (the learner has met them in the same breath).
interface Todo { lexKey: string; answer: string; gloss: string; kind: string; note?: string; chapter: string; siblings: string[] }
const todo: Todo[] = [];
const seen = new Set<string>();
for (const content of resolveChapters(pack)) {
  if (ONLY_CHAPTER && content.chapter.id !== ONLY_CHAPTER) continue;
  const siblingsAll = content.vocab.map((v) => `${v.answer} (${v.gloss})`);
  for (const it of content.vocab as ReviewItem[]) {
    const lexKey = deriveKeyForItem(it).lexKey;
    if (seen.has(lexKey)) continue;
    seen.add(lexKey);
    if (existing[lexKey]) continue;
    todo.push({
      lexKey,
      answer: it.answer.trim(),
      gloss: it.gloss,
      kind: it.kind,
      note: it.note,
      chapter: content.chapter.shortTitle,
      siblings: siblingsAll.filter((s) => !s.startsWith(`${it.answer.trim()} (`)).slice(0, 24),
    });
  }
}
console.log(`${seen.size} taught item(s); ${Object.keys(existing).length} already hinted; generating ${Math.min(todo.length, LIMIT)}.`);

const SCHEMA: Record<string, unknown> = {
  type: "object", additionalProperties: false,
  properties: { items: { type: "array", items: {
    type: "object", additionalProperties: false,
    properties: {
      answer: { type: "string", description: "Echo the Macedonian word/phrase EXACTLY as given (used to map the result)." },
      hint: { type: "string", description: "The nudge. One short clause, max ~12 words. MUST NOT contain the target word or any part of it." },
    },
    required: ["answer", "hint"],
  } } },
  required: ["items"],
};

const SYSTEM =
  `You write retrieval HINTS for a beginner learning ${pack.name}. The learner is shown an English prompt and has to ` +
  `produce the ${pack.name} word. Your hint is what they tap when it won't come: it must make the word findable WITHOUT saying it.\n` +
  `Write ONE short clause (max ~12 words), no final period needed.\n` +
  `PREFER a CONTRAST whenever the chapter list holds a natural partner — an opposite, the other half of a pair, the\n` +
  `reply it goes with, or another member of the same set. Name that partner in Cyrillic: "the opposite of лево",\n` +
  `"the one you say after здраво", "comes later than пред". A contrast is the most useful hint because it pins the\n` +
  `word down by what it is NOT.\n` +
  `Otherwise use the SITUATION ("what you say when you didn't catch something", "what the waiter brings at the end")\n` +
  `or a distinguishing FACT ("the drink, not the shop", "the polite one for a stranger").\n` +
  `The hint must ADD something the English prompt doesn't already say — never a re-wording of the gloss.\n` +
  `HARD RULES: never write the target word, any inflected form of it, or its romanization. Never spell it out, give its ` +
  `first letter, its length, or a rhyme. Don't just restate the English gloss — the learner already sees that. When you ` +
  `reference another word, use one from the chapter list provided and write it in Cyrillic. Plain beginner English.`;

interface Result { answer: string; hint: string }

const norm = (s: string) => s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
// A hint leaks if it contains the answer, a long piece of it, or its romanization — check both scripts,
// and stems (≥4 chars) so an inflected form ("кафето" for "кафе") is caught too.
function leaks(hint: string, answer: string): string | null {
  const h = norm(hint);
  const hRom = norm(romanize(hint));
  for (const raw of [answer, romanize(answer)]) {
    for (const tok of norm(raw).split(" ")) {
      if (tok.length < 3) continue;
      const stem = tok.length > 4 ? tok.slice(0, -1) : tok;
      if (h.includes(stem) || hRom.includes(norm(romanize(stem)))) return tok;
    }
  }
  return null;
}

// The model occasionally writes a referenced word in Latin ("not the voz station"). Snap those back to
// Cyrillic so a hint never mixes scripts — the learner is reading Cyrillic. Checked: no romanization of a
// taught single word collides with a common English word, so this can't mangle ordinary hint prose.
const ENGLISH = new Set("the and for you not are was one two out over off per top set way say see now here there near far left right".split(" "));
const cyrillicByRoman = new Map<string, string>();
for (const it of pack.vocab) {
  const a = it.answer.trim();
  if (/\s/.test(a)) continue;
  const r = romanize(a).toLowerCase();
  if (r.length >= 3 && !ENGLISH.has(r) && !cyrillicByRoman.has(r)) cyrillicByRoman.set(r, a);
}
const deLatinize = (hint: string) => hint.replace(/\b[a-zA-Z]{3,}\b/g, (w) => cyrillicByRoman.get(w.toLowerCase()) ?? w);

const out: Record<string, string> = { ...existing };
let cost = 0, failures = 0, leaked = 0;
const work = todo.slice(0, LIMIT);

for (let i = 0; i < work.length; i += BATCH) {
  const batch = work.slice(i, i + BATCH);
  const user = batch
    .map((b, j) =>
      `${j + 1}. "${b.answer}" — means "${b.gloss}" [${b.kind}, chapter: ${b.chapter}]${b.note ? ` (note: ${b.note})` : ""}\n` +
      `   other words in that chapter: ${b.siblings.join(", ") || "(none)"}`)
    .join("\n");
  try {
    const { data, costUsd } = await structuredCall<{ items: Result[] }>({
      model: MODELS.offline,
      system: SYSTEM,
      user: `Write a hint for each:\n${user}`,
      schema: SCHEMA,
      maxTokens: 3000,
    });
    cost += costUsd;
    const byAnswer = new Map(data.items.map((r) => [r.answer.trim(), r]));
    for (let j = 0; j < batch.length; j++) {
      const b = batch[j]!;
      const r = byAnswer.get(b.answer) ?? data.items[j];
      const hint = r?.hint?.trim() ? deLatinize(r.hint.trim()) : undefined;
      if (!hint) { console.warn(`  ⚠ no hint for "${b.answer}"`); failures++; continue; }
      const leak = leaks(hint, b.answer);
      if (leak) { console.warn(`  ⚠ "${b.answer}" → hint leaks "${leak}": ${hint}`); leaked++; continue; }
      if (norm(hint) === norm(b.gloss)) { console.warn(`  ⚠ "${b.answer}" → hint just restates the gloss`); failures++; continue; }
      out[b.lexKey] = hint;
    }
    console.log(`  batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(work.length / BATCH)}: ${batch.length} item(s), $${costUsd.toFixed(4)}`);
  } catch (e) {
    failures += batch.length;
    console.error(`  ✗ batch ${Math.floor(i / BATCH) + 1} failed: ${e instanceof Error ? e.message : e}`);
  }
}

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
const header =
  `// MACHINE-GENERATED by pipeline/src/run-hints.ts (Opus 4.8). One retrieval hint per taught word/phrase,\n` +
  `// keyed by lexKey (normalized surface form). A hint points at the word without containing it — a\n` +
  `// contrast with a chapter-mate, the situation, or a distinguishing fact. Served as pack.hints and\n` +
  `// looked up by lexKey; shown behind "Hint" on a flashcard and in the partnered drill.\n` +
  `// Regenerate/fill gaps with: pipeline/node_modules/.bin/tsx pipeline/src/run-hints.ts\n\n` +
  `export const hints: Record<string, string> = ${JSON.stringify(sorted, null, 2)};\n`;
writeFileSync(OUT, header);
console.log(`\nWrote ${Object.keys(sorted).length} hint(s) to ${OUT}. ${failures} failure(s), ${leaked} rejected for leaking. Total $${cost.toFixed(4)}.`);
