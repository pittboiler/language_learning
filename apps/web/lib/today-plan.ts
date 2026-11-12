// Today's session plan on the course, as pure functions: which steps a session holds (warm-up, new words,
// the lesson, Say it, the story, Build, the conversation…) and its agenda, from the blueprint and the
// learner's progress. page.tsx renders the steps; test/today-plan.test.ts walks the whole course checking
// that every agenda names exactly the steps its session plays.
import type { Chapter, ConjugationSet, CourseChapter, CourseExam, CourseSession, CourseWriting, GrammarConcept, GrammarPoint, LanguagePack, MiniStory, ReviewItem, Scenario } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import * as sentenceScope from "@ll/core/sentences";
import * as cp from "./course-player";
import { properNounLike } from "./capture";
import { CHECKPOINT_EARLIER, PRACTICE, PRACTICE_PER_CHAPTER, partsOf } from "./checkpoint";
import type { Progress } from "./store";

// The SRS review pool for a pack: vocab phrases + grammar drills (tagged with their concept name).
export const reviewPool = (pack: LanguagePack): ReviewItem[] => [
  ...pack.vocab,
  ...pack.grammar.flatMap((c) => c.drills.map((d) => ({ ...d, meta: { ...d.meta, concept: c.name } }))),
];

// Fisher–Yates shuffle (app runtime — Math.random is fine here, this is not a workflow script).
export const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

// "Again" on a card: it goes back into the cards still to come, AGAIN_GAP places on (or last, when fewer are
// left), so it returns while it's fresh but not straight away. Sent to the very end of a long warm-up it
// looked exactly like "Good" (Jake, 2026-11-11). `wait` = how many cards come before it.
export const AGAIN_GAP = 2;
export const sendBack = <T,>(rest: T[], card: T, gap = AGAIN_GAP): { rest: T[]; wait: number } => {
  const wait = Math.max(0, Math.min(gap, rest.length));
  return { rest: [...rest.slice(0, wait), card, ...rest.slice(wait)], wait };
};
/** A score from first tries: one per card, however many times "Again" brought it back. A retry (`retry`) still
 *  reschedules the card, but counting it too would add a free point to a checkpoint for every "Again". */
export const firstTries = (rs: { ok: boolean; retry?: boolean }[]): { got: number; total: number } => {
  const first = rs.filter((r) => !r.retry);
  return { got: first.filter((r) => r.ok).length, total: first.length };
};

// Rotate an array left by n (n=0 → unchanged). Used to vary which questions/drills lead each day.
export const rotate = <T,>(arr: T[], n: number): T[] => (arr.length ? arr.map((_, i) => arr[(i + n) % arr.length]!) : arr);

/** A story lens (new course, DESIGN §8): the lines that use today's point(s), and the words carrying them. */
export interface StoryLens {
  label: string;
  /** Lines that use today's focus. */
  highlight: number[];
  /** Today's focus points. */
  points: string[];
  /** Line index → the exact words carrying today's focus (highlighted word by word). */
  focus: Record<number, string[]>;
}

/** A checkpoint, or a practice round in its shape: words and grammar cards, "switch the person", lines to say
 *  and the conversation. `earlier`: how many of the words come from earlier chapters. */
export interface CheckpointRound {
  items: ReviewItem[];
  switches: Extract<cp.UseItItem, { kind: "switch" }>[];
  say: { text: string; gloss: string; focus?: string[] }[];
  scenario?: Scenario;
  earlier: number;
}

// One step of Today's session, as page.tsx renders it.
export type TodayStep =
  | { kind: "warmup"; items: ReviewItem[]; conjVerb?: ConjugationSet; own?: number }
  | { kind: "checkpoint"; chapter: Chapter; items: ReviewItem[]; scenario?: Scenario; persons?: ReturnType<typeof cp.checkpointPersons> }
  /** The course's chapter checkpoint session: practise this chapter, practise everything so far, or take the checkpoint. */
  | { kind: "chapterEnd"; chapter: Chapter; checkpoint: CheckpointRound; practice: { chapter: CheckpointRound; all: CheckpointRound } }
  | { kind: "newwords"; words: { lexKey: string; gloss?: string }[] }
  | { kind: "grammar"; concept: GrammarConcept }
  | { kind: "grammarPractice"; concept: GrammarConcept; dayIndex: number }
  | { kind: "story"; story: MiniStory; dayIndex: number; revisit?: boolean; lens?: StoryLens }
  | { kind: "point"; point: GrammarPoint; mode: "teach" | "practice"; dayIndex: number }
  | { kind: "agenda"; agenda: cp.Agenda }
  | { kind: "letters"; lesson: { title: string; glyphs: string[]; note?: string }; checkpoint: boolean }
  | { kind: "sayit"; lines: { text: string; gloss: string; translit?: string; focus?: string[] }[] }
  | { kind: "stage"; afterChapterId: string; items: ReviewItem[]; scenario?: Scenario }
  | { kind: "speak"; scenario: Scenario; focus?: string[] }
  | { kind: "build"; ids?: string[]; chapterOrder?: number }
  | { kind: "exam"; exam: CourseExam }
  | { kind: "writing"; prompt: string; set?: CourseWriting };

