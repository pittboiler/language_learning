// Verb pattern drills (batch 3, 2026-11-14): built across many verbs, kept per pattern × person, the weakest
// first and the newest tense always in. Walks the real Macedonian course.
//   Run with: npx tsx apps/web/test/verb-drills.test.ts
import assert from "node:assert/strict";
import { macedonian as pack } from "@ll/pack-mk";
import * as vd from "../lib/verb-drills.js";
import * as plan from "../lib/today-plan.js";
import type { Progress } from "../lib/store.js";

const course = pack.course!;
const chapters = [...course.chapters].sort((a, b) => a.order - b.order);
/** A learner who has done every session before (order, n): its points taught, its stories read. */
function at(order: number, n: number, extra: Partial<Progress> = {}): Progress {
  const seen: Record<string, boolean> = {};
  const reads: Record<string, string[]> = {};
  for (const c of chapters) for (const s of c.sessions) {
    if (c.order > order || (c.order === order && s.n >= n)) continue;
    if (s.role === "teach" && s.pointId) seen[s.pointId] = true;
    if (s.story) reads[s.story.id] = ["2026-11-01"];
  }
  const ch = chapters.find((c) => c.order === order)!;
  return { familiarity: {}, scenarios: {}, settings: { courseV2: true }, letters: {}, seenGrammar: seen, storyReads: reads, course: { chapterId: ch.chapterId, session: n, v: (course as { version?: number }).version }, ...extra } as unknown as Progress;
}
const ok = (q: vd.VerbQuestion, where: string) => {
  assert.ok(q.options.includes(q.answer), `${where}: answer among the options (${q.answer} / ${q.options})`);
  assert.equal(new Set(q.options).size, q.options.length, `${where}: options distinct (${q.options})`);
  assert.ok(q.options.length >= 2 && q.options.length <= 3, `${where}: 2-3 options (${q.options})`);
  assert.ok(q.shown.includes(vd.BLANK), `${where}: a blank to fill (${q.shown})`);
  assert.ok(q.filled.toLowerCase().includes(q.answer.toLowerCase()), `${where}: filled has the answer (${q.filled})`);
  assert.ok(!q.why.includes("undefined") && !q.ask.includes("undefined"), `${where}: no undefined in the text`);
};

// 1. Every session of the course: the drill builds, and every question is well-formed.
{
  let total = 0;
  const kinds = new Map<string, number>();
  for (const c of chapters) for (const s of c.sessions) for (const seed of [0, 1, 2]) {
    const p = at(c.order, s.n);
    for (const q of vd.buildVerbDrill(pack, p, { size: 3, seed })) { ok(q, `ch${c.order} s${s.n}`); total++; kinds.set(q.kind, (kinds.get(q.kind) ?? 0) + 1); }
  }
  assert.ok((kinds.get("same") ?? 0) > 0 && (kinds.get("time") ?? 0) > 0 && (kinds.get("which") ?? 0) > 0, `all three kinds come up: ${[...kinds]}`);
  console.log(`✓ ${total} questions across the course, all well-formed (${[...kinds].map(([k, n]) => `${k} ${n}`).join(", ")})`);
}

// 2. Nothing before the first pattern is taught; then only what's taught.
{
  const ch3 = at(3, 4);
  assert.equal(vd.buildVerbDrill(pack, ch3, { size: 3 }).length, 0, "no verb patterns before chapter 4");
  const teachA = chapters.find((c) => c.order === 4)!.sessions.find((s) => s.pointId === "pt-verbs-a" && s.role === "teach")!;
  const after = at(4, teachA.n + 1);
  const qs = vd.buildVerbDrill(pack, after, { size: 3 });
  assert.ok(qs.length === 3 && qs.every((q) => q.variant === "present-a"), `chapter 4: only the а-verbs (${qs.map((q) => q.variant)})`);
  console.log("✓ patterns come in as the course teaches them");
}

// 3. The daily warm-up: сум's match until a pattern is taught, then three pattern questions instead.
{
  const steps = (p: Progress) => plan.courseSteps(pack, p);
  const early = steps(at(2, 3)).find((s) => s.kind === "warmup");
  if (early && early.kind === "warmup") assert.equal(early.verbs, undefined, "chapter 2: no pattern questions");
  const later = steps(at(5, 6)).find((s) => s.kind === "warmup");
  assert.ok(later && later.kind === "warmup" && later.verbs?.length === plan.VERB_DRILL && !later.conjVerb, "chapter 5: three pattern questions, no one-verb match");
  console.log("✓ the warm-up swaps the one-verb match for pattern questions from chapter 4");
}

// 4. The newest tense is always in: from chapter 9 every drill has a past question (chapters 10–12 revisit it).
{
  for (const order of [10, 11, 12]) for (const n of [2, 4]) {
    const p = at(order, n);
    for (const seed of [0, 1, 2, 3]) {
      const qs = vd.buildVerbDrill(pack, p, { size: 3, seed });
      const newest = order === 12 && p.seenGrammar?.["pt-perfect"] ? ["haveDone"] : ["pastOngoing", "pastDone"];
      assert.ok(qs.some((q) => newest.includes(q.tense)), `ch${order} s${n} seed ${seed}: the newest tense is asked (${qs.map((q) => q.tense)})`);
    }
  }
  console.log("✓ chapters 10–12: every drill brings the past back");
}

