// Offline generator for the "Build a sentence" tile exercise. For each pack verb (with a paradigm), author
// sentences on a ladder of COMPLEXITY TIERS, each given for all six persons (MK + correct-agreement English),
// built from that verb + only taught words:
//   tier 1 — verb + one word (2-3 words)            "Пијам кафе."
//   tier 2 — a little more (3-4 words)              "Пијам топло кафе."
//   tier 3 — object + place/time (5-6 words)         "Секое утро пијам кафе во кафуле."
//   tier 4 — two linked clauses (7-9 words)          "Пијам кафе наутро, но навечер пијам чај."
// Generation (Opus) is followed by a review/correct pass (Opus) — native-naturalness, agreement, articles.
// Idempotent: only generates (verb, tier) pairs missing from sentences.ts. Writes packages/pack-mk/src/sentences.ts.
//
// Run:  pipeline/node_modules/.bin/tsx pipeline/src/run-sentences.ts              (fill missing tiers)
//       pipeline/node_modules/.bin/tsx pipeline/src/run-sentences.ts --review-all (also re-review existing items)
import "./env.js";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { SentenceItem, ReviewItem, ConjugationSet } from "@ll/pack-schema";
import { macedonian } from "@ll/pack-mk";
import { structuredCall, MODELS } from "@ll/core/llm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "packages", "pack-mk", "src", "sentences.ts");
const pack = macedonian;
const REVIEW_ALL = process.argv.includes("--review-all");
type Tier = 1 | 2 | 3 | 4;
const TIERS: Tier[] = [1, 2, 3, 4];
const TIER_SPEC: Record<Tier, { words: [number, number]; brief: string }> = {
  1: { words: [2, 3], brief: "2-3 words: just the verb plus ONE complement word." },
  2: { words: [3, 4], brief: "3-4 words: the verb plus a slightly richer complement (e.g. adjective + noun, noun + adverb, or a short prepositional phrase)." },
  3: { words: [5, 6], brief: "5-6 words: verb + object AND a place or time expression (e.g. 'Every morning I drink coffee at home')." },
  4: { words: [7, 9], brief: "7-9 words — COUNT THEM; 5-6 is too short, so give each clause a time/place/adverb/object. TWO clauses linked by и / но / затоа / бидејќи / кога / ако / дека (e.g. 'I drink coffee because I am tired'). The target verb must appear (conjugated for the person) in the first clause." },
};
const idOf = (lemma: string, tier: Tier) => (tier === 1 ? `sent-${lemma}` : `sent-${lemma}-t${tier}`);
const tierOf = (it: SentenceItem): Tier => it.tier ?? 1;

let existing: SentenceItem[] = [];
try { ({ sentences: existing } = await import(OUT)); } catch { /* first run */ }
const byId = new Map(existing.map((x) => [x.id, x]));

// Allowed words: single-word taught vocab (content + the taught function words: и, но, во, на, јас …). The
// model may only use these (plus the verb, closed-class grammar particles, and inflected/articled forms of
// allowed words) so every sentence stays within taught vocabulary; supportWords then gates it per learner.
const allow = new Map<string, string>();
for (const it of pack.vocab as ReviewItem[]) {
  const a = it.answer.trim();
  if (it.kind === "vocab" && !/\s/.test(a) && !/[?!]/.test(a) && !allow.has(a)) allow.set(a, it.gloss);
}
const allowList = [...allow.entries()].map(([w, g]) => `${w} (${g})`).join(", ");
const PARTICLES = "не, да (subjunctive), ќе (future), се, сум/си/е/сме/сте/се (to be), clitics го/ја/ги/ми/ти/му/ѝ/ни/ви/им, secondary verbs from the verb list below (conjugated)";
const verbList = (pack.conjugations ?? []).map((v) => `${v.lemma} (${v.gloss})`).join(", ");

