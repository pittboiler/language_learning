// Verbs by pattern: the drills (batch 3, 2026-11-14). Jake: "learn how different forms of verbs are conjugated
// and in what settings … practice the different forms across a variety of different verbs", "as long as we
// are learning the overarching approaches and not memorizing every verb". Three kinds, each tap one of three:
//  - same:  a pattern's ending on a verb you know, then the same ending on another verb that follows it (one
//           you haven't drilled it with; a new verb, glossed, once you've done the ones you know);
//  - time:  a line from a story you've read, said in the past or the future;
//  - which: ongoing or done, the two halves of an aspect pair in the past (јадев / изедов).
// Progress is kept per pattern variant × person (Progress.verbPractice): each drill asks the weakest, unasked
// first, and always includes the newest tense taught, so the past keeps coming back through chapters 10–12.
// Each verb has its own review too (Progress.verbReview, 2026-11-25): which verb a question uses goes by that,
// so a verb you've met comes back (see "each verb's own review" below). Pure: the warm-up, the checkpoint, the
// practice rounds and the Library all build from here.
import type { LanguagePack, MiniStory, VerbEntry, VerbPattern, VerbPatternVariant, VerbPerson, VerbTense } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import * as cp from "./course-player";
import type { Progress } from "./store";

export type VerbQuestion = {
  kind: "same" | "time" | "which";
  /** What it practises: Progress.verbPractice is keyed `${variant}|${person}`. */
  variant: string;
  person: VerbPerson;
  tense: VerbTense;
  /** The verb being drilled. */
  lemma: string;
  gloss: string;
  /** A verb you haven't met: the course hasn't taught it and no question has asked it yet. */
  isNew?: boolean;
  /** same: the pattern shown on a verb you know. */
  model?: { lemma: string; gloss: string; form: string };
  /** time: the line as you read it. */
  line?: { text: string; gloss: string; source: string };
  /** which: the English to match. */
  cue?: string;
  /** The task, in a few words ("Now in the past:"). */
  ask: string;
  /** same: who to say it for ("ти (you, one friend)"); the -л form of "have done" is a man's (дошол). */
  who?: string;
  /** The line or phrase with the answer blanked (___), and filled in. */
  shown: string;
  filled: string;
  answer: string;
  options: string[];
  why: string;
};
export type VerbResult = { q: VerbQuestion; ok: boolean };

const P: VerbPerson[] = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"];
/** `en` names the pronoun shown (таа: "she"); `who` is the person in an explanation, where a line may be about
 *  Петар ("he/she"). */
export const PRONOUN: Record<VerbPerson, { mk: string; en: string; who: string; subject: string; was: string }> = {
  "1sg": { mk: "јас", en: "I", who: "I", subject: "I", was: "was" },
  "2sg": { mk: "ти", en: "you (one friend)", who: "you", subject: "You", was: "were" },
  "3sg": { mk: "таа", en: "she", who: "he/she", subject: "She", was: "was" },
  "1pl": { mk: "ние", en: "we", who: "we", subject: "We", was: "were" },
  "2pl": { mk: "вие", en: "you all", who: "you all", subject: "You all", was: "were" },
  "3pl": { mk: "тие", en: "they", who: "they", subject: "They", was: "were" },
};
export const BLANK = "___";
export const keyOf = (variant: string, person: VerbPerson) => `${variant}|${person}`;
/** A small stable hash, so a drill built twice from the same state is the same drill. */
const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619); return h >>> 0; };
const pick = <T,>(xs: T[], seed: number): T | undefined => (xs.length ? xs[seed % xs.length] : undefined);

// ---- what's in reach ---------------------------------------------------------------------------------

export interface VariantInfo { pattern: VerbPattern; variant: VerbPatternVariant; pointId?: string }
export const variantsOf = (pack: LanguagePack): VariantInfo[] =>
  (pack.verbPatterns ?? []).flatMap((pattern) => pattern.variants.map((variant) => ({ pattern, variant, pointId: variant.pointId ?? pattern.pointId })));

/** The variants whose point the course has taught (the Library shows the rest as "comes in chapter N"). */
export function unlockedVariants(pack: LanguagePack, progress: Progress): VariantInfo[] {
  return variantsOf(pack).filter((v) => !!v.pointId && !!progress.seenGrammar?.[v.pointId]);
}

