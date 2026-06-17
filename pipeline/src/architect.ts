import type { CefrBand } from "@ll/pack-schema";
import type { LanguageProfile } from "./profiler.js";
import { structuredCall, MODELS } from "@ll/core/llm";

// Curriculum Architect — Opus 4.8, offline. profile → a SEQUENCED curriculum: the spine every
// generator emits against. Built BACKWARDS from the conversation goal (the bar/café benchmark), then
// radiated by frequency. Opinionated, SLA-grounded pedagogy is baked into the system prompt and is
// LANGUAGE-AGNOSTIC (chunks-beat-words, function-beats-topic, repair-kit-first, frequency-first,
// just-in-time minimal grammar, relentless spiraling, speaking-first). The LANGUAGE-SPECIFIC facts all
// come from the profile — nothing about Macedonian is hardcoded here, so the same call yields a BG (or
// any) curriculum. The output is a reviewable artifact; bulk content generation gates on it.

/** What a unit's generators must emit (maps to pack-schema types + app surfaces). */
export type ArtifactKind = "vocab" | "scenario" | "ministory" | "grammar" | "reader" | "writing" | "infogap";

/** A frequency-ranked lexical target — a whole CHUNK or a single WORD. `freqRank` drives ordering and
 *  is the prior for `i1Level` (the familiarity engine's computed-comprehension serving). */
export interface LexTarget {
  text: string; // canonical target-language form (chunk taught as a whole, or a word)
  gloss: string; // English
  kind: "word" | "chunk";
  freqRank: number; // 1 = top ~100 forms, 2 = top ~500, 3 = top ~1500 (coarse band)
  i1Level: number; // comprehensible-input level prior (0 = survival … 4 = A2 sustain)
}

/** A just-in-time, rule-first grammar point — introduced the moment a chunk/scenario needs it, drawn
 *  from the profile's load-bearing features (never a generic grammar syllabus). */
export interface GrammarPoint {
  id: string; // matches a profile grammarFeaturesThatMatter id where possible
  rule: string; // the one-line rule, stated first (rule-first pedagogy)
  produce: boolean; // true = learner produces it here; false = recognition-only (defer production)
  prereqUnits: string[]; // units that must precede it
}

/** One curriculum unit: a communicative function in a situation, its frequency-ranked lexis, the
 *  minimal grammar it forces, the artifacts to generate, the vocab it spirals back, and its
 *  prerequisites. Units are dependency-ordered into `Curriculum.sequence`. */
export interface CurriculumUnit {
  id: string; // e.g. "s0-repair", "s1-cafe-order"
  stage: 0 | 1 | 2;
  title: string;
  cefr: CefrBand;
  functions: string[]; // communicative functions (greet, request, repair, ask-price …) — NOT topics
  situation: string; // the concrete setting it's anchored in
  coreLexis: LexTarget[]; // frequency-ranked chunks + words, each with an i1Level
  grammarPoints: GrammarPoint[]; // just-in-time, minimal, rule-first
  artifacts: ArtifactKind[]; // what to generate for this unit (always ends in production)
  recycles: string[]; // unit ids / lexKeys spiraled back in (relentless reuse)
  dependsOn: string[]; // prerequisite unit ids → the dependency ordering
  rationale: string; // why this unit, here (the sequencing argument)
}

export interface Curriculum {
  languageCode: string;
  goal: string; // the north-star benchmark, restated for the generators
  stages: { stage: 0 | 1 | 2; name: string; cefr: CefrBand; goal: string }[];
  units: CurriculumUnit[]; // every unit, dependency-ordered
  sequence: string[]; // topological unit-id order (the spine the i+1 engine serves)
  costUsd: number;
}

