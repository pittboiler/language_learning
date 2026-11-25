// Verb pattern drills (batch 3, 2026-11-14): built across many verbs, kept per pattern × person, the weakest
// first and the newest tense always in. Walks the real Macedonian course.
//   Run with: npx tsx apps/web/test/verb-drills.test.ts
import assert from "node:assert/strict";
import { macedonian as pack } from "@ll/pack-mk";
import * as vd from "../lib/verb-drills.js";
import * as plan from "../lib/today-plan.js";
import * as cp from "../lib/course-player.js";
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
// 10. Each verb's own review (2026-11-25): right moves a verb along the waits, a miss sends it back to the
// start, and the next drill opens with it.
{
  const t0 = new Date("2026-12-01T18:00:00Z");
  const day = (n: number) => new Date(t0.getTime() + n * 864e5);
  let p = vd.recordVerbAnswer(at(5, 6), "сака", true, t0);
  assert.equal(p.verbReview?.["сака"]?.step, 1);
  const pk = (now: Date) => vd.verbPicker(p, vd.knownVerbs(pack, p), now);
  assert.equal(vd.verbTier(pk(t0), "сака"), 4, "right: waits");
  assert.equal(vd.verbTier(pk(new Date(t0.getTime() + 20 * 36e5)), "сака"), 3, "back the next day (20 hours on), not 24 hours later");
  p = vd.recordVerbAnswer(p, "сака", true, day(1));
  assert.equal(p.verbReview?.["сака"]?.step, 2);
  assert.ok(vd.verbTier(pk(day(3)), "сака") === 4 && vd.verbTier(pk(day(4)), "сака") === 3, "then three days");
  p = vd.recordVerbAnswer(p, "сака", false, day(4));
  assert.deepEqual([p.verbReview?.["сака"]?.step, p.verbReview?.["сака"]?.right, p.verbReview?.["сака"]?.wrong], [0, 2, 1], "a miss: back to the start");
  assert.equal(vd.verbTier(pk(day(4)), "сака"), 0, "missed: first in line");
  const next = vd.buildVerbDrill(pack, p, { size: 3, seed: 2, now: day(5) });
  assert.equal(next[0]?.lemma, "сака", `the drill opens with the verb you missed (${next.map((q) => q.lemma)})`);
  // A drill's answers count per verb as well as per pattern.
  const q = next[1]!;
  const after = vd.recordVerbResults(p, [{ q, ok: true }], day(5));
  assert.equal(after.verbReview?.[q.lemma]?.right, (p.verbReview?.[q.lemma]?.right ?? 0) + 1);
  console.log("✓ a verb's review: 1, 3… days on when right, back next lesson when missed");
}

// 11. The course's own verbs come first; at most one new verb a drill, and once met it isn't new.
{
  const p = at(5, 6);
  for (let seed = 0; seed < 12; seed++) {
    const qs = vd.buildVerbDrill(pack, p, { size: 6, seed });
    assert.ok(qs.filter((x) => x.isNew).length <= vd.NEW_VERBS, `seed ${seed}: one new verb at most (${qs.map((x) => `${x.lemma}${x.isNew ? "*" : ""}`)})`);
    assert.equal(new Set(qs.map((x) => x.lemma)).size, qs.length, "a verb once a drill");
  }
  const known = vd.knownVerbs(pack, p);
  const first = vd.buildVerbDrill(pack, p, { size: 3, seed: 1 });
  const fresh = first.find((x) => x.isNew);
  if (fresh) {
    const met = vd.recordVerbResults(p, [{ q: fresh, ok: true }]);
    assert.ok(!vd.isNewVerb(vd.verbPicker(met, known), fresh.lemma), "met once: no longer new");
  }
  console.log("✓ course verbs first, one new verb a drill at most");
}

