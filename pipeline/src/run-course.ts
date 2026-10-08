// Offline generator for the COURSE BLUEPRINT (DESIGN-course-spine.md): the grammar spine + a
// session-by-session plan per chapter, written to packages/pack-mk/src/course.ts.
//
//   tag       LLM: tag every existing line with the spine points it uses, and write a one-line
//             "set phrase for now" note for lines that use a point taught in a LATER chapter.
//   points    LLM: write each point's agenda / rule / recap / Library text and its grammar cards. Every
//             target-language example is a REFERENCE to an existing line, never new text.
//   assemble  No LLM: lay out sessions (course/plan.ts) and write course.ts.
//   review    No LLM: render pipeline/output/course-review-mk.md for sign-off.
//   signoff   Mark the points of --chapters as validated once a human has signed them off.
//   lines     Print the lines of chapters/concepts with their sources (authoring aid): lines 4 5 clitics
//   fit       Lines that could serve a point's lesson at its teach session (authoring aid): fit pt-sum
//   focus     LLM: for every tagged story / question / conversation / grammar-example line, the words carrying each
//             point (today's focus is highlighted word by word) and one fill-in with two wrong options.
//   import    No LLM: merge drafts written outside the API (pipeline/course-drafts/*.json), held to the
//             same validation as LLM output. --keep-confidence keeps a signed-off point signed off (for
//             content fixes made under standing permission; list them in the PR).
//
// Idempotent: tags and points already in course.ts are kept unless --redo is passed.
//
// Run:  pipeline/node_modules/.bin/tsx pipeline/src/run-course.ts <tag|points|assemble|review|all>
//         [--chapters s0-repair,s0-greet] [--redo]
import "./env.js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Course, GrammarCard, GrammarPoint, LineRef } from "@ll/pack-schema";
import { macedonian } from "@ll/pack-mk";
import { structuredCall, MODELS } from "@ll/core/llm";
import { SPINE, spinePoints } from "./course/spine.js";
import { lineCatalog, proseWords, tokens, wordCorpus, type CatalogLine } from "./course/lines.js";
import { planCourse } from "./course/plan.js";
import { lintCourse } from "./lint.js";
import { blankOut } from "../../apps/web/lib/course-player.js";
import * as cpSlots from "../../apps/web/lib/course-player.js";
import { knownAtSlot, laterGrammarAt } from "./course/known.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "packages", "pack-mk", "src", "course.ts");
const REVIEW = join(ROOT, "pipeline", "output", "course-review-mk.md");
const pack = macedonian;
const cmd = process.argv[2] ?? "all";
const argVal = (flag: string) => { const i = process.argv.indexOf(flag); return i === -1 ? undefined : process.argv[i + 1]; };
const ONLY = argVal("--chapters")?.split(",");
const REDO = process.argv.includes("--redo");
const KEEP_CONFIDENCE = process.argv.includes("--keep-confidence");

const spine = spinePoints();
const catalog = lineCatalog(pack);
const corpus = wordCorpus(pack);
let cost = 0;

// ---- existing blueprint (so re-runs only fill gaps) ----
let course: Course = { points: [], chapters: [], stageReviews: [], lineTags: {}, chunkNotes: [] };
if (pack.course) course = structuredClone(pack.course);

// Notes read as one voice: no "Set phrase for now:" prefix, curly quotes, "chapter 2" not "ch2", capitalized.
const tidyNote = (n: string): string => {
  const t = n.trim().replace(/^set phrases? for now:\s*/i, "").replace(/'([^']+)'/g, "“$1”").replace(/\bch(\d+)\b/g, "chapter $1");
  return /^[a-z]/.test(t) ? t.charAt(0).toUpperCase() + t.slice(1) : t; // never recase a target-language word
};
// A note that opens with a target-language word keeps that word's casing from its own line ("да повторите",
// not "Да повторите"): an earlier tidy pass capitalized every note's first letter.
function restoreCase(note: string, line: string): string {
  const first = /^[\p{Script=Cyrillic}]+/u.exec(note)?.[0];
  if (!first) return note;
  const lower = first.charAt(0).toLowerCase() + first.slice(1);
  return line.includes(lower) && !line.includes(first) ? lower + note.slice(first.length) : note;
}

// Keep stored note text in step with the live lines (content fixes change a line's text, not its source).
const catalogBySource = new Map(catalog.map((l) => [l.source, l]));
course.chunkNotes = course.chunkNotes
  .filter((n) => catalogBySource.has(n.source))
  .map((n) => ({ ...n, text: catalogBySource.get(n.source)!.text, note: restoreCase(tidyNote(n.note), catalogBySource.get(n.source)!.text) }));

// Sanity: the spine must cover the pack's chapters, in order.
const packOrder = [...(pack.chapters ?? [])].sort((a, b) => a.order - b.order).map((c) => c.id);
if (packOrder.join() !== SPINE.map((c) => c.chapterId).join()) throw new Error(`spine chapters ${SPINE.map((c) => c.chapterId)} ≠ pack chapters ${packOrder}`);
if ((pack.chapters ?? []).some((c) => packOrder.indexOf(c.id) !== c.order)) throw new Error("pack chapter orders must equal their spine index (chapter 0 first)");

const pointList = spine.map((p) => `- ${p.id} (chapter ${p.chapterOrder}): ${p.title}. ${p.scope}`).join("\n");

// Which points a line uses that are taught in a LATER chapter than its own (per the CURRENT spine).
const laterFor = (source: string): string[] => {
  const l = catalogBySource.get(source);
  if (!l || !l.chapterOrder) return [];
  return (course.lineTags[source] ?? []).filter((p) => (spine.find((s) => s.id === p)?.chapterOrder ?? 0) > l.chapterOrder);
};
// A note written for a different "taught later" set (the spine moved a point) is stale: drop it, so lint
// flags the line and `notes` rewrites it with the right chapters.
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
const before = course.chunkNotes.length;
course.chunkNotes = course.chunkNotes.filter((n) => { const later = laterFor(n.source); return later.length > 0 && sameSet(later, n.pointIds); });
if (course.chunkNotes.length !== before) console.log(`dropped ${before - course.chunkNotes.length} set-phrase note(s) the spine change made stale or unnecessary`);

