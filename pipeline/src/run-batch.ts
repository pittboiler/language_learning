// Offline batch (generalized from run-mk-batch). Builds a FULL language pack's content from a
// LanguageProfile on Opus 4.8: alphabet onboarding, grammar concepts + drills, vocab, scenarios for
// the shared situation set, and a graded reader — then runs the Validator over every generated
// target-language line. Output is written GATED (confidence:"unreviewed") to packages/pack-bg/src/
// generated.ts (NOT served until promoted) + a review report for the human spot-check queue.
//
// The profile is cached (pipeline/output/profile-<code>.json) — generated once, reused (cost control).
//
// Run (calibrate — alphabet only, no write):  CALIBRATE=1 pipeline/node_modules/.bin/tsx pipeline/src/run-batch.ts
// Run (full batch, writes pack-bg):                       pipeline/node_modules/.bin/tsx pipeline/src/run-batch.ts
import "./env.js";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GlyphLesson, GrammarConcept, ReviewItem, Reader, Scenario, PhonologyRules } from "@ll/pack-schema";
import { macedonian } from "@ll/pack-mk";
import { profile, type LanguageProfile } from "./profiler.js";
import { generateAlphabet, generateGrammar, generateVocab, generateReader } from "./content.js";
import { generateScenario, type Situation, type GenContext } from "./generator.js";
import { validate, summarize, type ValidatableItem, type ValidatorContext, type Verdict } from "./validator.js";
import { lintDrills, type DrillLintIssue } from "./lint.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CODE = process.env.LANG_CODE || "bg";
const CALIBRATE = !!process.env.CALIBRATE;

// The shared situation set (same as Macedonian, so the BG↔MK generality comparison is clean).
// MK hand-authored bar-order + small-talk; for BG we generate all six.
const SITUATIONS: Situation[] = [
  { id: "bar-order-a-drink", title: "Order a drink at a bar", goal: "Greet, order a beer, ask the price, and pay.", setting: "a relaxed bar" },
  { id: "small-talk", title: "Small talk at the bar", goal: "Make small talk: where you're from and what you're learning.", setting: "a bar, chatting with another patron" },
  { id: "directions", title: "Asking for directions", goal: "Ask where a place is and understand the answer.", setting: "a street in the city" },
  { id: "shopping", title: "Buying something at a shop", goal: "Ask for an item, ask the price, and pay.", setting: "a small shop" },
  { id: "introductions", title: "Introducing yourself", goal: "Say your name, where you're from, and what you do.", setting: "meeting someone new" },
  { id: "phone", title: "A short phone call", goal: "Greet, ask for someone, and leave a short message.", setting: "a phone call" },
];

/** Load the cached teaching profile, or generate + cache it. */
async function loadProfile(): Promise<LanguageProfile> {
  const cachePath = join(ROOT, "pipeline", "output", `profile-${CODE}.json`);
  if (existsSync(cachePath)) {
    console.log(`• profile: cached (${cachePath.replace(ROOT + "/", "")})`);
    return JSON.parse(readFileSync(cachePath, "utf8")) as LanguageProfile;
  }
  console.log(`• profile: generating (Opus 4.8)…`);
  const p = await profile(CODE);
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(p, null, 2));
  return p;
}

function scenarioLines(s: Scenario): ValidatableItem[] {
  return s.script
    .filter((t) => t.speaker === "learner")
    .map((t, i) => ({ id: `${s.id}-l${i + 1}`, kind: "scenario-line", text: t.text, gloss: t.gloss }));
}

