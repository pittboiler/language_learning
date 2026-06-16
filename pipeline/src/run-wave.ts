// Offline WAVE runner — MACEDONIAN ONLY. Drives curriculum-mk.json: for one STAGE, generates each
// unit's artifacts (vocab/chunks, mini-story, scenario, grammar, reader, writing, info-gap), runs the
// Validator over every generated Macedonian line + a structural drill lint, and writes GATED output
// (confidence:"unreviewed") to packages/pack-mk/src/generated-stage<N>.ts — NOT imported by the served
// pack (index.ts) — plus a per-wave spot-check report. Same trust discipline as run-mk-batch; the wave
// is the review unit.
//
// This runner is intentionally hardcoded to Macedonian. (Other languages go through run-batch.ts.)
//
// Calibrate (first unit's vocab + grammar only, cheap, no write):  CALIBRATE=1 STAGE=1 pipeline/node_modules/.bin/tsx pipeline/src/run-wave.ts
// Run a stage (writes gated output):                               STAGE=0 pipeline/node_modules/.bin/tsx pipeline/src/run-wave.ts
import "./env.js";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReviewItem, Scenario, MiniStory, InfoGapTask, GrammarConcept, Reader, WritingTask } from "@ll/pack-schema";
import { macedonian as mk } from "@ll/pack-mk";
import type { Curriculum, CurriculumUnit } from "./architect.js";
import {
  generateUnitVocab,
  generateUnitMiniStory,
  generateUnitScenario,
  generateUnitGrammar,
  generateUnitReader,
  generateUnitWriting,
  unitToSituation,
  type UnitGenContext,
} from "./unit.js";
import { generateInfoGapPair, type InfoGapGenContext } from "./infogap.js";
import { validate, summarize, type ValidatableItem, type ValidatorContext, type Verdict } from "./validator.js";
import { lintDrills, type DrillLintIssue } from "./lint.js";
import type { GenContext } from "./generator.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const STAGE = Number(process.env.STAGE ?? 0);
const CALIBRATE = !!process.env.CALIBRATE;

const orderADrink = mk.scenarios.find((s) => s.id === "bar-order-a-drink") ?? mk.scenarios[0]!;
const cafeGap = mk.infoGapTasks?.[0];

const scenarioCtx: GenContext = { languageName: mk.name, referenceScenario: orderADrink, grammarConceptIds: mk.grammar.map((g) => g.id) };
const unitCtx: UnitGenContext = { languageName: mk.name, stressRule: mk.phonology.stressRule, scenario: scenarioCtx };
const valCtx: ValidatorContext = { languageName: mk.name, stressRule: mk.phonology.stressRule };
const infoGapCtx: InfoGapGenContext = {
  languageName: mk.name,
  grammarConceptIds: mk.grammar.map((g) => g.id),
  referenceStyle: cafeGap ? renderInfoGap(cafeGap) : undefined,
};

function renderInfoGap(t: InfoGapTask): string {
  const role = (r: typeof t.roleA) => [`  [${r.role}] brief: ${r.brief}`, `      secret: ${r.secretInfo.join(" | ")}`, ...r.targetPhrases.map((p) => `      • ${p.text} — ${p.gloss}`)].join("\n");
  return [`Title: ${t.title}`, `Goal: ${t.goal}`, role(t.roleA), role(t.roleB), `Criteria: ${t.successCriteria.map((c) => c.description).join("; ")}`].join("\n");
}

function loadCurriculum(): Curriculum {
  const path = join(ROOT, "pipeline", "output", "curriculum-mk.json");
  return JSON.parse(readFileSync(path, "utf8")) as Curriculum;
}

function vocabItems(items: ReviewItem[]): ValidatableItem[] {
  return items.map((v) => ({ id: v.id, kind: "vocab", text: v.answer, gloss: v.gloss }));
}
function scenarioItems(s: Scenario): ValidatableItem[] {
  return s.script.filter((t) => t.speaker === "learner").map((t, i) => ({ id: `${s.id}-l${i + 1}`, kind: "scenario-line", text: t.text, gloss: t.gloss }));
}
function storyItems(s: MiniStory): ValidatableItem[] {
  return s.body.map((seg, i) => ({ id: `${s.id}-s${i + 1}`, kind: "reader-line", text: seg.text, gloss: seg.gloss }));
}
function grammarItems(concepts: GrammarConcept[]): ValidatableItem[] {
  return concepts.flatMap((c) => [
    ...c.examples.map((ex, i) => ({ id: `${c.id}-ex${i + 1}`, kind: "grammar-example", text: ex, note: c.name })),
    ...c.drills.map((d) => ({ id: d.id, kind: "grammar-drill", text: d.answer, gloss: d.gloss, note: d.prompt })),
  ]);
}
function readerItems(r: Reader): ValidatableItem[] {
  return r.body.map((l, i) => ({ id: `${r.id}-l${i + 1}`, kind: "reader-line", text: l.text, gloss: l.gloss }));
}
function infoGapItems(t: InfoGapTask): ValidatableItem[] {
  return [t.roleA, t.roleB].flatMap((r) => r.targetPhrases.map((p, i) => ({ id: `${t.id}-${r.role}${i + 1}`, kind: "phrase", text: p.text, gloss: p.gloss })));
}

