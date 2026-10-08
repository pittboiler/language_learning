// Plays the course blueprint (pack.course — DESIGN-course-spine.md): where the learner is, what today's
// session holds, and how the position advances once it's done. Pure — no React — so it's unit-tested
// (test/course-player.test.ts) and page.tsx only renders what this decides.
//
// The blueprint fixes WHAT is taught WHEN. Only review content is decided here at runtime: which due
// cards make the warm-up (with a guaranteed share from earlier chapters), what a failed checkpoint
// re-drills, and what a stage review samples.
import type { Course, CourseChapter, CourseSession, GrammarCard, GrammarPoint, LanguagePack, LineRef, MiniStory, ReviewItem, SentenceItem } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import type { CoursePositionShare } from "@ll/core/partner/joint";
import type { CourseLogEntry, Progress } from "./store";

/** The switch (DESIGN §11): on since the 2026-10-08 cutover. A learner can still switch back to the old
 *  runtime planner from Settings (`progress.settings.courseV2 = false`). */
export const COURSE_V2_DEFAULT = true;
export const courseV2On = (pack: LanguagePack, p: Progress): boolean =>
  !!pack.course?.chapters.length && (p.settings?.courseV2 ?? COURSE_V2_DEFAULT);

/** Where a learner is in the blueprint (stored on Progress.course). */
export interface CourseState {
  chapterId: string;
  /** 1-based session within the chapter. */
  session: number;
  /** The checkpoint was failed: the next attempt is preceded by a targeted review. */
  retry?: boolean;
  /** A stage review is owed after this chapter (set when a stage-ending checkpoint is passed). */
  stageReviewAfter?: string;
  /** The whole course is finished. */
  finished?: boolean;
  /** The blueprint structure this position was made on (Course.version). A different one re-places the
   *  learner at the start: their words, grammar seen and saved cards are kept. */
  v?: string;
}

export type CoursePosition =
  | { kind: "session"; chapter: CourseChapter; session: CourseSession; retry: boolean }
  | { kind: "stage-review"; afterChapterId: string }
  | { kind: "finished" };

export const initialState = (course: Course): CourseState => ({ chapterId: course.chapters[0]!.chapterId, session: 1, v: course.version });

/** The saved state, unless it was made on a different course structure (then: the start). */
const current = (course: Course, state: CourseState | undefined): CourseState =>
  state && (!course.version || state.v === course.version) ? state : initialState(course);

export function position(course: Course, state: CourseState | undefined): CoursePosition {
  const s = current(course, state);
  if (s.finished) return { kind: "finished" };
  if (s.stageReviewAfter) return { kind: "stage-review", afterChapterId: s.stageReviewAfter };
  const chapter = course.chapters.find((c) => c.chapterId === s.chapterId) ?? course.chapters[0]!;
  const session = chapter.sessions[Math.min(Math.max(1, s.session), chapter.sessions.length) - 1]!;
  return { kind: "session", chapter, session, retry: !!s.retry && session.role === "checkpoint" };
}

/** Advance after a finished session. A checkpoint only moves on when passed (else: retry, with a review
 *  first); a passed stage-ending checkpoint owes a stage review; a stage review leads to the next chapter. */
export function advance(course: Course, state: CourseState | undefined, outcome: { checkpointPassed?: boolean }): CourseState {
  const v = course.version;
  const s = { ...current(course, state), v };
  if (s.finished) return s;
  const idx = course.chapters.findIndex((c) => c.chapterId === s.chapterId);
  const next = course.chapters[idx + 1];
  const toNextChapter = (): CourseState => (next ? { chapterId: next.chapterId, session: 1, v } : { chapterId: s.chapterId, session: s.session, finished: true, v });
  if (s.stageReviewAfter) return toNextChapter();
  const chapter = course.chapters[idx]!;
  const session = chapter.sessions[s.session - 1];
  if (session?.role === "checkpoint") {
    if (!outcome.checkpointPassed) return { ...s, retry: true };
    if (course.stageReviews.some((r) => r.afterChapterId === chapter.chapterId)) return { chapterId: s.chapterId, session: s.session, stageReviewAfter: chapter.chapterId, v };
    return toNextChapter();
  }
  return { chapterId: s.chapterId, session: Math.min(s.session + 1, chapter.sessions.length), v };
}

/** Can the learner skip where they are? Only a script chapter (letters & sounds) — someone who already
 *  reads the alphabet shouldn't have to sit through it. */
export const canSkipChapter = (pos: CoursePosition): boolean =>
  pos.kind === "session" && pos.chapter.sessions.some((s) => !!s.letters);

/** Skip the current (script) chapter: on to the next chapter's first session. */
export function skipChapter(course: Course, state: CourseState | undefined): CourseState {
  const s = current(course, state);
  const idx = course.chapters.findIndex((c) => c.chapterId === s.chapterId);
  const next = course.chapters[idx + 1];
  return next ? { chapterId: next.chapterId, session: 1, v: course.version } : s;
}