// =====================================================================================================
// tag
// =====================================================================================================
async function tag() {
  const groups = new Map<number, CatalogLine[]>();
  for (const l of catalog) {
    if (!REDO && course.lineTags[l.source]) continue;
    if (ONLY && l.chapterOrder > 0 && !ONLY.includes(packOrder[l.chapterOrder - 1]!)) continue;
    groups.set(l.chapterOrder, [...(groups.get(l.chapterOrder) ?? []), l]);
  }
  const SCHEMA = {
    type: "object", additionalProperties: false, required: ["lines"],
    properties: { lines: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["i", "points", "note"],
      properties: {
        i: { type: "integer" },
        points: { type: "array", items: { type: "string" }, description: "Spine point ids this line genuinely uses." },
        note: { type: "string", description: "Only when the line uses a point from a LATER chapter than the line's own chapter: one short learner-facing sentence. Otherwise empty." },
      },
    } } },
  };
  const SYSTEM =
    `You annotate lines of a ${pack.name} course for English-speaking beginners. The course teaches grammar as an ordered spine of small points:\n${pointList}\n\n` +
    `For each line, list the point ids the line GENUINELY uses (a structure actually present in the line, per that point's description). ` +
    `Be precise: tag pt-the only if a noun carries the article suffix; tag pt-verbs-a / pt-verbs-e-i only for a conjugated verb of that group; pt-sum only for a form of сум; ` +
    `pt-se only for се with a verb; pt-mi-ti-mu only for ми/ти/му/ѝ/ни/ви/им as a to-whom pronoun; pt-go-ja-gi only for го/ја/ги; pt-question-words only for a question word opening a question; ` +
    `pt-yes-no only for ли or дали questions; pt-ne only for не before a verb; pt-commands only for an imperative. A line may use no point.\n` +
    `NOTE: the line's chapter number is given. If the line uses a point whose chapter number is HIGHER than the line's chapter, write a note: ` +
    `one plain-English sentence (max ~20 words) telling a beginner to treat that part as a set phrase for now, naming what it does and the chapter that explains it, ` +
    `e.g. "Set phrase for now: ќе marks the future; chapter 8 explains it." Quote only words that appear in the line. Otherwise note is "".`;
  for (const [order, lines] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    for (let start = 0; start < lines.length; start += 40) {
      const batch = lines.slice(start, start + 40);
      const user = batch.map((l, i) => `${i}. [chapter ${l.chapterOrder || "any (grammar example)"}] ${l.text}  (${l.gloss})`).join("\n");
      const { data, costUsd } = await structuredCall<{ lines: { i: number; points: string[]; note: string }[] }>({
        model: MODELS.offline, system: SYSTEM, user: `Annotate:\n${user}`, schema: SCHEMA, maxTokens: 16000, thinking: true,
      });
      cost += costUsd;
      const valid = new Set(spine.map((p) => p.id));
      for (const r of data.lines) {
        const l = batch[r.i];
        if (!l) continue;
        const pts = r.points.filter((p) => valid.has(p));
        course.lineTags[l.source] = pts;
        course.chunkNotes = course.chunkNotes.filter((n) => n.source !== l.source);
        const later = pts.filter((p) => l.chapterOrder > 0 && spine.find((s) => s.id === p)!.chapterOrder > l.chapterOrder);
        if (later.length) course.chunkNotes.push({ source: l.source, text: l.text, pointIds: later, note: tidyNote(r.note || "A later chapter explains how this works.") });
      }
      for (const l of batch) course.lineTags[l.source] ??= [];
      console.log(`  tagged chapter ${order || "grammar"} lines ${start + 1}-${start + batch.length}: $${costUsd.toFixed(3)}`);
    }
  }
}

// =====================================================================================================
// notes — (re)write set-phrase notes for lines that need one and don't have it (tags unchanged)
// =====================================================================================================
async function writeNotes() {
  const todo = catalog.filter((l) => laterFor(l.source).length && !course.chunkNotes.some((n) => n.source === l.source));
  console.log(`${todo.length} line(s) need a set-phrase note`);
  const SCHEMA = { type: "object", additionalProperties: false, required: ["notes"], properties: { notes: { type: "array", items: {
    type: "object", additionalProperties: false, required: ["i", "note"], properties: { i: { type: "integer" }, note: { type: "string" } } } } } };
  const SYSTEM =
    `You write one-line "set phrase for now" notes for a ${pack.name} course for English-speaking beginners. A line uses grammar the ` +
    `course only explains in a LATER chapter; the note tells the learner what that bit does and which chapter explains it, so they can ` +
    `treat it as a set phrase until then. One plain sentence, max ~20 words, no "Set phrase for now:" prefix (the app adds it). ` +
    `Quote only words that appear in the line. Name each later point's chapter exactly as given. Example: "е means “is” (chapter 1) and во means “in” (chapter 7)."`;
  for (let i = 0; i < todo.length; i += 30) {
    const batch = todo.slice(i, i + 30);
    const user = batch.map((l, j) => `${j}. [chapter ${l.chapterOrder}] ${l.text} (${l.gloss}) — later points: ${laterFor(l.source).map((p) => { const sp = spine.find((x) => x.id === p)!; return `${sp.title} (chapter ${sp.chapterOrder}: ${sp.scope})`; }).join("; ")}`).join("\n");
    const { data, costUsd } = await structuredCall<{ notes: { i: number; note: string }[] }>({ model: MODELS.offline, system: SYSTEM, user: `Write a note for each:\n${user}`, schema: SCHEMA, maxTokens: 12000, thinking: true });
    cost += costUsd;
    for (const r of data.notes) {
      const l = batch[r.i];
      if (!l || !r.note.trim()) continue;
      course.chunkNotes.push({ source: l.source, text: l.text, pointIds: laterFor(l.source), note: restoreCase(tidyNote(r.note), l.text) });
    }
    console.log(`  notes ${i + 1}-${i + batch.length}: $${costUsd.toFixed(3)}`);
  }
}

