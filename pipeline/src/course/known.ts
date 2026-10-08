// What a learner knows at a given session, for the planner and the lint: the course player's answer
// (apps/web/lib/course-player.ts knownForms / formSlots) plus two allowances the app doesn't need — names,
// and a known noun carrying a definite-article ending once "the" has been taught (кафе → кафето).
import type { Course, LanguagePack } from "@ll/pack-schema";
import * as cp from "../../../apps/web/lib/course-player.js";
import { lineCatalog } from "./lines.js";

/** Words only ever written capitalized that appear mid-sentence somewhere: names (Ана, Марко, Скопје). */
export function properNames(pack: LanguagePack): Set<string> {
  const mid = new Set<string>();
  const capitalized = new Set<string>();
  const lower = new Set<string>();
  const texts = [...lineCatalog(pack).map((l) => l.text), ...pack.vocab.map((v) => v.answer)];
  for (const text of texts) {
    for (const m of text.matchAll(/[\p{Script=Cyrillic}]+/gu)) {
      const w = m[0];
      const t = cp.wordTokens(w)[0];
      if (!t) continue;
      if (w[0] === w[0]!.toLowerCase()) { lower.add(t); continue; }
      capitalized.add(t);
      const before = text.slice(0, m.index).trimEnd();
      if (before.length && !/[.!?„“"«»—:…]$/.test(before)) mid.add(t);
    }
  }
  return new Set([...capitalized].filter((t) => mid.has(t) && !lower.has(t)));
}

const ARTICLE_ENDINGS = ["от", "та", "то", "те", "ов", "ва", "во", "ве", "он", "на", "но", "не"];

/** "Is this word form known by this session?" for a whole course. */
export function knownAtSlot(pack: LanguagePack, course: Course): (token: string, at: cp.CourseSlot) => boolean {
  const forms = cp.formSlots(pack, course);
  const names = properNames(pack);
  const the = course.points.find((p) => p.grammarIds.includes("definite-articles"));
  const theAt = the ? cp.pointSlots(course).get(the.id) : undefined;
  const by = (t: string, at: cp.CourseSlot) => { const s = forms.get(t); return !!s && cp.cmpSlot(s, at) <= 0; };
  return (t, at) => {
    if (names.has(t) || by(t, at)) return true;
    if (!theAt || cp.cmpSlot(theAt, at) > 0) return false;
    return ARTICLE_ENDINGS.some((e) => t.length > e.length + 1 && t.endsWith(e) && by(t.slice(0, -e.length), at));
  };
}

/** The same question for a set of known forms (the planner, mid-layout). */
export function knownInSet(pack: LanguagePack, known: Set<string>, theTaught: boolean, names = properNames(pack)): (token: string) => boolean {
  return (t) => names.has(t) || known.has(t) || (theTaught && ARTICLE_ENDINGS.some((e) => t.length > e.length + 1 && t.endsWith(e) && known.has(t.slice(0, -e.length))));
}

/** "Which later points does this line make the learner use, at this session?" A point taught after `at`
 *  counts when the line carries one of its little grammar words (a point's short quick-check answers: ми,
 *  го, ќе, ли…) outside a phrase already taught as a whole ("Мило ми е" is a phrase; "Ми го дава" is
 *  ми-grammar), or when the line has words the learner hasn't met (then the later structure is new to them).
 *  Longer forms (учам, кафето) are ordinary words: knowing the word is enough. */
export function laterGrammarAt(pack: LanguagePack, course: Course): (text: string, source: string | undefined, at: cp.CourseSlot) => string[] {
  const ps = cp.pointSlots(course);
  const known = knownAtSlot(pack, course);
  const formsOf = new Map(course.points.map((p) => [p.id, new Set(p.cards.flatMap((c) => (c.kind === "blank" ? cp.wordTokens(c.blank) : [])).filter((t) => t.length <= 3))]));
  const phrases = course.chapters.flatMap((c) => c.sessions.flatMap((s) => s.words.map((w) => ({ toks: cp.wordTokens(w.display), at: { order: c.order, n: s.n } }))))
    .filter((p) => p.toks.length > 1);
  return (text, source, at) => {
    const toks = cp.wordTokens(text);
    const covered = new Set<number>();
    for (const p of phrases) {
      if (cp.cmpSlot(p.at, at) > 0) continue;
      for (let i = 0; i + p.toks.length <= toks.length; i++) if (p.toks.every((t, j) => toks[i + j] === t)) p.toks.forEach((_, j) => covered.add(i + j));
    }
    const unknown = toks.some((t) => !known(t, at));
    return (source ? course.lineTags[source] ?? [] : []).filter((p) => {
      const s = ps.get(p);
      if (!s || cp.cmpSlot(s, at) <= 0) return false;
      return unknown || toks.some((t, i) => formsOf.get(p)?.has(t) && !covered.has(i));
    });
  };
}
