"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ConjugationSet, LanguagePack, MiniStory, ReviewItem, Scenario } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import * as scoring from "@ll/core/familiarity/scoring";
import * as leveling from "@ll/core/leveling";
import * as chapterSpine from "@ll/core/chapters";
import { makeRecorder } from "../lib/recorder";
import * as api from "../lib/api";
import { getPack, DEFAULT_PACK_ID } from "../lib/packs";
import { type Progress } from "../lib/store";
import { localDay, storyDone } from "../lib/daily";
import { properNounLike } from "../lib/capture";

export type Section = "today" | "library" | "progress" | "partnered";
export type LibView = "browse" | "flashcards" | "words" | "practice" | "converse" | "reference" | "letters" | "scenario" | "grammar" | "reading" | "story" | "write" | "build" | "notes";
// The active pack flows through context so every view reads the same selected language.
export const PackContext = createContext<LanguagePack>(getPack(DEFAULT_PACK_ID));
export const usePack = () => useContext(PackContext);
/** Global playback RATE for all spoken audio (1 = normal). The root computes it from settings: 1 when
 *  "normal", else the user's chosen slow rate (settings.slowRate, default 0.75). ONE setting app-wide. */
export const SlowContext = createContext(1);
/** Play TTS in the active pack's voice at the global playback rate. The per-call speed arg is now
 *  ignored (rate is a global setting); it stays only for call-site compatibility. Never throws: resolves
 *  false when the line couldn't be played (a SpeakButton shows that). */
export function usePlay() {
  const pack = usePack();
  const rate = useContext(SlowContext);
  return useCallback((text: string, _speed?: number): Promise<boolean> => api.playTts(text, rate, pack.id).catch(() => false), [pack.id, rate]);
}
/** A mic recorder that lets go of the mic when its view goes away mid-recording (a skip, the next step,
 *  leaving the exam), not only when Stop is pressed — otherwise the tab keeps the mic. */
export function useRecorder() {
  const rec = useRef(makeRecorder());
  useEffect(() => { const r = rec.current; return () => r.release(); }, []);
  return rec;
}
/** Resolve the effective playback rate from settings — slow on ⇒ the chosen slow rate (default 0.75). */
export const effectiveRate = (s?: { slow?: boolean; slowRate?: number }) => (s?.slow ? s.slowRate ?? 0.75 : 1);
// The script's focus glyphs (unique + false-friends) for any pack.
export const focusLetters = (pack: LanguagePack) => pack.alphabet.filter((a) => a.unique || a.falseFriend);
// A pack whose scenarios are all machine-generated + not yet native-reviewed (e.g. Bulgarian). The
// design rule is "never serve unreviewed content as authoritative" — so we surface it in the UI.
export const packUnreviewed = (pack: LanguagePack) => pack.scenarios.length > 0 && pack.scenarios.every((s) => s.confidence === "unreviewed");
// ---- familiarity helpers — unify vocab state + SRS in one store keyed by lexKey ----
// An item is due for REVIEW only once the learner has actually MET it (has a familiarity entry) and its
// SRS due date has arrived. A never-seen word is NOT due — it hasn't been introduced yet; the Today
// "new words" step owns introducing it (with audio + meaning), after which capture makes it due and it
// resurfaces here for spaced review. This keeps warm-up/flashcards to words you're learning, not the
// whole pack. (known ⇒ srs null ⇒ not due.)
export const isDue = (p: Progress, item: ReviewItem, now: Date): boolean => {
  const e = p.familiarity[familiarity.deriveKeyForItem(item).lexKey];
  return !!e && familiarity.isStudied(e) && !!e.srs && new Date(e.srs.due) <= now;
};
// Grade a review item → next Progress with its familiarity entry rescheduled via the same FSRS engine.
export const gradeItem = (p: Progress, item: ReviewItem, ok: boolean): Progress => {
  const spec = familiarity.deriveKeyForItem(item);
  const entry = p.familiarity[spec.lexKey] ?? familiarity.capture(spec);
  return { ...p, familiarity: { ...p.familiarity, [spec.lexKey]: familiarity.grade(entry, ok ? "good" : "again") } };
};
// A captured card that's only a name (a tapped "Скопје"): kept out of review. Only a single word can be one —
// a saved sentence starts with a capital too ("Како се вели …?") and must still show up.
export const nameCard = (display: string, pack: LanguagePack): boolean => !/\s/.test(display.trim()) && properNounLike(display, pack);
// Visual familiarity status of a reader word (drives the colored tokens).
export const wordStatus = (p: Progress, lexKey: string): string => {
  const e = p.familiarity[lexKey];
  return !e ? "new" : e.status === "known" ? "known" : e.status === "ignored" ? "ignored" : "learning";
};
// ---- daily-flow helpers ----
/** Bump the day-streak the first time an activity completes on a new local day (idempotent per day). */
export const bumpStreak = (p: Progress): Progress => {
  const today = localDay();
  const s = p.streak ?? { count: 0, lastDay: "" };
  if (s.lastDay === today) return p;
  const yesterday = localDay(new Date(Date.now() - 86400000));
  const count = s.lastDay === yesterday ? s.count + 1 : 1;
  return { ...p, streak: { count, lastDay: today } };
};
/** The streak as it stands today: the stored count only resets on the next activity, so a streak whose last
 *  day is older than yesterday has already lapsed and counts as 0. */