// =====================================================================================================
// focus — where each tagged point sits inside a line (words to highlight + one fill-in with 2 distractors)
// =====================================================================================================
/** Is `w` a whole word of `line` (exact spelling, not part of a longer word)? */
const wholeWord = (line: string, w: string) =>
  !!w && new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").test(line);

/** Whole words the pack actually uses (lines, vocabulary, verb forms, drill answers), stricter than the corpus,
 *  which also holds grammar-table endings like -он: an explanation may only quote these. */
const realWords = (() => {
  const w = new Set<string>();
  for (const l of catalog) tokens(l.text).forEach((t) => w.add(t));
  for (const v of pack.vocab) tokens(v.answer).forEach((t) => w.add(t));
  for (const c of pack.conjugations ?? []) [c.lemma, ...Object.values(c.forms)].flatMap(tokens).forEach((t) => w.add(t));
  for (const g of pack.grammar) for (const d of g.drills) [d.answer, ...(d.options ?? [])].flatMap(tokens).forEach((t) => w.add(t));
  return w;
})();

/** Problems with a line's focus words (fatal) and, separately, with its fill-in (only the fill-in is dropped). */
function validateFocus(l: CatalogLine, point: string, f: { words: string[]; blank: { word: string; options: string[]; why: string } }): { words: string[]; blank: string[] } {
  const words: string[] = [];
  const blank: string[] = [];
  if (!(course.lineTags[l.source] ?? []).includes(point)) words.push(`${point} isn't a tag of this line`);
  if (!f.words.length) words.push(`${point}: no words`);
  for (const w of f.words) if (!wholeWord(l.text, w)) words.push(`${point}: "${w}" isn't a whole word of the line`);
  if (f.blank.word) {
    if (!f.words.includes(f.blank.word)) blank.push(`${point}: blank "${f.blank.word}" isn't one of its words`);
    const opts = new Set(f.blank.options);
    if (opts.size !== 3 || !opts.has(f.blank.word)) blank.push(`${point}: options must be 3 distinct incl. "${f.blank.word}"`);
    for (const o of f.blank.options) for (const t of tokens(o)) if (!corpus.has(t)) blank.push(`${point}: option "${o}" isn't in the pack`);
    if (!f.blank.why.trim()) blank.push(`${point}: no why`);
    const quoted = proseWords(f.blank.why).filter((w) => !realWords.has(w) && !tokens(l.text).includes(w));
    if (quoted.length) blank.push(`${point}: the why quotes words not in the pack: ${quoted.join(", ")}`);
  }
  return { words, blank };
}

/** Words of the right kind for each point's wrong options: the point's quick-check forms, its grammar
 *  tables and drills, and (for verb points) every conjugated form of that group in the pack. All are pack
 *  words, so a fill-in built from them passes the "no new language" check. */
function optionPool(): string {
  const groupsOf: Record<string, string[]> = { "verb-conjugation": ["a"], "verb-conjugation-e": ["e"], "verb-conjugation-i": ["i"], "to-be": ["irregular"] };
  return course.points.map((p) => {
    const w = new Set<string>();
    for (const c of p.cards) if (c.kind === "blank") [c.blank, ...c.options].forEach((o) => w.add(o));
    for (const g of p.grammarIds.map((id) => pack.grammar.find((x) => x.id === id)).filter(Boolean)) {
      for (const row of g!.pattern?.rows ?? []) for (const cell of row) for (const m of cell.match(/[\p{Script=Cyrillic}]+/gu) ?? []) w.add(m);
      for (const d of g!.drills) [d.answer, ...(d.options ?? [])].forEach((o) => { if (o && o.split(/\s+/).length === 1) w.add(o); });
      for (const grp of groupsOf[g!.id] ?? []) for (const v of pack.conjugations ?? []) if (v.group === grp) Object.values(v.forms).forEach((f) => w.add(f));
    }
    const list = [...w].filter((x) => tokens(x).every((t) => corpus.has(t))).slice(0, 60);
    return list.length ? `- ${p.id}: ${list.join(", ")}` : "";
  }).filter(Boolean).join("\n");
}