// The daily conjugation drill picks the first verb not yet drilled (marked seen on completion), so a new
// verb comes up each day; once every verb has been seen it cycles.
// Verbs never drilled as a six-person table: треба is taught as impersonal (треба да…, ми треба), and чини
// only exists in the 3rd person — "требам" / "чинам" would contradict the lessons.
export const NOT_DRILLABLE = cp.NOT_DRILLABLE;
/** The verbs whose six forms are fair game by now: the verb group's point has been taught (сум from chapter 1,
 *  -а verbs from chapter 4, -е/-и from chapter 5) and the course has taught the verb itself. Shared by the
 *  warm-up drill and "Switch the person". */
export function drillableVerbs(pack: LanguagePack, progress: Progress): Set<string> {
  const groups = new Set<string>();
  if (progress.seenGrammar?.["pt-verbs-a"]) groups.add("a");
  if (progress.seenGrammar?.["pt-verbs-e-i"]) { groups.add("e"); groups.add("i"); }
  if (progress.seenGrammar?.["pt-sum"]) groups.add("irregular");
  const taught = pack.course ? cp.taughtVerbs(pack, pack.course, progress) : undefined;
  return new Set((pack.conjugations ?? []).filter((v) => groups.has(v.group) && !NOT_DRILLABLE.has(v.lemma) && (!taught || taught.has(v.lemma))).map((v) => v.lemma));
}

/** The verbs "Switch the person" may use: the drillable ones, plus a past-tense table once every one of its
 *  forms has been taught (the past is taught form by form: бев, then бевме / бевте / беа). */
export function switchableVerbs(pack: LanguagePack, progress: Progress): Set<string> {
  const out = drillableVerbs(pack, progress);
  if (!pack.course) return out;
  const forms = cp.formSlots(pack, pack.course);
  const at = cp.currentSlot(pack.course, progress);
  for (const v of pack.conjugations ?? []) {
    if (v.group !== "past") continue;
    if (Object.values(v.forms).flatMap(cp.wordTokens).every((t) => { const s = forms.get(t); return !!s && cp.cmpSlot(s, at) <= 0; })) out.add(v.lemma);
  }
  return out;
}

// On the course, only verbs it has taught by now (`allowed`), so the drill never springs доаѓа or спие on you.
export const pickConjVerb = (pack: LanguagePack, progress: Progress, groups?: Set<string>, allowed?: Set<string>): ConjugationSet | undefined => {
  const all = (pack.conjugations ?? []).filter((v) => !NOT_DRILLABLE.has(v.lemma) && v.group !== "past" && (!groups || groups.has(v.group)) && (!allowed || allowed.has(v.lemma)));
  if (!all.length) return undefined;
  const seen = new Set(progress.seenConjugations ?? []);
  return all.find((v) => !seen.has(v.lemma)) ?? all[(progress.seenConjugations?.length ?? 0) % all.length];
};

/** On the course, a verb drilled in the last CONJ_GAP lessons sits out (Jake, 2026-10-31): until chapter 4
 *  сум is the only verb, and matching its six forms every day for some 25 lessons was too much, so it now
 *  comes every third lesson. Once there are several verbs the daily rotation spaces them anyway. A verb not
 *  drilled yet always goes first. */
export const CONJ_GAP = 2;
export function courseConjVerb(pack: LanguagePack, progress: Progress, verbs: Set<string>): ConjugationSet | undefined {
  const recent = new Set((progress.courseLog ?? []).slice(-CONJ_GAP).flatMap((e) => e.drilled ?? []));
  const rested = new Set([...verbs].filter((v) => !recent.has(v)));
  return rested.size ? pickConjVerb(pack, progress, undefined, rested) : undefined;
}

