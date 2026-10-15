// Plays the course blueprint (pack.course — DESIGN-course-spine.md): where the learner is, what today's
// session holds, and how the position advances once it's done. Pure — no React — so it's unit-tested
// (test/course-player.test.ts) and page.tsx only renders what this decides.
//
// The blueprint fixes WHAT is taught WHEN. Only review content is decided here at runtime: which due
// cards make the warm-up (with a guaranteed share from earlier chapters), what a failed checkpoint
// re-drills, and what a stage review samples.
import type { Course, CourseChapter, CourseSession, CourseWord, GrammarCard, GrammarPoint, LanguagePack, LineRef, MiniStory, ReviewItem, SentenceItem } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import type { CoursePositionShare } from "@ll/core/partner/joint";
import type { GrammarItem } from "@ll/core/partner/grammar-together";
import type { CourseLogEntry, Progress } from "./store";
import type { CourseExam, CourseWriting, WritingLine } from "@ll/pack-schema";
import { romanize } from "./romanize";

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
  /** The exam after this chapter is next (after its stage review, when there is one). */
  examAfter?: string;
  /** The whole course is finished. */
  finished?: boolean;
  /** The blueprint structure this position was made on (Course.version). A different one re-places the
   *  learner at the start: their words, grammar seen and saved cards are kept. */
  v?: string;
}

export type CoursePosition =
  | { kind: "session"; chapter: CourseChapter; session: CourseSession; retry: boolean }
  | { kind: "stage-review"; afterChapterId: string }
  | { kind: "exam"; afterChapterId: string; exam: CourseExam }
  | { kind: "finished" };

/** The exam (midterm / final) that follows a chapter, if any. */
export const examAfterChapter = (course: Course, chapterId: string): CourseExam | undefined => course.exams?.find((e) => e.afterChapterId === chapterId);

export const initialState = (course: Course): CourseState => ({ chapterId: course.chapters[0]!.chapterId, session: 1, v: course.version });

/** The saved state, unless it was made on a different course structure (then: the start). */
const current = (course: Course, state: CourseState | undefined): CourseState =>
  state && (!course.version || state.v === course.version) ? state : initialState(course);

export function position(course: Course, state: CourseState | undefined): CoursePosition {
  const s = current(course, state);
  if (s.finished) return { kind: "finished" };
  if (s.examAfter) { const exam = examAfterChapter(course, s.examAfter); if (exam) return { kind: "exam", afterChapterId: s.examAfter, exam }; }
  if (s.stageReviewAfter) return { kind: "stage-review", afterChapterId: s.stageReviewAfter };
  const chapter = course.chapters.find((c) => c.chapterId === s.chapterId) ?? course.chapters[0]!;
  const session = chapter.sessions[Math.min(Math.max(1, s.session), chapter.sessions.length) - 1]!;
  return { kind: "session", chapter, session, retry: !!s.retry && session.role === "checkpoint" };
}

/** Advance after a finished session. A checkpoint only moves on when passed (else: retry, with a review
 *  first); a passed stage-ending checkpoint owes a stage review; then the chapter's exam, if it has one
 *  (taken or set aside — exams don't gate); then the next chapter. */