async function focus() {
  course.lineFocus ??= {};
  // A fill-in that no longer passes (e.g. its "why" quotes a word that isn't in the pack) is dropped; the
  // line keeps its words. Write a replacement by hand through `import` (lineFocus) if the line needs one.
  for (const [src, byPoint] of Object.entries(course.lineFocus)) {
    const l = catalogBySource.get(src);
    for (const [pid, f] of Object.entries(byPoint)) {
      if (l && f.blank && validateFocus(l, pid, { words: f.words, blank: f.blank }).blank.length) { delete f.blank; console.log(`  dropped the fill-in on ${src} (${pid})`); }
    }
  }
  const kinds = new Set(["story", "qa", "scenario", "grammar"]);
  const todo = catalog.filter((l) => kinds.has(l.kind) && (course.lineTags[l.source] ?? []).length
    && (REDO || (course.lineTags[l.source] ?? []).some((p) => !course.lineFocus![l.source]?.[p])));
  console.log(`${todo.length} line(s) need focus`);
  const SCHEMA = {
    type: "object", additionalProperties: false, required: ["lines"],
    properties: { lines: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["i", "points"],
      properties: {
        i: { type: "integer" },
        points: { type: "array", items: {
          type: "object", additionalProperties: false, required: ["point", "words", "blank"],
          properties: {
            point: { type: "string" },
            words: { type: "array", items: { type: "string" }, description: "Exact whole words of the line that carry this point." },
            blank: { type: "object", additionalProperties: false, required: ["word", "options", "why"], properties: {
              word: { type: "string", description: "One of `words` as a fill-in, or \"\" when no single word makes a fair blank." },
              options: { type: "array", items: { type: "string" } },
              why: { type: "string" },
            } },
          },
        } },
      },
    } } },
  };
  const SYSTEM =
    `You mark where grammar points sit inside lines of a ${pack.name} course for English-speaking beginners. The course's points:\n${pointList}\n\n` +
    `Each line comes with the point ids it uses. For EACH of those points give:\n` +
    `- words: the word(s) of the line that carry the point, copied EXACTLY as written (same capitalization), whole words only, no punctuation. ` +
    `E.g. pt-sum in „Ана е во Скопје.“ → ["е"]; pt-the in „Кафето е добро.“ → ["Кафето"]; pt-ne in „Извинете, не разбирам.“ → ["не"].\n` +
    `- blank: if one of those words makes a fair fill-in-the-blank for a beginner practising THIS point, give word (that word, exactly as written), ` +
    `options (exactly 3 distinct choices including the word; the other two are real ${pack.name} words of the same kind that would be WRONG here: ` +
    `another person's form, another gender, another question word, the form without the ending…; match the word's capitalization), ` +
    `and why (one short plain-English line saying why the right one is right, no jargon). If no single word is a fair blank, word is "" with empty options and why.\n` +
    `HARD RULE: never invent ${pack.name}. Options are checked against the course's word list, so take the wrong options from the words ` +
    `already in the line or from this list of course words for each point (anything else is rejected); a wrong option must be clearly wrong in this line.\n${optionPool()}`;
  for (let start = 0; start < todo.length; start += 30) {
    const batch = todo.slice(start, start + 30);
    const user = batch.map((l, i) => `${i}. ${l.text}  (${l.gloss})  — points: ${(course.lineTags[l.source] ?? []).join(", ")}`).join("\n");
    const { data, costUsd } = await structuredCall<{ lines: { i: number; points: { point: string; words: string[]; blank: { word: string; options: string[]; why: string } }[] }[] }>({
      model: MODELS.offline, system: SYSTEM, user: `Mark these lines:\n${user}`, schema: SCHEMA, maxTokens: 20000, thinking: true,
    });
    cost += costUsd;
    let ok = 0, bad = 0, noBlank = 0;
    for (const r of data.lines) {
      const l = batch[r.i];
      if (!l) continue;
      for (const f of r.points) {
        const errs = validateFocus(l, f.point, f);
        if (errs.words.length) { bad++; console.warn(`  ⚠ ${l.source}: ${errs.words.join(" | ")}`); continue; }
        if (errs.blank.length) { noBlank++; console.warn(`  · ${l.source}: fill-in dropped: ${errs.blank.join(" | ")}`); }
        ok++;
        const keepBlank = f.blank.word && !errs.blank.length ? { blank: { word: f.blank.word, options: f.blank.options, why: f.blank.why.trim() } } : course.lineFocus[l.source]?.[f.point]?.blank ? { blank: course.lineFocus[l.source]![f.point]!.blank } : {};
        course.lineFocus[l.source] = { ...course.lineFocus[l.source], [f.point]: { words: f.words, ...keepBlank } };
      }
    }
    console.log(`  focus lines ${start + 1}-${start + batch.length}: ${ok} ok (${noBlank} without a fill-in), ${bad} rejected, $${costUsd.toFixed(3)}`);
    save();
  }
}

// =====================================================================================================
// points
// =====================================================================================================
interface PointDraft {
  agenda: string; rule: string; recap: string;
  library: { rule: string; why: string[]; mistakes: string[] };
  examples: string[]; callbacks: string[];
  ruleCards: { front: string; back: string; example: string }[];
  blankCards: { line: string; blank: string; options: string[]; why: string }[];
}

const POINT_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["agenda", "rule", "recap", "library", "examples", "callbacks", "ruleCards", "blankCards"],
  properties: {
    agenda: { type: "string" }, rule: { type: "string" }, recap: { type: "string" },
    library: { type: "object", additionalProperties: false, required: ["rule", "why", "mistakes"], properties: {
      rule: { type: "string" }, why: { type: "array", items: { type: "string" } }, mistakes: { type: "array", items: { type: "string" } },
    } },
    examples: { type: "array", items: { type: "string" }, description: "Candidate ids (c1, c2…)." },
    callbacks: { type: "array", items: { type: "string" }, description: "Candidate ids of set phrases met in EARLIER chapters." },
    ruleCards: { type: "array", items: { type: "object", additionalProperties: false, required: ["front", "back", "example"], properties: {
      front: { type: "string" }, back: { type: "string" }, example: { type: "string", description: "Candidate id, or empty." },
    } } },
    blankCards: { type: "array", items: { type: "object", additionalProperties: false, required: ["line", "blank", "options", "why"], properties: {
      line: { type: "string", description: "Candidate id." }, blank: { type: "string" }, options: { type: "array", items: { type: "string" } }, why: { type: "string" },
    } } },
  },
};

const POINT_SYSTEM =
  `You write the teaching text for ONE grammar point of a ${pack.name} course for an English-speaking adult beginner who wants to hold real conversations. ` +
  `The learner meets each point three times in a day: a one-line AGENDA at the start (what we'll learn), a short RULE card mid-lesson, and a RECAP at the end. ` +
  `The Library holds the full detail for when they want to look something up. Days must never read like a textbook.\n\n` +
  `VOICE: plain, warm, concrete English. No linguistics jargon in agenda/rule/recap (no "clitic", "aorist", "imperfective", "enclitic", "infinitive" — say what it does instead). ` +
  `The Library may name the technical term ONCE, in brackets, for the curious.\n\n` +
  `HARD RULE — NO NEW ${pack.name.toUpperCase()}: you may only quote ${pack.name} that appears in the numbered candidate lines or the reference material given. ` +
  `Never invent a ${pack.name} word, form or sentence, not even a short one. Examples, callbacks and cards REFERENCE candidates by id (c1, c2…).\n\n` +
  `FIELDS:\n` +
  `- agenda: max ~12 words, phrased as an outcome ("Ask a yes/no question two ways: ли after the verb, or дали up front").\n` +
  `- rule: 2-3 short sentences. The one thing to hold on to, with one quoted example.\n` +
  `- recap: 3-5 sentences consolidating the rule. If callbacks exist, connect to them ("You've been saying … since the first chapter: …"). Written to be read after the lesson.\n` +
  `- library.rule: a thorough paragraph (still plain English).\n` +
  `- library.why: 2-4 "why is it like this?" notes — the nuances that genuinely confuse English speakers (e.g. where a little word goes and why, when two options both work, look-alike words with different jobs).\n` +
  `- library.mistakes: 2-3 common mistakes, each "Not …, but …" with a reason. DESCRIBE the wrong version in English ` +
  `("not adding -то to a feminine noun"), never spell out a wrong ${pack.name} form: only correct forms from the candidates may be quoted.\n` +
  `- examples: 2-4 candidate ids, preferring lines from this point's own chapter, then earlier chapters, then grammar examples.\n` +
  `- callbacks: 0-3 candidate ids marked EARLIER (set phrases the learner already says) that this point now explains. Empty if none are marked earlier.\n` +
  `- ruleCards: 1-2 simple flashcards. front: a plain question ("Where does ли go in a yes/no question?"); back: a one-line answer; example: a candidate id or "".\n` +
  `- blankCards: 2-3 cards (1 for a recognize-only point). line: a candidate id; blank: the exact substring of that line where the point lives (usually one word); ` +
  `options: exactly 3 distinct choices including the blank, the 2 distractors being plausible ${pack.name} words of the same kind that APPEAR in the candidates or reference material; why: one line.`;

