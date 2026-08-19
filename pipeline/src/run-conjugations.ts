// Offline generator: present-tense paradigms for the pack's VERBS, backing the Build-a-sentence
// conjugation tabs (I/you/we/they). Feeds it every single-word vocab entry; Opus (temp 0) flags which
// are verbs and returns the 6-person paradigm + verb class. Idempotent: skips lemmas already in
// conjugations.ts (resume). Writes packages/pack-mk/src/conjugations.ts, spot-checked like other content.
//
// Run:  pipeline/node_modules/.bin/tsx pipeline/src/run-conjugations.ts
import "./env.js";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ConjugationSet, ReviewItem } from "@ll/pack-schema";
import { macedonian } from "@ll/pack-mk";
import { structuredCall, MODELS } from "@ll/core/llm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "packages", "pack-mk", "src", "conjugations.ts");
const BATCH = 14;
const pack = macedonian;

// Try to resume from an existing file so a re-run only fills gaps.
let existing: ConjugationSet[] = [];
try { ({ conjugations: existing } = await import(join(ROOT, "packages", "pack-mk", "src", "conjugations.ts"))); } catch { /* first run */ }
const have = new Set(existing.map((c) => c.lemma));
// Every lemma AND inflected form already covered — so a resume skips words that are just another person
// of a verb we already have (e.g. "имам" when "има" is done), instead of re-scanning the whole vocab.
const haveForms = new Set(existing.flatMap((c) => [c.lemma, ...Object.values(c.forms)]));

// Core verbs the curriculum teaches inside sentences (not as standalone vocab lemmas) — seed them so the
// conjugation set covers the verbs learners actually meet (сака/want is the flagship grammar example).
const VERB_SEED: { answer: string; gloss: string }[] = [
  { answer: "сака", gloss: "want" },
  { answer: "може", gloss: "can" },
  { answer: "треба", gloss: "need / should" },
  { answer: "јаде", gloss: "eat" },
  { answer: "чини", gloss: "cost" },
  { answer: "прашува", gloss: "ask" },
  { answer: "дава", gloss: "give" },
  { answer: "зема", gloss: "take" },
  { answer: "живее", gloss: "live" },
  { answer: "купува", gloss: "buy" },
  { answer: "плаќа", gloss: "pay" },
];

// Unique single-word vocab, skipping proper-noun-ish capitalized tokens (names aren't verbs).
const seen = new Set<string>();
const words: { answer: string; gloss: string }[] = [];
for (const w of VERB_SEED) { if (!seen.has(w.answer)) { seen.add(w.answer); words.push(w); } }
for (const it of pack.vocab as ReviewItem[]) {
  const a = it.answer.trim();
  if (it.kind !== "vocab" || /\s/.test(a) || seen.has(a)) continue;
  seen.add(a);
  words.push({ answer: a, gloss: it.gloss });
}
const todo = words.filter((w) => !haveForms.has(w.answer));
console.log(`${words.length} single words; ${existing.length} verbs already done; scanning ${todo.length}.`);

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
          input: { type: "string", description: "Echo the Macedonian word EXACTLY as given (used to map the result)." },
          isVerb: { type: "boolean", description: "True only if this word is a verb that conjugates in the present tense." },
          lemma: { type: "string", description: "Dictionary/base form (the 3sg present, e.g. сака). Empty if not a verb." },
          gloss: { type: "string", description: "Concise English meaning (e.g. 'want'). Empty if not a verb." },
          group: { type: "string", enum: ["a", "e", "i", "irregular"], description: "Present-tense class by theme vowel: -а, -е, -и, or irregular (e.g. сум)." },
          forms: {
            type: "object",
            additionalProperties: false,
            description: "Present-tense forms by person. Empty strings if not a verb.",
            properties: {
              "1sg": { type: "string", description: "I (јас) form, e.g. сакам" },
              "2sg": { type: "string", description: "you (ти) form, e.g. сакаш" },
              "3sg": { type: "string", description: "he/she/it (тој/таа) form, e.g. сака" },
              "1pl": { type: "string", description: "we (ние) form, e.g. сакаме" },
              "2pl": { type: "string", description: "you all (вие) form, e.g. сакате" },
              "3pl": { type: "string", description: "they (тие) form, e.g. сакаат" },
            },
            required: ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"],
          },
        },
        required: ["input", "isVerb", "lemma", "gloss", "group", "forms"],
      },
    },
  },
  required: ["items"],
};

interface Row { input: string; isVerb: boolean; lemma: string; gloss: string; group: string; forms: ConjugationSet["forms"] }

const out: ConjugationSet[] = [...existing];
let cost = 0;
let added = 0;
for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  try {
    const { data, costUsd } = await structuredCall<{ items: Row[] }>({
      model: MODELS.offline, // Opus — morphology must be correct
      maxTokens: 4000,
      system:
        "You are a precise Macedonian morphology engine. For each given word, decide if it is a present-tense verb. " +
        "If it is, give its dictionary form (3sg present), a short English gloss, its class (-а/-е/-и/irregular), and the full " +
        "present-tense paradigm for all six persons. Use standard literary Macedonian. If a word is not a verb, set isVerb=false " +
        "and leave the string fields empty. Never invent a verb from a non-verb.",
      user: `Words:\n${batch.map((w) => `${w.answer} — ${w.gloss}`).join("\n")}`,
      schema: SCHEMA,
    });
    cost += costUsd;
    for (const r of data.items) {
      if (!r.isVerb || !r.forms?.["1sg"]?.trim()) continue;
      const lemma = (r.lemma || r.input).trim();
      if (have.has(lemma)) continue;
      have.add(lemma);
      out.push({ lemma, gloss: r.gloss.trim(), group: r.group || "irregular", forms: r.forms, conceptId: "verb-conjugation", confidence: "unreviewed" });
      added++;
    }
    console.log(`  batch ${Math.floor(i / BATCH) + 1}: ${batch.length} word(s), +${added} verbs so far, $${costUsd.toFixed(4)}`);
  } catch (e) {
    console.error(`  ✗ batch ${Math.floor(i / BATCH) + 1} failed: ${e instanceof Error ? e.message : e}`);
  }
}

out.sort((a, b) => a.lemma.localeCompare(b.lemma));
const header =
  `// MACHINE-GENERATED by pipeline/src/run-conjugations.ts (Opus 4.8). Present-tense verb paradigms for the\n` +
  `// Build-a-sentence conjugation tabs. Spot-check + flip confidence to "validated" as you review.\n` +
  `// Regenerate/fill gaps with: pipeline/node_modules/.bin/tsx pipeline/src/run-conjugations.ts\n` +
  `import type { ConjugationSet } from "@ll/pack-schema";\n\n` +
  `export const conjugations: ConjugationSet[] = ${JSON.stringify(out, null, 2)};\n`;
writeFileSync(OUT, header);
console.log(`\nWrote ${out.length} verb paradigm(s) to ${OUT} (+${added} new). Total $${cost.toFixed(4)}.`);