const ARCHITECT_SYSTEM = `You are an expert curriculum architect and applied-linguist. Turn a TEACHING PROFILE of a target language into a SEQUENCED, dependency-ordered curriculum that carries an absolute beginner (English L1) from zero to HOLDING A REAL, LIVE CONVERSATION (the benchmark: a bar/café exchange — the waiter AND other patrons — then radiating outward to the next most-frequent everyday situations).

These pedagogical principles are NON-NEGOTIABLE and language-agnostic — bake them into the sequence:
1. CHUNKS BEAT WORDS. Teach high-frequency formulaic sequences as WHOLE units (kind:"chunk"), not just isolated words. Fluency is fast retrieval of chunks.
2. FUNCTION BEATS TOPIC. Organize units by what the learner DOES with language (greet, request, offer, accept/decline, ask-price, ask-the-way, express want/like, clarify), not by topic word-lists.
3. REPAIR / STRATEGIC COMPETENCE IS FRONT-LOADED. The single highest-leverage set for SUSTAINING a real conversation is the repair kit — "I don't understand", "can you repeat?", "slower please", "how do you say … ?", "what does … mean?", "I'm still learning", plus backchannels. Make the repair kit the VERY FIRST unit (stage 0, before greetings), so a beginner can keep a conversation alive through the inevitable gaps. Spiral it back, leveled-up, as a late unit (problems & complaints).
4. FREQUENCY-FIRST. Prioritize the highest-frequency lexis; tag every LexTarget with a coarse freqRank (1 = top ~100 forms, 2 = top ~500, 3 = top ~1500). freqRank drives ordering and the i1Level prior.
5. BUILD BACKWARDS FROM THE GOAL, THEN RADIATE BY FREQUENCY. Anchor stage 1 on the café/bar benchmark, then add the next most-frequent real-life situations (greetings/introductions, shopping/market, directions/transport, then small talk, past/future, phone/arranging-to-meet, home/family/work, problems).
6. GRAMMAR = JUST-IN-TIME, RULE-FIRST, MINIMAL. Only the grammar that changes meaning or comprehensibility, introduced the moment a chunk/scenario needs it, drawn from the profile's load-bearing features. State each as a one-line rule FIRST. Crucially, set produce:false (recognition-only, deferred) for the HARDEST-to-PRODUCE features (e.g. verb aspect, clitic ordering) until late — beginners should recognize them long before they must produce them. Never invent a generic grammar course.
7. i+1 + RELENTLESS SPIRALING. Sequence by computed comprehension (each unit ≈ i+1 over its prerequisites). Every unit (except the first) MUST recycle lexis from earlier units — list it in recycles.
8. SPEAKING-FIRST. Every unit ENDS IN PRODUCTION. Each unit's artifacts must include at least one production artifact (scenario, ministory with a spoken-prompt Q&A, and/or infogap). Comprehensible input feeds output; do not delay speaking.

STAGES (use exactly these three):
- Stage 0 "Decode & survive" (pre-A1): the repair kit FIRST, then greetings/politeness/yes-no, then survival operators (want/can/where-is/how-much) + numbers 1–10. Goal: survive AND sustain a first exchange.
- Stage 1 "Core situations" (A1): café/bar (the anchor — build it first), greetings & introductions, shopping/market, directions & getting around. Just-in-time grammar from the profile (e.g. gender agreement, the definite article, present tense of high-frequency verbs).
- Stage 2 "Connect & sustain" (A2): small talk & opinions, past & future (your day/your plans), phone & arranging to meet, home/family/work, problems & complaints (the repair kit, leveled up). Multi-turn, longer conversations.

OUTPUT REQUIREMENTS:
- 12–14 units total. Each unit: a stable kebab id prefixed by stage ("s0-…","s1-…","s2-…"), the functions, the situation, 8–16 frequency-ranked coreLexis (mostly chunks), the minimal grammarPoints (with produce + prereqUnits), the artifacts to generate, the recycled units/lexKeys, dependsOn, and a one-line rationale.
- coreLexis MUST be correct, natural, beginner-appropriate target language with correct agreement/forms (use the profile's facts). Do NOT invent words.
- dependsOn MUST form a DAG with the café unit reachable early in stage 1; the repair unit has no lexical prerequisites (only the script/alphabet).
- "sequence" MUST be a valid topological order of the units (every unit appears after all its dependsOn).
- Be opinionated and specific to THIS language's profile (its script, its load-bearing grammar, its high-frequency vocab, its social norms).`;

const UNIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", description: "Stable kebab id prefixed by stage, e.g. 's0-repair'." },
    stage: { type: "integer", enum: [0, 1, 2] },
    title: { type: "string" },
    cefr: { type: "string", enum: ["pre-A1", "A1", "A2"] },
    functions: { type: "array", items: { type: "string" }, description: "Communicative functions (verbs), not topics." },
    situation: { type: "string" },
    coreLexis: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", description: "Canonical target-language chunk or word." },
          gloss: { type: "string" },
          kind: { type: "string", enum: ["word", "chunk"] },
          freqRank: { type: "integer", description: "1 = top ~100 forms, 2 = top ~500, 3 = top ~1500." },
          i1Level: { type: "integer", description: "0 survival … 4 A2-sustain." },
        },
        required: ["text", "gloss", "kind", "freqRank", "i1Level"],
      },
    },
    grammarPoints: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", description: "Matches a profile grammar-feature id where possible." },
          rule: { type: "string", description: "The one-line rule, stated first." },
          produce: { type: "boolean", description: "true = produced here; false = recognition-only (deferred)." },
          prereqUnits: { type: "array", items: { type: "string" } },
        },
        required: ["id", "rule", "produce", "prereqUnits"],
      },
    },
    artifacts: { type: "array", items: { type: "string", enum: ["vocab", "scenario", "ministory", "grammar", "reader", "writing", "infogap"] } },
    recycles: { type: "array", items: { type: "string" }, description: "Unit ids / lexKeys spiraled back in." },
    dependsOn: { type: "array", items: { type: "string" }, description: "Prerequisite unit ids." },
    rationale: { type: "string", description: "One line: why this unit, here." },
  },
  required: ["id", "stage", "title", "cefr", "functions", "situation", "coreLexis", "grammarPoints", "artifacts", "recycles", "dependsOn", "rationale"],
};