function pointUser(sp: (typeof spine)[number], candidates: { id: string; l: CatalogLine; earlier: boolean }[]): string {
  const concepts = sp.grammarIds.map((id) => pack.grammar.find((g) => g.id === id)).filter(Boolean)
    .map((g) => `### ${g!.name} (${g!.technicalName ?? ""})\n${g!.plain ?? ""}\n${g!.explanation}\n` +
      (g!.pattern ? `Pattern: ${g!.pattern.headers.join(" | ")}\n${g!.pattern.rows.map((r) => r.join(" | ")).join("\n")}` : "")).join("\n\n");
  const before = spine.filter((p) => p.order < sp.order).map((p) => p.title).join("; ");
  return `POINT: ${sp.title} (id ${sp.id}, chapter ${sp.chapterOrder}: ${pack.chapters?.find((c) => c.id === sp.chapterId)?.title})\n` +
    `Depth: ${sp.depth === "recognize" ? "RECOGNIZE ONLY — explain and recap it, but the learner isn't asked to produce it yet" : "produce"}\n` +
    `Covers: ${sp.scope}\n\n` +
    `Already taught before this point: ${before || "(nothing — this is the first point)"}\n\n` +
    (concepts ? `REFERENCE MATERIAL (existing lessons — you may quote its ${pack.name}):\n${concepts}\n\n` : "") +
    `CANDIDATE LINES (the only ${pack.name} you may reference):\n` +
    candidates.map((c) => `${c.id}. ${c.l.text} — ${c.l.gloss}  [${c.l.chapterOrder ? `chapter ${c.l.chapterOrder}` : "grammar example"}${c.earlier ? ", EARLIER" : ""}]`).join("\n");
}

function referenceWords(sp: (typeof spine)[number]): Set<string> {
  const words = new Set<string>();
  for (const id of sp.grammarIds) {
    const g = pack.grammar.find((x) => x.id === id);
    if (!g) continue;
    for (const s of [g.plain ?? "", g.explanation, ...g.examples, ...(g.pattern?.rows.flat() ?? [])]) tokens(s).forEach((w) => words.add(w));
  }
  return words;
}

function validateDraft(d: PointDraft, cands: Map<string, CatalogLine>, sp: (typeof spine)[number]): string[] {
  const errs: string[] = [];
  const ref = (id: string, what: string) => { if (id && !cands.has(id)) errs.push(`${what} references unknown candidate "${id}"`); };
  d.examples.forEach((id) => ref(id, "examples"));
  d.callbacks.forEach((id) => ref(id, "callbacks"));
  d.ruleCards.forEach((c) => ref(c.example, "ruleCard.example"));
  if (d.examples.length < 1) errs.push("needs at least one example");
  if (d.agenda.split(/\s+/).length > 16) errs.push(`agenda is ${d.agenda.split(/\s+/).length} words; keep it to ~12`);
  if (!d.ruleCards.length) errs.push("needs a rule card");
  if (d.blankCards.length < 1) errs.push("needs at least one blank card");
  for (const b of d.blankCards) {
    const l = cands.get(b.line);
    if (!l) { errs.push(`blankCard references unknown candidate "${b.line}"`); continue; }
    if (!l.text.includes(b.blank)) errs.push(`blank "${b.blank}" is not a substring of ${b.line} "${l.text}"`);
    const opts = new Set(b.options.map((o) => o.trim()));
    if (opts.size !== 3 || !opts.has(b.blank.trim())) errs.push(`blankCard on ${b.line}: options must be 3 distinct and include the blank "${b.blank}"`);
    for (const o of b.options) for (const w of tokens(o)) if (!corpus.has(w)) errs.push(`option "${o}" uses "${w}", which isn't in the pack`);
  }
  const prose = [d.agenda, d.rule, d.recap, d.library.rule, ...d.library.why, ...d.library.mistakes, ...d.ruleCards.flatMap((c) => [c.front, c.back]), ...d.blankCards.map((c) => c.why)];
  if (prose.some((t) => /\bc\d+\b/.test(t))) errs.push(`prose mentions candidate ids (c12…): refer to lines by quoting them, never by id`);
  if (prose.some((t) => /\b(go|ja|gi|se|mi|ti|mu|li|da|ne)\b,? (?:and |or )?\b(go|ja|gi|se|mi|ti|mu|li|da|ne)\b/.test(t))) errs.push(`prose romanizes target-language words: write them in the original script`);
  const allowed = referenceWords(sp);
  for (const c of cands.values()) tokens(c.text).forEach((w) => allowed.add(w));
  const bad = new Set(prose.flatMap(proseWords).filter((w) => !corpus.has(w) && !allowed.has(w)));
  if (bad.size) errs.push(`quotes ${pack.name} that doesn't exist in the pack: ${[...bad].join(", ")} — quote only candidate lines / reference material`);
  return errs;
}

