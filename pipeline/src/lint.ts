import type { GrammarConcept, LanguagePack, LineRef } from "@ll/pack-schema";
import { lineCatalog, proseWords, resolveSource, tokens, wordCorpus } from "./course/lines.js";
import { introducedBy, requiredChapter, tierCapForChapter } from "@ll/core/sentences";
import { normalize as normalizeKey } from "@ll/core/familiarity";
import * as cp from "../../apps/web/lib/course-player.js";
import { knownAtSlot, laterGrammarAt } from "./course/known.js";
import { spinePoints } from "./course/spine.js";

// Language-agnostic STRUCTURAL lint for grammar drills. The line-level Validator checks whether the
// answer text is correct, natural Bulgarian/etc. — but it never sees the option SET, so it can't
// catch a malformed multiple-choice (duplicate distractors, an answer missing from its own options,
// or too few options). This pure structural check fills that gap with no LLM call. Run it in the
// batch (every generation) and standalone over any committed pack.

export type DrillLintKind = "duplicate-options" | "answer-not-in-options" | "too-few-options";

export interface DrillLintIssue {
  conceptId: string;
  drillId: string;
  kind: DrillLintKind;
  detail: string;
}

// --- Transliteration homoglyph lint -------------------------------------------------------------
// The LLM romanizer occasionally keeps a source-script glyph inside an otherwise-Latin translit — e.g.
// Cyrillic "ѐ" (U+0450) pasted into "Sѐ ušte…" where Latin "è" was meant. It renders as a normal-looking
// Latin letter, so it's invisible to review but wrong (and it breaks any text->romanization matching).
// A translit / answerTranslit / targetPhrase.translit value must contain NO Cyrillic (U+0400–U+04FF).

export interface TranslitLintIssue {
  location: string; // e.g. "story gen-s0-repair-story body[3].translit"
  value: string; // the offending string
  cyrillic: string[]; // the specific out-of-place Cyrillic character(s)
}

const CYRILLIC = /[\u0400-\u04FF]/;
const cyrillicChars = (s: string): string[] => [...new Set([...s].filter((ch) => CYRILLIC.test(ch)))];

/** Every translit-bearing field in a pack whose value smuggles in a Cyrillic homoglyph (empty ⇒ clean). */
export function lintTranslit(pack: LanguagePack): TranslitLintIssue[] {
  const issues: TranslitLintIssue[] = [];
  const check = (value: string | undefined, location: string) => {
    if (!value) return;
    const bad = cyrillicChars(value);
    if (bad.length) issues.push({ location, value, cyrillic: bad });
  };
  pack.vocab.forEach((v) => check(v.translit, `vocab ${v.id}.translit`));
  pack.srsSeed.forEach((v) => check(v.translit, `srsSeed ${v.id}.translit`));
  pack.scenarios.forEach((s) => s.script.forEach((t, i) => check(t.translit, `scenario ${s.id} script[${i}].translit`)));
  pack.readers.forEach((r) => r.body.forEach((t, i) => check(t.translit, `reader ${r.id} body[${i}].translit`)));
  (pack.stories ?? []).forEach((st) => {
    st.body.forEach((seg, i) => check(seg.translit, `story ${st.id} body[${i}].translit`));
    st.qa.forEach((q) => check(q.answerTranslit, `story ${st.id} qa ${q.id}.answerTranslit`));
  });
  (pack.infoGapTasks ?? []).forEach((task) => {
    for (const role of [task.roleA, task.roleB]) {
      role.targetPhrases.forEach((p, i) => check(p.translit, `infogap ${task.id} role${role.role} targetPhrases[${i}].translit`));
    }
  });
  return issues;
}

// --- Vocabulary-consistency lint ----------------------------------------------------------------
// A pack should teach ONE word per everyday concept. A beginner who learned учител and then meets
// наставник in a scenario reads it as a mistake, not as vocabulary range — and the same for доктор vs
// лекар. Synonymy can't be inferred, so the choices are DECLARED (see run-lint.ts); this only enforces
// one once it's been made, across every string the pack serves (target text AND translit).
export interface SynonymGroup {
  concept: string; // what the word means, for the report ("teacher")
  preferred: string; // the form the pack teaches
  avoid: string[]; // competing stems — Cyrillic and/or Latin (translit)
}

