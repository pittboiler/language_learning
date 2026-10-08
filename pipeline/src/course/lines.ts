// Every existing target-language line in a pack, addressable by a stable `source` (see LineRef in
// pack-schema), plus the pack's word corpus. Shared by the course generator (run-course.ts) and the course
// lint: the blueprint may only POINT AT these lines, never introduce new target-language text.
import type { LanguagePack, LineRef } from "@ll/pack-schema";
import { resolveChapters } from "@ll/core/chapters";
import { normalize } from "@ll/core/familiarity";

export interface CatalogLine extends LineRef {
  /** Order of the chapter whose content holds the line (0 for chapter-less grammar examples). */
  chapterOrder: number;
  kind: "story" | "qa" | "scenario" | "reader" | "grammar" | "vocab" | "sentence";
}

/** Split a grammar example "<target> — <English>" into its halves. */
export const splitExample = (ex: string): { text: string; gloss: string } => {
  const i = ex.indexOf(" — ");
  return i === -1 ? { text: ex.trim(), gloss: "" } : { text: ex.slice(0, i).trim(), gloss: ex.slice(i + 3).trim() };
};

export function lineCatalog(pack: LanguagePack): CatalogLine[] {
  const out: CatalogLine[] = [];
  for (const c of resolveChapters(pack)) {
    const order = c.chapter.order;
    for (const s of c.stories) {
      s.body.forEach((b, i) => out.push({ source: `story:${s.id}#${i}`, text: b.text, gloss: b.gloss, chapterOrder: order, kind: "story" }));
      for (const q of s.qa) {
        out.push({ source: `qa:${s.id}#${q.id}:q`, text: q.question, gloss: q.questionGloss, chapterOrder: order, kind: "qa" });
        out.push({ source: `qa:${s.id}#${q.id}:a`, text: q.answer, gloss: q.answerGloss, chapterOrder: order, kind: "qa" });
      }
    }
    for (const s of c.scenarios) s.script.forEach((t, i) => out.push({ source: `scenario:${s.id}#${i}`, text: t.text, gloss: t.gloss, chapterOrder: order, kind: "scenario" }));
    for (const r of c.readers) r.body.forEach((t, i) => out.push({ source: `reader:${r.id}#${i}`, text: t.text, gloss: t.gloss, chapterOrder: order, kind: "reader" }));
  }
  for (const g of pack.grammar) {
    g.examples.forEach((ex, i) => {
      const { text, gloss } = splitExample(ex);
      out.push({ source: `grammar:${g.id}#${i}`, text, gloss, chapterOrder: 0, kind: "grammar" });
    });
  }
  // Phrases the course teaches as words ("Можете ли да повторите?"): a phrase can lean on grammar from a later
  // chapter too, and its card carries the same kind of note. Chapter = the course chapter that teaches it.
  for (const c of pack.course?.chapters ?? []) {
    for (const w of c.words) {
      if (normalize(w.display).split(/\s+/).filter(Boolean).length < 2) continue;
      const v = pack.vocab.find((x) => normalize(x.answer) === normalize(w.display));
      if (v && !out.some((l) => l.source === `vocab:${v.id}`)) out.push({ source: `vocab:${v.id}`, text: v.answer, gloss: v.gloss, chapterOrder: c.order, kind: "vocab" });
    }
  }
  // Build-a-sentence items, tagged like any line so the builder only offers grammar the course has taught.
  // Every person's version shares the grammar, so the first stands for the item.
  for (const it of pack.sentences ?? []) {
    const v = it.variants[0];
    if (v) out.push({ source: `sentence:${it.id}`, text: v.mk, gloss: v.en, chapterOrder: 0, kind: "sentence" });
  }
  return out;
}

/** Resolve a LineRef source to the line's current text (undefined ⇒ the source no longer exists). */
export function resolveSource(pack: LanguagePack, source: string): string | undefined {
  const m = /^(story|qa|scenario|reader|grammar|vocab|sentence):([^#]+)(?:#(.+))?$/.exec(source);
  if (!m) return undefined;
  const [, kind, id, rest] = m;
  if (kind === "vocab") return pack.vocab.find((v) => v.id === id)?.answer;
  if (kind === "sentence") return pack.sentences?.find((x) => x.id === id)?.variants[0]?.mk;
  if (kind === "story") return pack.stories?.find((s) => s.id === id)?.body[Number(rest)]?.text;
  if (kind === "qa") {
    const [qaId, side] = (rest ?? "").split(":");
    const q = pack.stories?.find((s) => s.id === id)?.qa.find((x) => x.id === qaId);
    return q ? (side === "a" ? q.answer : q.question) : undefined;
  }
  if (kind === "scenario") return pack.scenarios.find((s) => s.id === id)?.script[Number(rest)]?.text;
  if (kind === "reader") return pack.readers.find((r) => r.id === id)?.body[Number(rest)]?.text;
  const ex = pack.grammar.find((g) => g.id === id)?.examples[Number(rest)];
  return ex === undefined ? undefined : splitExample(ex).text;
}

/** Every target-language word form the pack contains — the vocabulary the blueprint's prose may quote. */
export function wordCorpus(pack: LanguagePack): Set<string> {
  const words = new Set<string>();
  const add = (s: string | undefined) => { for (const w of tokens(s ?? "")) words.add(w); };
  for (const l of lineCatalog(pack)) add(l.text);
  for (const v of pack.vocab) add(v.answer);
  for (const g of pack.grammar) {
    // The authored lessons' own prose quotes target-language forms too (e.g. imperatives: земи).
    add(g.plain); add(g.explanation);
    for (const row of g.pattern?.rows ?? []) row.forEach(add);
    for (const d of g.drills) { add(d.answer); (d.options ?? []).forEach(add); }
  }
  for (const c of pack.conjugations ?? []) { add(c.lemma); Object.values(c.forms).forEach(add); }
  for (const s of pack.sentences ?? []) for (const v of s.variants) add(v.mk);
  for (const a of pack.alphabet) for (const e of a.examples) add(e.text);
  return words;
}

/** Cyrillic word tokens of a string, normalized. */
export function tokens(s: string): string[] {
  return (s.match(/[\p{Script=Cyrillic}]+/gu) ?? []).map((t) => normalize(t)).filter(Boolean);
}

/** Cyrillic words quoted in English prose, skipping affixes written with a hyphen (-от, по-, нај-) —
 *  those name a piece of a word, not a word, so they can't be checked against the corpus. */
export function proseWords(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/(-?)([\p{Script=Cyrillic}]+)(-?)/gu)) {
    if (m[1] || m[3]) continue;
    const w = normalize(m[2]!);
    if (w) out.push(w);
  }
  return out;
}
