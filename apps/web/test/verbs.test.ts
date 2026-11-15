// Verbs by pattern (batch 3, 2026-11-14): the rule engine makes every form of every bank verb. These check
// it against Wiktionary's tables (a fixture of 59 verbs), against the course's own present tables
// (conjugations.ts), and that every pattern the bank names exists.
//   Run with: npx tsx apps/web/test/verbs.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { macedonian as pack } from "@ll/pack-mk";
import { bank, engine } from "../../../packages/pack-mk/src/verbs/index.js";

const W = JSON.parse(readFileSync(new URL("./fixtures/wiktionary-verbs.json", import.meta.url), "utf8"));
const P = engine.PERSONS;
const verbs = pack.verbs!;
const byLemma = new Map(verbs.map((v) => [v.lemma, v]));

// 1. Every form Wiktionary has for a bank verb, the engine makes the same (stress marks aside).
{
  let checked = 0;
  const off: string[] = [];
  const same = (what: string, mine?: string, theirs?: string | null) => {
    if (theirs == null || mine === undefined) return;
    checked++;
    if (mine !== theirs.replace(/́/g, "")) off.push(`${what}: ${mine} ≠ ${theirs}`);
  };
  for (const b of bank) {
    const w = W[b.lemma];
    if (!w || w.missing) continue;
    const v = byLemma.get(b.lemma)!;
    for (const p of P) {
      same(`${b.lemma} present ${p}`, v.forms.present?.[p], w.present?.[p]);
      same(`${b.lemma} ongoing past ${p}`, v.forms.pastOngoing?.[p], w.imperfect?.[p]);
      same(`${b.lemma} done past ${p}`, v.forms.pastDone?.[p], w.aorist?.[p]);
    }
    same(`${b.lemma} command`, v.forms.command?.["2sg"], w.imperative?.["2sg"]);
    same(`${b.lemma} command pl`, v.forms.command?.["2pl"], w.imperative?.["2pl"]);
    // The -л form: a done verb's (and сум's бил) is Wiktionary's aorist one, an ongoing verb's the imperfect one.
    const l = b.aspect === "done" || b.lemma === "сум" ? w.lform?.aorist : w.lform?.imperfect;
    if (l) for (const [k, kk] of [["m", "masculine"], ["f", "feminine"], ["n", "neuter"], ["pl", "plural"]] as const) same(`${b.lemma} -л ${k}`, v.lform?.[k], l[kk]);
  }
  assert.deepEqual(off, [], "engine forms that differ from Wiktionary");
  assert.ok(checked > 950, `checked ${checked} forms`);
  console.log(`✓ ${checked} forms match Wiktionary`);
}

// 2. Aspect agrees with Wiktionary (сум is biaspectual there; the course only uses its ongoing past).
for (const b of bank) {
  const w = W[b.lemma];
  if (!w?.aspect || b.lemma === "сум") continue;
  const want = b.aspect === "ongoing" ? "imperfective" : b.aspect === "done" ? "perfective" : "biaspectual";
  assert.equal(w.aspect, want, `${b.lemma}'s aspect`);
}
console.log("✓ aspects match Wiktionary");

// 3. The course's own present tables (Build a sentence, Switch the person, the warm-up) agree with the engine.
{
  const sumLemma = (l: string) => (l === "е" ? "сум" : l);
  let n = 0;
  for (const c of pack.conjugations ?? []) {
    if (c.group === "past") {
      // The past tables are a verb's past: бев (сум), имав (има), отидов (отиде), јадев (јаде).
      const of: Record<string, [string, "pastOngoing" | "pastDone"]> = { бев: ["сум", "pastOngoing"], имав: ["има", "pastOngoing"], отидов: ["отиде", "pastDone"], јадев: ["јаде", "pastOngoing"] };
      const [lemma, tense] = of[c.lemma]!;
      assert.deepEqual(byLemma.get(lemma)!.forms[tense], c.forms, `${c.lemma} table`);
      n++;
      continue;
    }
    const v = byLemma.get(sumLemma(c.lemma));
    assert.ok(v, `${c.lemma} is in the verb bank`);
    if (v.impersonal) { assert.equal(v.forms.present?.["3sg"], c.forms["3sg"]); n++; continue; }
    assert.deepEqual(v.forms.present, c.forms, `${c.lemma} present`);
    n++;
  }
  console.log(`✓ all ${n} course tables agree with the engine`);
}