async function main() {
  const curriculum = loadCurriculum();
  const order = new Map(curriculum.sequence.map((id, i) => [id, i]));
  const units = curriculum.units
    .filter((u) => u.stage === STAGE)
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  if (!units.length) {
    console.log(`No units at stage ${STAGE}. Stages present: ${[...new Set(curriculum.units.map((u) => u.stage))].join(", ")}.`);
    return;
  }

  console.log(`\n=== Macedonian content WAVE · stage ${STAGE} (${units.length} units, Opus 4.8, offline)${CALIBRATE ? " — CALIBRATE (first unit vocab+grammar only, no write)" : ""} ===\n`);

  let cost = 0;
  const allVocab: ReviewItem[] = [];
  const allScenarios: Scenario[] = [];
  const allStories: MiniStory[] = [];
  const allGrammar: GrammarConcept[] = [];
  const allReaders: Reader[] = [];
  const allWriting: WritingTask[] = [];
  const allInfoGaps: InfoGapTask[] = [];
  const allVerdicts: Verdict[] = [];
  const allDrillIssues: DrillLintIssue[] = [];

  if (CALIBRATE) {
    const u = units[0]!;
    process.stdout.write(`• calibrate: "${u.title}" vocab … generating`);
    const v = await generateUnitVocab(u, unitCtx);
    cost += v.costUsd;
    const verdicts = await validate(vocabItems(v.items), valCtx);
    cost += summarize(verdicts).costUsd;
    console.log(` (${v.items.length} items) · ${summarize(verdicts).flagged} flagged · $${cost.toFixed(4)}`);
    for (const it of v.items) console.log(`    ${it.answer}  —  ${it.gloss}  (${it.translit ?? ""})${it.meta && (it.meta as Record<string, unknown>).gender ? ` [${(it.meta as Record<string, unknown>).gender}]` : ""}`);
    if (u.artifacts.includes("grammar")) {
      process.stdout.write(`• calibrate: grammar … generating`);
      const g = await generateUnitGrammar(u, unitCtx);
      cost += g.costUsd;
      const gv = await validate(grammarItems(g.concepts), valCtx);
      cost += summarize(gv).costUsd;
      const issues = lintDrills(g.concepts);
      console.log(` (${g.concepts.length} concepts, ${g.concepts.reduce((n, c) => n + c.drills.length, 0)} drills) · ${summarize(gv).flagged} flagged · ${issues.length} lint issue(s) · $${cost.toFixed(4)}`);
      for (const c of g.concepts) console.log(`    [${c.id}] ${c.name}: ${c.explanation}`);
    }
    console.log(`\n=== CALIBRATE done · $${cost.toFixed(4)} for one unit's vocab${u.artifacts.includes("grammar") ? "+grammar" : ""}. No files written. ===\n`);
    return;
  }

  for (const u of units) {
    console.log(`• unit "${u.id}" — ${u.title}  [${u.artifacts.join(", ")}]`);
    const arts = new Set(u.artifacts);

    if (arts.has("vocab")) {
      try {
        process.stdout.write(`    vocab … generating`);
        const v = await generateUnitVocab(u, unitCtx);
        cost += v.costUsd;
        process.stdout.write(` · validating`);
        const verdicts = await validate(vocabItems(v.items), valCtx);
        cost += summarize(verdicts).costUsd;
        allVocab.push(...v.items);
        allVerdicts.push(...verdicts);
        console.log(` · ${v.items.length} items, ${summarize(verdicts).flagged} flagged  ($${cost.toFixed(3)})`);
      } catch (e) { console.log(` · ✗ ${e instanceof Error ? e.message : String(e)}`); }
    }

    if (arts.has("scenario")) {
      try {
        process.stdout.write(`    scenario … generating`);
        const g = await generateUnitScenario(u, unitCtx);
        cost += g.costUsd;
        process.stdout.write(` · validating`);
        const verdicts = await validate(scenarioItems(g.scenario), valCtx);
        cost += summarize(verdicts).costUsd;
        allScenarios.push(g.scenario);
        allVerdicts.push(...verdicts);
        console.log(` · ${g.scenario.script.length} turns, ${summarize(verdicts).flagged} flagged  ($${cost.toFixed(3)})`);
      } catch (e) { console.log(` · ✗ ${e instanceof Error ? e.message : String(e)}`); }
    }

    if (arts.has("ministory")) {
      try {
        process.stdout.write(`    ministory … generating`);
        const s = await generateUnitMiniStory(u, unitCtx);
        cost += s.costUsd;
        process.stdout.write(` · validating`);
        const verdicts = await validate(storyItems(s.story), valCtx);
        cost += summarize(verdicts).costUsd;
        allStories.push(s.story);
        allVerdicts.push(...verdicts);
        console.log(` · ${s.story.body.length} lines, ${summarize(verdicts).flagged} flagged  ($${cost.toFixed(3)})`);
      } catch (e) { console.log(` · ✗ ${e instanceof Error ? e.message : String(e)}`); }
    }

    if (arts.has("grammar")) {
      try {
        process.stdout.write(`    grammar … generating`);
        const g = await generateUnitGrammar(u, unitCtx);
        cost += g.costUsd;
        process.stdout.write(` · validating`);
        const verdicts = await validate(grammarItems(g.concepts), valCtx);
        cost += summarize(verdicts).costUsd;
        const issues = lintDrills(g.concepts);
        allGrammar.push(...g.concepts);
        allVerdicts.push(...verdicts);
        allDrillIssues.push(...issues);
        console.log(` · ${g.concepts.length} concepts, ${summarize(verdicts).flagged} flagged, ${issues.length} lint  ($${cost.toFixed(3)})`);
      } catch (e) { console.log(` · ✗ ${e instanceof Error ? e.message : String(e)}`); }
    }

    if (arts.has("reader")) {
      try {
        process.stdout.write(`    reader … generating`);
        const r = await generateUnitReader(u, unitCtx);
        cost += r.costUsd;
        process.stdout.write(` · validating`);
        const verdicts = await validate(readerItems(r.reader), valCtx);
        cost += summarize(verdicts).costUsd;
        allReaders.push(r.reader);
        allVerdicts.push(...verdicts);
        console.log(` · ${r.reader.body.length} lines, ${summarize(verdicts).flagged} flagged  ($${cost.toFixed(3)})`);
      } catch (e) { console.log(` · ✗ ${e instanceof Error ? e.message : String(e)}`); }
    }

    if (arts.has("writing")) {
      try {
        process.stdout.write(`    writing … generating`);
        const w = await generateUnitWriting(u, unitCtx);
        cost += w.costUsd;
        allWriting.push(...w.tasks);
        console.log(` · ${w.tasks.length} prompts (English — no TL validation)  ($${cost.toFixed(3)})`);
      } catch (e) { console.log(` · ✗ ${e instanceof Error ? e.message : String(e)}`); }
    }

    if (arts.has("infogap")) {
      try {
        process.stdout.write(`    infogap … generating`);
        const sit = unitToSituation(u);
        const g = await generateInfoGapPair({ situation: { id: u.id, title: u.title, goal: sit.goal, setting: u.situation }, splitRule: "secret-info" }, infoGapCtx);
        cost += g.costUsd;
        process.stdout.write(` · validating`);
        const verdicts = await validate(infoGapItems(g.task), valCtx);
        cost += summarize(verdicts).costUsd;
        allInfoGaps.push(g.task);
        allVerdicts.push(...verdicts);
        console.log(` · ${summarize(verdicts).flagged} flagged  ($${cost.toFixed(3)})`);
      } catch (e) { console.log(` · ✗ ${e instanceof Error ? e.message : String(e)}`); }
    }
  }

  writeGenerated(STAGE, { vocab: allVocab, scenarios: allScenarios, stories: allStories, grammar: allGrammar, readers: allReaders, writingTasks: allWriting, infoGapTasks: allInfoGaps, verdicts: allVerdicts });
  writeReview(STAGE, units, { vocab: allVocab.length, scenarios: allScenarios.length, stories: allStories.length, grammar: allGrammar.length, readers: allReaders.length, writing: allWriting.length, infoGaps: allInfoGaps.length }, allVerdicts, allDrillIssues, cost);

  const flagged = allVerdicts.filter((v) => !v.ok).length;
  console.log(`\n=== wave done · $${cost.toFixed(3)} total · ${flagged} flagged + ${allDrillIssues.length} drill-lint for spot-check ===`);
  console.log(`  wrote packages/pack-mk/src/generated-stage${STAGE}.ts (gated, confidence:"unreviewed" — NOT served)`);
  console.log(`  wrote pipeline/output/wave-mk-stage${STAGE}.md (spot-check queue)\n`);
}