// 5. Weakest first: a pattern × person you missed comes back before ones you got right.
{
  let p = at(5, 6);
  const first = vd.buildVerbDrill(pack, p, { size: 3, seed: 0 });
  // Everything right, except one miss.
  const all = vd.unlockedVariants(pack, p).flatMap((v) => (["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"] as const).map((person) => ({ v, person })));
  const results: vd.VerbResult[] = all.map(({ v, person }) => ({ q: { ...first[0]!, variant: v.variant.id, person }, ok: !(v.variant.id === "present-e" && person === "3pl") }));
  p = vd.recordVerbResults(p, results);
  assert.equal(p.verbPractice?.["present-e|3pl"]?.wrong, 1);
  const next = vd.buildVerbDrill(pack, p, { size: 3, seed: 5 });
  assert.ok(next.some((q) => q.variant === "present-e" && q.person === "3pl"), `the miss comes back: ${next.map((q) => vd.keyOf(q.variant, q.person))}`);
  assert.deepEqual(vd.variantStrength(p, "present-e"), { right: 5, wrong: 1 });
  console.log("✓ the weakest pattern × person comes back first");
}

// 6. "Same pattern" moves on to other verbs: the verbs it drilled lately sit out while others are left.
{
  let p = at(5, 6);
  const seen: string[] = [];
  for (let i = 0; i < 6; i++) {
    const qs = vd.buildVerbDrill(pack, p, { size: 1, only: ["present-a"], seed: 3 });
    assert.equal(qs.length, 1);
    seen.push(qs[0]!.lemma);
    p = vd.recordVerbResults(p, [{ q: qs[0]!, ok: true }]);
  }
  assert.equal(new Set(seen).size, seen.length, `six drills, six different а-verbs: ${seen}`);
  console.log(`✓ "same pattern" moves through the verbs: ${seen.join(", ")}`);
}

// 7. Switch the time: a past line swaps only its verb; a future puts ќе (or нема да for не) in front.
{
  const p = at(9, 7);
  const past = vd.variantsOf(pack).find((v) => v.variant.id === "past-ongoing")!;
  const fut = vd.variantsOf(pack).find((v) => v.variant.id === "future")!;
  const known = vd.knownVerbs(pack, p);
  let n = 0;
  for (let seed = 0; seed < 40; seed++) {
    for (const info of [past, fut]) {
      const q = vd.switchTime(pack, p, info, undefined, known, seed);
      if (!q) continue;
      n++;
      ok(q, `time ${q.line!.text}`);
      assert.notEqual(q.filled, q.line!.text, "the line changes");
      if (info === fut) assert.ok(/(^|\s)(ќе|нема да)\s/i.test(q.filled + " "), `a future: ${q.filled}`);
      if (info === past) assert.equal(q.filled.split(/\s+/).length, q.line!.text.split(/\s+/).length, `the past swaps one word: ${q.line!.text} → ${q.filled}`);
    }
  }
  assert.ok(n > 10, `switch-the-time questions found (${n})`);
  console.log(`✓ ${n} switch-the-time questions keep the line whole`);
}

// 8. Which past: ongoing ↔ done, only once both pasts and the pairs (pt-aspect) are taught.
{
  const p = at(9, 7);
  assert.ok(p.seenGrammar?.["pt-aspect"]);
  const known = vd.knownVerbs(pack, p);
  for (const id of ["past-ongoing", "past-done", "past-done-o"]) {
    const info = vd.variantsOf(pack).find((v) => v.variant.id === id)!;
    const q = vd.whichPast(pack, info, "1sg", known, 0);
    assert.ok(q, `a which-past for ${id}`);
    ok(q, `which ${id}`);
    const v = pack.verbs!.find((x) => x.lemma === q.lemma)!;
    assert.ok(q.options.includes((id === "past-ongoing" ? pack.verbs!.find((x) => x.lemma === v.partner)!.forms.pastDone : pack.verbs!.find((x) => x.lemma === v.partner)!.forms.pastOngoing)!["1sg"]!), "the other half of the pair is the trap");
  }
  console.log("✓ which-past offers both halves of a pair");
}

// 9. The checkpoint asks verb questions and counts them; practice rounds too.
{
  const c5 = chapters.find((c) => c.order === 5)!;
  const p = at(5, c5.sessions.length);
  const step = plan.courseSteps(pack, p).find((s) => s.kind === "chapterEnd");
  assert.ok(step && step.kind === "chapterEnd");
  assert.equal(step.checkpoint.verbs.length, 4, "4 verb questions in the checkpoint");
  assert.ok(step.checkpoint.verbs.filter((q) => q.variant === "present-i" || q.variant === "present-e").length >= 2, "half on the chapter's own patterns (-и / -е verbs)");
  assert.equal(step.practice.chapter.verbs.length, 2);
  assert.equal(step.practice.all.verbs.length, 2);
  console.log("✓ checkpoint and practice rounds carry verb questions");
}
console.log("verb-drills: all passed");