async function writePoint(sp: (typeof spine)[number]): Promise<GrammarPoint | undefined> {
  // Candidates: lines tagged with this point (up to its chapter), grammar examples of its concepts, and
  // the chapter's own lines (so a point with few tagged lines still has material).
  const pool: { l: CatalogLine; earlier: boolean }[] = [];
  const add = (l: CatalogLine) => { if (!pool.some((x) => x.l.source === l.source)) pool.push({ l, earlier: l.chapterOrder > 0 && l.chapterOrder < sp.chapterOrder }); };
  const tagged = catalog.filter((l) => (course.lineTags[l.source] ?? []).includes(sp.id));
  tagged.filter((l) => l.chapterOrder === sp.chapterOrder).forEach(add);
  tagged.filter((l) => l.chapterOrder > 0 && l.chapterOrder < sp.chapterOrder).forEach(add);
  catalog.filter((l) => l.kind === "grammar" && sp.grammarIds.some((g) => l.source.startsWith(`grammar:${g}#`))).forEach(add);
  tagged.filter((l) => l.chapterOrder === 0).forEach(add);
  if (pool.length < 8) catalog.filter((l) => l.chapterOrder === sp.chapterOrder && l.kind !== "qa").slice(0, 12).forEach(add);
  const candidates = pool.slice(0, 45).map((x, i) => ({ id: `c${i + 1}`, ...x }));
  const byId = new Map(candidates.map((c) => [c.id, c.l]));

  let user = pointUser(sp, candidates);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data, costUsd } = await structuredCall<PointDraft>({ model: MODELS.offline, system: POINT_SYSTEM, user, schema: POINT_SCHEMA, maxTokens: 20000, thinking: true });
    cost += costUsd;
    const errs = validateDraft(data, byId, sp);
    if (!errs.length) {
      console.log(`  ✓ ${sp.id} (attempt ${attempt}, $${costUsd.toFixed(3)})`);
      return toPoint(sp, data, byId);
    }
    console.warn(`  ⚠ ${sp.id} attempt ${attempt}: ${errs.join(" | ")}`);
    user = `${pointUser(sp, candidates)}\n\nYOUR PREVIOUS ATTEMPT HAD THESE PROBLEMS — fix them:\n- ${errs.join("\n- ")}`;
  }
  console.error(`  ✗ ${sp.id}: gave up after 3 attempts`);
  return undefined;
}

function toPoint(sp: (typeof spine)[number], data: PointDraft, byId: Map<string, CatalogLine>): GrammarPoint {
  const ref = (id: string): LineRef => { const l = byId.get(id)!; return { text: l.text, gloss: l.gloss, source: l.source }; };
  const cards: GrammarCard[] = [
    ...data.ruleCards.map((c): GrammarCard => ({ kind: "rule", front: c.front, back: c.back, ...(c.example ? { example: ref(c.example) } : {}) })),
    ...data.blankCards.map((c): GrammarCard => ({ kind: "blank", line: ref(c.line), blank: c.blank, options: c.options, why: c.why })),
  ];
  return {
    id: sp.id, chapterId: sp.chapterId, order: sp.order, grammarIds: sp.grammarIds, depth: sp.depth, ...(sp.heavy ? { heavy: true } : {}),
    title: sp.title, agenda: data.agenda, rule: data.rule, recap: data.recap, library: data.library,
    examples: data.examples.map(ref),
    callbacks: data.callbacks.filter((id) => { const o = byId.get(id)!.chapterOrder; return o > 0 && o <= sp.chapterOrder; }).map(ref),
    cards, confidence: "unreviewed",
  };
}

// =====================================================================================================
// import — drafts authored outside the API (e.g. in a review session), held to the same validation
// =====================================================================================================
function importDrafts(file: string) {
  const raw = JSON.parse(readFileSync(file, "utf8")) as {
    lineTags?: Record<string, string[]>;
    chunkNotes?: Record<string, string>;
    points?: Record<string, PointDraft>;
    lineFocus?: Record<string, Record<string, { words: string[]; blank?: { word: string; options: string[]; why: string } }>>;
  };
  const valid = new Set(spine.map((p) => p.id));
  const bySource = new Map(catalog.map((l) => [l.source, l]));
  const errors: string[] = [];
  for (const [source, tags] of Object.entries(raw.lineTags ?? {})) {
    const l = bySource.get(source);
    if (!l) { errors.push(`lineTags: unknown source ${source}`); continue; }
    const bad = tags.filter((t) => !valid.has(t));
    if (bad.length) errors.push(`lineTags ${source}: unknown point(s) ${bad.join(", ")}`);
    course.lineTags[source] = tags.filter((t) => valid.has(t));
    course.chunkNotes = course.chunkNotes.filter((n) => n.source !== source);
    const later = course.lineTags[source]!.filter((p) => l.chapterOrder > 0 && spine.find((s) => s.id === p)!.chapterOrder > l.chapterOrder);
    if (!later.length) continue;
    const note = raw.chunkNotes?.[source];
    if (!note) { errors.push(`chunkNotes: ${source} uses ${later.join(", ")} from a later chapter but has no note`); continue; }
    const quoted = proseWords(note).filter((w) => !tokens(l.text).includes(w) && !corpus.has(w));
    if (quoted.length) errors.push(`chunkNotes ${source}: quotes words not in the pack: ${quoted.join(", ")}`);
    course.chunkNotes.push({ source, text: l.text, pointIds: later, note: tidyNote(note) });
  }
  for (const [id, draft] of Object.entries(raw.points ?? {})) {
    const sp = spine.find((p) => p.id === id);
    if (!sp) { errors.push(`points: unknown point ${id}`); continue; }
    const errs = validateDraft(draft, bySource, sp);
    if (errs.length) { errors.push(...errs.map((e) => `point ${id}: ${e}`)); continue; }
    // --keep-confidence: a content fix to a signed-off point (standing permission to fix errors) keeps its
    // sign-off; without it, an imported point is a fresh draft awaiting review.
    const prev = course.points.find((p) => p.id === id);
    const next = toPoint(sp, draft, bySource);
    course.points = [...course.points.filter((p) => p.id !== id), KEEP_CONFIDENCE && prev ? { ...next, confidence: prev.confidence } : next];
  }
  for (const [source, byPoint] of Object.entries(raw.lineFocus ?? {})) {
    const l = bySource.get(source);
    if (!l) { errors.push(`lineFocus: unknown source ${source}`); continue; }
    for (const [pid, f] of Object.entries(byPoint)) {
      const errs = validateFocus(l, pid, { words: f.words, blank: f.blank ?? { word: "", options: [], why: "" } });
      if (errs.words.length || errs.blank.length) { errors.push(...[...errs.words, ...errs.blank].map((e) => `lineFocus ${source}: ${e}`)); continue; }
      course.lineFocus = { ...course.lineFocus, [source]: { ...course.lineFocus?.[source], [pid]: { words: f.words, ...(f.blank ? { blank: f.blank } : {}) } } };
    }
  }
  course.points.sort((a, b) => a.order - b.order);
  if (errors.length) { console.error(`✗ ${errors.length} problem(s) in ${file}:\n  - ${errors.join("\n  - ")}`); process.exit(1); }
  console.log(`imported ${Object.keys(raw.lineTags ?? {}).length} line tag(s), ${Object.keys(raw.points ?? {}).length} point(s), ${Object.keys(raw.lineFocus ?? {}).length} line focus from ${file}`);
}