export interface SynonymLintIssue {
  location: string; // dotted path into the pack, e.g. "scenarios[7].script[9].text"
  concept: string;
  found: string;
  preferred: string;
  value: string;
}

// Stem + at most 2 more letters, so inflections count (наставникот, учители) but a different word that
// merely starts the same does not (лекарство "medicine" is stem+4, and stays clean).
const stemRe = (stem: string) => new RegExp(`(?<!\\p{L})${stem}\\p{L}{0,2}(?!\\p{L})`, "iu");

/** Every served string using a competing synonym instead of the pack's chosen word (empty ⇒ consistent). */
export function lintSynonyms(pack: LanguagePack, groups: SynonymGroup[]): SynonymLintIssue[] {
  const issues: SynonymLintIssue[] = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === "string") {
      for (const g of groups) {
        for (const stem of g.avoid) {
          const hit = node.match(stemRe(stem));
          if (hit) issues.push({ location: path, concept: g.concept, found: hit[0], preferred: g.preferred, value: node });
        }
      }
      return;
    }
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(pack, "");
  return issues;
}

/** Structural issues across a pack's grammar drills (empty array ⇒ all drills are well-formed). */
export function lintDrills(concepts: GrammarConcept[]): DrillLintIssue[] {
  const issues: DrillLintIssue[] = [];
  for (const c of concepts) {
    for (const d of c.drills) {
      const opts = d.options ?? [];
      if (opts.length < 2) {
        issues.push({ conceptId: c.id, drillId: d.id, kind: "too-few-options", detail: `${opts.length} option(s) — a multiple-choice drill needs ≥2` });
      }
      const dupes = [...new Set(opts.filter((o, i) => opts.indexOf(o) !== i))];
      if (dupes.length) {
        issues.push({ conceptId: c.id, drillId: d.id, kind: "duplicate-options", detail: `duplicate option(s): ${dupes.map((o) => `"${o}"`).join(", ")}` });
      }
      if (opts.length > 0 && !opts.includes(d.answer)) {
        issues.push({ conceptId: c.id, drillId: d.id, kind: "answer-not-in-options", detail: `answer "${d.answer}" is not among the options` });
      }
    }
  }
  return issues;
}

// --- Chapter coverage lint ----------------------------------------------------------------------
// The chapter spine (pack.chapters + core/chapters) groups content by the `gen-<chapterId>` id
// convention. Artifacts that match no chapter would vanish from a chapter-grouped Library, and an
// artifact matching two chapters would appear twice — neither is visible from the app, so assert it
// here. Vocab is allowed to be unchaptered (the core word list is broader than the 12 situations);
// scenarios, stories and readers are not.
export interface ChapterLintIssue {
  kind: "unchaptered" | "double-chaptered" | "empty-chapter";
  location: string;
  detail: string;
}

export function lintChapters(pack: LanguagePack): ChapterLintIssue[] {
  const chapters = pack.chapters ?? [];
  if (!chapters.length) return [];
  const issues: ChapterLintIssue[] = [];
  const owners = (id: string) => chapters.filter((c) => id.startsWith(`gen-${c.id}`) || c.extraIds?.includes(id));

  const groups: [string, { id: string }[]][] = [
    ["scenario", pack.scenarios],
    ["story", pack.stories ?? []],
    ["reader", pack.readers],
    ["writingTask", pack.writingTasks ?? []],
    ["infoGapTask", pack.infoGapTasks ?? []],
  ];
  for (const [kind, items] of groups) {
    for (const it of items) {
      const owned = owners(it.id);
      if (owned.length === 0) issues.push({ kind: "unchaptered", location: `${kind} ${it.id}`, detail: "belongs to no chapter — it would be invisible in a chapter-grouped Library" });
      if (owned.length > 1) issues.push({ kind: "double-chaptered", location: `${kind} ${it.id}`, detail: `claimed by ${owned.map((c) => c.id).join(", ")}` });
    }
  }
  for (const c of chapters) {
    if (c.kind === "script") continue; // letters & sounds: no scenario or story by design
    const hasScenario = pack.scenarios.some((s) => owners(s.id).some((o) => o.id === c.id));
    const hasStory = (pack.stories ?? []).some((s) => owners(s.id).some((o) => o.id === c.id));
    if (!hasScenario || !hasStory) {
      issues.push({ kind: "empty-chapter", location: `chapter ${c.id}`, detail: `missing ${!hasScenario ? "a scenario" : ""}${!hasScenario && !hasStory ? " and " : ""}${!hasStory ? "a story" : ""}` });
    }
  }
  return issues;
}