// ---------- Today, new course: play the blueprint (lib/course-player.ts) ----------
// The blueprint fixes the session's content; this only maps it onto Today's steps and fills the review
// parts (warm-up with an earlier-chapter share, checkpoint and stage-review items) from the learner's state.
export function courseSteps(pack: LanguagePack, progress: Progress): TodayStep[] {
  const steps = courseBody(pack, progress);
  const pos = cp.position(pack.course!, progress.course);
  const agenda = cp.sessionAgenda(pack, pack.course!, pos);
  // A chapter's end opens on its own choice screen (practise, or take the checkpoint), which says what's on
  // offer and how long each takes: a menu in front of it would just be a second screen to click through.
  if (!steps.length || !agenda || steps.some((x) => x.kind === "chapterEnd")) return steps;
  // The warm-up comes first, so the agenda says so.
  const warm = steps.find((x): x is Extract<TodayStep, { kind: "warmup" }> => x.kind === "warmup");
  const own = warm?.own ?? 0;
  const n = (warm?.items.length ?? 0) - own;
  // Words added to a session the learner had already passed come first (cp.catchUpWords), and the agenda says why.
  const taughtNow = new Set(steps.flatMap((x) => (x.kind === "newwords" ? x.words.map((w) => w.lexKey) : [])));
  const catchUp = cp.catchUpWords(pack.course!, progress).filter((w) => taughtNow.has(w.lexKey));
  const catchLine = catchUp.length ? `Catch-up: ${catchUp.length} word${catchUp.length > 1 ? "s" : ""} added to a session you'd already done: ${catchUp.map((w) => w.display.replace(/\.+$/, "")).join(", ")}` : undefined;
  const warmLine = n || own
    ? `Warm-up: ${n ? `${n} card${n > 1 ? "s" : ""} from earlier sessions` : ""}${n && own ? " + " : ""}${own ? `${own} of your own picked words (★ / ＋ Learn)` : ""}`
    : "Warm-up: a quick verb drill";
  // Build-a-sentence only runs when something is buildable right now (and Say it when there's a line to
  // say); don't promise either otherwise.
  const items = agenda.items
    .filter((b) => steps.some((x) => x.kind === "build") || !b.startsWith("Build a sentence"))
    .filter((b) => steps.some((x) => x.kind === "sayit") || !b.startsWith("Say it:"));
  const head = [...(warm ? [warmLine] : []), ...(catchLine ? [catchLine] : [])];
  return [{ kind: "agenda", agenda: { ...agenda, items: [...head, ...items] } }, ...steps];
}

// The lens for a session's story: a banner naming what to spot, the lines that use today's focus, and the
// exact words in them. (Set-phrase notes sit with each line's English, for every line, in StoryReader.)
export function storyLens(course: NonNullable<LanguagePack["course"]>, s: CourseSession, story: MiniStory, points: Map<string, GrammarPoint>): StoryLens {
  const names = (s.story?.lens ?? []).map((id) => points.get(id)?.title).filter(Boolean) as string[];
  const n = s.story?.highlight.length ?? 0;
  const what = names.length === 1 ? names[0]! : "this chapter's grammar";
  const label = !n
    ? `Read it through${names.length ? ` — today's grammar is ${what}` : ""}.`
    : s.story?.reuse
      ? `Back to an earlier story, with fresh eyes: the ${n} highlighted line${n > 1 ? "s use" : " uses"} ${what}.`
      : `Spot it: the ${n} highlighted line${n > 1 ? "s use" : " uses"} ${what}.`;
  const lens = s.story?.lens ?? [];
  const focus: Record<number, string[]> = {};
  story.body.forEach((_, i) => { const w = cp.focusWords(course, `story:${story.id}#${i}`, lens); if (w.length) focus[i] = w; });
  return { label, highlight: s.story?.highlight ?? [], points: lens, focus };
}

