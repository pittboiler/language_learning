// Today's session plan on the course, as pure functions: which steps a session holds (warm-up, new words,
// the lesson, Say it, the story, Build, the conversation…) and its agenda, from the blueprint and the
// learner's progress. page.tsx renders the steps; test/today-plan.test.ts walks the whole course checking
// that every agenda names exactly the steps its session plays.
import type { Chapter, ConjugationSet, CourseSession, GrammarConcept, GrammarPoint, LanguagePack, MiniStory, ReviewItem, Scenario } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import * as sentenceScope from "@ll/core/sentences";
import * as cp from "./course-player";
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

// One step of Today's session, as page.tsx renders it.
export type TodayStep =
  | { kind: "warmup"; items: ReviewItem[]; conjVerb?: ConjugationSet; own?: number }
  | { kind: "checkpoint"; chapter: Chapter; items: ReviewItem[]; scenario?: Scenario }
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
  | { kind: "writing"; prompt: string };

// The daily conjugation drill picks the first verb not yet drilled (marked seen on completion), so a new
// verb comes up each day; once every verb has been seen it cycles.
// Verbs never drilled as a six-person table: треба is taught as impersonal (треба да…, ми треба), and чини
// only exists in the 3rd person — "требам" / "чинам" would contradict the lessons.
export const NOT_DRILLABLE = new Set(["треба", "чини"]);
// On the course, only verbs it has taught by now (`allowed`), so the drill never springs доаѓа or спие on you.
export const pickConjVerb = (pack: LanguagePack, progress: Progress, groups?: Set<string>, allowed?: Set<string>): ConjugationSet | undefined => {
  const all = (pack.conjugations ?? []).filter((v) => !NOT_DRILLABLE.has(v.lemma) && (!groups || groups.has(v.group)) && (!allowed || allowed.has(v.lemma)));
  if (!all.length) return undefined;
  const seen = new Set(progress.seenConjugations ?? []);
  return all.find((v) => !seen.has(v.lemma)) ?? all[(progress.seenConjugations?.length ?? 0) % all.length];
};

// ---------- Today, new course: play the blueprint (lib/course-player.ts) ----------
// The blueprint fixes the session's content; this only maps it onto Today's steps and fills the review
// parts (warm-up with an earlier-chapter share, checkpoint and stage-review items) from the learner's state.
export function courseSteps(pack: LanguagePack, progress: Progress): TodayStep[] {
  const steps = courseBody(pack, progress);
  const pos = cp.position(pack.course!, progress.course);
  const agenda = cp.sessionAgenda(pack, pack.course!, pos);
  if (!steps.length || !agenda) return steps;
  // The warm-up comes first, so the agenda says so (a checkpoint retry's review is already in its bullets).
  const warm = steps.find((x): x is Extract<TodayStep, { kind: "warmup" }> => x.kind === "warmup");
  const retry = pos.kind === "session" && pos.retry;
  const own = warm?.own ?? 0;
  const n = (warm?.items.length ?? 0) - own;
  const warmLine = n || own
    ? `Warm-up: ${n ? `${n} card${n > 1 ? "s" : ""} from earlier sessions` : ""}${n && own ? " + " : ""}${own ? `${own} of your own picked words (★ / ＋ Learn)` : ""}`
    : "Warm-up: a quick verb drill";
  // Build-a-sentence only runs when something is buildable right now (and Say it when there's a line to
  // say); don't promise either otherwise.
  const items = agenda.items
    .filter((b) => steps.some((x) => x.kind === "build") || !b.startsWith("Build a sentence"))
    .filter((b) => steps.some((x) => x.kind === "sayit") || !b.startsWith("Say it:"));
  return [{ kind: "agenda", agenda: { ...agenda, items: warm && !retry ? [warmLine, ...items] : items } }, ...steps];
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

  if (s.role === "checkpoint") {
    const words = cc.words.filter((w) => studied(w.lexKey)).map((w) => vocabByKey.get(w.lexKey)).filter((v): v is ReviewItem => !!v);
    // A retry is preceded by a targeted review of the chapter's weakest words.
    if (pos.retry) {
      const weakest = [...words].sort((a, b) => (progress.familiarity[familiarity.deriveKeyForItem(a).lexKey]?.strength ?? 0) - (progress.familiarity[familiarity.deriveKeyForItem(b).lexKey]?.strength ?? 0)).slice(0, 8);
      if (weakest.length) out.push({ kind: "warmup", items: weakest });
    }
    const cards = cc.pointIds.map((id) => points.get(id)).filter((p): p is GrammarPoint => !!p).flatMap((p) => cp.blankCardItems(p).slice(0, 1));
    const items = [...shuffle(words).slice(0, 8), ...cards];
    if (items.length) out.push({ kind: "checkpoint", chapter, items, scenario: pack.scenarios.find((x) => x.id === cc.checkpoint.scenarioId) });
    return out;
  }

  const review = s.role === "review";
  const warm = cp.pickWarmup({ pool, progress, now, current: { order, n: s.n }, slotOf, size: review ? cp.REVIEW_ITEMS : cp.WARMUP_ITEMS, share: review ? cp.EARLIER_SHARE.review : cp.EARLIER_SHARE.normal });
  // The conjugation drill only drills verb groups whose point has been TAUGHT (in an earlier session):
  // -а verbs from chapter 4, -е/-и verbs from chapter 5, сум once its point is done.
  const groups = new Set<string>();
  if (progress.seenGrammar?.["pt-verbs-a"]) groups.add("a");
  if (progress.seenGrammar?.["pt-verbs-e-i"]) { groups.add("e"); groups.add("i"); }
  if (progress.seenGrammar?.["pt-sum"] && groups.size) groups.add("irregular");
  const conjVerb = groups.size ? pickConjVerb(pack, progress, groups, cp.taughtVerbs(pack, course, progress)) : undefined;
  // Review days also bring back the words you picked yourself (★ saved, ＋ Learn); other days stay on the course.
  const keyOf = (it: ReviewItem) => familiarity.deriveKeyForItem(it).lexKey;
  const own = review ? cp.ownWordsDue(pack, progress, now, 4).filter((o) => !warm.some((w) => keyOf(w) === keyOf(o))) : [];
  if (warm.length || own.length || conjVerb) out.push({ kind: "warmup", items: [...warm, ...own], conjVerb, own: own.length });

  const words = s.words.filter((w) => cp.needsTeaching(progress, w.lexKey)).map((w) => ({ lexKey: w.lexKey, gloss: w.gloss }));
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
      .map((e) => ({ text: e.text.replace(/^[„“"]+|[“”"]+$/g, ""), gloss: e.gloss, focus: cp.focusWords(course, e.source, [point!.id]) }));
    const lines = [...fromWords, ...fromPoint].filter((l, i, all) => all.findIndex((x) => x.text === l.text) === i).slice(0, 4);
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
  if (s.writing) out.push({ kind: "writing", prompt: scen?.goal ?? "Write a few lines using this chapter\u2019s words." });
  return out;
}
