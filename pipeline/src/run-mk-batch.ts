// Offline batch: generate a small set of new Macedonian scenarios (+ vocab) for everyday situations,
// anchored to the authored order-a-drink reference, then run the Validator over every generated line.
// Output is written GATED (confidence: "unreviewed") to packages/pack-mk/src/generated.ts — NOT wired
// into the served pack — plus a console summary + a review report for Jake's native spot-check.
//
// Run:  ANTHROPIC_API_KEY=... pipeline/node_modules/.bin/tsx pipeline/src/run-mk-batch.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Scenario, ReviewItem } from "@ll/pack-schema";
import { macedonian as mk } from "@ll/pack-mk";
import { generateScenario, type Situation, type GenContext } from "./generator.js";
import { validate, summarize, type ValidatableItem, type ValidatorContext, type Verdict } from "./validator.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const SITUATIONS: Situation[] = [
  { id: "directions", title: "Asking for directions", goal: "Ask where a place is and understand the answer.", setting: "a street in Skopje" },
  { id: "shopping", title: "Buying something at a shop", goal: "Ask for an item, ask the price, and pay.", setting: "a small shop" },
  { id: "introductions", title: "Introducing yourself", goal: "Say your name, where you're from, and what you do.", setting: "meeting someone new" },
  { id: "phone", title: "A short phone call", goal: "Greet, ask for someone, and leave a short message.", setting: "a phone call" },
];

const genCtx: GenContext = {
  languageName: mk.name,
  referenceScenario: mk.scenarios[0]!,
  grammarConceptIds: mk.grammar.map((g) => g.id),
};
const valCtx: ValidatorContext = {
  languageName: mk.name,
  stressRule: mk.phonology.stressRule,
};

async function main() {
  const N = Number(process.env.BATCH_N) || SITUATIONS.length;
  const batch = SITUATIONS.slice(0, N);
  console.log(`\n=== MK content batch: ${batch.length}/${SITUATIONS.length} situations (Opus 4.8, offline) ===\n`);
  let cost = 0;
  const scenarios: Scenario[] = [];
  const vocab: ReviewItem[] = [];
  const allVerdicts: Verdict[] = [];

  for (const sit of batch) {
    process.stdout.write(`• ${sit.title} … generating`);
    try {
      const gen = await generateScenario(sit, genCtx);
      cost += gen.costUsd;
      process.stdout.write(" · validating");
      const items: ValidatableItem[] = [
        ...gen.scenario.script
          .filter((t) => t.speaker === "learner")
          .map((t, i) => ({ id: `${gen.scenario.id}-l${i + 1}`, kind: "scenario-line", text: t.text, gloss: t.gloss })),
        ...gen.vocab.map((v) => ({ id: v.id, kind: "vocab", text: v.answer, gloss: v.gloss })),
      ];
      const verdicts = await validate(items, valCtx);
      const s = summarize(verdicts);
      cost += s.costUsd;
      allVerdicts.push(...verdicts);
      scenarios.push(gen.scenario);
      vocab.push(...gen.vocab);
      console.log(` · ${s.validated} ok / ${s.flagged} flagged  (running $${cost.toFixed(3)})`);
    } catch (e) {
      console.log(` · ✗ FAILED: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Write the gated output (NOT imported by the served pack until spot-checked).
  const outDir = join(ROOT, "packages", "pack-mk", "src");
  const flagged = allVerdicts.filter((v) => !v.ok);
  const header = `// MACHINE-GENERATED (Opus 4.8), confidence: "unreviewed" — GATED, not served until Jake spot-checks.\n// ${scenarios.length} scenarios, ${vocab.length} vocab. Validator flagged ${flagged.length} item(s) (see validatorReport).\n`;
  const body =
    `import type { Scenario, ReviewItem } from "@ll/pack-schema";\n\n` +
    `export const generatedScenarios: Scenario[] = ${JSON.stringify(scenarios, null, 2)};\n\n` +
    `export const generatedVocab: ReviewItem[] = ${JSON.stringify(vocab, null, 2)};\n\n` +
    `export const validatorReport = ${JSON.stringify(allVerdicts.map((v) => ({ itemId: v.itemId, ok: v.ok, issues: v.issues, corrected: v.corrected })), null, 2)} as const;\n`;
  writeFileSync(join(outDir, "generated.ts"), header + body);

  // Human-readable review report for the spot-check queue.
  const reviewLines = [
    `# Generated content — spot-check queue`,
    ``,
    `${scenarios.length} scenarios + ${vocab.length} vocab generated. **${flagged.length}** flagged by the Validator:`,
    ``,
    ...flagged.map((v) => `- \`${v.itemId}\`: ${v.issues.join("; ")}${v.corrected ? `  → suggested: \`${v.corrected}\`` : ""}`),
    flagged.length === 0 ? `- (none flagged — but still spot-check before serving)` : ``,
    ``,
    `Total Opus cost: ~$${cost.toFixed(3)}. Everything stays \`confidence: "unreviewed"\` until you promote it.`,
  ];
  const reviewDir = join(ROOT, "pipeline", "output");
  mkdirSync(reviewDir, { recursive: true });
  writeFileSync(join(reviewDir, "review.md"), reviewLines.join("\n"));

  console.log(`\n=== done · $${cost.toFixed(3)} total ===`);
  console.log(`  wrote packages/pack-mk/src/generated.ts (gated)`);
  console.log(`  wrote pipeline/output/review.md (${flagged.length} flagged for spot-check)\n`);
}

main().catch((e) => {
  console.error("batch failed:", e);
  process.exit(1);
});