/** The chapter that teaches a point (for "comes in chapter N"). */
export function chapterOfPoint(pack: LanguagePack, pointId?: string): number | undefined {
  const point = pointId ? pack.course?.points.find((p) => p.id === pointId) : undefined;
  return point ? pack.course?.chapters.find((c) => c.chapterId === point.chapterId)?.order : undefined;
}

/** The verbs you know: the course has taught one of their forms by now (cp.verbsTaughtBy), or you've studied it. */
export function knownVerbs(pack: LanguagePack, progress: Progress): Set<string> {
  const out = pack.course ? cp.verbsTaughtBy(pack, pack.course, cp.currentSlot(pack.course, progress)) : new Set<string>();
  for (const v of pack.verbs ?? []) {
    if (out.has(v.lemma)) continue;
    const own = (["present", "pastOngoing", "pastDone", "command"] as const).flatMap((t) => Object.values(v.forms[t] ?? {}));
    const forms = [v.lemma, ...own, ...(v.lform ? Object.values(v.lform) : [])].flatMap(cp.wordTokens);
    if (forms.some((t) => { const e = progress.familiarity[t]; return !!e && familiarity.isStudied(e); })) out.add(v.lemma);
  }
  return out;
}

/** The verbs that follow a variant in its tense (impersonal verbs aside; a done verb's bare present isn't
 *  drilled: it only comes after да or ќе). */
export function followers(pack: LanguagePack, info: VariantInfo): VerbEntry[] {
  const t = info.pattern.tense;
  return (pack.verbs ?? []).filter((v) => v.patterns[t] === info.variant.id && !v.impersonal && !(t === "present" && v.aspect === "done") && !!v.forms[t]);
}

const personsOf = (info: VariantInfo): VerbPerson[] => P.filter((p) => info.variant.endings[p] !== undefined);

// ---- each verb's own review (2026-11-25) --------------------------------------------------------------
// Jake: "all the verbs we are learning through the conjugations, do we eventually access those elsewhere /
// build on them to ensure repetition?" They didn't: a question's verb was the one its pattern had drilled
// least lately, and some 28 verbs the course never teaches came up once or twice, glossed, and never again.
// Now every first-try answer about a verb (here, and "Switch the person") moves it along VERB_WAITS. A drill
// opens with the verbs that are back (verbsBack: the ones you missed, then the most overdue for their wait),
// two of the warm-up's three questions, each on a pattern it follows. Its other questions take, of the verbs
// that fit: one you missed, then one the course taught that hasn't been asked, then a new one (at most
// NEW_VERBS a drill), then one that's back, then the one due soonest. So the course's own verbs come first,
// new ones keep arriving, and a verb once met keeps coming back.
// Tuned by walking the course a lesson a day with 15% misses (2026-11-25): reviews first everywhere let only
// 2 of the 28 drill-only verbs in; one review a drill let them all in but left 10 verbs met once and first
// comebacks up to 23 lessons late; two a drill: some 45 verbs (14–16 drill-only, each back 3 times or more),
// every miss back the next lesson, first comebacks within about 10 lessons. Only a few done verbs first asked
// in chapter 12 are met once. Switches and the checkpoint add reviews on top of the warm-up's.

/** Days until a verb comes back, by how many times running it's been right; a miss sets it back to 0 (due
 *  at once, so the next drill asks it again). */
export const VERB_WAITS = [0, 1, 3, 7, 14, 30];
/** New verbs (not taught by the course, never asked) one drill may bring in. */
export const NEW_VERBS = 1;
type VerbReviewEntry = NonNullable<Progress["verbReview"]>[string];

/** A first-try answer about a verb: right moves it a wait further on, a miss brings it back next time. */
export function recordVerbAnswer(progress: Progress, lemma: string, ok: boolean, now = new Date()): Progress {
  const r = progress.verbReview?.[lemma];
  const step = ok ? Math.min((r?.step ?? 0) + 1, VERB_WAITS.length - 1) : 0;
  // A day's wait means the next day, not 24 hours on: a 7 pm lesson still finds a verb answered at 8 pm.
  const wait = VERB_WAITS[step]! * 864e5 - (step ? 6 * 36e5 : 0);
  const entry: VerbReviewEntry = {
    right: (r?.right ?? 0) + (ok ? 1 : 0), wrong: (r?.wrong ?? 0) + (ok ? 0 : 1), at: now.toISOString(), step, due: new Date(now.getTime() + wait).toISOString(),
  };
  return { ...progress, verbReview: { ...progress.verbReview, [lemma]: entry } };
}