// ---- grammar points as reviewable cards ------------------------------------------------------------
/** Blank out `blank` where it stands as a whole word (не must not hit the не inside Извинете). Falls back
 *  to the first occurrence when the blank is part of a word on purpose (an ending). */
export function blankOut(text: string, blank: string): string {
  const esc = blank.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const whole = new RegExp(`(^|[^\\p{L}])${esc}(?![\\p{L}])`, "u");
  return whole.test(text) ? text.replace(whole, (_m, pre: string) => `${pre}___`) : text.replace(blank, "___");
}

/** The grammar concept whose pattern table a point may show: only once the point is the LAST in the spine
 *  drawing on that concept — earlier points would otherwise preview later chapters' material (не's lesson
 *  showing нема да). */
export function patternConceptFor(course: Course, point: GrammarPoint): string | undefined {
  return point.grammarIds.find((g) => {
    const users = course.points.filter((p) => p.grammarIds.includes(g));
    return users.length > 0 && users[users.length - 1]!.id === point.id;
  });
}
// A point's blank cards render as multiple-choice drills (the Drill component) and are graded into the
// same familiarity/SRS store as words, keyed `grammar:pt:<pointId>:<n>`.
export function blankCardItems(point: GrammarPoint): ReviewItem[] {
  return point.cards.flatMap((c: GrammarCard, i): ReviewItem[] => c.kind !== "blank" ? [] : [{
    id: `pt:${point.id}:${i}`,
    kind: "grammar",
    prompt: blankOut(c.line.text, c.blank),
    answer: c.blank,
    gloss: c.line.gloss,
    options: c.options,
    why: c.why,
    i1Level: 0,
    tags: ["grammar", point.id],
    meta: { concept: point.title, point: point.id },
  }]);
}

/** A point's rule cards: a plain question, revealed to a one-line answer (+ an existing example line). */
export function ruleCardItems(point: GrammarPoint): ReviewItem[] {
  return point.cards.flatMap((c: GrammarCard, i): ReviewItem[] => c.kind !== "rule" ? [] : [{
    id: `pt:${point.id}:r${i}`,
    kind: "grammar",
    prompt: c.front,
    answer: c.back,
    gloss: c.back,
    i1Level: 0,
    tags: ["grammar", point.id],
    meta: { concept: point.title, point: point.id, ruleCard: true, ...(c.example ? { example: c.example.text, exampleGloss: c.example.gloss } : {}) },
  }]);
}

/** All of a point's flashcards: rule cards first, then blank cards. */
export const pointItems = (point: GrammarPoint): ReviewItem[] => [...ruleCardItems(point), ...blankCardItems(point)];

export const pointsById = (course: Course) => new Map(course.points.map((p) => [p.id, p]));

/** Every point card in the course — they join the warm-up's review pool once their point is taught. */
export const allPointItems = (course: Course): ReviewItem[] => course.points.flatMap(pointItems);

/** Cards for the points a learner has been taught (seenGrammar[pointId]) — the Flashcards "Grammar" deck. */
export const taughtPointItems = (course: Course, p: Progress): ReviewItem[] =>
  course.points.filter((pt) => p.seenGrammar?.[pt.id]).flatMap(pointItems);

// ---- warm-up: due cards, with a guaranteed share from EARLIER chapters (DESIGN §4a item 1) ----------
export const WARMUP_ITEMS = 8;
export const REVIEW_ITEMS = 14;
export const EARLIER_SHARE = { normal: 2, review: 4 };

/** Where the blueprint first teaches a lexKey / point card: chapter order (1-based) and session n. */
export interface CourseSlot { order: number; n: number }

/** The slot of every word and point card in the course. A word a session teaches belongs to that session;
 *  a point's cards to the session that teaches the point. Chapter words/points no session introduces
 *  count from the chapter's last session. */
export function slotOfKey(course: Course): Map<string, CourseSlot> {
  const m = new Map<string, CourseSlot>();
  const cardKeys = (pid: string) => {
    const p = course.points.find((x) => x.id === pid);
    return p ? pointItems(p).map((it) => familiarity.deriveKeyForItem(it).lexKey) : [];
  };
  const put = (k: string, slot: CourseSlot) => { if (!m.has(k)) m.set(k, slot); };
  for (const c of course.chapters) {
    for (const s of c.sessions) {
      for (const w of s.words) put(w.lexKey, { order: c.order, n: s.n });
      if (s.role === "teach" && s.pointId) cardKeys(s.pointId).forEach((k) => put(k, { order: c.order, n: s.n }));
    }
    const last = { order: c.order, n: c.sessions.length };
    for (const w of c.words) put(w.lexKey, last);
    for (const pid of c.pointIds) cardKeys(pid).forEach((k) => put(k, last));
  }
  return m;
}

/** Has the course taught this slot in a session before `current`? */
export const taughtBefore = (slot: CourseSlot | undefined, current: CourseSlot): boolean =>
  !!slot && (slot.order < current.order || (slot.order === current.order && slot.n < current.n));

// ---- what the course has taught by a session: one answer for every screen and for the lint ----------
export const cmpSlot = (a: CourseSlot, b: CourseSlot): number => a.order - b.order || a.n - b.n;