async function points() {
  const todo = spine.filter((p) => (!ONLY || ONLY.includes(p.chapterId)) && (REDO || !course.points.some((x) => x.id === p.id)));
  console.log(`writing ${todo.length} point(s)…`);
  for (let i = 0; i < todo.length; i += 4) {
    const done = await Promise.all(todo.slice(i, i + 4).map(writePoint));
    for (const p of done) if (p) course.points = [...course.points.filter((x) => x.id !== p.id), p];
    save(); // checkpoint progress — a long run shouldn't lose finished points
  }
  course.points.sort((a, b) => a.order - b.order);
}

// =====================================================================================================
// assemble + review
// =====================================================================================================
function assemble() {
  const { chapters, stageReviews, version } = planCourse({ pack, points: course.points, lineTags: course.lineTags, chunkNotes: course.chunkNotes });
  course.version = version;
  course.chapters = chapters;
  course.stageReviews = stageReviews;
}

function save() {
  const header =
    `// MACHINE-GENERATED by pipeline/src/run-course.ts — the course blueprint (DESIGN-course-spine.md).\n` +
    `// Spine edits go in pipeline/src/course/spine.ts; re-run \`run-course.ts assemble\`. Point text and line\n` +
    `// tags are LLM-drafted then reviewed (confidence marks which). Don't hand-edit sessions.\n`;
  writeFileSync(OUT, `${header}import type { Course } from "@ll/pack-schema";\n\nexport const course: Course = ${JSON.stringify(course, null, 2)};\n`);
}

function review() {
  const chosen = SPINE.filter((c) => !ONLY || ONLY.includes(c.chapterId));
  const L: string[] = [];
  const storyTitle = (id: string) => pack.stories?.find((s) => s.id === id)?.title ?? id;
  const line = (r: LineRef) => `${r.text} — *${r.gloss}* \`${r.source}\``;
  L.push(`# Course blueprint — review (${chosen.map((c) => c.chapterId).join(", ")})`, "",
    `Generated by \`run-course.ts review\`. Point text is an AI draft (confidence: unreviewed) until signed off. Every Macedonian line below already exists in the pack.`, "");
  for (const sc of chosen) {
    const ch = pack.chapters!.find((c) => c.id === sc.chapterId)!;
    const cc = course.chapters.find((c) => c.chapterId === sc.chapterId);
    L.push(`---`, ``, `## Chapter ${ch.order}: ${ch.title}`, ``);
    if (cc) {
      L.push(`**${cc.sessions.length} sessions** · ${cc.words.length} words taught · ${cc.extraWords.length} moved to the Library`, "");
      L.push(`| # | Role | Point | New words | Story (highlighted lines) | Speak | Build |`, `|---|---|---|---|---|---|---|`);
      for (const s of cc.sessions) {
        const pt = s.pointId ? spine.find((p) => p.id === s.pointId)!.title : "";
        const story = s.story ? `${s.story.reuse ? "↩ " : ""}${storyTitle(s.story.id)} (${s.story.highlight.length ? s.story.highlight.map((i) => i + 1).join(", ") : "—"})` : "";
        L.push(`| ${s.n} | ${s.role} | ${pt} | ${s.words.map((w) => w.display).join(" · ")} | ${story} | ${s.speak ? "✓" : ""} | ${s.build.length} |`);
      }
      L.push("", "**Agenda, session by session**", "");
      for (const s of cc.sessions) {
        L.push(`${s.n}. ${s.agenda.join(" · ")}  \n   _${s.next}_`);
        for (const src of s.notes ?? []) { const n = course.chunkNotes.find((x) => x.source === src); if (n) L.push(`   - 💬 *${n.text}*: ${n.note}`); }
      }
      if (cc.extraWords.length) L.push("", `**Moved to Library → Words:** ${cc.extraWords.map((w) => w.display).join(" · ")}`);
    }
    for (const sp of sc.points) {
      const p = course.points.find((x) => x.id === sp.id);
      L.push("", `### ${sp.title}${sp.depth === "recognize" ? " *(recognize only)*" : ""}${sp.heavy ? " *(heavy: gets a practice session)*" : ""}`, "");
      if (!p) { L.push("_Not written yet._"); continue; }
      L.push(`**Agenda:** ${p.agenda}`, "", `**Rule card:** ${p.rule}`, "", `**Recap:** ${p.recap}`, "");
      L.push(`**Examples:**`, ...p.examples.map((e) => `- ${line(e)}`), "");
      if (p.callbacks.length) L.push(`**Callbacks (you already say these):**`, ...p.callbacks.map((e) => `- ${line(e)}`), "");
      L.push(`<details><summary>Library page</summary>`, "", p.library.rule, "", `**Why it's like this**`, ...p.library.why.map((w) => `- ${w}`), "", `**Common mistakes**`, ...p.library.mistakes.map((w) => `- ${w}`), "", `</details>`, "");
      L.push(`**Grammar cards**`, ...p.cards.map((c) => c.kind === "rule"
        ? `- 🃏 *${c.front}* → ${c.back}${c.example ? ` (e.g. ${c.example.text})` : ""}`
        : `- ▢ ${blankOut(c.line.text, c.blank)} → **${c.blank}** of [${c.options.join(" / ")}]: ${c.why}`));
    }
    // Today's focus inside the chapter's own story: the words highlighted, and the "complete the line" fill-ins.
    const home = pack.stories?.find((st) => st.id === `gen-${sc.chapterId}-story`);
    if (home && course.lineFocus) {
      const rows = home.body.flatMap((b, i) => Object.entries(course.lineFocus![`story:${home.id}#${i}`] ?? {}).map(([pid, f]) =>
        `- ${b.text} · ${pid}: **${f.words.join(", ")}**${f.blank ? ` · fill-in ${blankOut(b.text, f.blank.word)} → **${f.blank.word}** of [${f.blank.options.join(" / ")}]: ${f.blank.why}` : ""}`));
      if (rows.length) L.push("", `**Focus in “${home.title}”** (highlighted words; fill-ins for “Use it”):`, ...rows);
    }
    const notes = course.chunkNotes.filter((n) => catalog.find((l) => l.source === n.source)?.chapterOrder === ch.order);
    const surfaced = new Set(course.chapters.flatMap((c) => c.sessions.flatMap((s) => s.notes ?? [])));
    const tapOnly = notes.filter((n) => !surfaced.has(n.source));
    if (tapOnly.length) L.push("", `**Set-phrase notes available on tap only** (not surfaced in a session):`, ...tapOnly.map((n) => `- ${n.text}: ${n.note}`));
    L.push("");
  }
  mkdirSync(dirname(REVIEW), { recursive: true });
  writeFileSync(REVIEW, L.join("\n"));
  console.log(`wrote ${REVIEW}`);
}