export const currentStreak = (p: Progress): number => {
  const s = p.streak;
  if (!s?.count) return 0;
  return s.lastDay === localDay() || s.lastDay === localDay(new Date(Date.now() - 86400000)) ? s.count : 0;
};
// Mark a grammar concept's rule as introduced (so later it's surfaced just-in-time, not re-taught).
export const markSeen = (p: Progress, conceptId: string): Progress => ({ ...p, seenGrammar: { ...p.seenGrammar, [conceptId]: true } });
// Capture a batch of pre-taught words into familiarity (the "new words" step before the story). These
// are STUDIED — the learner just worked through them — so they're eligible for review. A word that was
// only exposed before (seeded by an earlier story read) gets promoted to studied here.
export const captureWords = (p: Progress, words: { lexKey: string; gloss?: string }[]): Progress => {
  const fam = { ...p.familiarity };
  for (const w of words) {
    const kind = w.lexKey.includes(" ") ? "chunk" : "word";
    fam[w.lexKey] = fam[w.lexKey]
      ? familiarity.markStudied(fam[w.lexKey]!)
      : familiarity.capture({ lexKey: w.lexKey, kind, display: w.lexKey, gloss: w.gloss });
  }
  return { ...p, familiarity: fam };
};
// Seed a story's registered vocab into familiarity (reading it EXPOSES those words). Tagged "exposed":
// they color the reader + count toward comprehension, but stay OUT of active review until the learner
// engages with them directly — so warm-up never cold-quizzes a word only glimpsed in a story.
export const seedStoryVocab = (p: Progress, story: MiniStory): Progress => {
  const fam = { ...p.familiarity };
  for (const v of story.registersVocab) {
    if (!fam[v.lexKey]) fam[v.lexKey] = familiarity.capture({ lexKey: v.lexKey, kind: v.lexKey.includes(" ") ? "chunk" : "word", display: v.lexKey, gloss: v.gloss, tags: [familiarity.EXPOSED_TAG] });
  }
  return { ...p, familiarity: fam };
};
// Functional level from progress signals (glyphs known, criteria met, vocab tracked).
export const computeLevel = (pack: LanguagePack, progress: Progress) => {
  const glyphsKnown = focusLetters(pack).filter((a) => progress.letters[a.glyph]).length;
  const criteriaMet = Object.values(progress.scenarios).reduce((n, s) => n + s.metCriteria.length, 0);
  const reviewStrength = Object.keys(progress.familiarity).length;
  return leveling.currentLevel({ glyphsKnown, glyphsTotal: focusLetters(pack).length, criteriaMet, reviewStrength });
};
// ---- Today "unit" model ----
// A daily session coheres around ONE unit: a story + the scenario that practises it. Stories follow
// the id convention `<scenarioId>-story`; fall back to a shared theme, then required-vocab overlap.
export function partnerScenario(pack: LanguagePack, story: MiniStory): Scenario | undefined {
  const baseId = story.id.replace(/-story$/, "");
  return (
    pack.scenarios.find((s) => s.id === baseId) ??
    (story.theme ? pack.scenarios.find((s) => s.theme === story.theme) : undefined) ??
    pack.scenarios.find((s) => {
      const keys = new Set(story.registersVocab.map((v) => v.lexKey));
      return s.requiredVocab.some((id) => {
        const v = pack.vocab.find((x) => x.id === id);
        return !!v && keys.has(familiarity.deriveKeyForItem(v).lexKey);
      });
    })
  );
}
// Resolve a scenario's requiredVocab (ReviewItem ids) → {lexKey, gloss} so it can be pre-taught.
export function scenarioVocab(pack: LanguagePack, scen: Scenario): { lexKey: string; gloss?: string }[] {
  return scen.requiredVocab
    .map((id) => pack.vocab.find((v) => v.id === id))
    .filter((v): v is ReviewItem => !!v)
    .map((v) => ({ lexKey: familiarity.deriveKeyForItem(v).lexKey, gloss: v.gloss }));
}
// The current unit's story = the first not-yet-done story IN CHAPTER ORDER; once all are done, review the
// last one. Course order, not array order: the hand-authored stories predate the generation pipeline and
// sit at the front of the pack, so plain array order starts a brand-new learner on the café story — i.e.
// chapter 4 — while the chapter map correctly says chapter 1. Sorting by the spine keeps Today, the
// header and the map telling the same story.
export function currentStory(pack: LanguagePack, progress: Progress): MiniStory | undefined {
  const stories = pack.stories ?? [];
  const order = (s: MiniStory) => chapterSpine.chapterOf(pack, s.id)?.order ?? Number.MAX_SAFE_INTEGER;
  const ordered = [...stories].sort((a, b) => order(a) - order(b));
  return ordered.find((s) => !storyDone(progress, s)) ?? ordered[ordered.length - 1];
}
// Free-writing is the GATED unit capstone: it opens only once the unit's vocab is mostly "known" AND its
// grammar has been practised (introduced/drilled, or produced in Build-a-sentence). Until then, producing
// a free sentence is just frustration — see the writing plan.
export function writingUnlocked(pack: LanguagePack, progress: Progress, story: MiniStory): boolean {
  const scen = partnerScenario(pack, story);
  const vocab = scen ? scenarioVocab(pack, scen) : story.registersVocab.map((v) => ({ lexKey: v.lexKey }));
  if (!vocab.length) return false;
  const known = vocab.filter((v) => progress.familiarity[v.lexKey]?.status === "known").length;
  if (known / vocab.length < 0.7) return false;
  const concepts = scen?.requiredStructures?.length ? scen.requiredStructures : storyGrammarIds(pack, story);
  return concepts.every((id) => !!progress.seenGrammar?.[id] || !!progress.familiarity[`grammar:${id}`]);
}
// ---------- Today: the guided daily flow (building order: review → new words → grammar → story → speak) ----------
// dayIndex = how many distinct days this unit's story has already been read (0 on day 1, 1 on day 2…).
// It rotates the day-to-day content (story Q&A, grammar drills) so a repeated unit isn't a copy.