/** The session that teaches each point. */
export function pointSlots(course: Course): Map<string, CourseSlot> {
  const m = new Map<string, CourseSlot>();
  for (const c of course.chapters) for (const s of c.sessions) {
    if (s.role === "teach" && s.pointId && !m.has(s.pointId)) m.set(s.pointId, { order: c.order, n: s.n });
  }
  return m;
}

/** Cyrillic word tokens of a line, normalized the way familiarity keys are. */
export const wordTokens = (s: string): string[] =>
  (s.match(/[\p{Script=Cyrillic}]+/gu) ?? []).map((t) => familiarity.normalize(t)).filter(Boolean);

/** The point that teaches a verb group's endings (from the grammar concept the point draws on). */
const verbGroupConcept = (group: string) => (group === "a" ? "verb-conjugation" : group === "irregular" ? "to-be" : `verb-conjugation-${group}`);

/** Every word form known once these words and points are taught: the words' own tokens, the points' card
 *  forms (a blank and its options: сум, си, е…), and every form of a verb once one of its forms is known
 *  AND its group's endings have been taught (разбирам known + -а verbs taught ⇒ разбира, разбираш…). */
export function knownForms(pack: LanguagePack, points: GrammarPoint[], words: Iterable<string>, pointIds: Iterable<string>): Set<string> {
  const known = new Set<string>();
  for (const w of words) wordTokens(w).forEach((t) => known.add(t));
  const taught = new Set(pointIds);
  for (const p of points) {
    if (!taught.has(p.id)) continue;
    for (const c of p.cards) if (c.kind === "blank") [c.blank, ...c.options].flatMap(wordTokens).forEach((t) => known.add(t));
  }
  for (const v of pack.conjugations ?? []) {
    const forms = [v.lemma, ...Object.values(v.forms)].flatMap(wordTokens);
    const endings = points.find((p) => p.grammarIds.includes(verbGroupConcept(v.group)));
    if (endings && taught.has(endings.id) && forms.some((f) => known.has(f))) forms.forEach((f) => known.add(f));
  }
  return known;
}

/** The session at which each word form becomes known (see knownForms), walking the course in order. */
export function formSlots(pack: LanguagePack, course: Course): Map<string, CourseSlot> {
  const m = new Map<string, CourseSlot>();
  const words: string[] = [];
  const pts: string[] = [];
  for (const c of course.chapters) for (const s of c.sessions) {
    words.push(...s.words.map((w) => w.display));
    if (s.role === "teach" && s.pointId) pts.push(s.pointId);
    for (const t of knownForms(pack, course.points, words, pts)) if (!m.has(t)) m.set(t, { order: c.order, n: s.n });
  }
  return m;
}

/** Pick the warm-up: due studied cards, but at least `share` of them from chapters before the current one
 *  — the weakest first, due or not — so a busy chapter can't crowd older material out. Only what the
 *  course has already taught, in an earlier session, is eligible: a card met out of order (before a
 *  course reorder, or a word tapped in a story) stays in Flashcards and waits for its own session. */
export function pickWarmup(opts: {
  pool: ReviewItem[];
  progress: Progress;
  now: Date;
  current: CourseSlot;
  slotOf: Map<string, CourseSlot>;
  size: number;
  share: number;
}): ReviewItem[] {
  const { progress, now, current } = opts;
  const keyOf = (it: ReviewItem) => familiarity.deriveKeyForItem(it).lexKey;
  const entry = (it: ReviewItem) => progress.familiarity[keyOf(it)];
  const slot = (it: ReviewItem) => opts.slotOf.get(keyOf(it));
  const studied = (it: ReviewItem) => { const e = entry(it); return !!e && familiarity.isStudied(e) && !!e.srs && taughtBefore(slot(it), current); };
  const due = (it: ReviewItem) => studied(it) && new Date(entry(it)!.srs!.due) <= now;
  const seen = new Set<string>();
  const uniq = opts.pool.filter((it) => { const k = keyOf(it); if (seen.has(k)) return false; seen.add(k); return true; });

  const earlier = uniq
    .filter((it) => studied(it) && slot(it)!.order < current.order)
    .sort((a, b) => Number(due(b)) - Number(due(a)) || (entry(a)!.strength ?? 0) - (entry(b)!.strength ?? 0));
  const out: ReviewItem[] = earlier.slice(0, opts.share);
  const picked = new Set(out.map(keyOf));
  for (const it of uniq.filter(due)) {
    if (out.length >= opts.size) break;
    if (!picked.has(keyOf(it))) { out.push(it); picked.add(keyOf(it)); }
  }
  return out;
}

// ---- stage review -----------------------------------------------------------------------------------
/** A stage review samples every chapter of the stage: up to `perChapter` studied words each (weakest
 *  first), one card per point, and the stage's first conversation not yet completed. */