const SCHEMA: Record<string, unknown> = {
  type: "object", additionalProperties: false,
  properties: { items: { type: "array", items: {
    type: "object", additionalProperties: false,
    properties: {
      verbLemma: { type: "string", description: "Echo the verb's dictionary form EXACTLY (maps the result)." },
      tier: { type: "integer", enum: [1, 2, 3, 4] },
      supportWords: { type: "array", items: { type: "string" }, description: "The non-verb content/function words used, in their DICTIONARY form exactly as they appear in the allowed list (e.g. 'доктор' even if the sentence says 'докторот'). Omit particles/clitics." },
      conceptIds: { type: "array", items: { type: "string" }, description: "Grammar exercised — always 'verb-conjugation'; add 'definite-articles' if a noun takes -от/-та/-то, etc." },
      variants: { type: "array", description: "Exactly six, one per person, IN ORDER 1sg,2sg,3sg,1pl,2pl,3pl.", items: {
        type: "object", additionalProperties: false,
        properties: {
          person: { type: "string", enum: ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"] },
          en: { type: "string", description: "Natural English with correct agreement, e.g. 'I want coffee' / 'he/she wants coffee'." },
          mk: { type: "string", description: "The Macedonian sentence for that person. Ends with a period. Pronoun usually dropped." },
        },
        required: ["person", "en", "mk"],
      } },
    },
    required: ["verbLemma", "tier", "supportWords", "conceptIds", "variants"],
  } } },
  required: ["items"],
};
interface Row { verbLemma: string; tier: Tier; supportWords: string[]; conceptIds: string[]; variants: { person: NonNullable<SentenceItem["variants"][number]["person"]>; en: string; mk: string }[] }

const RULES =
  "Rules: natural, idiomatic standard Macedonian a native speaker would actually say (not a word-for-word calque). " +
  "Use ONLY words from the allowed list (inflected/articled forms are fine: пазар→пазарот, добар→добра), the verbs listed, and grammar particles (" + PARTICLES + "). " +
  "Use the definite article wherever Macedonian requires it (e.g. 'Го прашувам докторот', 'Го знам патот'). " +
  "The target verb must appear in the paradigm form for each person; everything else stays identical across the six persons except what agreement requires (possessives/reflexives may follow the person). " +
  "види is PERFECTIVE: use it after да or ќе ('Сакам да ја видам планината', 'Утре ќе го видам градот'), never as a bare present 'I see' (that is гледа). " +
  "Only the verbs listed exist for you — e.g. no perfective купи/дојде (use купува/доаѓа). " +
  "треба is impersonal: use 'Ми/Ти/Му… треба X' or 'Треба да + verb' (never требам/требаш). " +
  "Don't force a verb into a meaning it doesn't have (e.g. чини 'costs' needs a thing as subject — prefer 3sg/3pl-natural content and keep other persons grammatical). " +
  "Meaning must be sensible and everyday (no odd cause/effect like 'I sleep badly because I have money'); don't stack redundant words ('Секое утро секогаш'). " +
  "Vary topics across tiers and verbs — avoid leaning on секогаш or 'because I am sick'; each tier's sentence must differ from the lower tiers'. " +
  "English prompts must be natural and match the Macedonian meaning exactly. Keep word counts within the tier range (count Macedonian words, clitics included).";

const para = (v: ConjugationSet) => `${v.lemma} — ${v.gloss} — ${v.forms["1sg"]}/${v.forms["2sg"]}/${v.forms["3sg"]}/${v.forms["1pl"]}/${v.forms["2pl"]}/${v.forms["3pl"]}`;
// Verbs that are impersonal in standard Macedonian ("Ми треба вода", "Треба да одам") — the person lives in a
// clitic or the да-verb, so the check accepts the invariant form instead of the (colloquial) personal paradigm.
const IMPERSONAL = new Set(["треба"]);
const norm = (w: string) => w.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");

// Out-of-vocabulary check: every token must be a particle/clitic, a form of a pack verb, or an inflection of an
// allowed word (matched by stem — the word minus its last letter, so пазар/пазарот, добар/добра/добро all pass).
const CLOSED = new Set("не да ќе се сум си е сме сте го ја ги ми ти му ѝ ни ви им ги што".split(" ").map((w) => w.normalize("NFC")));
const stems = new Set<string>();
const addStem = (w: string) => {
  const n = norm(w);
  if (!n) return;
  stems.add(n.length > 3 ? n.slice(0, -1) : n);
  const fleeting = n.replace(/[аео]([^аеиоу])$/, "$1"); // fleeting vowel: болен→болн(а), топол→топл(о)
  if (fleeting !== n && fleeting.length >= 3) stems.add(fleeting);
};
for (const w of allow.keys()) addStem(w);
for (const c of pack.conjugations ?? []) { addStem(c.lemma); for (const f of Object.values(c.forms)) addStem(f); }
const known = (tok: string) => CLOSED.has(tok) || [...stems].some((st) => tok === st || (st.length >= 3 && tok.startsWith(st)));

// Structural checks: six persons in order, verb form present per person, word count within a tolerant range.
function problems(r: Row, v: ConjugationSet): string[] {
  const out: string[] = [];
  const order = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"];
  if (r.variants.length !== 6 || r.variants.some((x, i) => x.person !== order[i])) out.push("variants not 6 in person order");
  const [lo, hi] = TIER_SPEC[r.tier].words;
  for (const x of r.variants) {
    const toks = x.mk.split(/\s+/).map(norm).filter(Boolean);
    const form = IMPERSONAL.has(v.lemma) ? v.lemma : v.forms[x.person];
    const hasVerb = IMPERSONAL.has(v.lemma) ? toks.some((t) => t.startsWith(norm(form))) : toks.includes(norm(form)); // треба / требаат
    if (!hasVerb) out.push(`${x.person}: verb form "${form}" missing in "${x.mk}"`);
    const oov = toks.filter((t) => !known(t));
    if (oov.length) out.push(`${x.person}: untaught word(s) ${oov.join(", ")} in "${x.mk}"`);
    if (toks.length < lo - 1 || toks.length > hi + 1) out.push(`${x.person}: ${toks.length} words (tier ${r.tier} wants ${lo}-${hi}) "${x.mk}"`);
  }
  return out;
}

function toItem(r: Row): SentenceItem {
  const tier = r.tier;
  return {
    id: idOf(r.verbLemma, tier),
    conceptIds: [...new Set([...(r.conceptIds || []), "verb-conjugation"])],
    verbLemma: r.verbLemma,
    supportWords: [...new Set((r.supportWords || []).map((w) => w.trim()).filter((w) => allow.has(w)))],
    variants: r.variants.map((x) => ({ person: x.person, en: x.en.trim(), mk: x.mk.trim() })),
    ...(tier > 1 ? { tier } : {}),
    confidence: "unreviewed",
  };
}

const rowOf = (it: SentenceItem): Row => ({ verbLemma: it.verbLemma!, tier: tierOf(it), supportWords: it.supportWords, conceptIds: it.conceptIds, variants: it.variants as Row["variants"] });

let cost = 0, generated = 0, reviewedChanged = 0;
// чини "costs" only makes sense with a thing as subject ("Чинам десет" = "I cost ten"), so it can't be drilled
// across six persons — leave it out of the builder.
const SKIP = new Set(["чини"]);
const verbs = (pack.conjugations ?? []).filter((v) => !SKIP.has(v.lemma));
console.log(`${verbs.length} verbs; ${existing.length} existing item(s).${REVIEW_ALL ? " Re-reviewing everything." : ""}`);

// Verbs run with limited concurrency — one generate + one review call per verb.
async function doVerb(v: ConjugationSet) {
  const missing = TIERS.filter((t) => !byId.has(idOf(v.lemma, t)));
  let rows: Row[] = [];
  if (missing.length) {
    const { data, costUsd } = await structuredCall<{ items: Row[] }>({
      model: MODELS.offline,
      maxTokens: 6000,
      system:
        "You write graded beginner→intermediate Macedonian practice sentences for a tap-the-tiles sentence builder. " +
        "For the given verb, write ONE sentence per requested complexity tier, each given for all six persons in order " +
        "(1sg,2sg,3sg,1pl,2pl,3pl) with correctly-agreeing English. Make the tiers feel like a genuine progression and " +
        "vary the content across tiers (don't just pad the tier-1 sentence). " + RULES,
      user:
        `Allowed words: ${allowList}\n\nVerbs you may also use (conjugated): ${verbList}\n\n` +
        `Target verb: ${para(v)}\n\nTiers to write:\n` + missing.map((t) => `- tier ${t}: ${TIER_SPEC[t].brief}`).join("\n"),
      schema: SCHEMA,
    });
    cost += costUsd;
    rows = data.items.filter((r) => missing.includes(r.tier)).map((r) => ({ ...r, verbLemma: v.lemma }));
  }
  const toReview: Row[] = [...rows, ...(REVIEW_ALL ? existing.filter((x) => x.verbLemma === v.lemma).map(rowOf) : [])];
  if (!toReview.length) return;

  // Review/correct: a native-speaker pass that fixes rather than flags; returns the corrected full set.
  const { data: rev, costUsd: rc } = await structuredCall<{ items: Row[] }>({
    model: MODELS.offline,
    maxTokens: 8000,
    system:
      "You are a native Macedonian editor reviewing practice sentences for learners. For EACH item, return it corrected: " +
      "fix anything unnatural, ungrammatical, wrongly articled, wrongly conjugated, or mismatched with its English; fix " +
      "English to match. Keep the tier's word-count range and the same verb. If an item is already right, return it unchanged. " + RULES,
    user:
      `Allowed words: ${allowList}\n\nVerbs you may also use: ${verbList}\n\nTarget verb: ${para(v)}\n` +
      `Tier word ranges: ${TIERS.map((t) => `tier ${t}: ${TIER_SPEC[t].words.join("-")}`).join("; ")}\n\n` +
      `Items:\n${JSON.stringify(toReview, null, 1)}`,
    schema: SCHEMA,
  });
  cost += rc;
  for (const r0 of rev.items) {
    const r = { ...r0, verbLemma: v.lemma };
    const issues = problems(r, v);
    const id = idOf(v.lemma, r.tier);
    if (issues.length) { console.warn(`  ⚠ ${id} rejected:\n     ${issues.join("\n     ")}`); continue; }
    const before = byId.get(id);
    if (before && JSON.stringify(before.variants) !== JSON.stringify(r.variants)) {
      reviewedChanged++;
      console.log(`  ✎ ${id}: "${before.variants[0]!.mk}" → "${r.variants[0]!.mk}"`);
    }
    if (!before) generated++;
    byId.set(id, toItem(r));
  }
  console.log(`  ${v.lemma}: done (${[...byId.values()].filter((x) => x.verbLemma === v.lemma).map((x) => `t${tierOf(x)}`).join(",")})`);
}

const queue = [...verbs];
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let v = queue.shift(); v; v = queue.shift()) {
    try { await doVerb(v); } catch (e) { console.error(`  ✗ ${v.lemma} failed: ${e instanceof Error ? e.message : e}`); }
  }
}));

const out = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
const header =
  `// MACHINE-GENERATED by pipeline/src/run-sentences.ts (Opus 4.8). "Build a sentence" items — per verb, a ladder of\n` +
  `// complexity tiers (1: 2-3 words … 4: two clauses, 7-9 words), each across all six persons, using only taught\n` +
  `// words; generated then reviewed by a second Opus pass. Spot-check + flip confidence to "validated".\n` +
  `// Regenerate/fill gaps with: pipeline/node_modules/.bin/tsx pipeline/src/run-sentences.ts [--review-all]\n` +
  `import type { SentenceItem } from "@ll/pack-schema";\n\n` +
  `export const sentences: SentenceItem[] = ${JSON.stringify(out, null, 2)};\n`;
writeFileSync(OUT, header);
console.log(`\nWrote ${out.length} item(s) (+${generated} new, ${reviewedChanged} existing corrected). Total $${cost.toFixed(4)}.`);