// --- Hint lint ----------------------------------------------------------------------------------
// A retrieval hint must point AT a word without containing it — a hint that says the answer turns the
// flashcard into a reading exercise, and in the partnered drill it hands the learner the word their
// partner is holding. The generator rejects leaks at authoring time; this catches any that arrive by a
// hand-edit or a re-generation. Script-agnostic: it compares against the lexKey the hint is filed under.
export interface HintLintIssue {
  kind: "leaks-answer" | "empty" | "too-long";
  lexKey: string;
  detail: string;
}

const HINT_MAX = 120;

export function lintHints(pack: LanguagePack): HintLintIssue[] {
  const issues: HintLintIssue[] = [];
  const norm = (s: string) => s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  for (const [lexKey, hint] of Object.entries(pack.hints ?? {})) {
    const h = norm(hint);
    if (!h) { issues.push({ kind: "empty", lexKey, detail: "no hint text" }); continue; }
    if (hint.length > HINT_MAX) issues.push({ kind: "too-long", lexKey, detail: `${hint.length} chars (max ${HINT_MAX}) — a hint is one short clause` });
    for (const tok of norm(lexKey).split(" ")) {
      if (tok.length < 3) continue;
      const stem = tok.length > 4 ? tok.slice(0, -1) : tok; // tolerate one inflectional ending
      if (h.includes(stem)) {
        issues.push({ kind: "leaks-answer", lexKey, detail: `contains "${tok}" — the hint gives away the answer: “${hint}”` });
        break;
      }
    }
  }
  return issues;
}

// --- Build-a-sentence serveability lint ----------------------------------------------------------
// A sentence is only offered once the course has introduced its verb and every one of its support words
// (core/sentences.requiredChapter). An item naming something no chapter ever introduces is dead content:
// it ships, it's counted, and no learner can ever be shown it. Name those here rather than leaving them
// to rot in the pack.
export interface SentenceLintIssue {
  kind: "never-serveable" | "late-tier";
  id: string;
  detail: string;
}

export function lintSentences(pack: LanguagePack): SentenceLintIssue[] {
  if (!pack.sentences?.length || !pack.chapters?.length) return [];
  const issues: SentenceLintIssue[] = [];
  const intro = introducedBy(pack);
  const lastChapter = Math.max(...pack.chapters.map((c) => c.order));
  for (const item of pack.sentences) {
    const need = requiredChapter(pack, item, intro);
    if (need === undefined) {
      const missing = item.supportWords.filter((w) => !intro.has(normalizeKey(w)));
      issues.push({
        kind: "never-serveable",
        id: item.id,
        detail: missing.length
          ? `support word(s) ${missing.join(", ")} are never introduced by any chapter`
          : `the verb "${item.verbLemma}" is never introduced by any chapter (no form appears in a word, scenario or story)`,
      });
      continue;
    }
    // A long sentence gated behind a chapter whose tier cap is lower than its own tier can never come up.
    if ((item.tier ?? 1) > tierCapForChapter(lastChapter)) {
      issues.push({ kind: "late-tier", id: item.id, detail: `tier ${item.tier} exceeds the cap at the final chapter` });
    }
  }
  return issues;
}

// --- Course blueprint lint ----------------------------------------------------------------------
// The blueprint (DESIGN-course-spine.md) may only POINT AT existing target-language lines: every LineRef
// must still resolve to the same text, every quoted word in its English prose must exist somewhere in the
// pack, and every blank card must be answerable from its own line. Structurally, the spine must be in
// order with two or three points per chapter, a session may teach at most three words, the conversation
// waits until its words were taught in an earlier session, reuse only looks backward, and any line that
// uses grammar from a later chapter carries a set-phrase note.
export interface CourseLintIssue {
  kind:
    | "spine-order" | "points-per-chapter" | "missing-point" | "stale-line" | "new-language" | "bad-blank"
    | "too-many-words" | "speak-too-early" | "reuse-forward" | "bad-highlight" | "no-checkpoint"
    | "missing-chunk-note" | "unknown-point" | "bad-focus";
  where: string;
  detail: string;
}