export function stageReviewContent(pack: LanguagePack, course: Course, afterChapterId: string, progress: Progress, perChapter = 3): {
  items: ReviewItem[];
  scenarioId?: string;
} {
  const review = course.stageReviews.find((r) => r.afterChapterId === afterChapterId);
  if (!review) return { items: [] };
  const byKey = new Map(pack.vocab.map((v) => [familiarity.deriveKeyForItem(v).lexKey, v]));
  const words = review.chapterIds.flatMap((cid) => {
    const ch = course.chapters.find((c) => c.chapterId === cid);
    return (ch?.words ?? [])
      .filter((w) => !!progress.familiarity[w.lexKey])
      .sort((a, b) => (progress.familiarity[a.lexKey]!.strength ?? 0) - (progress.familiarity[b.lexKey]!.strength ?? 0))
      .slice(0, perChapter)
      .map((w) => byKey.get(w.lexKey))
      .filter((v): v is ReviewItem => !!v);
  });
  const points = pointsById(course);
  const cards = review.pointIds.map((id) => points.get(id)).filter((p): p is GrammarPoint => !!p)
    .flatMap((p) => blankCardItems(p).slice(0, 1));
  const scenarioId = review.scenarioIds.find((id) => {
    const sp = progress.scenarios[id];
    const scen = pack.scenarios.find((s) => s.id === id);
    return !sp || !!scen?.successCriteria.some((c) => !sp.metCriteria.includes(c.id));
  }) ?? review.scenarioIds[0];
  return { items: [...words, ...cards], scenarioId };
}

/** Does this session still teach the word? Yes unless the learner knows it (or set it aside): a word met
 *  earlier (in passing, or before a course reorder) is still taught in its own session, as the agenda says. */
export const needsTeaching = (progress: Progress, lexKey: string): boolean => {
  const status = progress.familiarity[lexKey]?.status;
  return status !== "known" && status !== "ignored";
};

// ---- agenda + recap (DESIGN §5) ---------------------------------------------------------------------
export interface Agenda { title: string; items: string[] }

/** The brief agenda that opens a session: where we are, then the blueprint's bullets for today. */
export function sessionAgenda(pack: LanguagePack, course: Course, pos: CoursePosition): Agenda | undefined {
  if (pos.kind === "finished") return undefined;
  if (pos.kind === "stage-review") {
    const r = course.stageReviews.find((x) => x.afterChapterId === pos.afterChapterId);
    const titles = (r?.chapterIds ?? []).map((id) => pack.chapters?.find((c) => c.id === id)?.shortTitle).filter(Boolean);
    return { title: "Stage review", items: [`A look back at ${titles.join(", ")}`, "Words and grammar from every chapter in the stage", "One conversation from the stage"] };
  }
  const ch = pack.chapters?.find((c) => c.id === pos.chapter.chapterId);
  const role = pos.session.role === "teach" ? "" : pos.session.role === "review" ? " · review day" : pos.session.role === "use" ? " · put it together" : pos.session.role === "checkpoint" ? " · checkpoint" : " · practice";
  const items = pos.retry ? ["A quick review of this chapter's trickiest words", ...pos.session.agenda] : pos.session.agenda;
  return { title: `Chapter ${ch?.order ?? ""} · ${ch?.shortTitle ?? ""} · session ${pos.session.n}${role}`, items };
}

export interface RecapPoint {
  point: GrammarPoint;
  /** Taught today for the first time, or practised/revisited. */
  fresh: boolean;
  /** Today's own lines that use the point (from the story read today), so the recap quotes what you met. */
  lines: { text: string; gloss: string; source: string }[];
}

export interface Recap {
  points: RecapPoint[];
  /** Every word from today: the session's taught words, plus anything tapped/captured during it. */
  words: { lexKey: string; display: string; gloss?: string }[];
  /** Today's grammar cards (the point's blank cards). */
  cards: ReviewItem[];
  /** Chapter 0: the letters learned today, with their sounds and an example word. */
  letters: { glyph: string; sound: string; example?: string; gloss?: string }[];
  next: string;
}

/** What the end-of-session recap shows (DESIGN §5). `since` (and, for saved lesson notes, `until`) bound
 *  the session, to pick up words tapped during it. */