/** What a drill goes by when it picks verbs: the verbs taught, each verb's review, the verbs it has already
 *  used, and how many new verbs it may still bring in. */
export interface VerbPicker { known: Set<string>; review: Record<string, VerbReviewEntry>; now: number; used: Set<string>; newLeft: number }
export const verbPicker = (progress: Progress, known: Set<string>, now = new Date(), newVerbs = NEW_VERBS): VerbPicker =>
  ({ known, review: progress.verbReview ?? {}, now: now.getTime(), used: new Set(), newLeft: newVerbs });

/** Where a verb stands: 0 missed, 1 taught but never asked, 2 new, 3 due, 4 waiting its turn. */
export function verbTier(pk: VerbPicker, lemma: string): number {
  const r = pk.review[lemma];
  if (r) return Date.parse(r.due) <= pk.now ? (r.step === 0 ? 0 : 3) : 4;
  return pk.known.has(lemma) ? 1 : 2;
}
/** The verbs you've met that are back, most pressing first: the ones you missed, then the most overdue for
 *  their wait (a day late on a one-day wait before a week late on a month's), so a verb just met gets its
 *  early comebacks while the ones you know well can slip. */
export function verbsBack(pk: VerbPicker): string[] {
  const late = (r: VerbReviewEntry) => (pk.now - Date.parse(r.due)) / 864e5 / Math.max(1, VERB_WAITS[r.step]!);
  return Object.entries(pk.review).filter(([, r]) => Date.parse(r.due) <= pk.now)
    .sort(([, a], [, b]) => Number(a.step > 0) - Number(b.step > 0) || late(b) - late(a)).map(([l]) => l);
}
/** A new verb: the course hasn't taught it and nothing has asked it. */
export const isNewVerb = (pk: VerbPicker, lemma: string): boolean => !pk.known.has(lemma) && !pk.review[lemma];

/** The one to ask, of things each about a verb: the lowest tier (verbTier), then the longest overdue or soonest due;
 *  a new verb only while the drill has room for one, never a verb it has used. Ties go by the seed. */
export function mostPressing<T>(xs: T[], lemmaOf: (x: T) => string, pk: VerbPicker, seed: number): T | undefined {
  const fit = xs.filter((x) => !pk.used.has(lemmaOf(x)) && (pk.newLeft > 0 || !isNewVerb(pk, lemmaOf(x))));
  const rank = (x: T): [number, number] => { const l = lemmaOf(x); const r = pk.review[l]; return [verbTier(pk, l), r ? Date.parse(r.due) : 0]; };
  const cmp = (a: T, b: T) => { const [ta, da] = rank(a); const [tb, db] = rank(b); return ta - tb || da - db; };
  const sorted = [...fit].sort(cmp);
  return pick(sorted.filter((x) => cmp(x, sorted[0]!) === 0), seed);
}

// ---- picking what to ask --------------------------------------------------------------------------------

/** How much a variant × person needs practice: never asked first, then the most missed, then the longest ago. */
function need(progress: Progress, key: string, now: number): number {
  const r = progress.verbPractice?.[key];
  if (!r) return 1000;
  const ago = (now - new Date(r.at).getTime()) / 864e5;
  return r.wrong * 3 - r.right + Math.min(ago, 30) / 3;
}

export interface DrillOpts {
  /** How many questions. */
  size: number;
  /** Only these variants (the Library's "Practise this pattern", a chapter's own patterns). */
  only?: string[];
  /** Varies the verbs and lines picked between drills built from the same state (e.g. the lesson count). */
  seed?: number;
  /** New verbs the drill may bring in (default NEW_VERBS). */
  newVerbs?: number;
  /** For what's due (default: now). */
  now?: Date;
}

/** A drill: the weakest variant × persons, one question each, with the newest tense taught always in it, and
 *  the verbs that are back (missed, or their wait over) in all its other questions they fit. */