// 4. The rules, on verbs Wiktionary didn't have.
assert.deepEqual(Object.values(byLemma.get("купува")!.forms.present!), ["купувам", "купуваш", "купува", "купуваме", "купувате", "купуваат"]);
assert.deepEqual(Object.values(byLemma.get("сака")!.forms.pastOngoing!), ["сакав", "сакаше", "сакаше", "сакавме", "сакавте", "сакаа"]);
assert.deepEqual(byLemma.get("сака")!.forms.command, { "2sg": "сакај", "2pl": "сакајте" });
assert.equal(byLemma.get("сум")!.forms.future!["1sg"], "ќе бидам");
assert.equal(byLemma.get("оди")!.forms.future!["1pl"], "ќе одиме");
assert.equal(byLemma.get("купи")!.forms.haveDone!["1sg"], "сум купил");
assert.equal(byLemma.get("купи")!.forms.haveDone!["3pl"], "купиле");
assert.equal(byLemma.get("дојде")!.forms.haveDone!["3sg"], "дошол");
assert.equal(byLemma.get("гледа")!.forms.pastOngoing!["3sg"], "гледаше", "an ongoing verb's past is -ше, never a bare гледа");
assert.equal(byLemma.get("гледа")!.forms.pastDone, undefined);
assert.deepEqual(Object.keys(byLemma.get("треба")!.forms.present!), ["3sg", "3pl"]);
assert.equal(byLemma.get("треба")!.forms.command, undefined);
console.log("✓ rules on the verbs Wiktionary lacks");

// 5. Patterns: every pattern a verb follows exists, every variant has a verb, and partners point both ways.
{
  const variants = new Set(pack.verbPatterns!.flatMap((p) => p.variants.map((v) => v.id)));
  const used = new Set<string>();
  for (const v of verbs) for (const id of Object.values(v.patterns)) { if (id === "irregular") continue; assert.ok(variants.has(id!), `${v.lemma} follows ${id}`); used.add(id!); }
  for (const id of variants) assert.ok(used.has(id), `some verb follows ${id}`);
  for (const v of verbs) if (v.partner) {
    const p = byLemma.get(v.partner);
    assert.ok(p, `${v.lemma}'s partner ${v.partner} is in the bank`);
    assert.equal(p.partner, v.lemma, `${v.partner} points back to ${v.lemma}`);
    assert.notEqual(p.aspect, v.aspect, `${v.lemma} / ${v.partner} are one ongoing, one done`);
  }
  const points = new Set(pack.course!.points.map((p) => p.id));
  for (const p of pack.verbPatterns!) { assert.ok(points.has(p.pointId!), `${p.id}'s point`); for (const v of p.variants) if (v.pointId) assert.ok(points.has(v.pointId)); }
  console.log(`✓ ${variants.size} pattern variants, each followed by a verb; partners pair up`);
}

// 6. No Latin letters hiding in the Macedonian (о vs o, а vs a…).
for (const v of verbs) for (const t of Object.values(v.forms)) for (const f of Object.values(t!)) assert.ok(!/[a-z]/i.test(f!), `${v.lemma}: ${f}`);
for (const p of pack.verbPatterns!) for (const s of [p.how, p.when, ...(p.notes ?? []), ...p.variants.flatMap((v) => [v.spot, ...Object.values(v.endings)])])
  for (const w of s!.split(/[^\p{L}]+/u)) assert.ok(!(/[Ѐ-ӿ]/.test(w) && /[a-z]/i.test(w)), `mixed scripts in "${w}" (${p.id})`);
console.log("✓ no mixed-script words");
console.log("verbs: all passed");