export function sessionRecap(pack: LanguagePack, course: Course, pos: CoursePosition, progress: Progress, since: Date, until?: Date): Recap {
  const points = pointsById(course);
  const out: Recap = { points: [], words: [], cards: [], letters: [], next: "" };
  const fresh = (lexKey: string) => {
    const e = progress.familiarity[lexKey];
    if (!e) return false;
    const at = new Date(e.createdAt);
    return at >= since && (!until || at <= until) && familiarity.isStudied(e) && e.status !== "ignored" && !lexKey.startsWith("grammar:");
  };
  if (pos.kind === "stage-review") {
    out.next = "Next: a new chapter";
    return out;
  }
  if (pos.kind !== "session") return out;
  const { chapter, session } = pos;
  if (session.letters) {
    out.letters = session.letters.glyphs.map((g) => pack.alphabet.find((a) => a.glyph === g)).filter((a): a is NonNullable<typeof a> => !!a)
      .map((a) => ({ glyph: a.glyph, sound: a.sound, example: a.examples[0]?.text, gloss: a.examples[0]?.gloss }));
    out.next = session.next;
    return out;
  }
  // Which points does today recap? The one taught/practised, else everything this chapter has taught so far.
  const taughtSoFar = chapter.pointIds.filter((id) => chapter.sessions.some((s) => s.n <= session.n && s.pointId === id));
  const ids = session.pointId ? [session.pointId] : taughtSoFar;
  const story = session.story ? pack.stories?.find((s) => s.id === session.story!.id) : undefined;
  for (const id of ids) {
    const point = points.get(id);
    if (!point) continue;
    const lines = (story?.body ?? []).flatMap((b, i) => (course.lineTags[`story:${story!.id}#${i}`] ?? []).includes(id) ? [{ text: b.text, gloss: b.gloss, source: `story:${story!.id}#${i}` }] : []);
    out.points.push({ point, fresh: session.role === "teach" && session.pointId === id, lines });
  }
  const seen = new Set<string>();
  for (const w of session.words) if (!seen.has(w.lexKey)) { seen.add(w.lexKey); out.words.push({ lexKey: w.lexKey, display: w.display, gloss: w.gloss }); }
  for (const [k, e] of Object.entries(progress.familiarity)) {
    if (!e || seen.has(k) || !fresh(k)) continue;
    seen.add(k);
    out.words.push({ lexKey: k, display: e.display ?? k, gloss: e.gloss });
  }
  if (session.pointId) { const p = points.get(session.pointId); if (p) out.cards = pointItems(p); }
  out.next = session.next;
  return out;
}

// ---- today's focus inside lines, and "Use it" (the exercises after the story) ---------------------------
/** The words carrying any of these points in a line (from course.lineFocus), for word-level highlighting. */
export function focusWords(course: Course, source: string, pointIds: string[]): string[] {
  const f = course.lineFocus?.[source];
  return f ? [...new Set(pointIds.flatMap((p) => f[p]?.words ?? []))] : [];
}

/** The points a session focuses on: the story's lens, else its own point. */
export const sessionFocus = (chapter: CourseChapter, s: CourseSession): string[] =>
  s.story?.lens.length ? s.story.lens : [practisedPoint(chapter, s)].filter((x): x is string => !!x);

export type UseItItem =
  /** Read a line, pick what it means (English options from the same story). */
  | { kind: "understand"; line: LineRef; options: string[] }
  /** The line with today's form blanked; tap one of three. */
  | { kind: "complete"; line: LineRef; blank: string; options: string[]; why: string }
  /** Put the line's words back in order. */
  | { kind: "build"; line: LineRef }
  /** Say the line, with speech feedback (skippable). */
  | { kind: "say"; line: LineRef & { translit?: string } };