function writeGenerated(stage: number, d: { vocab: ReviewItem[]; scenarios: Scenario[]; stories: MiniStory[]; grammar: GrammarConcept[]; readers: Reader[]; writingTasks: WritingTask[]; infoGapTasks: InfoGapTask[]; verdicts: Verdict[] }) {
  const outDir = join(ROOT, "packages", "pack-mk", "src");
  mkdirSync(outDir, { recursive: true });
  const flagged = d.verdicts.filter((v) => !v.ok).length;
  const header =
    `// MACHINE-GENERATED (Opus 4.8) for curriculum stage ${stage}. confidence:"unreviewed" — GATED, NOT imported by index.ts / served until a native spot-check promotes it.\n` +
    `// ${d.vocab.length} vocab · ${d.scenarios.length} scenarios · ${d.stories.length} mini-stories · ${d.grammar.length} grammar · ${d.readers.length} readers · ${d.writingTasks.length} writing · ${d.infoGapTasks.length} info-gap. Validator flagged ${flagged} line(s) — see pipeline/output/wave-mk-stage${stage}.md.\n`;
  const body =
    `import type { ReviewItem, Scenario, MiniStory, GrammarConcept, Reader, WritingTask, InfoGapTask } from "@ll/pack-schema";\n\n` +
    `export const generatedVocab: ReviewItem[] = ${JSON.stringify(d.vocab, null, 2)};\n\n` +
    `export const generatedScenarios: Scenario[] = ${JSON.stringify(d.scenarios, null, 2)};\n\n` +
    `export const generatedStories: MiniStory[] = ${JSON.stringify(d.stories, null, 2)};\n\n` +
    `export const generatedGrammar: GrammarConcept[] = ${JSON.stringify(d.grammar, null, 2)};\n\n` +
    `export const generatedReaders: Reader[] = ${JSON.stringify(d.readers, null, 2)};\n\n` +
    `export const generatedWritingTasks: WritingTask[] = ${JSON.stringify(d.writingTasks, null, 2)};\n\n` +
    `export const generatedInfoGapTasks: InfoGapTask[] = ${JSON.stringify(d.infoGapTasks, null, 2)};\n\n` +
    `export const validatorReport = ${JSON.stringify(d.verdicts.map((v) => ({ itemId: v.itemId, ok: v.ok, issues: v.issues, corrected: v.corrected })), null, 2)} as const;\n`;
  writeFileSync(join(outDir, `generated-stage${stage}.ts`), header + body);
}

