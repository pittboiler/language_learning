// Offline generator for the core single-word vocabulary (the served set is thin on single words —
// mostly phrases). ADDITIVE + SEED-DRIVEN: reads the existing words.ts, and for every word in SEED that
// isn't already served, asks Opus to fill accurate metadata (romanization, gloss, gender, note), then
// merges + writes packages/pack-mk/src/words.ts. Re-running only ADDS what's missing, so it never churns
// existing entries — grow the set by extending SEED and re-running.
//
// Run:  pipeline/node_modules/.bin/tsx pipeline/src/run-words.ts
import "./env.js";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReviewItem } from "@ll/pack-schema";
import { macedonian } from "@ll/pack-mk";
import { coreWords as existingWords } from "../../packages/pack-mk/src/words.js";
import { normalize } from "@ll/core/familiarity";
import { structuredCall, MODELS } from "@ll/core/llm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "packages", "pack-mk", "src", "words.ts");
const BATCH = 20;

// Compute transliteration deterministically from the Cyrillic in the app's standard sh/ch/kj style, so
// every card matches the rest of the app (the LLM sometimes returns academic diacritics like č/š/ḱ).
// Mirrors apps/web/lib/romanize.ts.
const ROMAN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ѓ: "gj", е: "e", ж: "zh", з: "z", ѕ: "dz", и: "i", ј: "y",
  к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t", ќ: "kj",
  у: "u", ф: "f", х: "h", ц: "c", ч: "ch", џ: "dj", ш: "sh", ѐ: "e", ѝ: "i",
};
const romanize = (text: string): string => {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const m = ROMAN[lower];
    if (!m) { out += ch; continue; }
    out += ch === lower ? m : m.charAt(0).toUpperCase() + m.slice(1);
  }
  return out;
};

// The single words to ENSURE exist as standalone cards, grouped by the theme header they show under.
// Content words (nouns/verbs/adjectives) were seeded earlier; this list adds the grammatical building
// blocks a beginner needs first — pronouns, question words, prepositions, conjunctions, particles, numbers.
const SEED: Record<string, string[]> = {
  "pronouns": ["јас", "ти", "тој", "таа", "тоа", "ние", "вие", "тие"],
  "possessives": ["мој", "твој", "негов", "нејзин", "наш", "ваш", "нивен"],
  "this & that": ["ова", "она", "овој", "оваа"],
  "question words": ["кој", "што", "каде", "кога", "како", "зошто", "колку", "чиј"],
  "prepositions": ["во", "на", "со", "од", "до", "за", "кај", "под", "над", "пред", "по", "без", "околу"],
  "conjunctions": ["и", "или", "ама", "но", "затоа", "дека", "ако", "бидејќи", "кога", "додека"],
  "common adverbs": ["ќе", "сега", "веќе", "тука", "таму", "многу", "малку", "само", "исто", "повеќе", "можеби", "секогаш", "никогаш", "добро", "лошо", "брзо", "полека"],
  "numbers": ["нула", "еден", "два", "три", "четири", "пет", "шест", "седум", "осум", "девет", "десет", "сто", "илјада"],
};

const pack = macedonian;
// Skip anything already served as a single-word card (elsewhere in the pack, or already in words.ts).
const served = new Set([...pack.vocab, ...existingWords].map((v) => normalize(v.answer)));

interface Seeded { answer: string; theme: string }
const seen = new Set<string>();
const todo: Seeded[] = [];
for (const [theme, list] of Object.entries(SEED)) {
  for (const answer of list) {
    const key = normalize(answer);
    if (seen.has(key)) continue;
    seen.add(key);
    if (served.has(key)) continue;
    todo.push({ answer, theme });
  }
}

console.log(`${existingWords.length} existing core word(s); ${todo.length} building-block(s) to add.`);
if (todo.length === 0) { console.log("nothing to add — SEED already fully served."); process.exit(0); }

const SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    words: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          answer: { type: "string", description: "Echo the Macedonian word EXACTLY as given." },
          translit: { type: "string", description: "Romanization." },
          gloss: { type: "string", description: "Concise English meaning (1-4 words)." },
          gender: { type: "string", description: "For a NOUN only: masculine | feminine | neuter. Empty string otherwise (pronouns, particles, numbers, etc.)." },
          note: { type: "string", description: "Optional short usage note (what it's for / how it behaves), or empty string." },
        },
        required: ["answer", "translit", "gloss", "gender", "note"],
      },
    },
  },
  required: ["words"],
};

const SYSTEM =
  `You prepare beginner ${pack.name} flashcards for common grammatical building-block words (pronouns, ` +
  `question words, prepositions, conjunctions, particles, numbers). For EACH given word return an accurate ` +
  `romanization, a concise English gloss, gender (nouns only, else ""), and an optional short usage note. ` +
  `Use standard Macedonian. For a particle/clitic gloss its function briefly (e.g. "ќе" → "will (future marker)").`;

const generated: ReviewItem[] = [];
let cost = 0;
for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  const { data, costUsd } = await structuredCall<{ words: { answer: string; translit: string; gloss: string; gender: string; note: string }[] }>({
    model: MODELS.offline,
    system: SYSTEM,
    user: `Words:\n${batch.map((b, j) => `${j + 1}. ${b.answer}`).join("\n")}`,
    schema: SCHEMA,
    maxTokens: 3000,
  });
  cost += costUsd;
  const byAnswer = new Map(data.words.map((w) => [w.answer.trim(), w]));
  for (const b of batch) {
    const w = byAnswer.get(b.answer);
    if (!w || !w.gloss?.trim()) { console.warn(`  ⚠ no metadata for ${b.answer}`); continue; }
    const slug = romanize(b.answer).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `w${generated.length}`;
    generated.push({
      id: `word-${slug}`,
      kind: "vocab",
      prompt: w.gloss,
      answer: b.answer,
      translit: romanize(b.answer),
      gloss: w.gloss,
      ...(w.note?.trim() ? { note: w.note.trim() } : {}),
      i1Level: 1,
      tags: [b.theme],
      ...(w.gender?.trim() ? { meta: { gender: w.gender.trim() } } : {}),
      confidence: "validated" as const,
    });
  }
  console.log(`  batch ${i / BATCH + 1}: +${batch.length}, $${costUsd.toFixed(4)}`);
}

// Merge existing + new; ids are answer-derived so a collision is the same word (new wins). Normalize
// existing translits through the same romanizer so the whole set is one consistent style.
const byId = new Map<string, ReviewItem>();
for (const w of [...existingWords.map((w) => ({ ...w, translit: romanize(w.answer) })), ...generated]) byId.set(w.id, w);
const items = [...byId.values()].sort((a, b) => (a.tags[0]! + a.translit).localeCompare(b.tags[0]! + b.translit));

const header =
  `// MACHINE-GENERATED by pipeline/src/run-words.ts (Opus 4.8). Themed high-frequency single Macedonian\n` +
  `// words that expand the flashcard vocabulary, deduped against the rest of the pack. Merged into \`vocab\`\n` +
  `// in index.ts. Spot-check before trusting as authoritative. Additive — grow by extending SEED and\n` +
  `// re-running: pipeline/node_modules/.bin/tsx pipeline/src/run-words.ts\n` +
  `import type { ReviewItem } from "@ll/pack-schema";\n\n` +
  `export const coreWords: ReviewItem[] = ${JSON.stringify(items, null, 2)};\n`;
writeFileSync(OUT, header);

console.log(`\nWrote ${items.length} words (${generated.length} new) to ${OUT}. $${cost.toFixed(4)}.`);