/** A line without its quotation marks (tiles and speech shouldn't carry „ “). */
export const bareLine = (text: string) => text.replace(/[„“”"«»]/g, "").replace(/\s+/g, " ").trim();

/** About four exercises on today's focus, easiest first (understand → complete → build → say), built only
 *  from the story's own lines that use the focus points, so they practise the lesson at hand. When the story
 *  has no such line, the points' own example lines and quick checks stand in. `seed` varies the picks
 *  from one reading of the same story to the next. */
export function useItItems(course: Course, story: MiniStory, focus: string[], seed = 0): UseItItem[] {
  const all = story.body.map((b, i) => ({ text: b.text, gloss: b.gloss, source: `story:${story.id}#${i}`, translit: b.translit }));
  const onFocus = (src: string) => (course.lineTags[src] ?? []).some((t) => focus.includes(t));
  const rot = <T,>(a: T[]) => (a.length ? a.map((_, i) => a[(i + seed) % a.length]!) : a);
  const pts = focus.map((id) => course.points.find((p) => p.id === id)).filter((p): p is GrammarPoint => !!p);
  // The story's own lines on today's focus first; when it has fewer than three, the lesson's example lines
  // join them, so four exercises don't all lean on one sentence.
  const storyLines = rot(all.filter((l) => l.gloss && onFocus(l.source)));
  const examples = pts.flatMap((p) => p.examples).filter((e) => e.gloss && !storyLines.some((l) => bareLine(l.text) === bareLine(e.text))).map((e) => ({ ...e, translit: undefined as string | undefined }));
  const lines = storyLines.length >= 3 ? storyLines : [...storyLines, ...rot(examples)];
  if (!lines.length) return [];
  const used = new Set<string>();
  const pick = (ok: (l: (typeof lines)[number]) => boolean) => lines.find((l) => ok(l) && !used.has(l.source)) ?? lines.find(ok);
  const take = <T extends { source: string }>(l: T | undefined) => { if (l) used.add(l.source); return l; };
  const out: UseItItem[] = [];

  // 1. Understand: the line's English among two other lines' English (from the same story, or examples).
  const u = take(pick(() => true));
  const others = [...new Set([...all, ...lines].filter((l) => l.gloss && l.source !== u?.source && l.gloss !== u?.gloss).map((l) => l.gloss))];
  if (u && others.length >= 2) out.push({ kind: "understand", line: { text: u.text, gloss: u.gloss, source: u.source }, options: [u.gloss, ...rot(others).slice(0, 2)] });

  // 2. Complete: today's form blanked (from the line's focus), else one of the points' quick checks.
  const blankOf = (src: string) => focus.map((p) => course.lineFocus?.[src]?.[p]?.blank).find((b) => !!b);
  const c = take(pick((l) => !!blankOf(l.source)));
  const cb = c && blankOf(c.source);
  if (c && cb) out.push({ kind: "complete", line: { text: c.text, gloss: c.gloss, source: c.source }, blank: cb.word, options: cb.options, why: cb.why });
  else {
    const card = rot(pts.flatMap((p) => p.cards).filter((x): x is Extract<GrammarCard, { kind: "blank" }> => x.kind === "blank"))[0];
    if (card) out.push({ kind: "complete", line: card.line, blank: card.blank, options: card.options, why: card.why });
  }

  // 3. Build: a line of two to seven words.
  const words = (t: string) => bareLine(t).split(" ").length;
  const b = take(pick((l) => words(l.text) >= 2 && words(l.text) <= 7));
  if (b) out.push({ kind: "build", line: { text: bareLine(b.text), gloss: b.gloss, source: b.source } });

  // 4. Say it: the shortest focus line not used yet.
  const sayable = [...lines].sort((x, y) => words(x.text) - words(y.text));
  const sy = sayable.find((l) => !used.has(l.source)) ?? sayable[0];
  if (sy) out.push({ kind: "say", line: { text: bareLine(sy.text), gloss: sy.gloss, source: sy.source, translit: sy.translit } });
  return out;
}

/** What the "Have a question?" helper is told about the learner: their chapter, the points taught so far,
 *  and what comes later (with its chapter). */
export function explainContext(course: Course, p: Progress): { chapter: number; taught: string[]; later: { title: string; chapter: number }[] } {
  const pos = position(course, p.course);
  const orderOf = (chapterId: string) => course.chapters.find((c) => c.chapterId === chapterId)?.order ?? 0;
  const chapter = pos.kind === "session" ? pos.chapter.order : pos.kind === "stage-review" ? orderOf(pos.afterChapterId) : Math.max(...course.chapters.map((c) => c.order));
  return {
    chapter,
    taught: course.points.filter((pt) => p.seenGrammar?.[pt.id]).map((pt) => pt.title),
    later: course.points.filter((pt) => !p.seenGrammar?.[pt.id]).map((pt) => ({ title: pt.title, chapter: orderOf(pt.chapterId) })),
  };
}

// ---- practice tools on the course: what's in reach by the learner's place ------------------------------
/** The learner's place as a slot (a stage review or the end counts as past its chapter). */
export function currentSlot(course: Course, p: Progress): CourseSlot {
  const pos = position(course, p.course);
  if (pos.kind === "session") return { order: pos.chapter.order, n: pos.session.n };
  if (pos.kind === "stage-review") return { order: course.chapters.find((c) => c.chapterId === pos.afterChapterId)?.order ?? 0, n: 999 };
  return { order: 999, n: 999 };
}

/** Build-a-sentence on the course: a sentence is in reach once the course has taught its verb (the forms it
 *  uses) and every grammar point it uses (its line tags; for an untagged item, a point for each concept). */
export function sentenceAllowed(pack: LanguagePack, course: Course, p: Progress): (it: SentenceItem) => boolean {
  const at = currentSlot(course, p);
  const forms = formSlots(pack, course);
  const ps = pointSlots(course);
  const reached = (s?: CourseSlot) => !!s && cmpSlot(s, at) <= 0;
  return (it) => {
    const verb = it.verbLemma ? pack.conjugations?.find((c) => c.lemma === it.verbLemma) : undefined;
    if (verb) {
      const verbForms = new Set([verb.lemma, ...Object.values(verb.forms)].flatMap(wordTokens));
      if (!it.variants.every((v) => wordTokens(v.mk).filter((t) => verbForms.has(t)).every((t) => reached(forms.get(t))))) return false;
    }
    const tags = course.lineTags[`sentence:${it.id}`];
    if (tags) return tags.every((id) => reached(ps.get(id)));
    return it.conceptIds.every((cid) => course.points.some((pt) => pt.grammarIds.includes(cid) && reached(ps.get(pt.id))));
  };
}

/** Verbs the warm-up's conjugation drill may use: ones the course has taught by now (a form of them is a
 *  taught word) whose endings have been taught too. */
export function taughtVerbs(pack: LanguagePack, course: Course, p: Progress): Set<string> {
  const at = currentSlot(course, p);
  const forms = formSlots(pack, course);
  return new Set((pack.conjugations ?? []).filter((v) => [v.lemma, ...Object.values(v.forms)].flatMap(wordTokens).some((t) => { const s = forms.get(t); return !!s && cmpSlot(s, at) <= 0; })).map((v) => v.lemma));
}

/** The course chapter that teaches a word (lexKey), or that lists it among its extra, Library-only words.
 *  A word inside a taught bundle ("два, три, четири, пет") belongs to that bundle's chapter. */
export function chapterOfWord(course: Course, lexKey: string): { order: number; chapterId: string; extra: boolean } | undefined {
  for (const c of course.chapters) if (c.words.some((w) => w.lexKey === lexKey)) return { order: c.order, chapterId: c.chapterId, extra: false };
  for (const c of course.chapters) if (c.words.some((w) => w.lexKey.split(/[\s,/]+/).includes(lexKey))) return { order: c.order, chapterId: c.chapterId, extra: false };
  for (const c of course.chapters) if (c.extraWords.some((w) => w.lexKey === lexKey)) return { order: c.order, chapterId: c.chapterId, extra: true };
  return undefined;
}

/** Has the learner learned this word inside a taught bundle (два inside "два, три, четири, пет")? */
export function learnedInBundle(course: Course, p: Progress, lexKey: string): boolean {
  return course.chapters.some((c) => c.words.some((w) => w.lexKey !== lexKey && w.lexKey.split(/[\s,/]+/).includes(lexKey) && !!p.familiarity[w.lexKey] && familiarity.isStudied(p.familiarity[w.lexKey]!)));
}

/** Review days bring back the learner's own picks: due words they ★ saved or picked with ＋ Learn, which the
 *  daily warm-up (course material only) leaves out. Pack items where they exist, else built from the entry. */
export function ownWordsDue(pack: LanguagePack, p: Progress, now: Date, limit: number): ReviewItem[] {
  const byKey = new Map(pack.vocab.map((v) => [familiarity.deriveKeyForItem(v).lexKey, v]));
  return Object.values(p.familiarity)
    .filter((e) => (familiarity.isStarred(e) || familiarity.isPicked(e)) && familiarity.isStudied(e) && !!e.srs && new Date(e.srs.due) <= now && !e.lexKey.startsWith("grammar:"))
    .sort((a, b) => (a.strength ?? 0) - (b.strength ?? 0))
    .slice(0, limit)
    .map((e) => byKey.get(e.lexKey) ?? { id: `own-${e.lexKey}`, kind: "phrase" as const, prompt: e.gloss ?? e.display ?? e.lexKey, answer: e.display ?? e.lexKey, gloss: e.gloss ?? e.display ?? e.lexKey, i1Level: 0, tags: [] });
}

// ---- lesson notes: a small record per finished session, rebuilt into its recap later --------------------
/** The record kept when a session ends (see Progress.courseLog). */
export function logEntry(pos: CoursePosition, startedAt: Date, at: Date, missed: { answer: string; gloss: string }[]): CourseLogEntry | undefined {
  if (pos.kind === "finished") return undefined;
  const base = { startedAt: startedAt.toISOString(), at: at.toISOString(), ...(missed.length ? { missed: missed.slice(0, 20) } : {}) };
  return pos.kind === "stage-review"
    ? { chapterId: pos.afterChapterId, n: 0, stage: true, ...base }
    : { chapterId: pos.chapter.chapterId, n: pos.session.n, ...base };
}

/** The session a record (or a chapter/session pair) points at, for rebuilding its recap. */
export function positionOf(course: Course, at: { chapterId: string; n: number; stage?: boolean }): CoursePosition | undefined {
  if (at.stage) return course.stageReviews.some((r) => r.afterChapterId === at.chapterId) ? { kind: "stage-review", afterChapterId: at.chapterId } : undefined;
  const chapter = course.chapters.find((c) => c.chapterId === at.chapterId);
  const session = chapter?.sessions.find((x) => x.n === at.n);
  return chapter && session ? { kind: "session", chapter, session, retry: false } : undefined;
}

/** The point a practice session practises: its own, else the chapter's latest one taught before it. */
export const practisedPoint = (chapter: CourseChapter, s: CourseSession): string | undefined =>
  s.pointId ?? chapter.pointIds.filter((id) => chapter.sessions.some((x) => x.n < s.n && x.pointId === id)).at(-1);

/** One line naming a session in the course map: what it teaches and its new words. */
export function sessionHeadline(course: Course, chapter: CourseChapter, s: CourseSession): string {
  if (s.letters) return s.role === "checkpoint" ? "Checkpoint: the tricky letters" : `${s.letters.title}: ${s.letters.glyphs.join(" ")}`;
  const title = (id?: string) => (id ? course.points.find((p) => p.id === id)?.title : undefined);
  const words = s.words.map((w) => w.display.replace(/\.+$/, "")).join(", ");
  const withWords = (head: string) => (words ? `${head} · ${words}` : head);
  switch (s.role) {
    case "teach": return withWords(`New: ${title(s.pointId) ?? "grammar"}`);
    case "practice": return withWords(`Practice: ${title(practisedPoint(chapter, s)) ?? "this chapter's grammar"}`);
    case "review": return s.speak ? "Review day · the conversation" : "Review day";
    case "use": return withWords(s.writing ? "Put it together · write your own lines" : "Put it together");
    default: return "Checkpoint: this chapter's words and grammar";
  }
}

export type MapState = "done" | "current" | "upcoming";
export interface ChapterOverview {
  chapterId: string;
  order: number;
  title: string;
  shortTitle: string;
  state: MapState;
  sessions: { n: number; role: CourseSession["role"]; headline: string; state: MapState; log?: CourseLogEntry }[];
  points: { id: string; title: string; taught: boolean }[];
  words: { lexKey: string; display: string; gloss: string; learned: boolean }[];
  /** A stage review follows this chapter. */
  stageReview?: { state: MapState; log?: CourseLogEntry };
}
export interface CourseOverview {
  chapters: ChapterOverview[];
  /** Curriculum sessions (chapters 1+) finished and in total. */
  done: number;
  total: number;
  current?: { chapterId: string; n: number; stage?: boolean };
}

/** The whole course as the learner's map: every chapter and session marked done / today / upcoming from
 *  their place in the course, with the grammar and words each chapter teaches. */
export function courseOverview(pack: LanguagePack, course: Course, p: Progress): CourseOverview {
  const pos = position(course, p.course);
  const cur = current(course, p.course);
  const idx = course.chapters.findIndex((c) => c.chapterId === cur.chapterId);
  const log = p.courseLog ?? [];
  const logOf = (chapterId: string, n: number, stage = false) => [...log].reverse().find((e) => e.chapterId === chapterId && e.n === n && !!e.stage === stage);
  const learned = (k: string) => { const e = p.familiarity[k]; return !!e && familiarity.isStudied(e) && e.status !== "ignored"; };
  const chapters = course.chapters.map((c, ci): ChapterOverview => {
    const ch = pack.chapters?.find((x) => x.id === c.chapterId);
    const state: MapState = pos.kind === "finished" || ci < idx ? "done" : ci > idx ? "upcoming" : pos.kind === "stage-review" ? "done" : "current";
    const sessionState = (n: number): MapState => (state !== "current" ? state : n < cur.session ? "done" : n === cur.session ? "current" : "upcoming");
    const hasStage = course.stageReviews.some((r) => r.afterChapterId === c.chapterId);
    const stageState: MapState = pos.kind === "stage-review" && pos.afterChapterId === c.chapterId ? "current" : pos.kind === "finished" || ci < idx ? "done" : "upcoming";
    return {
      chapterId: c.chapterId,
      order: c.order,
      title: ch?.title ?? c.chapterId,
      shortTitle: ch?.shortTitle ?? c.chapterId,
      state,
      sessions: c.sessions.map((s) => ({ n: s.n, role: s.role, headline: sessionHeadline(course, c, s), state: sessionState(s.n), log: logOf(c.chapterId, s.n) })),
      points: c.pointIds.map((id) => ({ id, title: course.points.find((x) => x.id === id)?.title ?? id, taught: !!p.seenGrammar?.[id] })),
      words: c.words.map((w) => ({ lexKey: w.lexKey, display: w.display, gloss: w.gloss, learned: learned(w.lexKey) })),
      ...(hasStage ? { stageReview: { state: stageState, log: logOf(c.chapterId, 0, true) } } : {}),
    };
  });
  const curriculum = chapters.filter((c) => c.order > 0).flatMap((c) => c.sessions);
  return {
    chapters,
    done: curriculum.filter((s) => s.state === "done").length,
    total: curriculum.length,
    current: pos.kind === "session" ? { chapterId: pos.chapter.chapterId, n: pos.session.n } : pos.kind === "stage-review" ? { chapterId: pos.afterChapterId, n: 0, stage: true } : undefined,
  };
}

/** What a passed checkpoint leads to, for its message: the next chapter, a stage review, or the end. */
export function afterCheckpoint(pack: LanguagePack, course: Course, state: CourseState | undefined): string {
  const next = position(course, advance(course, state, { checkpointPassed: true }));
  if (next.kind === "stage-review") return "a stage review of everything so far";
  if (next.kind === "finished") return "the end of the course";
  const ch = pack.chapters?.find((c) => c.id === next.chapter.chapterId);
  return `chapter ${ch?.order ?? next.chapter.order}${ch ? `, ${ch.shortTitle}` : ""}`;
}

// ---- partnered: what I publish about my place in the course (core/partner/joint) ----------------------
/** My course position for the partner (undefined when the new course is off). Points taught are the
 *  course points marked seen. */
export function positionShare(pack: LanguagePack, p: Progress): CoursePositionShare | undefined {
  const course = pack.course;
  if (!course || !courseV2On(pack, p)) return undefined;
  const state = current(course, p.course);
  const ch = course.chapters.find((c) => c.chapterId === state.chapterId) ?? course.chapters[0]!;
  return {
    chapterId: ch.chapterId,
    chapterOrder: ch.order,
    session: state.stageReviewAfter ? ch.sessions.length + 1 : state.session,
    points: course.points.filter((pt) => p.seenGrammar?.[pt.id]).map((pt) => pt.id),
  };
}