// Person order for the warm-up conjugation drill.
export const PRONOUNS: { key: keyof ConjugationSet["forms"]; en: string; mk: string }[] = [
  { key: "1sg", en: "I", mk: "јас" },
  { key: "2sg", en: "you", mk: "ти" },
  { key: "3sg", en: "he/she", mk: "тој/таа" },
  { key: "1pl", en: "we", mk: "ние" },
  { key: "2pl", en: "you all", mk: "вие" },
  { key: "3pl", en: "they", mk: "тие" },
];
// ---------- Library: browse content by difficulty, plus the alphabet/grammar/writing tools ----------
export function difficultyChip(familiarPct: number): { label: string; cls: string } {
  if (familiarPct >= 0.9) return { label: "easy review", cls: "easy" };
  if (familiarPct >= 0.55) return { label: "just right", cls: "just" };
  if (familiarPct >= 0.3) return { label: "a stretch", cls: "stretch" };
  return { label: "challenging", cls: "hard" };
}
// Coverage of a text for this learner: knownPct (status known/ignored) for honest display, plus a
// familiarPct that also counts learning words at half weight — used to rank + label by i+1 fit.
export function coverageOf(text: string, fam: Progress["familiarity"]): { knownPct: number; familiarPct: number } {
  const words = scoring.tokenize(text).filter((t) => t.isWord);
  if (!words.length) return { knownPct: 0, familiarPct: 0 };
  let known = 0;
  let familiar = 0;
  for (const w of words) {
    const e = fam[w.lexKey];
    if (e && (e.status === "known" || e.status === "ignored")) { known++; familiar++; }
    else if (e && e.status === "learning") { familiar++; }
  }
  return { knownPct: known / words.length, familiarPct: familiar / words.length };
}
// ---------- Hints: a way back in when a word won't come ----------
// Pre-authored in the pipeline (pipeline/run-hints.ts → pack.hints), keyed by lexKey so a pack item, a
// word captured from reading, and a partner's drill turn all resolve to the same hint. A hint points at
// the word without containing it ("the opposite of лево"), so tapping it costs you the recall but not
// the answer.
export function useHintFor(): (lexKey?: string) => string | undefined {
  const pack = usePack();
  return useCallback((lexKey?: string) => (lexKey ? pack.hints?.[lexKey] : undefined), [pack]);
}
/** The "Hint" affordance: a button that turns into the hint once tapped. Renders nothing without one. */
export function HintButton({ hint, label = "Hint" }: { hint?: string; label?: string }) {
  const [shown, setShown] = useState(false);
  if (!hint) return null;
  return shown
    ? <div className="hint"><MixedText text={hint} /></div>
    : <button className="quiet hint-btn" onClick={() => setShown(true)}>{label}</button>;
}
// The learner's course chapter (order) for screens far from Today, e.g. the partner pickers. Undefined when
// the new course is off.
export const CourseOrderContext = createContext<number | undefined>(undefined);
/** Content in course order around your chapter: your chapter and earlier ones first (latest first), then
 *  later chapters, flagged so a picker can mark them "later". Content the spine doesn't place comes last. */