export function buildVerbDrill(pack: LanguagePack, progress: Progress, opts: DrillOpts): VerbQuestion[] {
  const all = unlockedVariants(pack, progress).filter((v) => !opts.only || opts.only.includes(v.variant.id));
  if (!all.length) return [];
  const known = knownVerbs(pack, progress);
  const now = opts.now ?? new Date();
  const pk = verbPicker(progress, known, now, opts.newVerbs ?? NEW_VERBS);
  const seed = opts.seed ?? (progress.courseLog?.length ?? 0);
  // The newest: the variant whose point the course taught last.
  const slots = pack.course ? cp.pointSlots(pack.course) : new Map<string, cp.CourseSlot>();
  const newest = [...all].sort((a, b) => cp.cmpSlot(slots.get(b.pointId!) ?? { order: 0, n: 0 }, slots.get(a.pointId!) ?? { order: 0, n: 0 }))[0]!;
  type Key = { info: VariantInfo; person: VerbPerson; need: number; lemma?: string };
  const keys: Key[] = all.flatMap((info) => personsOf(info).map((person) => ({ info, person, need: need(progress, keyOf(info.variant.id, person), now.getTime()) + (hash(`${seed}${info.variant.id}${person}`) % 100) / 1000 })))
    .sort((a, b) => b.need - a.need);
  const order: Key[] = [];
  // The verbs that are back first, all but one question's worth (the newest tense keeps its place), each on
  // the weakest of its patterns with a form for that person.
  const fits = (v: VerbEntry, k: Key) => followers(pack, k.info).includes(v) && !!v.forms[k.info.pattern.tense]?.[k.person];
  const byLemma = new Map((pack.verbs ?? []).map((v) => [v.lemma, v]));
  const back = verbsBack(pk).map((l) => byLemma.get(l)).flatMap((v) => { const k = v && keys.find((x) => fits(v, x)); return v && k ? [{ ...k, lemma: v.lemma }] : []; });
  order.push(...back.slice(0, Math.max(1, opts.size - 1)));
  const has = (k: Key) => order.some((c) => c.info === k.info && c.person === k.person);
  const newestKey = keys.find((k) => k.info.variant.id === newest.variant.id && !has(k));
  if (newestKey && !opts.only) order.push(newestKey);
  // Different variants first, so one drill covers several patterns; then anything still needed. The whole list
  // is in order, so a key that can't make a question gives way to the next.
  for (const k of keys) if (!has(k) && !order.some((c) => c.info.variant.id === k.info.variant.id)) order.push(k);
  for (const k of keys) if (!has(k)) order.push(k);

  const out: VerbQuestion[] = [];
  const aspectTaught = !!progress.seenGrammar?.["pt-aspect"];
  for (const [i, { info, person, lemma }] of order.entries()) {
    if (out.length >= opts.size) break;
    const s = seed + i * 7;
    const t = info.pattern.tense;
    // The kind: the pasts take turns between all three; the future between a line and a pattern.
    const kinds: VerbQuestion["kind"][] = t === "pastOngoing" ? ["time", "same", ...(aspectTaught ? ["which" as const] : [])]
      : t === "pastDone" ? [...(aspectTaught ? ["which" as const] : []), "same"]
      : t === "future" ? ["time", "same"] : ["same"];
    const turn = kinds.map((_, j) => kinds[(s + j) % kinds.length]!);
    let q = lemma ? samePattern(pack, info, person, pk, s, lemma) : undefined;
    for (const kind of turn) {
      if (q) break;
      q = kind === "same" ? samePattern(pack, info, person, pk, s)
        : kind === "time" ? switchTime(pack, progress, info, person, known, s, pk)
        : whichPast(pack, info, person, known, s, pk);
    }
    if (!q) continue;
    if (isNewVerb(pk, q.lemma)) pk.newLeft--;
    pk.used.add(q.lemma);
    out.push(q);
  }
  return out;
}

// ---- same pattern, another verb ----------------------------------------------------------------------

/** Wrong answers that test the pattern: the same verb in the persons most often confused with this one, and,
 *  where the variants' endings are plain suffixes (the present), this person's ending from the other
 *  variants (носат vs носаат): picking the right vowel IS the pattern. */