export function courseBody(pack: LanguagePack, progress: Progress): TodayStep[] {
  const course = pack.course!;
  const pos = cp.position(course, progress.course);
  const out: TodayStep[] = [];
  const now = new Date();
  const pool = [...reviewPool(pack), ...cp.allPointItems(course)];
  const slotOf = cp.slotOfKey(course);
  const points = cp.pointsById(course);
  const vocabByKey = new Map(pack.vocab.map((v) => [familiarity.deriveKeyForItem(v).lexKey, v]));
  if (pos.kind === "finished") return out;
  // A midterm / final: the whole session is the exam (it has its own intro, prep screens and results).
  if (pos.kind === "exam") return [{ kind: "exam", exam: pos.exam }];
  if (pos.kind === "stage-review") {
    const c = cp.stageReviewContent(pack, course, pos.afterChapterId, progress);
    const own = cp.ownWordsDue(pack, progress, now, 4).filter((o) => !c.items.some((w) => familiarity.deriveKeyForItem(w).lexKey === familiarity.deriveKeyForItem(o).lexKey));
    out.push({ kind: "stage", afterChapterId: pos.afterChapterId, items: shuffle([...c.items, ...own]), scenario: pack.scenarios.find((s) => s.id === c.scenarioId) });
    return out;
  }
  const { chapter: cc, session: s } = pos;
  const order = cc.order;
  const chapter = (pack.chapters ?? []).find((c) => c.id === cc.chapterId)!;
  const studied = (lexKey: string) => { const e = progress.familiarity[lexKey]; return !!e && familiarity.isStudied(e); };

  // Chapter 0 — letters & sounds: learn a group (or, at the checkpoint, the tricky ones) and say example words.
  if (s.letters) {
    out.push({ kind: "letters", lesson: s.letters, checkpoint: s.role === "checkpoint" });
    if (s.role !== "checkpoint") {
      const lines = s.letters.glyphs.map((g) => pack.alphabet.find((a) => a.glyph === g)?.examples[0]).filter((e): e is NonNullable<typeof e> => !!e)
        .slice(0, 4).map((e) => ({ text: e.text, gloss: e.gloss ?? "", translit: e.translit }));
      if (lines.length) out.push({ kind: "sayit", lines });
    }
    return out;
  }

  // Catch-up words ride on top of the session's own, so a day that already brings new words takes fewer.
  const catchUp = cp.catchUpWords(course, progress, s.words.length ? 2 : cp.CATCH_UP_MAX).map((w) => ({ lexKey: w.lexKey, gloss: w.gloss }));
  if (s.role === "checkpoint") {
    if (catchUp.length) out.push({ kind: "newwords", words: catchUp });
    const end = chapterEndStep(pack, progress, cc, chapter);
    if (end.checkpoint.items.length) out.push(end);
    return out;
  }

  const review = s.role === "review";
  const warm = cp.pickWarmup({ pool, progress, now, current: { order, n: s.n }, slotOf, size: review ? cp.REVIEW_ITEMS : cp.WARMUP_ITEMS, share: review ? cp.EARLIER_SHARE.review : cp.EARLIER_SHARE.normal });
  // The conjugation drill only drills verbs whose group's point has been TAUGHT (in an earlier session): сум
  // from chapter 1 (before 2026-10-14 it waited for chapter 4, so сме / сте / се went undrilled for three
  // chapters), -а verbs from chapter 4, -е/-и from 5 (drillableVerbs), and not one drilled in the last two
  // lessons (courseConjVerb).
  const conjVerb = courseConjVerb(pack, progress, drillableVerbs(pack, progress));
  // Review days also bring back the words you picked yourself (★ saved, ＋ Learn); other days stay on the course.
  const keyOf = (it: ReviewItem) => familiarity.deriveKeyForItem(it).lexKey;
  const own = review ? cp.ownWordsDue(pack, progress, now, 4).filter((o) => !warm.some((w) => keyOf(w) === keyOf(o))) : [];
  if (warm.length || own.length || conjVerb) out.push({ kind: "warmup", items: [...warm, ...own], conjVerb, own: own.length });

  const words = [...catchUp, ...s.words.filter((w) => cp.needsTeaching(progress, w.lexKey) && !catchUp.some((c) => c.lexKey === w.lexKey)).map((w) => ({ lexKey: w.lexKey, gloss: w.gloss }))];
  if (words.length) out.push({ kind: "newwords", words });

  const pointId = s.pointId ?? (s.role === "practice" ? cc.pointIds.filter((id) => cc.sessions.some((x) => x.n < s.n && x.pointId === id)).at(-1) : undefined);
  const point = pointId ? points.get(pointId) : undefined;
  if (point) out.push({ kind: "point", point, mode: s.role === "teach" ? "teach" : "practice", dayIndex: s.n });

  // "Say it" (teach + practice sessions): today's new phrases and the point's example lines, out loud, with
  // speech feedback — so no teaching session goes by without speaking, before the conversation unlocks.
  if (s.role === "teach" || s.role === "practice") {
    const vocabLine = (w: CourseSession["words"][number]) => { const v = vocabByKey.get(w.lexKey); return { text: w.display, gloss: w.gloss, translit: v?.translit }; };
    const fromWords = s.words.map(vocabLine).sort((a, b) => b.text.split(/\s+/).length - a.text.split(/\s+/).length).slice(0, 2);
    // The point's examples from real exchanges first; the grammar reference's own examples when it has no others.
    const examples = point?.examples ?? [];
    const fromPoint = [...examples.filter((e) => !e.source.startsWith("grammar:")), ...examples.filter((e) => e.source.startsWith("grammar:"))].slice(0, 2)
      .map((e) => ({ text: (cp.spoken(e.text) ?? e.text).replace(/^[„“"]+|[“”"]+$/g, ""), gloss: cp.spokenGloss(e.gloss), focus: cp.focusWords(course, e.source, [point!.id]) }));
    // …and two more persons, taking turns across the chapter's sessions (cp.personPair), so every form gets said.
    const persons = cp.personSayLines(pack, cc, s, drillableVerbs(pack, progress));
    const lines = [...fromWords, ...fromPoint.slice(0, persons.length ? 1 : 2), ...persons].filter((l, i, all) => all.findIndex((x) => x.text === l.text) === i).slice(0, 5);
    if (lines.length) out.push({ kind: "sayit", lines });
  }

  if (s.story) {
    const story = (pack.stories ?? []).find((x) => x.id === s.story!.id);
    if (story) out.push({ kind: "story", story, dayIndex: progress.storyReads?.[story.id]?.length ?? 0, revisit: !!s.story.reuse, lens: storyLens(course, s, story, points) });
  }
  const canBuild = s.build.length > 0 && sentenceScope.withFallback(pack, { chapterOrder: order, builtCount: (progress.builtConjugations ?? []).length, hasMet: (k) => !!progress.familiarity[k], allow: cp.sentenceAllowed(pack, course, progress) }).items.length > 0;
  if (canBuild) out.push({ kind: "build", ids: s.build, chapterOrder: order });
  const scen = s.speak ? pack.scenarios.find((x) => x.id === s.speak) : undefined;
  if (scen) out.push({ kind: "speak", scenario: scen, focus: cp.sessionFocus(cc, s) });
  // The chapter's writing lines when it has them (English → the target language, one at a time); else a free
  // prompt. Never the conversation's goal: that's a brief for the content generator, not for the learner.
  if (s.writing) out.push({ kind: "writing", prompt: "Write a few lines using this chapter\u2019s words.", set: cp.writingFor(course, cc.chapterId) });
  return out;
}