export function byCourseOrder<T>(pack: LanguagePack, items: T[], idOf: (t: T) => string, myOrder: number | undefined): { item: T; later: boolean }[] {
  if (myOrder === undefined) return items.map((item) => ({ item, later: false }));
  const orderOf = (t: T) => chapterSpine.chapterOf(pack, idOf(t))?.order;
  const ranked = items.map((item) => ({ item, o: orderOf(item) }));
  const now = ranked.filter((x) => x.o !== undefined && x.o <= myOrder).sort((a, b) => b.o! - a.o!);
  const later = ranked.filter((x) => x.o !== undefined && x.o > myOrder).sort((a, b) => a.o! - b.o!);
  const loose = ranked.filter((x) => x.o === undefined);
  return [...now.map((x) => ({ item: x.item, later: false })), ...loose.map((x) => ({ item: x.item, later: false })), ...later.map((x) => ({ item: x.item, later: true }))];
}
// Focus-on-form: surface the grammar a scenario uses as bite-size, just-in-time notes — tap to expand
// the rule + examples right where it's relevant, without leaving the conversation.
// The grammar concepts a story exercises. Stories carry no grammar link of their own, but promoted
// story ids follow the `<scenarioId>-story` convention, so we borrow the matching scenario's
// requiredStructures. Falls back to a same-theme scenario (covers the hand-authored `ana-coffee`,
// whose café theme maps to the café scenario's structures). No data changes needed.
export function storyGrammarIds(pack: LanguagePack, story: MiniStory): string[] {
  const scenarioId = story.id.replace(/-story$/, "");
  const direct = pack.scenarios.find((s) => s.id === scenarioId);
  if (direct?.requiredStructures.length) return direct.requiredStructures;
  const byTheme = story.theme
    ? pack.scenarios.find((s) => s.theme && s.theme === story.theme && s.requiredStructures.length)
    : undefined;
  return byTheme?.requiredStructures ?? [];
}
// ---------- Lesson notes: a finished session's recap, reopened later (Progress → The course, Library → My notes) ----------
// Rebuilt from the blueprint plus the small record kept when the session ended (Progress.courseLog). Sessions
// finished before records were kept still open, just without a date or the items missed.
export type NoteAt = { chapterId: string; n: number; stage?: boolean; exam?: boolean };
// "Do this lesson again": replay a finished session in Today without moving your place in the course.
export const ReplayContext = createContext<((at: NoteAt) => void) | null>(null);
// One-shot hand-offs between views (set just before navigating, read once on mount).
export const pending: { guidedDeck: string | null; pointFocus: string | null; readerId: string | null; notesFocus: NoteAt | null } = { guidedDeck: null, pointFocus: null, readerId: null, notesFocus: null };

// ---------- Café building blocks ----------
/** Progress as filled segments (2026-10-26: the old cross-stitch X marks read as "wrong"): done ones filled,
 *  the current one outlined, the rest a quiet track. The name and props are the cross-stitch ones, so every
 *  caller keeps working; `size` sets the height, and segments are wider when there are fewer of them. */
