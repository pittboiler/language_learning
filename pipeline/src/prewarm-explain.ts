// Offline pre-warm for the "Have a question?" helper (DESIGN-ai-explain.md §5.4 / Phase 2). For every
// lesson conversation (each story + each scenario), generate the answer to each CONCEPT-DERIVED canned
// question and seed it into the shared `ai_explain` cache — so those chips are instant + free for every
// learner, and only novel free-text ever hits the model. Uses the SAME prompt as the live route
// (@ll/core/explain), so a live canned ask and the pre-warmed row are interchangeable.
//
// Idempotent: skips (convo, concept) rows already cached (pass --force to regenerate). --dry prints the
// target list without touching the DB or the LLM. Needs migration 0006 applied.
//
// Run:  pipeline/node_modules/.bin/tsx pipeline/src/prewarm-explain.ts [--dry] [--force]
import "./env.js";
import { macedonian } from "@ll/pack-mk";
import type { LanguagePack, MiniStory } from "@ll/pack-schema";
import { structuredCall, MODELS } from "@ll/core/llm";
import { EXPLAIN_SCHEMA, explainSystem, explainUser, type ExplainLine } from "@ll/core/explain";

const DRY = process.argv.includes("--dry");
const FORCE = process.argv.includes("--force");

const pack = macedonian;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const rest = (path: string) => `${URL}/rest/v1/${path}`;
const authHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

// Mirror of the app's storyGrammarIds (page.tsx): a story borrows the matching scenario's requiredStructures.
function storyGrammarIds(p: LanguagePack, story: MiniStory): string[] {
  const scenarioId = story.id.replace(/-story$/, "");
  const direct = p.scenarios.find((s) => s.id === scenarioId);
  if (direct?.requiredStructures.length) return direct.requiredStructures;
  const byTheme = story.theme ? p.scenarios.find((s) => s.theme && s.theme === story.theme && s.requiredStructures.length) : undefined;
  return byTheme?.requiredStructures ?? [];
}

interface Target {
  convoId: string;
  conceptId: string;
  conceptName: string;
  lines: ExplainLine[];
}

// Build every (conversation, concept) target from the pack's stories + scenarios.
const targets: Target[] = [];
const pushTargets = (convoId: string, lines: ExplainLine[], conceptIds: string[]) => {
  for (const id of [...new Set(conceptIds)]) {
    const c = pack.grammar.find((g) => g.id === id);
    if (c) targets.push({ convoId, conceptId: id, conceptName: c.name, lines });
  }
};
for (const s of pack.scenarios) pushTargets(s.id, s.script.map((t) => ({ text: t.text, gloss: t.gloss })), s.requiredStructures);
for (const st of pack.stories ?? []) pushTargets(st.id, st.body.map((b) => ({ text: b.text, gloss: b.gloss })), storyGrammarIds(pack, st));

console.log(`${targets.length} (conversation × concept) canned targets across ${pack.scenarios.length} scenarios + ${(pack.stories ?? []).length} stories.`);

if (DRY) {
  for (const t of targets.slice(0, 12)) console.log(`  ${t.convoId}  ·  ${t.conceptId} (${t.conceptName})`);
  if (targets.length > 12) console.log(`  … and ${targets.length - 12} more`);
  console.log("--dry: no DB or LLM calls made.");
  process.exit(0);
}

if (!URL || !KEY) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local."); process.exit(1); }
if (!process.env.ANTHROPIC_API_KEY) { console.error("Missing ANTHROPIC_API_KEY."); process.exit(1); }

async function existingKeys(): Promise<Set<string>> {
  const r = await fetch(rest(`ai_explain?pack_id=eq.${pack.id}&select=convo_id,question`), { headers: authHeaders });
  if (r.status === 404 || r.status === 400) { console.error("`ai_explain` not found — apply migration 0006_ai_explain.sql to Supabase first."); process.exit(1); }
  if (!r.ok) throw new Error(`fetch existing failed: ${r.status} ${await r.text()}`);
  const rows = (await r.json()) as { convo_id: string; question: string }[];
  return new Set(rows.map((x) => `${x.convo_id}|${x.question}`));
}

async function upsert(rows: Record<string, unknown>[]): Promise<void> {
  const r = await fetch(rest("ai_explain"), {
    method: "POST",
    headers: { ...authHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`upsert failed: ${r.status} ${await r.text()}`);
}

const seen = FORCE ? new Set<string>() : await existingKeys();
const todo = targets.filter((t) => !seen.has(`${t.convoId}|${t.conceptId}`));
console.log(`${seen.size} already cached; generating ${todo.length}.`);

let cost = 0;
let done = 0;
for (const t of todo) {
  const label = `Why "${t.conceptName}"? Explain how it shows up in this conversation.`;
  try {
    const { data, costUsd } = await structuredCall<{ answer: string }>({
      model: MODELS.mechanical,
      temperature: 0,
      maxTokens: 220,
      system: explainSystem(pack.name),
      user: explainUser(t.lines, label, true),
      schema: EXPLAIN_SCHEMA,
    });
    cost += costUsd;
    await upsert([{ pack_id: pack.id, convo_id: t.convoId, question: t.conceptId, answer: data.answer, model: MODELS.mechanical }]);
    done++;
    if (done % 10 === 0 || done === todo.length) console.log(`  ${done}/${todo.length}  ($${cost.toFixed(3)})`);
  } catch (e) {
    console.warn(`  skip ${t.convoId}/${t.conceptId}: ${e instanceof Error ? e.message : e}`);
  }
}
console.log(`Done — pre-warmed ${done} answers, ~$${cost.toFixed(3)}.`);
