// Offline generator for the "Build a sentence" tile exercise. For each pack verb (with a paradigm), author
// ONE natural, very-simple beginner sentence built from that verb + only taught complement words, given for
// all six persons (MK + correct-agreement English). Opus, spot-checked like other content. Idempotent:
// skips verbs already in sentences.ts. Writes packages/pack-mk/src/sentences.ts.
//
// Run:  pipeline/node_modules/.bin/tsx pipeline/src/run-sentences.ts
import "./env.js";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { SentenceItem, ReviewItem } from "@ll/pack-schema";
import { macedonian } from "@ll/pack-mk";
import { structuredCall, MODELS } from "@ll/core/llm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "packages", "pack-mk", "src", "sentences.ts");
const BATCH = 6;
const pack = macedonian;

let existing: SentenceItem[] = [];
try { ({ sentences: existing } = await import(OUT)); } catch { /* first run */ }
const have = new Set(existing.map((x) => x.verbLemma).filter(Boolean));

// Allowed complement words: single-word taught vocab (nouns/adjectives/etc). The model may only use these
// (plus the verb) so every generated sentence stays within taught vocabulary.
const allow = new Map<string, string>();
for (const it of pack.vocab as ReviewItem[]) {
  const a = it.answer.trim();
  if (it.kind === "vocab" && !/\s/.test(a) && !allow.has(a)) allow.set(a, it.gloss);
}
const allowList = [...allow.entries()].map(([w, g]) => `${w} (${g})`).join(", ");

const verbs = (pack.conjugations ?? []).filter((v) => !have.has(v.lemma));
console.log(`${(pack.conjugations ?? []).length} verbs; ${existing.length} already have sentences; generating ${verbs.length}.`);

const SCHEMA: Record<string, unknown> = {
  type: "object", additionalProperties: false,
  properties: { items: { type: "array", items: {
    type: "object", additionalProperties: false,
    properties: {
      verbLemma: { type: "string", description: "Echo the verb's dictionary form EXACTLY (maps the result)." },
      supportWords: { type: "array", items: { type: "string" }, description: "The non-verb Macedonian content words used (each must come from the allowed list)." },
      conceptIds: { type: "array", items: { type: "string" }, description: "Grammar exercised — always include 'verb-conjugation'; add 'definite-articles' if a word takes -от/-та/-то, etc." },
      variants: { type: "array", description: "Exactly six, one per person, IN ORDER 1sg,2sg,3sg,1pl,2pl,3pl.", items: {
        type: "object", additionalProperties: false,
        properties: {
          person: { type: "string", enum: ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"] },
          en: { type: "string", description: "English prompt with correct agreement, e.g. 'I want coffee' / 'he/she wants coffee'." },
          mk: { type: "string", description: "The Macedonian sentence for that person (pronoun optional; verb form must match)." },
        },
        required: ["person", "en", "mk"],
      } },
    },
    required: ["verbLemma", "supportWords", "conceptIds", "variants"],
  } } },
  required: ["items"],
};

interface Row { verbLemma: string; supportWords: string[]; conceptIds: string[]; variants: { person: SentenceItem["variants"][number]["person"]; en: string; mk: string }[] }

const out: SentenceItem[] = [...existing];
let cost = 0, added = 0;
for (let i = 0; i < verbs.length; i += BATCH) {
  const batch = verbs.slice(i, i + BATCH);
  try {
    const { data, costUsd } = await structuredCall<{ items: Row[] }>({
      model: MODELS.offline,
      maxTokens: 4000,
      system:
        "You write ONE natural, very simple beginner Macedonian sentence for each given verb — just the verb plus a short " +
        "complement drawn ONLY from the allowed word list (no other content words). Give the sentence for all six persons " +
        "in order (1sg,2sg,3sg,1pl,2pl,3pl), each with the correctly-agreeing English. Macedonian normally drops the subject " +
        "pronoun; that's fine. Keep it 2-4 words. Return the non-verb content words you used in supportWords.",
      user: `Allowed complement words: ${allowList}\n\nVerbs (lemma — gloss — forms 1sg/2sg/3sg/1pl/2pl/3pl):\n` +
        batch.map((v) => `${v.lemma} — ${v.gloss} — ${v.forms["1sg"]}/${v.forms["2sg"]}/${v.forms["3sg"]}/${v.forms["1pl"]}/${v.forms["2pl"]}/${v.forms["3pl"]}`).join("\n"),
      schema: SCHEMA,
    });
    cost += costUsd;
    for (const r of data.items) {
      const lemma = (r.verbLemma || "").trim();
      if (!lemma || have.has(lemma) || (r.variants?.length ?? 0) < 6) continue;
      have.add(lemma);
      out.push({
        id: `sent-${lemma}`,
        conceptIds: [...new Set([...(r.conceptIds || []), "verb-conjugation"])],
        verbLemma: lemma,
        supportWords: (r.supportWords || []).filter((w) => allow.has(w.trim())),
        variants: r.variants.map((v) => ({ person: v.person, en: v.en.trim(), mk: v.mk.trim() })),
        confidence: "unreviewed",
      });
      added++;
    }
    console.log(`  batch ${Math.floor(i / BATCH) + 1}: ${batch.length} verb(s), +${added} so far, $${costUsd.toFixed(4)}`);
  } catch (e) {
    console.error(`  ✗ batch ${Math.floor(i / BATCH) + 1} failed: ${e instanceof Error ? e.message : e}`);
  }
}

out.sort((a, b) => a.id.localeCompare(b.id));
const header =
  `// MACHINE-GENERATED by pipeline/src/run-sentences.ts (Opus 4.8). "Build a sentence" items — one simple\n` +
  `// sentence per verb across all six persons, using only taught complement words. Spot-check + flip\n` +
  `// confidence to "validated". Regenerate/fill gaps with: pipeline/node_modules/.bin/tsx pipeline/src/run-sentences.ts\n` +
  `import type { SentenceItem } from "@ll/pack-schema";\n\n` +
  `export const sentences: SentenceItem[] = ${JSON.stringify(out, null, 2)};\n`;
writeFileSync(OUT, header);
console.log(`\nWrote ${out.length} sentence item(s) to ${OUT} (+${added}). Total $${cost.toFixed(4)}.`);