const CURRICULUM_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    goal: { type: "string", description: "The north-star benchmark, restated." },
    stages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          stage: { type: "integer", enum: [0, 1, 2] },
          name: { type: "string" },
          cefr: { type: "string", enum: ["pre-A1", "A1", "A2"] },
          goal: { type: "string" },
        },
        required: ["stage", "name", "cefr", "goal"],
      },
    },
    units: { type: "array", items: UNIT_SCHEMA },
    sequence: { type: "array", items: { type: "string" }, description: "Topological unit-id order." },
  },
  required: ["goal", "stages", "units", "sequence"],
};

type CurriculumData = Omit<Curriculum, "languageCode" | "costUsd">;

/** Pure structural check (no LLM) — mirrors lint.ts: catch a model that emits a broken dependency
 *  graph (orphan deps, a sequence that isn't a topological order, a missing repair/café anchor). */
export function lintCurriculum(c: Pick<Curriculum, "units" | "sequence">): string[] {
  const issues: string[] = [];
  const ids = new Set(c.units.map((u) => u.id));
  for (const u of c.units) {
    for (const d of u.dependsOn) if (!ids.has(d)) issues.push(`unit "${u.id}" depends on unknown unit "${d}"`);
  }
  const seqSet = new Set(c.sequence);
  for (const u of c.units) if (!seqSet.has(u.id)) issues.push(`unit "${u.id}" is missing from sequence`);
  for (const s of c.sequence) if (!ids.has(s)) issues.push(`sequence references unknown unit "${s}"`);
  const pos = new Map(c.sequence.map((id, i) => [id, i]));
  for (const u of c.units) {
    for (const d of u.dependsOn) {
      const du = pos.get(d);
      const uu = pos.get(u.id);
      if (du !== undefined && uu !== undefined && du > uu) issues.push(`sequence violates dependency: "${d}" must precede "${u.id}"`);
    }
  }
  if (!c.units.some((u) => u.stage === 0 && /repair/i.test(u.id + u.functions.join(" ")))) issues.push(`no repair-kit unit in stage 0 (it must be front-loaded)`);
  return issues;
}

/** Opus 4.8, offline. Given a teaching profile, produce the sequenced curriculum. Opinionated pedagogy
 *  is in the prompt (language-agnostic); the language facts come from the profile. */
export async function architect(profile: LanguageProfile): Promise<Curriculum> {
  const features = profile.grammarFeaturesThatMatter.map((f) => `- ${f.id} — ${f.name}: ${f.why}`).join("\n");
  const user = `TARGET LANGUAGE: ${profile.languageName} (code "${profile.languageCode}").
Script: ${profile.script}
Stress/phonology: ${profile.phonology.stressRule} — ${profile.phonology.notes}
Load-bearing grammar features (use these for just-in-time grammar; defer the hardest-to-produce to recognition-only):
${features}
High-frequency early vocab (seed the survival + café units, then radiate): ${profile.highFrequencyVocab.join(", ")}
Social/register norms to respect (e.g. formal/informal "you"): ${profile.socialNorms.join(" | ")}

Produce the full sequenced curriculum for ${profile.languageName}, repair-kit FIRST, café/bar as the stage-1 anchor.`;

  const { data, costUsd } = await structuredCall<CurriculumData>({
    model: MODELS.offline,
    system: ARCHITECT_SYSTEM,
    user,
    schema: CURRICULUM_SCHEMA,
    effort: "high",
    thinking: true,
    maxTokens: 16000,
  });

  return { languageCode: profile.languageCode, goal: data.goal, stages: data.stages, units: data.units, sequence: data.sequence, costUsd };
}