async function main() {
  const prof = await loadProfile();
  const valCtx: ValidatorContext = { languageName: prof.languageName, stressRule: prof.phonology.stressRule };
  // Profile cost is reported separately by run-profile (and the profile is cached); this tallies the
  // batch's own generation + validation spend only.
  let cost = 0;
  const allVerdicts: Verdict[] = [];

  console.log(`\n=== ${prof.languageName} content batch (Opus 4.8, offline)${CALIBRATE ? " — CALIBRATE (alphabet only, no write)" : ""} ===\n`);

  // --- Alphabet (the most fact-checkable artifact — generate + validate examples) ---
  process.stdout.write(`• alphabet … generating`);
  const alpha = await generateAlphabet(prof);
  cost += alpha.costUsd;
  const alphaItems: ValidatableItem[] = alpha.data.map((g) => ({
    id: `glyph-${g.glyph}`,
    kind: "alphabet-example",
    text: g.examples[0]?.text ?? "",
    gloss: g.examples[0]?.gloss ?? "",
    note: `example word for the letter ${g.glyph} (${g.name})`,
  }));
  // In calibrate mode validate only a small sample (to measure per-item cost cheaply); full batch
  // validates every example.
  const alphaToValidate = CALIBRATE ? alphaItems.slice(0, 3) : alphaItems;
  process.stdout.write(` (${alpha.data.length} letters) · validating ${alphaToValidate.length} example(s)`);
  const alphaVerdicts = await validate(alphaToValidate, valCtx);
  allVerdicts.push(...alphaVerdicts);
  const alphaValCost = summarize(alphaVerdicts).costUsd;
  cost += alphaValCost;
  console.log(` · ${summarize(alphaVerdicts).flagged} flagged  (running $${cost.toFixed(3)})`);

  // Hard inventory check (verifiable without speaking the language).
  const glyphs = alpha.data.map((g) => g.glyph);
  const mkUnique = ["Ѓ", "Ќ", "Ѕ", "Ј", "Љ", "Њ", "Џ"];
  const bgSignature = ["Ъ", "Щ", "Ь"];
  const leaked = mkUnique.filter((u) => glyphs.includes(u));
  const missing = CODE === "bg" ? bgSignature.filter((s) => !glyphs.map((g) => g.toUpperCase()).includes(s)) : [];
  console.log(`  inventory: ${alpha.data.length} letters · MK-unique present: [${leaked.join(" ") || "none ✓"}] · BG-signature missing: [${missing.join(" ") || "none ✓"}]`);

  if (CALIBRATE) {
    console.log(`\n--- generated alphabet ---`);
    for (const g of alpha.data) console.log(`  ${g.glyph}  ${g.name}  ${g.sound}  ·  ${g.examples[0]?.text} (${g.examples[0]?.gloss})${g.unique ? " [unique]" : ""}${g.falseFriend ? " [false-friend]" : ""}`);
    const perValidate = alphaValCost / Math.max(1, alphaToValidate.length);
    const estGen = alpha.costUsd * 10; // ~10 generation calls: alphabet + grammar + vocab + reader + 6 scenarios
    const estValidate = perValidate * 95; // ~95 validated target-language lines across the whole pack
    const estTotal = estGen + estValidate;
    console.log(`\n=== CALIBRATE done · alphabet gen $${alpha.costUsd.toFixed(4)} + ${alphaToValidate.length} validations $${alphaValCost.toFixed(4)}. No files written. ===`);
    console.log(`  Per-line validation ≈ $${perValidate.toFixed(4)}. Est. FULL batch ≈ $${estTotal.toFixed(2)}  (gen ~$${estGen.toFixed(2)} / ~10 calls + validation ~$${estValidate.toFixed(2)} / ~95 lines).\n`);
    return;
  }

  // --- Grammar concepts + drills ---
  process.stdout.write(`• grammar … generating`);
  const gram = await generateGrammar(prof);
  cost += gram.costUsd;
  const gramItems: ValidatableItem[] = gram.data.flatMap((c) => [
    ...c.examples.map((ex, i) => ({ id: `${c.id}-ex${i + 1}`, kind: "grammar-example", text: ex, note: c.name })),
    ...c.drills.map((d) => ({ id: d.id, kind: "grammar-drill", text: d.answer, gloss: d.gloss, note: d.prompt })),
  ]);
  process.stdout.write(` (${gram.data.length} concepts) · validating`);
  const gramVerdicts = await validate(gramItems, valCtx);
  allVerdicts.push(...gramVerdicts);
  cost += summarize(gramVerdicts).costUsd;
  console.log(` · ${summarize(gramVerdicts).flagged} flagged  (running $${cost.toFixed(3)})`);
  // Structural lint (free, no LLM): catches malformed multiple-choice the line Validator can't see.
  const drillIssues = lintDrills(gram.data);
  if (drillIssues.length) console.log(`  ⚠ ${drillIssues.length} structural drill issue(s) — see review-${CODE}.md`);

  // --- Vocab ---
  process.stdout.write(`• vocab … generating`);
  const voc = await generateVocab(prof);
  cost += voc.costUsd;
  const vocItems: ValidatableItem[] = voc.data.map((v) => ({ id: v.id, kind: "vocab", text: v.answer, gloss: v.gloss }));
  process.stdout.write(` (${voc.data.length} items) · validating`);
  const vocVerdicts = await validate(vocItems, valCtx);
  allVerdicts.push(...vocVerdicts);
  cost += summarize(vocVerdicts).costUsd;
  console.log(` · ${summarize(vocVerdicts).flagged} flagged  (running $${cost.toFixed(3)})`);

  // --- Scenarios (shared situation set; MK order-a-drink as the style/format anchor) ---
  const refScenario = macedonian.scenarios.find((s) => s.id === "bar-order-a-drink") ?? macedonian.scenarios[0]!;
  const genCtx: GenContext = { languageName: prof.languageName, referenceScenario: refScenario, grammarConceptIds: gram.data.map((c) => c.id) };
  const scenarios: Scenario[] = [];
  const scenarioVocab: ReviewItem[] = [];
  for (const sit of SITUATIONS) {
    process.stdout.write(`• scenario "${sit.title}" … generating`);
    try {
      const g = await generateScenario(sit, genCtx);
      cost += g.costUsd;
      process.stdout.write(` · validating`);
      const items: ValidatableItem[] = [...scenarioLines(g.scenario), ...g.vocab.map((v) => ({ id: v.id, kind: "vocab", text: v.answer, gloss: v.gloss }))];
      const verdicts = await validate(items, valCtx);
      allVerdicts.push(...verdicts);
      cost += summarize(verdicts).costUsd;
      scenarios.push(g.scenario);
      scenarioVocab.push(...g.vocab);
      console.log(` · ${summarize(verdicts).flagged} flagged  (running $${cost.toFixed(3)})`);
    } catch (e) {
      console.log(` · ✗ FAILED: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // --- Reader ---
  process.stdout.write(`• reader … generating`);
  const read = await generateReader(prof);
  cost += read.costUsd;
  const readItems: ValidatableItem[] = read.data.body.map((l, i) => ({ id: `reader-l${i + 1}`, kind: "reader-line", text: l.text, gloss: l.gloss }));
  process.stdout.write(` (${read.data.body.length} lines) · validating`);
  const readVerdicts = await validate(readItems, valCtx);
  allVerdicts.push(...readVerdicts);
  cost += summarize(readVerdicts).costUsd;
  console.log(` · ${summarize(readVerdicts).flagged} flagged  (running $${cost.toFixed(3)})`);

  // --- Assemble + write the gated generated.ts ---
  const phonology: PhonologyRules = prof.phonology;
  const allVocab: ReviewItem[] = [...voc.data, ...scenarioVocab];
  const flagged = allVerdicts.filter((v) => !v.ok);
  writeGenerated({ alphabet: alpha.data, phonology, grammar: gram.data, vocab: allVocab, scenarios, reader: read.data, verdicts: allVerdicts });
  writeReview(prof.languageName, { alphabet: alpha.data.length, grammar: gram.data.length, vocab: allVocab.length, scenarios: scenarios.length, readerLines: read.data.body.length }, flagged, drillIssues, cost);

  console.log(`\n=== done · $${cost.toFixed(3)} total ===`);
  console.log(`  wrote packages/pack-${CODE}/src/generated.ts (gated, confidence:"unreviewed")`);
  console.log(`  wrote pipeline/output/review-${CODE}.md (${flagged.length} flagged for spot-check)\n`);
}

function writeGenerated(d: {
  alphabet: GlyphLesson[];
  phonology: PhonologyRules;
  grammar: GrammarConcept[];
  vocab: ReviewItem[];
  scenarios: Scenario[];
  reader: Reader;
  verdicts: Verdict[];
}) {
  const outDir = join(ROOT, "packages", `pack-${CODE}`, "src");
  mkdirSync(outDir, { recursive: true });
  const flagged = d.verdicts.filter((v) => !v.ok).length;
  const header =
    `// MACHINE-GENERATED (Opus 4.8), confidence:"unreviewed" — GATED, not served until a native spot-check.\n` +
    `// ${d.alphabet.length} letters · ${d.grammar.length} grammar concepts · ${d.vocab.length} vocab · ${d.scenarios.length} scenarios · 1 reader.\n` +
    `// Validator flagged ${flagged} item(s) — see validatorReport + pipeline/output/review-${CODE}.md.\n`;
  const body =
    `import type { GlyphLesson, PhonologyRules, GrammarConcept, ReviewItem, Scenario, Reader } from "@ll/pack-schema";\n\n` +
    `export const generatedAlphabet: GlyphLesson[] = ${JSON.stringify(d.alphabet, null, 2)};\n\n` +
    `export const generatedPhonology: PhonologyRules = ${JSON.stringify(d.phonology, null, 2)};\n\n` +
    `export const generatedGrammar: GrammarConcept[] = ${JSON.stringify(d.grammar, null, 2)};\n\n` +
    `export const generatedVocab: ReviewItem[] = ${JSON.stringify(d.vocab, null, 2)};\n\n` +
    `export const generatedScenarios: Scenario[] = ${JSON.stringify(d.scenarios, null, 2)};\n\n` +
    `export const generatedReader: Reader = ${JSON.stringify(d.reader, null, 2)};\n\n` +
    `export const validatorReport = ${JSON.stringify(d.verdicts.map((v) => ({ itemId: v.itemId, ok: v.ok, issues: v.issues, corrected: v.corrected })), null, 2)} as const;\n`;
  writeFileSync(join(outDir, "generated.ts"), header + body);
}

function writeReview(lang: string, counts: Record<string, number>, flagged: Verdict[], drillIssues: DrillLintIssue[], cost: number) {
  const lines = [
    `# ${lang} generated content — spot-check queue`,
    ``,
    `Generated: ${counts.alphabet} alphabet letters · ${counts.grammar} grammar concepts · ${counts.vocab} vocab · ${counts.scenarios} scenarios · ${counts.readerLines}-line reader.`,
    `**${flagged.length}** item(s) flagged by the Validator (content correctness):`,
    ``,
    ...flagged.map((v) => `- \`${v.itemId}\`: ${v.issues.join("; ")}${v.corrected ? `  → suggested: \`${v.corrected}\`` : ""}`),
    flagged.length === 0 ? `- (none flagged — but still needs a native review before promotion)` : ``,
    ``,
    `**${drillIssues.length}** structural drill issue(s) (malformed multiple-choice — the line Validator can't see these):`,
    ``,
    ...drillIssues.map((i) => `- \`${i.conceptId}/${i.drillId}\` [${i.kind}]: ${i.detail}`),
    drillIssues.length === 0 ? `- (none)` : ``,
    ``,
    `Everything stays \`confidence:"unreviewed"\` and is NOT imported by the served pack until promoted. Total Opus cost: ~$${cost.toFixed(3)}.`,
  ];
  const outDir = join(ROOT, "pipeline", "output");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `review-${CODE}.md`), lines.join("\n"));
}

main().catch((e) => {
  console.error("batch failed:", e);
  process.exit(1);
});