export function Stitches({ total, done, now = -1, size = 12, label }: { total: number; done: number; now?: number; size?: number; label: string }) {
  const h = Math.max(6, Math.round(size * 0.7));
  const w = total <= 6 ? h * 4 : total <= 10 ? h * 3 : h * 2;
  return (
    <span className="stitches" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`seg${i === now ? " now" : i < done ? " done" : ""}`} style={{ width: w, height: h, borderRadius: h / 2 }} />
      ))}
    </span>
  );
}

/** Keyboard shortcuts for whatever is on screen (desktop): `keys` maps a key ("Space", "h", "Enter"…) to what
 *  it does. Only the most recently mounted handler whose element is visible gets the key, so a screen kept
 *  mounted but hidden (Today behind another tab) never hears it. Typing in a field, a modifier key, or Space /
 *  Enter on a focused button (which press it already) are left alone. */
type ShortcutEntry = { el: () => HTMLElement | null; keys: () => Record<string, (() => void) | undefined> };
const shortcutStack: ShortcutEntry[] = [];
let shortcutListening = false;
function onShortcutKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  const t = e.target as HTMLElement | null;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  const key = e.key === " " ? "Space" : e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if ((key === "Space" || key === "Enter") && t && /^(BUTTON|A|SUMMARY)$/.test(t.tagName)) return;
  for (let i = shortcutStack.length - 1; i >= 0; i--) {
    const entry = shortcutStack[i]!;
    const el = entry.el();
    if (!el || el.offsetParent === null) continue;
    const run = entry.keys()[key];
    if (run) { e.preventDefault(); run(); }
    return;
  }
}
export function useShortcuts(ref: { current: HTMLElement | null }, keys: Record<string, (() => void) | undefined>) {
  const latest = useRef(keys);
  latest.current = keys;
  useEffect(() => {
    const entry: ShortcutEntry = { el: () => ref.current, keys: () => latest.current };
    shortcutStack.push(entry);
    if (!shortcutListening) { window.addEventListener("keydown", onShortcutKey); shortcutListening = true; }
    return () => { const i = shortcutStack.indexOf(entry); if (i >= 0) shortcutStack.splice(i, 1); };
  }, [ref]);
}

const CYRILLIC_RUN = /[Ѐ-ӿ]+(?:[\s,'’-]+[Ѐ-ӿ]+)*/g;
/** English copy with target-language words in it (agenda lines, recaps): each Cyrillic run is tagged with
 *  the pack's lang, so it gets the text face and screen readers read it in the right voice. */
export function MixedText({ text }: { text: string }) {
  const pack = usePack();
  const parts: (string | { mk: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(CYRILLIC_RUN)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push({ mk: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((p, i) => (typeof p === "string" ? p : <span key={i} lang={pack.id}>{p.mk}</span>))}</>;
}

const ICON_PATHS: Record<string, string> = {
  speaker: "M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7",
  mic: "M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0M12 18v3",
  stop: "M7 7h10v10H7z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  close: "M6 6l12 12M18 6L6 18",
  next: "M9 6l6 6-6 6",
  restart: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
  plus: "M12 5v14M5 12h14",
  // the four sections, in the desktop sidebar
  today: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4",
  library: "M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM8 7h7",
  progress: "M5 20V11M12 20V5M19 20v-6",
  partner: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6",
};
/** The app's line icons (no emoji in the interface). Decorative unless the caller labels the button. */
export function Icon({ name, size = 18 }: { name: keyof typeof ICON_PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
/** The round "play this line" button used next to every spoken line. */
/** A speaker button. When its action is a play (it returns the play's promise), it shows the line loading,
 *  and if the line couldn't be played it says so and a tap tries again, rather than doing nothing. */
export function SpeakButton({ onClick, label = "Listen" }: { onClick: () => unknown; label?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  const click = () => {
    const r = onClick();
    if (!(r instanceof Promise)) return;
    setState("idle");
    const slow = setTimeout(() => setState("loading"), 300);
    const settle = (ok: boolean) => { clearTimeout(slow); setState(ok ? "idle" : "failed"); };
    r.then((v) => settle(v !== false), () => settle(false));
  };
  const name = state === "failed" ? "Couldn't play that: tap to try again" : state === "loading" ? `${label} (loading)` : label;
  return <button type="button" className={`play-btn${state === "idle" ? "" : ` ${state}`}`} aria-label={name} title={name} onClick={click}><Icon name={state === "failed" ? "restart" : "speaker"} size={16} /></button>;
}