// ---------- The end of a chapter: practise, or take the checkpoint (lib/checkpoint.ts) ----------
/** Everything a chapter's last session can offer, built once when the session is planned:
 *  - the checkpoint: every word and grammar card of the chapter (Jake, 2026-10-15: it "felt very light"), plus
 *    your CHECKPOINT_EARLIER weakest words from earlier chapters, so it covers the course so far (2026-11-12);
 *    then "Switch the person" on its stories, a line to say for every other person, and its conversation.
 *  - "Practise this chapter": the same shape, smaller (PRACTICE), from this chapter.
 *  - "Practise everything so far": the same, drawn from every chapter up to this one.
 *  Practice puts what you missed at your last go first, then your weakest; ties fall in a random order, so
 *  practising again isn't the same round. */
export function chapterEndStep(pack: LanguagePack, progress: Progress, cc: CourseChapter, chapter: Chapter): Extract<TodayStep, { kind: "chapterEnd" }> {
  const course = pack.course!;
  const vocabByKey = new Map(pack.vocab.map((v) => [familiarity.deriveKeyForItem(v).lexKey, v]));
  const points = cp.pointsById(course);
  const keyOf = (it: ReviewItem) => familiarity.deriveKeyForItem(it).lexKey;
  const entry = (it: ReviewItem) => progress.familiarity[keyOf(it)];
  const studied = (lexKey: string) => { const e = progress.familiarity[lexKey]; return !!e && familiarity.isStudied(e); };
  const missed = new Set(partsOf(progress, cc.chapterId).last?.missed ?? []);
  const weakestFirst = (xs: ReviewItem[]) => shuffle(xs).sort((a, b) =>
    Number(missed.has(b.id)) - Number(missed.has(a.id)) || (entry(a)?.strength ?? 0) - (entry(b)?.strength ?? 0));
  const wordsOf = (c: CourseChapter) => c.words.filter((w) => studied(w.lexKey)).map((w) => vocabByKey.get(w.lexKey)).filter((v): v is ReviewItem => !!v);
  const cardsOf = (c: CourseChapter, taughtOnly = false) => c.pointIds.map((id) => points.get(id))
    .filter((p): p is GrammarPoint => !!p && (!taughtOnly || !!progress.seenGrammar?.[p.id])).flatMap((p) => cp.blankCardItems(p));
  const verbs = switchableVerbs(pack, progress);
  const personsOf = (c: CourseChapter) => cp.checkpointPersons(pack, c, verbs, (w) => properNounLike(w, pack));
  const scenarioOf = (c: CourseChapter) => pack.scenarios.find((x) => x.id === c.checkpoint.scenarioId);
  const upTo = course.chapters.filter((c) => c.order >= 1 && c.order <= cc.order);
  const before = upTo.filter((c) => c.order < cc.order);

  // The checkpoint. Earlier chapters' words: due ones first, then the weakest.
  const own = wordsOf(cc);
  const now = new Date();
  const due = (it: ReviewItem) => { const e = entry(it); return !!e?.srs && new Date(e.srs.due) <= now; };
  const earlier = shuffle(before.flatMap((c) => wordsOf(c)))
    .sort((a, b) => Number(due(b)) - Number(due(a)) || (entry(a)?.strength ?? 0) - (entry(b)?.strength ?? 0))
    .slice(0, CHECKPOINT_EARLIER);
  const persons = personsOf(cc);
  const checkpoint: CheckpointRound = { items: [...shuffle([...own, ...earlier]), ...cardsOf(cc)], switches: persons.switches, say: persons.say, scenario: scenarioOf(cc), earlier: earlier.length };

  // Practise this chapter.
  const thisChapter: CheckpointRound = {
    items: [...weakestFirst(own).slice(0, PRACTICE.words), ...weakestFirst(cardsOf(cc)).slice(0, PRACTICE.cards)],
    switches: shuffle(persons.switches).slice(0, PRACTICE.switches),
    say: shuffle(persons.say).slice(0, PRACTICE.say),
    scenario: scenarioOf(cc),
    earlier: 0,
  };

  // Practise everything so far: the weakest words across the chapters, a few from each at most; cards from
  // points you've been taught; the person round and the conversation from one chapter, picked at random.
  const chapterOf = new Map(upTo.flatMap((c) => c.words.map((w) => [w.lexKey, c.chapterId] as const)));
  const perChapter = new Map<string, number>();
  const words: ReviewItem[] = [];
  for (const it of weakestFirst(upTo.flatMap(wordsOf))) {
    if (words.length >= PRACTICE.words) break;
    const c = chapterOf.get(keyOf(it)) ?? "";
    if ((perChapter.get(c) ?? 0) >= PRACTICE_PER_CHAPTER) continue;
    perChapter.set(c, (perChapter.get(c) ?? 0) + 1);
    words.push(it);
  }
  const mixed = shuffle(upTo);
  const people = mixed.map(personsOf).find((x) => x.switches.length > 0) ?? persons;
  const all: CheckpointRound = {
    items: [...shuffle(words), ...weakestFirst(upTo.flatMap((c) => cardsOf(c, true))).slice(0, PRACTICE.cards)],
    switches: shuffle(people.switches).slice(0, PRACTICE.switches),
    say: shuffle(people.say).slice(0, PRACTICE.say),
    scenario: mixed.map(scenarioOf).find((x) => !!x),
    earlier: words.filter((w) => chapterOf.get(keyOf(w)) !== cc.chapterId).length,
  };
  return { kind: "chapterEnd", chapter, checkpoint, practice: { chapter: thisChapter, all } };
}
