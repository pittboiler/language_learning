// Offline generator: for every MULTI-WORD phrase/chunk in a pack, author a word-by-word breakdown +
// a one-line "how it fits" grammar takeaway, shown on the flashcard reveal (PhraseBreakdown). Opus,
// temperature 0 (reproducible), batched to cut calls. Idempotent: skips answers already in
// breakdowns.ts, so a re-run only fills gaps. Writes packages/pack-mk/src/breakdowns.ts.
//
// Run:  pipeline/node_modules/.bin/tsx pipeline/src/run-breakdowns.ts
import "./env.js";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReviewItem } from "@ll/pack-schema";
import { macedonian } from "@ll/pack-mk";
import { breakdowns as existing, type PhraseBreakdownData } from "../../packages/pack-mk/src/breakdowns.js";
import { structuredCall, MODELS } from "@ll/core/llm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "packages", "pack-mk", "src", "breakdowns.ts");
const BATCH = 12;

const pack = macedonian;

// Unique multi-word answers across the served review items (vocab + seed), skipping ones already done.
const isMultiWord = (a: string) => a.trim().split(/\s+/).length > 1;
const seen = new Set<string>();
const todo: { answer: string; gloss: string; translit: string }[] = [];
for (const it of [...pack.vocab, ...pack.srsSeed] as ReviewItem[]) {
  const answer = it.answer.trim();
  if (!isMultiWord(answer) || seen.has(answer)) continue;
  seen.add(answer);
  if (existing[answer]) continue; // resume: already generated
  todo.push({ answer, gloss: it.gloss, translit: it.translit ?? "" });
}

console.log(`${seen.size} unique multi-word phrase(s); ${Object.keys(existing).length} already done; generating ${todo.length}.`);

const SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          answer: { type: "string", description: "Echo the Macedonian phrase EXACTLY as given (used to map the result)." },
          breakdown: {
            type: "array",
            description: "Each meaningful piece of the phrase, IN ORDER, mapped to a concise English meaning.",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                part: { type: "string", description: "A surface chunk of the Macedonian phrase (a word, or a small clitic/particle cluster)." },
                gloss: { type: "string", description: "Concise English meaning of that piece (1-4 words)." },
              },
              required: ["part", "gloss"],
            },
          },
          takeaway: { type: "string", description: "ONE short plain-English sentence (max ~22 words) on how the pieces combine — word order, clitic position, agreement, or the role of a particle (ќе/да/нека/се). No jargon a beginner won't know." },
        },
        required: ["answer", "breakdown", "takeaway"],
      },
    },
  },
  required: ["items"],
};

const conceptList = pack.grammar.map((c) => c.name).join("; ");
const SYSTEM =
  `You explain short ${pack.name} phrases to an absolute-beginner English speaker. For EACH phrase you are given, return:\n` +
  `1) a word-by-word breakdown: split the phrase into its meaningful pieces IN ORDER (keep a proclitic like ме/му/се or a particle like ќе/да/нека as its own piece), each with a concise English meaning;\n` +
  `2) ONE short, plain-English takeaway naming how the pieces fit together grammatically (word order, where the little pronoun sits, gender/number agreement, the job of a particle). Keep it concrete and jargon-light.\n` +
  `Use the provided English gloss as the intended meaning. Be accurate, natural, and standard Macedonian. These grammar themes exist in the course if useful for framing: ${conceptList}.`;

interface Result { answer: string; breakdown: { part: string; gloss: string }[]; takeaway: string }

const out: Record<string, PhraseBreakdownData> = { ...existing };
let cost = 0;
let failures = 0;

for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  const user = batch.map((b, j) => `${j + 1}. "${b.answer}" — means "${b.gloss}"${b.translit ? ` (${b.translit})` : ""}`).join("\n");
  try {
    const { data, costUsd } = await structuredCall<{ items: Result[] }>({
      model: MODELS.offline, // Opus deprecates `temperature`; authored-once content doesn't need it anyway
      system: SYSTEM,
      user: `Phrases:\n${user}`,
      schema: SCHEMA,
      maxTokens: 4000,
    });
    cost += costUsd;
    const byAnswer = new Map(data.items.map((r) => [r.answer.trim(), r]));
    for (let j = 0; j < batch.length; j++) {
      const b = batch[j]!;
      const r = byAnswer.get(b.answer) ?? data.items[j]; // echo match, else positional fallback
      if (!r || !r.breakdown?.length || !r.takeaway?.trim()) {
        console.warn(`  ⚠ no usable breakdown for "${b.answer}"`);
        failures++;
        continue;
      }
      out[b.answer] = { breakdown: r.breakdown.map((p) => ({ part: p.part, gloss: p.gloss })), takeaway: r.takeaway.trim() };
    }
    console.log(`  batch ${i / BATCH + 1}: ${batch.length} phrase(s), $${costUsd.toFixed(4)}`);
  } catch (e) {
    failures += batch.length;
    console.error(`  ✗ batch ${i / BATCH + 1} failed: ${e instanceof Error ? e.message : e}`);
  }
}

// Emit a stable, key-sorted file so re-runs produce minimal diffs.
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
const header =
  `// MACHINE-GENERATED by pipeline/src/run-breakdowns.ts (Opus 4.8). Word-by-word breakdowns + a one-line\n` +
  `// "how it fits" grammar takeaway for the pack's multi-word phrases/chunks, keyed by the exact (trimmed)\n` +
  `// \`answer\` string. Merged onto review items in index.ts and shown on the flashcard reveal\n` +
  `// (PhraseBreakdown). Regenerate with: pipeline/node_modules/.bin/tsx pipeline/src/run-breakdowns.ts\n` +
  `export interface PhraseBreakdownData {\n  breakdown: { part: string; gloss: string }[];\n  takeaway: string;\n}\n\n` +
  `export const breakdowns: Record<string, PhraseBreakdownData> = ${JSON.stringify(sorted, null, 2)};\n`;
writeFileSync(OUT, header);

console.log(`\nWrote ${Object.keys(sorted).length} breakdown(s) to ${OUT}. ${failures} failure(s). Total $${cost.toFixed(4)}.`);