function distractors(pack: LanguagePack, info: VariantInfo, v: VerbEntry, person: VerbPerson): string[] {
  const t = info.pattern.tense;
  const forms = v.forms[t] ?? {};
  const answer = forms[person]!;
  const out: string[] = [];
  const plain = (e?: string) => !!e && /^-\p{L}+$/u.test(e);
  if (info.pattern.variants.length > 1 && info.pattern.variants.every((x) => P.every((p) => plain(x.endings[p])))) {
    const mine = info.variant.endings[person]!.slice(1);
    if (answer.endsWith(mine)) {
      const stem = answer.slice(0, answer.length - mine.length);
      for (const other of info.pattern.variants) if (other.id !== info.variant.id) out.push(stem + other.endings[person]!.slice(1));
    }
  }
  const confusable: Record<VerbPerson, VerbPerson[]> = { "1sg": ["1pl", "3sg"], "2sg": ["2pl", "3sg"], "3sg": ["3pl", "2sg"], "1pl": ["1sg", "2pl"], "2pl": ["2sg", "1pl"], "3pl": ["3sg", "1pl"] };
  for (const p of confusable[person]) if (forms[p]) out.push(forms[p]!);
  for (const p of P) if (forms[p]) out.push(forms[p]!);
  // A command has only two forms: the plain "you" form is the slip to tell it from (гледаш vs гледај).
  if (t === "command" && v.forms.present?.[person]) out.push(v.forms.present[person]!);
  return [...new Set(out.filter((f) => f !== answer))].slice(0, 2);
}

/** `lemma`: ask this verb (the drill's most pressing one); otherwise the picker chooses. */
function samePattern(pack: LanguagePack, info: VariantInfo, person: VerbPerson, pk: VerbPicker, seed: number, lemma?: string): VerbQuestion | undefined {
  const t = info.pattern.tense;
  const vs = followers(pack, info).filter((v) => !!v.forms[t]?.[person]);
  const target = lemma ? vs.find((v) => v.lemma === lemma && !pk.used.has(lemma)) : mostPressing(vs, (v) => v.lemma, pk, seed);
  if (!target) return undefined;
  // The model: another verb that follows the pattern, one you know if there is one.
  const models = vs.filter((v) => v.lemma !== target.lemma);
  const model = pick(models.filter((v) => pk.known.has(v.lemma)), seed) ?? pick(models, seed);
  if (!model) return undefined;
  const form = target.forms[t]![person]!;
  const pron = PRONOUN[person];
  const modelForm = model.forms[t]![person]!;
  const ending = info.variant.endings[person]!;
  const subject = t === "command" ? (person === "2sg" ? "to one friend" : "to several people, or politely") : pron.mk;
  // "Have done" agrees with who: the drill's -л forms are a man's (сум дошол), so the person says so.
  const HAVE_WHO: Partial<Record<VerbPerson, string>> = { "1sg": "јас (I, a man)", "2sg": "ти (you, to a man)", "3sg": "тој (he)" };
  const who = t === "command" ? undefined : t === "haveDone" && HAVE_WHO[person] ? HAVE_WHO[person] : `${pron.mk} (${pron.en})`;
  return {
    kind: "same", variant: info.variant.id, person, tense: t, lemma: target.lemma, gloss: target.gloss, isNew: isNewVerb(pk, target.lemma),
    model: { lemma: model.lemma, gloss: model.gloss, form: modelForm },
    ask: `${target.lemma} follows the same pattern. ${t === "command" ? `Say it ${subject}` : `Now ${who}`}:`,
    ...(who ? { who } : {}),
    shown: t === "command" || t === "haveDone" || t === "future" ? BLANK : `${pron.mk} ${BLANK}`,
    filled: t === "command" || t === "haveDone" || t === "future" ? form : `${pron.mk} ${form}`,
    answer: form,
    options: [form, ...distractors(pack, info, target, person)],
    why: sameWhy(info, target.lemma, `${model.lemma} (${modelForm})`, ending, t === "command" ? subject : pron.who, form),
  };
}

/** Why the answer follows the pattern, in the pattern's own terms. */
function sameWhy(info: VariantInfo, lemma: string, model: string, ending: string, who: string, form: string): string {
  switch (info.pattern.tense) {
    case "present": return `${lemma} is an ${info.variant.label.replace(/s$/, "")}, like ${model}: ${ending} for ${who}, so ${form}.`;
    case "future": return `The future is ќе + the present, for every verb: ${form}.`;
    case "command": return `${lemma} works like ${model}: ${ending} ${who}, so ${form}.`;
    case "pastOngoing": return `Every ongoing verb\u2019s past works like ${model}: ${ending} for ${who}, so ${form}.`;
    case "pastDone": return `${lemma} is a done verb like ${model}: ${ending === "the stem" ? "the bare stem" : ending} for ${who}, so ${form}.`;
    case "haveDone": return `сум, си, сме or сте + the -л form, as with ${model}: ${form}.`;
  }
}