export function advance(course: Course, state: CourseState | undefined, outcome: { checkpointPassed?: boolean }): CourseState {
  const v = course.version;
  const s = { ...current(course, state), v };
  if (s.finished) return s;
  const idx = course.chapters.findIndex((c) => c.chapterId === s.chapterId);
  const next = course.chapters[idx + 1];
  const toNextChapter = (): CourseState => (next ? { chapterId: next.chapterId, session: 1, v } : { chapterId: s.chapterId, session: s.session, finished: true, v });
  const toExam = (chapterId: string): CourseState => ({ chapterId: s.chapterId, session: s.session, examAfter: chapterId, v });
  if (s.examAfter) return toNextChapter();
  if (s.stageReviewAfter) return examAfterChapter(course, s.stageReviewAfter) ? toExam(s.stageReviewAfter) : toNextChapter();
  const chapter = course.chapters[idx]!;
  const session = chapter.sessions[s.session - 1];
  if (session?.role === "checkpoint") {
    if (!outcome.checkpointPassed) return { ...s, retry: true };
    if (course.stageReviews.some((r) => r.afterChapterId === chapter.chapterId)) return { chapterId: s.chapterId, session: s.session, stageReviewAfter: chapter.chapterId, v };
    if (examAfterChapter(course, chapter.chapterId)) return toExam(chapter.chapterId);
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

/** A partner's published place in the course, as a slot (their current, not-yet-done session). */
export const slotOfShare = (s: CoursePositionShare): CourseSlot => ({ order: s.chapterOrder, n: s.session });

/** Where each story is first read (its own chapter's session, not a later reuse). */
export function storySlots(course: Course): Map<string, CourseSlot> {
  const m = new Map<string, CourseSlot>();
  for (const c of course.chapters) for (const s of c.sessions) {
    if (s.story && !s.story.reuse && !m.has(s.story.id)) m.set(s.story.id, { order: c.order, n: s.n });
  }
  return m;
}

/** The partnered grammar step for one point: the rule read aloud, then its rule questions and fill-in cards
 *  interleaved, then gaps for the point in story lines BOTH partners have already read (from lineFocus).
 *  Existing lines only. Fill-ins from the point's cards carry the card id, so the answerer's pick grades
 *  their own grammar flashcard. */
export function grammarTogetherItems(pack: LanguagePack, course: Course, pointId: string, a: CourseSlot, b: CourseSlot): GrammarItem[] {
  const point = course.points.find((p) => p.id === pointId);
  if (!point) return [];
  const rules: GrammarItem[] = point.cards.flatMap((c): GrammarItem[] => (c.kind === "rule" ? [{ kind: "rule", question: c.front, answer: c.back }] : [])).slice(0, 2);
  const blanks: GrammarItem[] = point.cards.flatMap((c, i): GrammarItem[] => c.kind !== "blank" ? [] : [{
    kind: "blank", line: c.line.text, gloss: c.line.gloss, answer: c.blank, options: c.options, why: c.why, source: c.line.source, cardId: `pt:${point.id}:${i}`,
  }]).slice(0, 4);
  const used = new Set(blanks.map((x) => (x.kind === "blank" ? x.line : "")));
  const slots = storySlots(course);
  const extra: GrammarItem[] = [];
  for (const [src, byPoint] of Object.entries(course.lineFocus ?? {})) {
    const f = byPoint[pointId];
    if (extra.length >= 2 || !f?.blank || !src.startsWith("story:")) continue;
    const storyId = src.slice("story:".length, src.lastIndexOf("#"));
    const slot = slots.get(storyId);
    if (!taughtBefore(slot, a) || !taughtBefore(slot, b)) continue; // only lines you've both read
    const line = pack.stories?.find((st) => st.id === storyId)?.body[Number(src.slice(src.lastIndexOf("#") + 1))];
    if (!line || used.has(line.text)) continue;
    used.add(line.text);
    extra.push({ kind: "blank", line: line.text, gloss: line.gloss, answer: f.blank.word, options: f.blank.options, why: f.blank.why, source: src });
  }
  const mixed: GrammarItem[] = [];
  for (let i = 0; i < Math.max(rules.length, blanks.length); i++) {
    if (rules[i]) mixed.push(rules[i]!);
    if (blanks[i]) mixed.push(blanks[i]!);
  }
  return [{ kind: "read" }, ...mixed, ...extra];
}

/** The course words BOTH partners have been taught (in sessions each has finished) — the partnered warm-up
 *  draws only on these, so being ahead never pushes your words onto your partner, and words learned outside
 *  the course (★ picks, story taps) stay in your own flashcards. */
export function wordsTaughtToBoth(course: Course, a: CourseSlot, b: CourseSlot): CourseWord[] {
  const slots = slotOfKey(course);
  const out = new Map<string, CourseWord>();
  for (const c of course.chapters) {
    for (const w of [...c.sessions.flatMap((s) => s.words), ...c.words]) {
      const s = slots.get(w.lexKey);
      if (!out.has(w.lexKey) && taughtBefore(s, a) && taughtBefore(s, b)) out.set(w.lexKey, w);
    }
  }
  return [...out.values()];
}

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

/** Most catch-up words a session takes on top of its own (see catchUpWords). */
export const CATCH_UP_MAX = 3;

/** Words from sessions already behind the learner that they've never met: words added to the course after
 *  they'd gone by (a content update, e.g. вие / тие joining chapter 1), or a new-words step they skipped.
 *  Taught at the start of the next session, a few at a time, so changing the course never leaves a gap. */
export function catchUpWords(course: Course, p: Progress, max = CATCH_UP_MAX): CourseWord[] {
  const at = currentSlot(course, p);
  const out: CourseWord[] = [];
  for (const c of course.chapters) for (const s of c.sessions) {
    if (cmpSlot({ order: c.order, n: s.n }, at) >= 0) continue;
    for (const w of s.words) if (!p.familiarity[w.lexKey] && !out.some((x) => x.lexKey === w.lexKey)) out.push(w);
  }
  return out.slice(0, max);
}

// ---- agenda + recap (DESIGN §5) ---------------------------------------------------------------------
export interface Agenda { title: string; items: string[] }

/** The brief agenda that opens a session: where we are, then the blueprint's bullets for today. */
export function sessionAgenda(pack: LanguagePack, course: Course, pos: CoursePosition): Agenda | undefined {
  if (pos.kind === "finished") return undefined;
  if (pos.kind === "exam") {
    const speak = pos.exam.tasks.filter((t) => t.mode === "speak").length, write = pos.exam.tasks.length - speak;
    return { title: pos.exam.title, items: [`Open book: a prep screen before every task, as long as you like`, `${speak} speaking task${speak === 1 ? "" : "s"}, then ${write} writing task${write === 1 ? "" : "s"}`, "Your results: what you can do, and what to look at again"] };
  }
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
  if (pos.kind === "stage-review" || pos.kind === "exam") {
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
  // Which points does today recap? What the agenda named: the point taught, or the point practised; on a
  // review / put-it-together / checkpoint day, the chapter so far plus whatever the story asked you to spot.
  const taughtSoFar = chapter.pointIds.filter((id) => chapter.sessions.some((s) => s.n <= session.n && s.pointId === id));
  const ids = session.role === "teach" && session.pointId ? [session.pointId]
    : session.role === "practice" ? [practisedPoint(chapter, session)].filter((x): x is string => !!x)
    : [...new Set([...taughtSoFar, ...(session.story?.lens ?? [])])];
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
  | { kind: "say"; line: LineRef & { translit?: string } }
  /** The line told about someone else: its verb blanked, pick the form for the new person (see switchPersonItem). */
  | { kind: "switch"; line: LineRef; person: Person; shown: string; filled: string; blank: string; options: string[]; why: string };

/** A line without its quotation marks (tiles and speech shouldn't carry „ “). */
export const bareLine = (text: string) => text.replace(/[„“”"«»]/g, "").replace(/\s+/g, " ").trim();
/** English without the quote marks a story line's translation carries ("I'm well." → I'm well.), so a prompt
 *  that quotes it doesn't double them. */
export const bareGloss = (gloss: string) => gloss.replace(/^["“”„']+|["“”„']+$/g, "").trim();

/** About four exercises on today's focus, easiest first (understand → complete → build → say), built only
 *  from the story's own lines that use the focus points, so they practise the lesson at hand. When the story
 *  has no such line, the points' own example lines and quick checks stand in. `seed` varies the picks
 *  from one reading of the same story to the next. */
export function useItItems(course: Course, story: MiniStory, focus: string[], seed = 0): UseItItem[] {
  const all = story.body.map((b, i) => ({ text: b.text, gloss: bareGloss(b.gloss), source: `story:${story.id}#${i}`, translit: b.translit }));
  const onFocus = (src: string) => (course.lineTags[src] ?? []).some((t) => focus.includes(t));
  const rot = <T,>(a: T[]) => (a.length ? a.map((_, i) => a[(i + seed) % a.length]!) : a);
  const pts = focus.map((id) => course.points.find((p) => p.id === id)).filter((p): p is GrammarPoint => !!p);
  // The story's own lines on today's focus first; when it has fewer than three, the lesson's example lines
  // join them, so four exercises don't all lean on one sentence.
  const storyLines = rot(all.filter((l) => l.gloss && onFocus(l.source)));
  const examples = pts.flatMap((p) => p.examples).filter((e) => e.gloss && !storyLines.some((l) => bareLine(l.text) === bareLine(e.text))).map((e) => ({ ...e, gloss: bareGloss(e.gloss), translit: undefined as string | undefined }));
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
    if (card) out.push({ kind: "complete", line: { ...card.line, gloss: bareGloss(card.line.gloss) }, blank: card.blank, options: card.options, why: card.why });
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
  const chapter = pos.kind === "session" ? pos.chapter.order : pos.kind === "stage-review" || pos.kind === "exam" ? orderOf(pos.afterChapterId) : Math.max(...course.chapters.map((c) => c.order));
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
  if (pos.kind === "stage-review" || pos.kind === "exam") return { order: course.chapters.find((c) => c.chapterId === pos.afterChapterId)?.order ?? 0, n: 999 };
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
    : pos.kind === "exam"
      ? { chapterId: pos.afterChapterId, n: 0, exam: true, ...base }
      : { chapterId: pos.chapter.chapterId, n: pos.session.n, ...base };
}

/** The session a record (or a chapter/session pair) points at, for rebuilding its recap. */
export function positionOf(course: Course, at: { chapterId: string; n: number; stage?: boolean; exam?: boolean }): CoursePosition | undefined {
  if (at.exam) { const exam = examAfterChapter(course, at.chapterId); return exam ? { kind: "exam", afterChapterId: at.chapterId, exam } : undefined; }
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
    case "use": return withWords(s.writing ? "Put it together · write it in Macedonian" : "Put it together");
    default: return "Checkpoint: the whole chapter — every word and card, every person, the conversation";
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
  /** An exam follows this chapter (after its stage review). */
  exam?: { id: string; title: string; state: MapState };
}
export interface CourseOverview {
  chapters: ChapterOverview[];
  /** Curriculum sessions (chapters 1+) finished and in total. */
  done: number;
  total: number;
  current?: { chapterId: string; n: number; stage?: boolean; exam?: boolean };
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
    const state: MapState = pos.kind === "finished" || ci < idx ? "done" : ci > idx ? "upcoming" : pos.kind === "stage-review" || pos.kind === "exam" ? "done" : "current";
    const sessionState = (n: number): MapState => (state !== "current" ? state : n < cur.session ? "done" : n === cur.session ? "current" : "upcoming");
    const hasStage = course.stageReviews.some((r) => r.afterChapterId === c.chapterId);
    const stageState: MapState = pos.kind === "stage-review" && pos.afterChapterId === c.chapterId ? "current" : pos.kind === "finished" || ci < idx || (pos.kind === "exam" && pos.afterChapterId === c.chapterId) ? "done" : "upcoming";
    const exam = examAfterChapter(course, c.chapterId);
    const examState: MapState = pos.kind === "exam" && pos.afterChapterId === c.chapterId ? "current" : pos.kind === "finished" || ci < idx ? "done" : "upcoming";
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
      ...(exam ? { exam: { id: exam.id, title: exam.title, state: examState } } : {}),
    };
  });
  const curriculum = chapters.filter((c) => c.order > 0).flatMap((c) => c.sessions);
  return {
    chapters,
    done: curriculum.filter((s) => s.state === "done").length,
    total: curriculum.length,
    current: pos.kind === "session" ? { chapterId: pos.chapter.chapterId, n: pos.session.n } : pos.kind === "stage-review" ? { chapterId: pos.afterChapterId, n: 0, stage: true } : pos.kind === "exam" ? { chapterId: pos.afterChapterId, n: 0, exam: true } : undefined,
  };
}

/** What a passed checkpoint leads to, for its message: the next chapter, a stage review, or the end. */
export function afterCheckpoint(pack: LanguagePack, course: Course, state: CourseState | undefined): string {
  const next = position(course, advance(course, state, { checkpointPassed: true }));
  if (next.kind === "stage-review") return "a stage review of everything so far";
  if (next.kind === "exam") return `the ${next.exam.id === "final" ? "final" : "midterm"}`;
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
    session: state.examAfter ? ch.sessions.length + 2 : state.stageReviewAfter ? ch.sessions.length + 1 : state.session,
    points: course.points.filter((pt) => p.seenGrammar?.[pt.id]).map((pt) => pt.id),
  };
}

// ---------- Writing, line by line ----------

/** A chapter's writing exercise (played in its session marked `writing`). */
export function writingFor(course: Course, chapterId: string): CourseWriting | undefined {
  return course.writing?.find((w) => w.chapterId === chapterId);
}

/** A written line reduced to its letters, whatever the script: Cyrillic is romanized, and the usual ways of
 *  typing Macedonian in Latin letters (ч as č / ch / c, ќ as ḱ / kj / k, ј as j / y…) collapse to one
 *  spelling. Loose on purpose: it only decides "this is the model answer, no need to ask the tutor". */
export function writingKey(text: string): string {
  return romanize(text.normalize("NFC")).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z]/g, "")
    .replace(/y/g, "j").replace(/dzh|dj/g, "dz").replace(/([kgln])j/g, "$1")
    .replace(/ch|ts/g, "c").replace(/sh/g, "s").replace(/zh/g, "z");
}

/** Is a written attempt the line's model answer (or one of its equally right alternatives)? */
export function writtenMatches(typed: string, line: WritingLine): boolean {
  const k = writingKey(typed);
  return !!k && [line.answer, ...(line.also ?? [])].some((a) => writingKey(a) === k);
}

// ---------- Persons: every form, in context (DESIGN-story-variety §2; Jake: "it's the core LESSON that must
// be repeated, not the EXERCISE") ----------

export const PERSONS = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"] as const;
export type Person = (typeof PERSONS)[number];
export const PRONOUN: Record<Person, { mk: string; en: string }> = {
  "1sg": { mk: "јас", en: "I" }, "2sg": { mk: "ти", en: "you (one friend)" }, "3sg": { mk: "таа", en: "she" },
  "1pl": { mk: "ние", en: "we" }, "2pl": { mk: "вие", en: "you all" }, "3pl": { mk: "тие", en: "they" },
};
/** The order persons take turns in a chapter's sessions: the plurals first, the ones a single scene rarely needs. */
export const PERSON_TURNS: Person[] = ["1pl", "2pl", "3pl", "2sg", "1sg", "3sg"];
/** The two persons a session's "Say it" adds (session n of its chapter): every person within three sessions. */
export const personPair = (n: number): Person[] => { const i = ((Math.max(1, n) - 1) * 2) % 6; return [PERSON_TURNS[i]!, PERSON_TURNS[i + 1]!]; };

const SUBJECTS = new Map<string, Person>([["јас", "1sg"], ["ти", "2sg"], ["тој", "3sg"], ["таа", "3sg"], ["тоа", "3sg"], ["ние", "1pl"], ["вие", "2pl"], ["тие", "3pl"]]);
const DATIVE = new Map<string, Person>([["ми", "1sg"], ["му", "3sg"], ["ѝ", "3sg"], ["ни", "1pl"], ["ви", "2pl"], ["им", "3pl"]]);

/** Words that mark a person: the subject pronouns, the to-whom pronouns (ми се допаѓа practises "me" too) and
 *  every verb-table form (сум's included), minus се, which is mostly the reflexive (се викам), not "they are". */
export function personMarkers(pack: LanguagePack): Map<string, Person> {
  const m = new Map<string, Person>([...SUBJECTS, ...DATIVE]);
  for (const v of pack.conjugations ?? []) for (const [p, f] of Object.entries(v.forms)) for (const t of wordTokens(f)) if (t !== "се" && !m.has(t)) m.set(t, p as Person);
  return m;
}

/** A known English line with "you" made unambiguous ("You want beer." → "You all want beer."). */
const youFor = (en: string, p: string) => {
  const who = p === "2pl" ? "You all" : p === "2sg" ? "You (one friend)" : "";
  return who ? en.replace(/^You('re)?\b/, (_m, re: string | undefined) => (re ? `${who} are` : who)) : en;
};

/** One utterance: a story line that's a single sentence said by one person, with no narration around a quote
 *  ("„…“ прашува келнерот", "Ана вели: „…“") — the only kind it's fair to say aloud or to retell about someone else. */
export const singleUtterance = (raw: string): boolean => {
  const text = bareLine(raw);
  return !/\S\s*[„:]/.test(raw) && !/[“”]\s*[,\p{L}]/u.test(raw) && !/[?!.…]\s+\S/.test(text);
};
/** A story line's English without its narration: the quoted words when there are any, no (asides). */
export const spokenGloss = (gloss: string): string => {
  const q = /["“]([^"”]+)["”]/.exec(gloss)?.[1];
  return bareGloss((q ?? gloss).replace(/\s*\([^)]*\)\s*/g, " ")).trim();
};

/** "Say it" in two more persons (personPair): one of the session's build sentences (taking turns) in those
 *  persons when it has a verb taught by now, else a line from the chapter's stories that uses them. `verbs`:
 *  the lemmas taught by now. */
export function personSayLines(pack: LanguagePack, chapter: CourseChapter, s: CourseSession, verbs: Set<string>): { text: string; gloss: string; focus: string[] }[] {
  const pair = personPair(s.n);
  const items = s.build.map((id) => pack.sentences?.find((x) => x.id === id)).filter((it): it is SentenceItem => !!it?.verbLemma && verbs.has(it.verbLemma) && pair.every((p) => it.variants.some((v) => v.person === p)));
  const item = items[(s.n - 1) % Math.max(1, items.length)];
  if (item) {
    const verb = pack.conjugations?.find((v) => v.lemma === item.verbLemma);
    return pair.map((p) => { const v = item.variants.find((x) => x.person === p)!; const form = verb?.forms[p]; return { text: v.mk, gloss: youFor(v.en, p), focus: form ? v.mk.split(/\s+/).map((w) => w.replace(/[.,!?…]+$/, "")).filter((w) => familiarity.normalize(w) === familiarity.normalize(form)) : [] }; });
  }
  // No verb sentence yet (chapters 1–3, сум): a short line from the chapter's stories read so far.
  const markers = personMarkers(pack);
  const read = new Set(chapter.sessions.filter((x) => x.n <= s.n && x.story).map((x) => x.story!.id));
  const lines = [...read].flatMap((id) => pack.stories?.find((st) => st.id === id)?.body ?? []).filter((b) => singleUtterance(b.text)).map((b) => ({ text: bareLine(b.text), gloss: spokenGloss(b.gloss) }));
  return pair.flatMap((p) => {
    const hit = lines.filter((l) => wordTokens(l.text).some((t) => markers.get(t) === p) && l.text.split(" ").length <= 8).sort((a, b) => a.text.length - b.text.length)[0];
    return hit ? [{ ...hit, focus: hit.text.split(/\s+/).map((w) => w.replace(/[.,!?…]+$/, "")).filter((w) => markers.get(familiarity.normalize(w)) === p) }] : [];
  });
}

/** Lines whose person can't be switched cleanly: да + a second verb (both would change), ајде да, an impersonal
 *  "it is" after a to-whom pronoun (Мило ми е), and yes/no-answer lines. */
const UNSWITCHABLE = new Set(["да", "ајде", "нека"]);
/** After a form of сум, what may follow when the number changes (a place or a how, not a noun that would agree). */
const SUM_SAFE_AFTER = new Set(["во", "на", "од", "тука", "таму", "добро", "близу", "далеку", "дома", "кај", "со", "не"]);
const KEEP_NUMBER = new Set(["како", "заедно", "сите"]);
const PREPOSITIONS = new Set(["во", "на", "од", "до", "со", "кај", "за", "по", "пред", "зад"]);

/** "Switch the person": a line from today's story told about someone else, its verb blanked, with three forms
 *  of that verb to choose from (DESIGN-story-variety §2b). Built from the verb tables — no new language. Only
 *  lines with exactly one verb the learner has been taught (`verbs`: lemmas), whose subject (when it's said) is
 *  a pronoun or a name right before the verb; сум only switches number when nothing after it would have to
 *  agree. `seed` turns the line and the person from one reading to the next. */
export function switchPersonItem(pack: LanguagePack, story: MiniStory, verbs: Set<string>, names: (word: string) => boolean, seed = 0): Extract<UseItItem, { kind: "switch" }> | undefined {
  const forms = new Map<string, { lemma: string; person: Person }>();
  // A form two persons share (past беше: "you were" and "he/she was") is read as he/she, so a line like
  // „Кафето беше добро“ is treated as having a noun subject and left alone.
  for (const v of pack.conjugations ?? []) if (verbs.has(v.lemma)) for (const [p, f] of Object.entries(v.forms)) { const t = familiarity.normalize(f); if (t !== "се" && t !== "си" && (!forms.has(t) || (p === "3sg" && forms.get(t)!.lemma === v.lemma))) forms.set(t, { lemma: v.lemma, person: p as Person }); }
  const candidates = story.body.flatMap((b, i) => {
    const text = bareLine(b.text);
    if (!singleUtterance(b.text)) return [];
    const words = [...text.matchAll(/[\p{L}]+/gu)].map((m) => ({ w: m[0], at: m.index!, t: familiarity.normalize(m[0]) }));
    if (words.some((x) => UNSWITCHABLE.has(x.t))) return [];
    const verbAt = words.map((x, k) => (forms.has(x.t) ? k : -1)).filter((k) => k >= 0);
    if (verbAt.length !== 1) return [];
    const v = verbAt[0]!;
    const { lemma, person } = forms.get(words[v]!.t)!;
    if (lemma === "е" && v > 0 && DATIVE.has(words[v - 1]!.t)) return []; // Мило ми е: "it is"
    // The subject: a pronoun or a name just before the verb (skipping не / ќе and short object pronouns).
    // (A comma ends the search: in „Не, не сум Марко“ the first Не is "No", not part of the verb.)
    const commaAfter = (j: number) => j >= 0 && text.slice(words[j]!.at + words[j]!.w.length, words[j + 1]!.at).includes(",");
    let k = v - 1;
    while (k >= 0 && !commaAfter(k) && ["не", "ќе", "го", "ја", "ги", "ми", "му", "ѝ", "ни", "ви", "им", "се", "ме", "те", "ве"].includes(words[k]!.t)) k--;
    // A name after a preposition (Од Англија сум) is where, not who.
    const subj = k >= 0 && (SUBJECTS.has(words[k]!.t) || (names(words[k]!.w) && !(k > 0 && PREPOSITIONS.has(words[k - 1]!.t)))) ? k : -1;
    if (subj > 0 && words[subj - 1]!.t === "и") return []; // "Марко и Петар …": a joined subject
    // Someone addressed by name ("Марко, Петар, каде сте?!") fixes who "you" is.
    if (words.some((x) => names(x.w) && new RegExp(`(^|,\\s*)${x.w}\\s*,|,\\s*${x.w}\\s*[!?.]*$`, "u").test(text))) return [];
    // Not said: a he/she/they form may have a noun subject (Кафето е добро) that wouldn't change with it, so only
    // the I / you / we forms (which never have one) are switched without a stated subject.
    if (subj === -1 && (person === "3sg" || person === "3pl")) return [];
    // Where a pronoun would go if one is needed: only when the verb (with its не / ќе / object pronouns) opens
    // its clause — „Добро, одиме…“ yes, „Добро сме“ no (Добро се reads fine).
    const clauseStart = k === -1 || commaAfter(k) ? k + 1 : -1;
    return [{ i, text, gloss: bareGloss(b.gloss), words, v, subj, chain: clauseStart, lemma, person }];
  });
  if (!candidates.length) return undefined;
  const c = candidates[seed % candidates.length]!;
  const table = pack.conjugations!.find((x) => x.lemma === c.lemma)!;
  const after = c.words.slice(c.v + 1);
  // Keep the number when something else would have to change with it: what follows a form of сум (Таа е Ема),
  // "as a …" (работам како учителка), "together", or се with the verb (се видиме is "see each other").
  const keepNumber = (c.lemma === "е" && after.length > 0 && !SUM_SAFE_AFTER.has(after[0]!.t))
    || c.words.some((x) => KEEP_NUMBER.has(x.t)) || (c.v > 0 && c.words[c.v - 1]!.t === "се");
  const plural = (p: Person) => p.endsWith("pl");
  const targets = PERSON_TURNS.filter((p) => p !== c.person && (!keepNumber || plural(p) === plural(c.person)) && familiarity.normalize(table.forms[p] ?? "") !== c.words[c.v]!.t);
  if (!targets.length) return undefined;
  const person = targets[(seed + c.i) % targets.length]!;
  const form = table.forms[person]!;
  const pron = PRONOUN[person];
  // Rebuild the line: the verb blanked (and filled), the subject swapped for the new pronoun when it was said —
  // or, for he / she / they with none said, put in front of the verb (else „Добро, оди…“ reads as a command).
  const insertAt = c.subj === -1 && c.chain >= 0 && (person === "3sg" || person === "3pl") ? c.chain : -1;
  const startOf = (k: number) => k === 0 || /[.!?]\s*$/.test(c.text.slice(0, c.words[k]!.at));
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  const rebuild = (verb: string) => {
    let out = "";
    let pos = 0;
    c.words.forEach((x, k) => {
      if (k !== c.v && k !== c.subj && k !== insertAt) return;
      out += c.text.slice(pos, x.at);
      if (k === insertAt) {
        out += `${startOf(k) ? cap(pron.mk) : pron.mk} `;
        if (k !== c.v) { out += startOf(k) && !names(x.w) ? x.w.charAt(0).toLowerCase() + x.w.slice(1) : x.w; pos = x.at + x.w.length; return; }
      }
      const rep = k === c.v ? verb : pron.mk;
      out += startOf(k) && k !== insertAt ? cap(rep) : rep;
      pos = x.at + x.w.length;
    });
    return out + c.text.slice(pos);
  };
  const others = PERSONS.filter((p) => p !== person).map((p) => table.forms[p]!).filter((f, k, all) => f !== form && all.indexOf(f) === k);
  const options = [form, table.forms[c.person]!, ...others.filter((f) => f !== table.forms[c.person])].filter((f, k, all) => all.indexOf(f) === k).slice(0, 3);
  return {
    kind: "switch",
    line: { text: c.text, gloss: c.gloss, source: `story:${story.id}#${c.i}` },
    person,
    shown: rebuild("___"),
    filled: rebuild(form),
    blank: form,
    options,
    why: `${pron.mk} (${pron.en}) → ${form}. All six: ${PERSONS.map((p) => `${PRONOUN[p].mk} ${table.forms[p]}`).join(" · ")}`,
  };
}

/** The chapter checkpoint's person round: "Switch the person" on the chapter's own stories, one line per
 *  person (up to `max`), then a line to say aloud for each person the round didn't reach — so the chapter's
 *  last session works every person taught, in its own sentences. */
export function checkpointPersons(pack: LanguagePack, chapter: CourseChapter, verbs: Set<string>, names: (word: string) => boolean, max = 4): {
  switches: Extract<UseItItem, { kind: "switch" }>[];
  say: { text: string; gloss: string; focus: string[] }[];
} {
  const stories = [...new Set(chapter.sessions.filter((s) => s.story && !s.story.reuse).map((s) => s.story!.id))]
    .map((id) => pack.stories?.find((st) => st.id === id)).filter((st): st is MiniStory => !!st);
  const switches: Extract<UseItItem, { kind: "switch" }>[] = [];
  for (let seed = 0; seed < 12 && switches.length < max; seed++) {
    for (const st of stories) {
      const it = switchPersonItem(pack, st, verbs, names, seed);
      if (it && !switches.some((x) => x.person === it.person || x.line.source === it.line.source)) switches.push(it);
      if (switches.length >= max) break;
    }
  }
  const markers = personMarkers(pack);
  const lines = stories.flatMap((st) => st.body).filter((b) => singleUtterance(b.text)).map((b) => ({ text: bareLine(b.text), gloss: spokenGloss(b.gloss) }));
  const say = PERSON_TURNS.filter((p) => !switches.some((x) => x.person === p)).flatMap((p) => {
    const hit = lines.filter((l) => wordTokens(l.text).some((t) => markers.get(t) === p) && l.text.split(" ").length <= 8).sort((a, b) => a.text.length - b.text.length)[0];
    return hit ? [{ ...hit, focus: hit.text.split(/\s+/).map((w) => w.replace(/[.,!?…]+$/, "")).filter((w) => markers.get(familiarity.normalize(w)) === p) }] : [];
  }).filter((l, i, all) => all.findIndex((x) => x.text === l.text) === i);
  return { switches, say };
}