// =====================================================================================================
if (cmd === "lines") {
  // Authoring aid: print every line of the given chapter numbers (and grammar concepts) with its source.
  const want = process.argv.slice(3);
  for (const l of catalog) {
    const ok = l.chapterOrder > 0 ? want.includes(String(l.chapterOrder)) : want.some((w) => l.source.startsWith(`grammar:${w}#`));
    if (ok) console.log(`${l.source}\t${l.text}\t${l.gloss}`);
  }
  process.exit(0);
}
if (cmd === "export") {
  // Write points back out in the draft format (sources instead of candidate ids) for hand-editing; the
  // edited file goes back in through `import`, which re-runs the full validation.
  const pts = course.points.filter((p) => !ONLY || ONLY.includes(p.chapterId));
  const out: Record<string, PointDraft> = {};
  for (const p of pts) out[p.id] = {
    agenda: p.agenda, rule: p.rule, recap: p.recap, library: p.library,
    examples: p.examples.map((e) => e.source), callbacks: p.callbacks.map((e) => e.source),
    ruleCards: p.cards.flatMap((c) => (c.kind === "rule" ? [{ front: c.front, back: c.back, example: c.example?.source ?? "" }] : [])),
    blankCards: p.cards.flatMap((c) => (c.kind === "blank" ? [{ line: c.line.source, blank: c.blank, options: c.options, why: c.why }] : [])),
  };
  writeFileSync(process.argv[3]!, JSON.stringify({ points: out }, null, 2));
  console.log(`exported ${pts.length} point(s) to ${process.argv[3]}`);
  process.exit(0);
}
if (cmd === "fit") {
  // Authoring aid for content fixes: existing lines that could serve a point's lesson, i.e. tagged with it and
  // using nothing taught after its teach session (the session lint's rule), fewest unmet words first.
  //   fit pt-sum pt-ne
  const ps = cpSlots.pointSlots(course);
  const known = knownAtSlot(pack, course);
  const later = laterGrammarAt(pack, course);
  for (const id of process.argv.slice(3)) {
    const at = ps.get(id);
    if (!at) { console.log(`${id}: no teach session`); continue; }
    console.log(`\n${id}, taught ch${at.order} s${at.n}`);
    catalog.filter((l) => (course.lineTags[l.source] ?? []).includes(id) && !later(l.text, l.source, at).length)
      .map((l) => ({ l, unmet: [...new Set(cpSlots.wordTokens(l.text).filter((t) => !known(t, at)))] }))
      .sort((a, b) => a.unmet.length - b.unmet.length)
      .slice(0, 15)
      .forEach(({ l, unmet }) => console.log(`  ${l.source.padEnd(36)} ${l.text} — ${l.gloss}${unmet.length ? `   [not met yet: ${unmet.join(", ")}]` : ""}`));
  }
  process.exit(0);
}
if (cmd === "signoff") {
  // A human signed off these chapters: their points become `validated` (served as authoritative).
  if (!ONLY) throw new Error("signoff needs --chapters");
  let n = 0;
  course.points = course.points.map((p) => (ONLY.includes(p.chapterId) ? (n++, { ...p, confidence: "validated" as const }) : p));
  console.log(`signed off ${n} point(s) in ${ONLY.join(", ")}`);
  save();
}
if (cmd === "notes") { await writeNotes(); save(); }
if (cmd === "focus") { await focus(); save(); }
if (cmd === "import") { importDrafts(process.argv[3]!); save(); }
if (cmd === "tag" || cmd === "all") { await tag(); save(); }
if (cmd === "points" || cmd === "all") { await points(); save(); }
if (["assemble", "all", "points", "tag", "import", "notes"].includes(cmd)) { assemble(); save(); }
if (cmd === "review" || cmd === "all") review();
console.log(`\n${course.points.length}/${spine.length} points written · ${Object.keys(course.lineTags).length} lines tagged · ${course.chunkNotes.length} set-phrase notes · cost this run $${cost.toFixed(2)}`);
const issues = lintCourse({ ...pack, course });
console.log(`course lint: ${issues.length} issue(s)`);
for (const i of issues.slice(0, 40)) console.log(`  • [${i.kind}] ${i.where}: ${i.detail}`);