// ---- switch the time: a line you've read, in the past or the future ----------------------------------

/** Words that make a line too tangled to retime by swapping its verb (a second verb after да, a would, a let's). */
const UNTIMEABLE = new Set(["да", "ќе", "би", "нека", "ајде", "немој", "ако"]);
/** The short pronouns that sit just before a verb: ќе goes in front of them (Ќе ги земам). */
const CLITICS = new Set(["ме", "те", "го", "ја", "ги", "ве", "се", "му", "ѝ", "им", "ни", "ми"]);

/** The stories you've read, in course order up to your place. */
function readStories(pack: LanguagePack, progress: Progress): MiniStory[] {
  return (pack.stories ?? []).filter((st) => (progress.storyReads?.[st.id]?.length ?? 0) > 0 || progress.seenStories?.[st.id]);
}

/** Every present form of the bank's ongoing verbs → the verb and person. A form two verbs share (земам, of зема
 *  and земе) is left out, its past would be a guess, and so is a done verb's form: on its own it's that verb's
 *  past (Марко отиде, "Marko went"), not a present. */
function presentForms(pack: LanguagePack): Map<string, { v: VerbEntry; person: VerbPerson }> {
  const m = new Map<string, { v: VerbEntry; person: VerbPerson } | null>();
  const done = new Set((pack.verbs ?? []).filter((v) => v.aspect === "done").flatMap((v) => [...Object.values(v.forms.present ?? {}), ...Object.values(v.forms.pastDone ?? {})]).map((f) => familiarity.normalize(f!)));
  for (const v of pack.verbs ?? []) for (const [p, f] of Object.entries(v.forms.present ?? {})) {
    if (v.aspect === "done") continue;
    const t = familiarity.normalize(f!);
    if (v.lemma === "сум" && (t === "се" || t === "си")) continue; // mostly the reflexive се / си
    if (done.has(t)) { m.set(t, null); continue; }
    const prev = m.get(t);
    m.set(t, prev === undefined ? { v, person: p as VerbPerson } : prev && prev.v.lemma === v.lemma ? prev : null);
  }
  return new Map([...m].filter((e): e is [string, { v: VerbEntry; person: VerbPerson }] => !!e[1]));
}
/** Every form of every bank verb, any tense: a line with two of them has two verbs. */
function anyForms(pack: LanguagePack): Set<string> {
  return new Set((pack.verbs ?? []).flatMap((v) => Object.values(v.forms).flatMap((t) => Object.values(t ?? {}))).flatMap((f) => f!.split(" ")).map((f) => familiarity.normalize(f)));
}