function writeReview(stage: number, units: CurriculumUnit[], counts: Record<string, number>, verdicts: Verdict[], drillIssues: DrillLintIssue[], cost: number) {
  const flagged = verdicts.filter((v) => !v.ok);
  const lines = [
    `# Macedonian — stage ${stage} wave · spot-check queue`,
    ``,
    `Units: ${units.map((u) => `\`${u.id}\``).join(", ")}.`,
    `Generated: ${counts.vocab} vocab · ${counts.scenarios} scenarios · ${counts.stories} mini-stories · ${counts.grammar} grammar · ${counts.readers} readers · ${counts.writing} writing · ${counts.infoGaps} info-gap tasks.`,
    `**${flagged.length}** line(s) flagged by the Validator (content correctness):`,
    ``,
    ...flagged.map((v) => `- \`${v.itemId}\`: ${v.issues.join("; ")}${v.corrected ? `  → suggested: \`${v.corrected}\`` : ""}`),
    flagged.length === 0 ? `- (none flagged — but still needs a native spot-check before promotion)` : ``,
    ``,
    `**${drillIssues.length}** structural drill issue(s) (malformed multiple-choice — the line Validator can't see these):`,
    ``,
    ...drillIssues.map((i) => `- \`${i.conceptId}/${i.drillId}\` [${i.kind}]: ${i.detail}`),
    drillIssues.length === 0 ? `- (none)` : ``,
    ``,
    `Everything stays \`confidence:"unreviewed"\` and is NOT imported by the served pack until promoted. Total Opus cost: ~$${cost.toFixed(3)}.`,
    `**Promotion:** spot-check → set \`confidence:"validated"\` → wire \`generated-stage${stage}.ts\` exports into \`pack-mk/src/index.ts\` (mirror the existing \`generated.ts\` promotion).`,
  ];
  const outDir = join(ROOT, "pipeline", "output");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `wave-mk-stage${stage}.md`), lines.filter((l) => l !== undefined).join("\n"));
}

main().catch((e) => {
  console.error("wave failed:", e);
  process.exit(1);
});