// 12. Walking the course a lesson a day, with some misses: every miss is back the next lesson, the drills
// reach well beyond the course's own verbs, and a verb met before the last chapters comes back.
{
  const t0 = Date.parse("2026-12-01T18:00:00Z");
  let p: Progress = at(1, 1);
  const seen = new Map<string, number[]>();
  let lesson = 0, missesBack = 0, misses = 0;
  let pending: string[] = [];
  for (const c of chapters) for (const s of c.sessions) {
    const now = new Date(t0 + lesson * 864e5);
    const here = { ...at(c.order, s.n), verbPractice: p.verbPractice, verbReview: p.verbReview, courseLog: Array(lesson).fill({}) } as Progress;
    const qs = vd.buildVerbDrill(pack, here, { size: plan.VERB_DRILL, seed: lesson, now });
    for (const m of pending) { misses++; if (qs.some((x) => x.lemma === m)) missesBack++; }
    pending = [];
    const results = qs.map((x, i) => ({ q: x, ok: (lesson * 3 + i) % 7 !== 3 }));
    for (const r of results) { if (!r.ok) pending.push(r.q.lemma); seen.set(r.q.lemma, [...(seen.get(r.q.lemma) ?? []), c.order]); }
    p = vd.recordVerbResults(here, results, now);
    lesson++;
  }
  const taught = vd.knownVerbs(pack, at(12, 9));
  const drillOnly = [...seen.keys()].filter((l) => !taught.has(l));
  const onceEarly = [...seen].filter(([, xs]) => xs.length === 1 && xs[0]! < 11).map(([l]) => l);
  assert.ok(misses > 10 && missesBack === misses, `every miss back the next lesson (${missesBack}/${misses})`);
  assert.ok(drillOnly.length >= 8, `new verbs keep coming in (${drillOnly.length}: ${drillOnly})`);
  assert.deepEqual(onceEarly, [], "a verb met before chapter 11 comes back");
  console.log(`✓ the course, a lesson a day: ${seen.size} verbs (${drillOnly.length} beyond the course's own), ${missesBack}/${misses} misses back next lesson`);
}

// 13. "Switch the person" on the verb engine: any verb you've been taught, in a tense you've been taught
// (an irregular past once all its forms are), not just the 16 with a hand-made table.
{
  const open = (order: number, n: number) => plan.switchableVerbs(pack, at(order, n));
  const ch4 = chapters.find((c) => c.order === 4)!;
  const teachA = ch4.sessions.find((s) => s.pointId === "pt-verbs-a" && s.role === "teach")!;
  assert.ok(open(4, teachA.n + 1).has("разбира|present") && !open(4, teachA.n).has("разбира|present"), "разбира switches once the а-verbs are taught");
  assert.ok(!open(9, 2).has("сум|pastOngoing") && open(9, 4).has("сум|pastOngoing"), "сум's past once бевме / бевте / беа are taught too");
  assert.ok(open(9, 4).has("чита|pastOngoing") && open(9, 4).has("отиде|pastDone"), "any known verb's past once the past is taught");
  assert.ok(open(12, 9).size > 3 * 16, `many more tables than the old 16 verbs (${open(12, 9).size})`);
  const all = new Set(cp.switchTables(pack).map((t) => t.id));
  const one = (text: string, seed = 0) => cp.switchPersonItem(pack, { id: "t", body: [{ text, gloss: "…" }] } as never, all, () => false, seed);
  const sw = one("Ние читавме книга.");
  assert.ok(sw && sw.lemma === "чита" && sw.options.includes(sw.blank) && /^(Вие|Тие|Ти|Јас|Таа) /.test(sw.filled), `the past switches: ${sw?.filled}`);
  assert.equal(one("Таа ќе дојде утре.")?.lemma, "дојде", "a done verb's present after ќе");
  assert.equal(one("Добро, ќе ги земам."), undefined, "земам after ќе could be зема or земе: left alone");
  for (let seed = 0; seed < 6; seed++) { const x = one("Тие беа уморни.", seed); assert.ok(!x || x.person.endsWith("pl"), `an adjective after сум's past keeps the number: ${x?.filled}`); }
  assert.equal(one("Јас учам и работам."), undefined, "two verbs: left alone");
  console.log("✓ switch the person: any taught verb, present and past, from the verb engine");
}
console.log("verb-drills: all passed");