export function lintCourse(pack: LanguagePack): CourseLintIssue[] {
  const course = pack.course;
  if (!course) return [];
  const issues: CourseLintIssue[] = [];
  const add = (kind: CourseLintIssue["kind"], where: string, detail: string) => issues.push({ kind, where, detail });
  const corpus = wordCorpus(pack);
  const chapterOrder = new Map((pack.chapters ?? []).map((c) => [c.id, c.order]));
  const pointIds = new Set(course.chapters.flatMap((c) => c.pointIds));
  const pointChapter = new Map(course.chapters.flatMap((c) => c.pointIds.map((p) => [p, chapterOrder.get(c.chapterId) ?? 0] as const)));

  // spine shape
  for (const c of course.chapters) {
    const script = c.sessions.some((s) => s.letters);
    if (!script && (c.pointIds.length < 2 || c.pointIds.length > 3)) add("points-per-chapter", c.chapterId, `${c.pointIds.length} points (want 2-3)`);
    for (const id of c.pointIds) if (!course.points.some((p) => p.id === id)) add("missing-point", c.chapterId, `point ${id} has no text yet`);
  }
  const orders = course.points.map((p) => p.order);
  if (orders.some((o, i) => i > 0 && o <= orders[i - 1]!)) add("spine-order", "points", "points are not in spine order");

  // point text: references + no new language
  const checkRef = (r: LineRef, where: string) => {
    const now = resolveSource(pack, r.source);
    if (now === undefined) add("stale-line", where, `${r.source} no longer exists`);
    else if (now.trim() !== r.text.trim()) add("stale-line", where, `${r.source} now reads "${now}", blueprint has "${r.text}"`);
  };
  const checkProse = (s: string, where: string) => {
    const bad = proseWords(s).filter((w) => !corpus.has(w));
    if (bad.length) add("new-language", where, `quotes words not in the pack: ${bad.join(", ")}`);
  };
  for (const p of course.points) {
    const at = `point ${p.id}`;
    [...p.examples, ...p.callbacks].forEach((r) => checkRef(r, at));
    [p.agenda, p.rule, p.recap, p.library.rule, ...p.library.why, ...p.library.mistakes].forEach((s) => checkProse(s, at));
    for (const c of p.cards) {
      if (c.kind === "rule") { checkProse(c.front, at); checkProse(c.back, at); if (c.example) checkRef(c.example, at); continue; }
      checkRef(c.line, at);
      checkProse(c.why, at);
      if (!c.line.text.includes(c.blank)) add("bad-blank", at, `"${c.blank}" isn't in "${c.line.text}"`);
      else if (!new RegExp(`(^|[^\\p{L}])${c.blank.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").test(c.line.text)) add("bad-blank", at, `"${c.blank}" is only part of a word in "${c.line.text}"`);
      if (new Set(c.options).size !== 3 || !c.options.includes(c.blank)) add("bad-blank", at, `options [${c.options.join(", ")}] must be 3 distinct incl. "${c.blank}"`);
      for (const o of c.options) for (const w of tokens(o)) if (!corpus.has(w)) add("new-language", at, `option "${o}" isn't in the pack`);
    }
  }

  // sessions
  for (const c of course.chapters) {
    const order = chapterOrder.get(c.chapterId) ?? 0;
    const taughtBefore = new Set(course.chapters.filter((x) => (chapterOrder.get(x.chapterId) ?? 0) < order).flatMap((x) => x.words.map((w) => w.lexKey)));
    const scen = pack.scenarios.find((s) => s.id === c.checkpoint.scenarioId);
    const required = (scen?.requiredVocab ?? []).map((id) => pack.vocab.find((v) => v.id === id)).filter(Boolean).map((v) => normalizeKey(v!.answer));
    const inCourse = new Set([...taughtBefore, ...c.words.map((w) => w.lexKey)]);
    c.sessions.forEach((s, i) => {
      const at = `${c.chapterId} session ${s.n}`;
      if (s.words.length > 3) add("too-many-words", at, `${s.words.length} new words`);
      if (s.speak) {
        const before = new Set([...taughtBefore, ...c.sessions.slice(0, i).flatMap((x) => x.words.map((w) => w.lexKey))]);
        const missing = required.filter((k) => inCourse.has(k) && !before.has(k));
        if (missing.length) add("speak-too-early", at, `conversation needs ${missing.join(", ")}, not yet taught in an earlier session`);
      }
      if (s.story) {
        const story = pack.stories?.find((x) => x.id === s.story!.id);
        const owner = (pack.chapters ?? []).find((ch) => s.story!.id.startsWith(`gen-${ch.id}`) || ch.extraIds?.includes(s.story!.id));
        if (owner && owner.order > order) add("reuse-forward", at, `story ${s.story.id} is from a later chapter`);
        if (!story || s.story.highlight.some((h) => h < 0 || h >= story.body.length)) add("bad-highlight", at, `highlight out of range for ${s.story.id}`);
      }
    });
    if (c.sessions.at(-1)?.role !== "checkpoint") add("no-checkpoint", c.chapterId, "last session isn't the checkpoint");
  }

  // focus: the words are whole words of the line; a fill-in is one of them, with 3 distinct pack-word options
  const wholeWord = (line: string, w: string) => !!w && new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").test(line);
  for (const [source, byPoint] of Object.entries(course.lineFocus ?? {})) {
    const text = resolveSource(pack, source);
    if (text === undefined) { add("stale-line", source, "focus on a line that no longer exists"); continue; }
    for (const [pid, f] of Object.entries(byPoint)) {
      if (!(course.lineTags[source] ?? []).includes(pid)) add("bad-focus", source, `focus for ${pid}, which isn't a tag of the line`);
      for (const w of f.words) if (!wholeWord(text, w)) add("bad-focus", source, `${pid}: "${w}" isn't a whole word of “${text}”`);
      if (!f.blank) continue;
      if (!f.words.includes(f.blank.word)) add("bad-focus", source, `${pid}: fill-in "${f.blank.word}" isn't one of its words`);
      if (new Set(f.blank.options).size !== 3 || !f.blank.options.includes(f.blank.word)) add("bad-focus", source, `${pid}: options [${f.blank.options.join(", ")}] must be 3 distinct incl. "${f.blank.word}"`);
      for (const o of f.blank.options) for (const w of tokens(o)) if (!corpus.has(w)) add("new-language", source, `${pid}: option "${o}" isn't in the pack`);
      checkProse(f.blank.why, `${source} ${pid} fill-in`);
    }
  }

  // tags + set-phrase notes
  for (const [source, tags] of Object.entries(course.lineTags)) {
    for (const t of tags) if (!pointIds.has(t)) add("unknown-point", source, `tag ${t} isn't a spine point`);
  }
  for (const l of lineCatalog(pack)) {
    if (!l.chapterOrder) continue;
    const later = (course.lineTags[l.source] ?? []).filter((t) => (pointChapter.get(t) ?? 0) > l.chapterOrder);
    if (later.length && !course.chunkNotes.some((n) => n.source === l.source)) add("missing-chunk-note", l.source, `uses ${later.join(", ")} from a later chapter`);
  }
  return issues;
}

// --- Session lint: what each session SHOWS vs what the course has TAUGHT by then ---------------------
// The course lint above works chapter by chapter, but a learner meets things session by session. This walks
// what the screens show — each point's lesson (examples, quick checks, rule-card examples, grammar table),
// Build-a-sentence, the story and its questions, the conversation, and the agenda — and checks it against
// the points and word forms taught by that session (lib/course-player.ts), so a lesson never quizzes
// tomorrow's grammar. "error" counts against the lint; "note" is worth a look but isn't a defect (a glossed
// word the learner hasn't met yet, a story line that's a set phrase for a session or two).
export interface SessionLintIssue {
  kind: "lesson-later-grammar" | "build-untaught" | "agenda" | "lesson-untaught-words" | "table-untaught-words" | "reading-later-grammar";
  level: "error" | "note";
  where: string;
  detail: string;
}

export function lintCourseSessions(pack: LanguagePack): SessionLintIssue[] {
  const course = pack.course;
  if (!course) return [];
  const out: SessionLintIssue[] = [];
  const add = (level: SessionLintIssue["level"], kind: SessionLintIssue["kind"], where: string, detail: string) => out.push({ level, kind, where, detail });
  const ps = cp.pointSlots(course);
  const known = knownAtSlot(pack, course);
  const noted = new Set(course.chunkNotes.map((n) => n.source));
  const title = (id: string) => course.points.find((p) => p.id === id)?.title ?? id;
  const fmt = (s?: cp.CourseSlot) => (s ? `ch${s.order} s${s.n}` : "never");
  const laterPoints = (source: string | undefined, at: cp.CourseSlot) =>
    (source ? course.lineTags[source] ?? [] : []).filter((p) => { const s = ps.get(p); return !!s && cp.cmpSlot(s, at) > 0; });
  const unknownWords = (text: string, at: cp.CourseSlot) => [...new Set(cp.wordTokens(text).filter((t) => !known(t, at)))];

  // A lesson line may not make the learner use a later point (see laterGrammarAt: a phrase they already own,
  // like "Не разбирам", is fine; "Ми го дава" in the го lesson is not).
  const laterInLesson = laterGrammarAt(pack, course);
  const acceptLater = new Map(spinePoints().flatMap((p) => Object.entries(p.acceptLater ?? {})));
  const lessonLine = (where: string, at: cp.CourseSlot, l: { text: string; source?: string }) => {
    const unknown = unknownWords(l.text, at);
    const later = laterInLesson(l.text, l.source, at);
    // Accepted on purpose: the line has a set-phrase note (the lesson shows it under the example), or the
    // spine accepts it for a point the pack has no cleaner line for.
    const accepted = !!l.source && (noted.has(l.source) || !!acceptLater.get(l.source));
    if (later.length) add(accepted ? "note" : "error", "lesson-later-grammar", where, `“${l.text}” uses ${later.map((p) => `${title(p)} (${fmt(ps.get(p))})`).join(", ")}${accepted ? " (accepted: set phrase)" : ""}`);
    else if (unknown.length) add("note", "lesson-untaught-words", where, `“${l.text}”: ${unknown.join(", ")}`);
  };
  const readingLine = (where: string, at: cp.CourseSlot, text: string, source: string) => {
    const later = laterPoints(source, at);
    if (later.length && !noted.has(source) && unknownWords(text, at).length) add("note", "reading-later-grammar", where, `“${text}” uses ${later.map((p) => `${title(p)} (${fmt(ps.get(p))})`).join(", ")}`);
  };

  // 1. Each point's lesson, checked at the session that teaches it (practice sessions come later, so the
  //    teach session is the strictest place to check). Rule cards come back in reviews from then on.
  for (const p of course.points) {
    const at = ps.get(p.id);
    if (!at) continue;
    const where = `${p.id} (taught ${fmt(at)})`;
    p.examples.forEach((e) => lessonLine(`${where} example`, at, e));
    p.cards.forEach((c, i) => {
      if (c.kind === "rule") { if (c.example) lessonLine(`${where} rule card ${i} example`, at, c.example); return; }
      lessonLine(`${where} quick check ${i}`, at, c.line);
      const bad = [...new Set(c.options.flatMap(cp.wordTokens).filter((t) => !known(t, at)))];
      if (bad.length) add("note", "lesson-untaught-words", `${where} quick check ${i} options`, bad.join(", "));
    });
    const concept = pack.grammar.find((g) => g.id === cp.patternConceptFor(course, p) && !!g.pattern);
    concept?.pattern?.rows.forEach((r, i) => {
      const bad = unknownWords(r.join(" "), at);
      if (bad.length) add("note", "table-untaught-words", `${where} table ${concept.id} row ${i}`, `${r.join(" | ")}: ${bad.join(", ")}`);
    });
  }

  // 2. Each session: Build-a-sentence, the story and its questions, the conversation, and the agenda.
  for (const c of course.chapters) {
    const firstSpeak = c.sessions.find((s) => s.speak)?.n;
    for (const s of c.sessions) {
      if (s.letters) continue;
      const at = { order: c.order, n: s.n };
      const where = `ch${c.order} s${s.n} (${s.role})`;
      for (const id of s.build) {
        const item = pack.sentences?.find((x) => x.id === id);
        const phrase = id.startsWith("phrase-") ? pack.vocab.find((v) => v.id === id.slice("phrase-".length)) : undefined;
        const text = item ? item.variants.map((v) => v.mk).join(" ") : phrase?.answer;
        if (!text) { add("error", "build-untaught", where, `${id} doesn't exist`); continue; }
        const bad = unknownWords(text, at);
        if (bad.length) add("error", "build-untaught", where, `${id} uses ${bad.join(", ")} before they're taught`);
      }
      const story = s.story ? pack.stories?.find((x) => x.id === s.story!.id) : undefined;
      story?.body.forEach((b, i) => readingLine(`${where} story ${story.id}#${i}`, at, b.text, `story:${story.id}#${i}`));
      story?.qa.forEach((q) => {
        readingLine(`${where} story question ${q.id}`, at, q.question, `qa:${story.id}#${q.id}:q`);
        readingLine(`${where} story answer ${q.id}`, at, q.answer, `qa:${story.id}#${q.id}:a`);
      });
      const scen = s.speak ? pack.scenarios.find((x) => x.id === s.speak) : undefined;
      scen?.script.forEach((t, i) => readingLine(`${where} conversation ${scen.id}#${i}`, at, t.text, `scenario:${scen.id}#${i}`));

      // The agenda names what the session actually holds.
      const ag = s.agenda;
      const has = (re: RegExp) => ag.some((b) => re.test(b));
      for (const w of s.words) if (!ag.some((b) => /^\d+ new words?:/.test(b) && b.includes(w.display.replace(/\.+$/, "")))) add("error", "agenda", where, `new word ${w.display} isn't on the agenda`);
      if (story && !ag.some((b) => b.includes(story.title))) add("error", "agenda", where, `story “${story.title}” isn't on the agenda`);
      if (scen && !ag.some((b) => b.includes(scen.title))) add("error", "agenda", where, `conversation “${scen.title}” isn't on the agenda`);
      if (!scen && has(/^(Conversation|First try)/)) add("error", "agenda", where, "the agenda promises a conversation the session doesn't have");
      if (s.build.length && !has(/^Build/)) add("error", "agenda", where, "Build-a-sentence isn't on the agenda");
      if (has(/^First try/) && s.n !== firstSpeak) add("error", "agenda", where, `“First try at the conversation”, but session ${firstSpeak} already had it`);
      if (s.role === "practice") {
        const practised = s.pointId ?? c.pointIds.filter((id) => c.sessions.some((x) => x.n < s.n && x.pointId === id)).at(-1);
        if (practised && !ag.some((b) => b.includes(title(practised)))) add("error", "agenda", where, `practises “${title(practised)}” but the agenda doesn't say so`);
      }
    }
  }
  return out;
}

// --- Mixed-script lint ----------------------------------------------------------------------------
// The mirror of the translit lint: a TARGET-language word must not smuggle in a Latin look-alike (e.g.
// "сè" typed with Latin è instead of Cyrillic ѐ). It renders fine, but breaks word matching, familiarity
// keys and the "no new language" corpus check. Any word mixing a non-Latin script with Latin letters is flagged.
export interface ScriptMixIssue { location: string; word: string; value: string }

export function lintScriptMix(pack: LanguagePack): ScriptMixIssue[] {
  const out: ScriptMixIssue[] = [];
  const check = (location: string, value: string | undefined) => {
    for (const w of (value ?? "").split(/[^\p{L}]+/u)) {
      if (/\p{Script=Latin}/u.test(w) && /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(w)) out.push({ location, word: w, value: value! });
    }
  };
  for (const l of lineCatalog(pack)) check(l.source, l.text);
  for (const v of pack.vocab) check(`vocab ${v.id}`, v.answer);
  for (const g of pack.infoGapTasks ?? []) for (const r of [g.roleA, g.roleB]) for (const t of r.targetPhrases) check(`infogap ${g.id}`, t.text);
  return out;
}
