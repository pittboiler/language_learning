// Runnable checks for carrying progress over when a big card is split into smaller ones (Jake, 2026-11-16: "this
// is a LOT for one card… no more than 2-3 max"): what a learner studied on the old card counts on the new ones, so
// nothing comes back as new, and the old bundle leaves their deck.
//   Run with: npx tsx apps/web/test/card-splits.test.ts
import assert from "node:assert/strict";
import { macedonian as pack } from "@ll/pack-mk";
import * as familiarity from "@ll/core/familiarity";
import type { FamiliarityEntry } from "@ll/core/familiarity";
import type { Progress } from "../lib/store.js";
import { carryOverSplitCards } from "../lib/card-splits.js";
import { courseSteps, type TodayStep } from "../lib/today-plan.js";

const course = pack.course!;
const past = new Date("2026-01-01T00:00:00Z");
const later = new Date("2026-02-01T00:00:00Z");
const entry = (display: string, at = past): FamiliarityEntry =>
  familiarity.capture({ lexKey: familiarity.normalize(display), kind: display.includes(" ") ? "chunk" : "word", display }, at);
const fam = (...es: FamiliarityEntry[]) => Object.fromEntries(es.map((e) => [e.lexKey, e]));

// 1. One old card → the new card made only from it; a card made from two old ones waits for both.
{
  const out = carryOverSplitCards(fam(entry("два, три, четири, пет")), pack);
  assert.ok(out["два, три, четири"], "два, три, четири carries over");
  assert.equal(out["два, три, четири"]!.display, "два, три, четири", "with the new card's own text");
  assert.equal(out["пет, шест, седум"], undefined, "пет, шест, седум waits for шест … десет too");
  assert.equal(out["два, три, четири, пет"], undefined, "the old card is gone");
}
// 2. Both old cards met: the shared card takes the one due soonest.
{
  const early = { ...entry("два, три, четири, пет"), srs: { ...entry("два, три, четири, пет").srs!, due: past } };
  const late = { ...entry("шест, седум, осум, девет, десет", later), srs: { ...entry("шест, седум, осум, девет, десет", later).srs!, due: later } };
  const out = carryOverSplitCards(fam(early, late), pack);
  assert.deepEqual(Object.keys(out).sort(), ["два, три, четири", "осум, девет, десет", "пет, шест, седум"], "three new cards, no old ones");
  assert.equal(new Date(out["пет, шест, седум"]!.srs!.due).getTime(), past.getTime(), "the shared card is due when the sooner one was");
  // Run again: nothing changes.
  assert.deepEqual(carryOverSplitCards(out, pack), out, "a second run changes nothing");
}
// 3. Only seen in a story: the new card is only seen too, so a lesson still teaches it.
{
  const seen = { ...entry("сок"), lexKey: "чај / сок / вода / кафе / пиво", display: "чај / сок / вода / кафе / пиво", tags: [familiarity.EXPOSED_TAG] };
  const out = carryOverSplitCards(fam(seen), pack);
  assert.ok(out["кафе / чај"] && !familiarity.isStudied(out["кафе / чај"]!), "still only seen");
}
// 4. A card the learner already has is left alone, and progress without old cards is returned as it was.
{
  const own = entry("кафе / чај", later);
  const out = carryOverSplitCards(fam(entry("чај / сок / вода / кафе / пиво"), own), pack);
  assert.equal(out["кафе / чај"], own, "their own entry stays");
  const none = fam(entry("пиво"));
  assert.equal(carryOverSplitCards(none, pack), none, "nothing to do: the same object");
}

// 5. Jake, 2026-11-16: through chapter 3 on the old cards (drinks as one card, 2–5, 6–10, the teens, the tens,
//    25, a lot / a little), now at chapter 4. After the carry-over nothing he studied is new or a catch-up.
{
  const retiredNew = new Set(Object.values(pack.retiredCards ?? {}).flat().map(familiarity.normalize));
  const current = course.chapters.filter((c) => c.order <= 3).flatMap((c) => c.sessions.flatMap((s) => s.words)).filter((w) => !retiredNew.has(w.lexKey)).map((w) => entry(w.display));
  const old = ["чај / сок / вода / кафе / пиво", "два, три, четири, пет", "шест, седум, осум, девет, десет", "единаесет, дванаесет, тринаесет, четиринаесет, петнаесет",
    "шеснаесет, седумнаесет, осумнаесет, деветнаесет", "дваесет, триесет, четириесет, педесет, шеесет", "седумдесет, осумдесет, деведесет", "дваесет и пет", "многу / малку"].map((d) => entry(d));
  const carried = carryOverSplitCards(fam(...current, ...old), pack);
  for (const k of Object.keys(pack.retiredCards ?? {})) assert.equal(carried[familiarity.normalize(k)], undefined, `no ${k} left`);
  const at = (o: number, n: number, more: FamiliarityEntry[] = []): Progress => ({ familiarity: { ...carried, ...fam(...more) }, scenarios: {}, settings: { courseV2: true }, letters: Object.fromEntries(pack.alphabet.map((a) => [a.glyph, true])), seenGrammar: {},
    course: { chapterId: course.chapters.find((c) => c.order === o)!.chapterId, session: n, v: course.version } }) as unknown as Progress;
  const newWords = (p: Progress) => courseSteps(pack, p).filter((x): x is Extract<TodayStep, { kind: "newwords" }> => x.kind === "newwords").flatMap((x) => x.words.map((w) => w.lexKey));
  assert.deepEqual(newWords(at(4, 1)), ["имам", "давам"], "chapter 4, day 1: only the verbs");
  assert.deepEqual(newWords(at(4, 2, [entry("имам"), entry("давам")])), ["сто, двесте, триста"], "day 2: coffee and tea and 70–90 are known; the hundreds are new");
}
console.log("card-splits.test.ts: all assertions passed ✓");