/** `pk`: in a drill, the line's verb goes by each verb's review (mostPressing); without it, any line. */
export function switchTime(pack: LanguagePack, progress: Progress, info: VariantInfo, person: VerbPerson | undefined, known: Set<string>, seed: number, pk?: VerbPicker): VerbQuestion | undefined {
  const t = info.pattern.tense;
  if (t !== "pastOngoing" && t !== "future") return undefined;
  const pres = presentForms(pack);
  const every = anyForms(pack);
  const lines = readStories(pack, progress).flatMap((st) => st.body.map((b, i) => ({ b, source: `story:${st.id}#${i}` })));
  const cands = lines.flatMap(({ b, source }) => {
    if (!cp.singleUtterance(b.text)) return [];
    const text = cp.spoken(b.text)!;
    const words = [...text.matchAll(/\p{L}+/gu)].map((m) => ({ w: m[0], at: m.index!, t: familiarity.normalize(m[0]) }));
    if (words.length < 2 || words.length > 9 || words.some((x) => UNTIMEABLE.has(x.t))) return [];
    const verbs = words.map((x, k) => (every.has(x.t) ? k : -1)).filter((k) => k >= 0);
    if (verbs.length !== 1) return [];
    const k = verbs[0]!;
    const hit = pres.get(words[k]!.t);
    if (!hit || hit.v.impersonal || !known.has(hit.v.lemma) || hit.v.patterns[t] !== info.variant.id) return [];
    if (t === "pastOngoing" && !hit.v.forms.pastOngoing) return [];
    if (hit.v.lemma === "сум" && k > 0 && CLITICS.has(words[k - 1]!.t)) return []; // Мило ми е
    // A command that looks like a present (Ана, оди право!: оди is also "go!"): someone addressed, or a "!".
    const asCommand = Object.values(hit.v.forms.command ?? {}).some((f) => familiarity.normalize(f!) === words[k]!.t);
    if (asCommand && (/!\s*$/.test(text) || /^\p{Lu}\p{L}*,/u.test(text))) return [];
    if (person && hit.person !== person) return [];
    return [{ text, gloss: cp.spokenGloss(b.gloss), source, words, k, ...hit }];
  });
  const c = pk ? mostPressing(cands, (x) => x.v.lemma, pk, seed) : pick(cands, seed);
  if (!c) return undefined;
  const { v, words, k, text } = c;
  const p = c.person;
  const cap = (s: string, like: string) => (/^\p{Lu}/u.test(like) ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const otherP = (forms: Partial<Record<VerbPerson, string>>) => P.find((x) => x !== p && forms[x] && forms[x] !== forms[p]);
  // What gets replaced: the past swaps just the verb (Не разбирам → Не разбирав). The future goes in front of
  // the short pronouns before the verb (Ќе ги земам), and a не before them becomes нема да (Нема да го знам).
  let from = k;
  let answer: string;
  let trap: string;
  let wrongPerson: string | undefined;
  if (t === "pastOngoing") {
    answer = v.forms.pastOngoing![p]!;
    trap = v.forms.present![p]!;
    const o = otherP(v.forms.pastOngoing!);
    wrongPerson = o ? v.forms.pastOngoing![o] : undefined;
  } else {
    let lead = k;
    while (lead > 0 && CLITICS.has(words[lead - 1]!.t)) lead--;
    const neg = lead > 0 && words[lead - 1]!.t === "не";
    from = neg ? lead - 1 : lead;
    const between = words.slice(lead, k).map((x) => x.t);
    // The verb after ќе: the present, but for сум its own future (ќе бидам).
    const bare = (q: VerbPerson) => v.forms.future![q]!.replace(/^ќе /, "");
    const fut = (q: VerbPerson) => [neg ? "нема да" : "ќе", ...between, bare(q)].join(" ");
    answer = fut(p);
    // The traps: the line left in the present, and with не the "не ќе" English speakers reach for.
    trap = [...(neg ? ["не ќе"] : []), ...between, neg ? bare(p) : v.forms.present![p]!].join(" ");
    const o = otherP(v.forms.future!);
    wrongPerson = o ? fut(o) : undefined;
  }
  const start = words[from]!.at;
  const end = words[k]!.at + words[k]!.w.length;
  const lineWith = (f: string) => text.slice(0, start) + cap(f, words[from]!.w) + text.slice(end);
  const pron = PRONOUN[p];
  const vowel = v.lemma.at(-1);
  const why = t === "pastOngoing"
    ? v.lemma === "сум" ? `сум's past is learnt on its own: бев, беше, беше, бевме, бевте, беа. So ${answer}.`
      : vowel === "а" ? `${v.lemma} is an ongoing verb: its past keeps the а and adds ${info.variant.endings[p]} for ${pron.who}, so ${answer}.`
      : `${v.lemma} is an ongoing verb: in the past its ${vowel} becomes е, then ${info.variant.endings[p]} for ${pron.who}, so ${answer}.`
    : answer.startsWith("нема да") ? `\u201cWon\u2019t\u201d is нема да + the present: ${answer}. Не ќе isn\u2019t used.`
    : `The future is ќе + the present${v.lemma === "сум" ? " (сум\u2019s own: ќе бидам, ќе бидеш…)" : ""}: ${answer}.`;
  return {
    kind: "time", variant: info.variant.id, person: p, tense: t, lemma: v.lemma, gloss: v.gloss,
    line: { text, gloss: c.gloss, source: c.source },
    ask: t === "pastOngoing" ? "Now say it about the past:" : "Now say it about later (the future):",
    shown: lineWith(BLANK),
    filled: lineWith(answer),
    answer,
    options: [...new Set([answer, trap, ...(wrongPerson ? [wrongPerson] : [])])].slice(0, 3),
    why,
  };
}

// ---- which past? ongoing or done -------------------------------------------------------------------------

/** `pk`: in a drill, the pair goes by the review of the verb asked (mostPressing); without it, any pair. */
export function whichPast(pack: LanguagePack, info: VariantInfo, person: VerbPerson, known: Set<string>, seed: number, pk?: VerbPicker): VerbQuestion | undefined {
  const t = info.pattern.tense;
  if (t !== "pastOngoing" && t !== "pastDone") return undefined;
  const byLemma = new Map((pack.verbs ?? []).map((v) => [v.lemma, v]));
  // Pairs where the verb on this side follows the variant; the ongoing half (or both) known.
  const pairs = (pack.verbs ?? []).filter((v) => v.aspect === "ongoing" && v.partner && v.en).map((v) => [v, byLemma.get(v.partner!)!] as const)
    .filter(([on, done]) => !!done?.en && !!on.forms.pastOngoing?.[person] && !!done.forms.pastDone?.[person] && (t === "pastOngoing" ? on.patterns.pastOngoing : done.patterns.pastDone) === info.variant.id)
    .sort(([a], [b]) => Number(known.has(b.lemma)) - Number(known.has(a.lemma)));
  const knownPairs = pairs.filter(([on, done]) => known.has(on.lemma) || known.has(done.lemma));
  const isOn = t === "pastOngoing";
  const pair = pk ? mostPressing(knownPairs.length ? knownPairs : pairs, ([on, done]) => (isOn ? on : done).lemma, pk, seed) : pick(knownPairs.length ? knownPairs : pairs, seed);
  if (!pair) return undefined;
  const [on, done] = pair;
  const pron = PRONOUN[person];
  const v = isOn ? on : done;
  const answer = isOn ? on.forms.pastOngoing![person]! : done.forms.pastDone![person]!;
  const other = isOn ? done.forms.pastDone![person]! : on.forms.pastOngoing![person]!;
  const forms = isOn ? on.forms.pastOngoing! : done.forms.pastDone!;
  const wrong = P.map((x) => forms[x]).find((f) => f && f !== answer && f !== other);
  const cue = isOn ? `${pron.subject} ${pron.was} ${on.en!.ing}… (it went on for a while)` : `${pron.subject} ${done.en!.past}. (once, and it was done)`;
  return {
    kind: "which", variant: info.variant.id, person, tense: t, lemma: v.lemma, gloss: v.gloss, isNew: pk ? isNewVerb(pk, v.lemma) : !known.has(v.lemma),
    cue, ask: "Which past fits?", shown: BLANK, filled: answer, answer,
    options: [answer, other, ...(wrong ? [wrong] : [])],
    why: isOn
      ? `Going on for a while: the ongoing verb ${on.lemma}, so ${answer}. Done once: ${done.lemma} (${other}).`
      : `Once and done: the done verb ${done.lemma}, so ${answer}. Going on: ${on.lemma} (${other}).`,
  };
}

// ---- results --------------------------------------------------------------------------------------------

/** Records a drill's first tries per variant × person, and per verb (recordVerbAnswer). */
export function recordVerbResults(progress: Progress, results: VerbResult[], now = new Date()): Progress {
  const practice = { ...(progress.verbPractice ?? {}) };
  for (const { q, ok } of results) {
    const k = keyOf(q.variant, q.person);
    const r = practice[k] ?? { right: 0, wrong: 0, at: now.toISOString() };
    practice[k] = { right: r.right + (ok ? 1 : 0), wrong: r.wrong + (ok ? 0 : 1), at: now.toISOString() };
  }
  return results.reduce<Progress>((p, { q, ok }) => recordVerbAnswer(p, q.lemma, ok, now), { ...progress, verbPractice: practice });
}

/** How sure you are of a variant, from its persons' first tries: undefined until it's been asked. */
export function variantStrength(progress: Progress, variantId: string): { right: number; wrong: number } | undefined {
  const rs = Object.entries(progress.verbPractice ?? {}).filter(([k]) => k.startsWith(`${variantId}|`)).map(([, r]) => r);
  return rs.length ? rs.reduce((a, r) => ({ right: a.right + r.right, wrong: a.wrong + r.wrong }), { right: 0, wrong: 0 }) : undefined;
}
