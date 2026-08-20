"use client";
// Phase 0-1 UI ported from spike/public/index.html into React, on @ll/core + the ACTIVE language pack.
// The pack is selected by id from the registry (progress.activePackId) and flows through context — the
// UI reads the active pack, never a hardcoded language import. Pure engines (scenario/srs/leveling) run
// client-side; paid calls (tts/asr/feedback/chat) hit the server route handlers that hold the keys.
//
// Navigation is four sections — Today (the guided daily flow) / Library (Situations + Flashcards +
// Reference) / Progress (stats + Flashcards) / Partnered. "Today" sequences one session in a building order:
// warm-up review → new words → new grammar → story → speak. See DESIGN notes for the rationale.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ConjugationSet, DialogueTurn, GlyphLesson, GrammarConcept, InfoGapTask, LanguagePack, MiniStory, ReviewItem, Scenario, SentenceItem, SentenceVariant } from "@ll/pack-schema";
import * as scenario from "@ll/core/scenario";
import * as familiarity from "@ll/core/familiarity";
import type { FamiliarityEntry } from "@ll/core/familiarity";
import * as scoring from "@ll/core/familiarity/scoring";
import * as leveling from "@ll/core/leveling";
import { makeRecorder } from "../lib/recorder";
import * as api from "../lib/api";
import { getPack, DEFAULT_PACK_ID, packList } from "../lib/packs";
import { getStore, emptyProgress, type Progress } from "../lib/store";
import { NEW_WORDS_PER_SESSION, localDay, markStorySeen, storyDone } from "../lib/daily";
import { captureWord, properNounLike, buildLineGlosses, toggleStar } from "../lib/capture";
import * as partner from "@ll/core/partner";
import type { Partnership, VisibilitySettings, ActivityRecord } from "@ll/core/partner";
import { getPartnerStore, subscribeArtifacts, joinPresence, sharedArtifactId, type PartnerStore, type PartnerArtifact, type PublishedState } from "../lib/partner-store";
import { translitOr, romanize } from "../lib/romanize";
import * as roleswap from "@ll/core/roleswap";
import type { RoleSwapSession, RoleSwapTurn } from "@ll/core/roleswap";
import type { SpeakingFeedback } from "@ll/core/speaking";
import * as partnerDiff from "@ll/core/partner/familiarity-diff";
import type { ComplementaryDiff, FamiliarityProjection } from "@ll/core/partner/familiarity-diff";
import * as teachback from "@ll/core/teachback";
import * as complementarySrs from "@ll/core/partner/complementary-srs";
import * as infogap from "@ll/core/infogap";
import type { InfoGapSession } from "@ll/core/infogap";
import * as live from "@ll/core/live";
import type { LiveSession } from "@ll/core/live";
import * as together from "@ll/core/together";
import { currentUser, sendMagicLink, signOut, supabaseConfigured, type AuthUser } from "../lib/supabase";

type Section = "today" | "library" | "progress" | "partnered";
type LibView = "browse" | "flashcards" | "words" | "reference" | "letters" | "scenario" | "grammar" | "reading" | "story" | "write" | "build";

// The active pack flows through context so every view reads the same selected language.
const PackContext = createContext<LanguagePack>(getPack(DEFAULT_PACK_ID));
const usePack = () => useContext(PackContext);
/** Global playback RATE for all spoken audio (1 = normal). The root computes it from settings: 1 when
 *  "normal", else the user's chosen slow rate (settings.slowRate, default 0.75). ONE setting app-wide. */
const SlowContext = createContext(1);
/** Play TTS in the active pack's voice at the global playback rate. The per-call speed arg is now
 *  ignored (rate is a global setting); it stays only for call-site compatibility. */
function usePlay() {
  const pack = usePack();
  const rate = useContext(SlowContext);
  return useCallback((text: string, _speed?: number) => api.playTts(text, rate, pack.id).catch(() => {}), [pack.id, rate]);
}
/** Resolve the effective playback rate from settings — slow on ⇒ the chosen slow rate (default 0.75). */
const effectiveRate = (s?: { slow?: boolean; slowRate?: number }) => (s?.slow ? s.slowRate ?? 0.75 : 1);

// Cosmetic flag per pack id (app-level only — not pack data).
const FLAG: Record<string, string> = { mk: "🇲🇰", bg: "🇧🇬" };

// The script's focus glyphs (unique + false-friends) for any pack.
const focusLetters = (pack: LanguagePack) => pack.alphabet.filter((a) => a.unique || a.falseFriend);

// The SRS review pool for a pack: vocab phrases + grammar drills (tagged with their concept name).
const reviewPool = (pack: LanguagePack): ReviewItem[] => [
  ...pack.vocab,
  ...pack.grammar.flatMap((c) => c.drills.map((d) => ({ ...d, meta: { ...d.meta, concept: c.name } }))),
];

// A pack whose scenarios are all machine-generated + not yet native-reviewed (e.g. Bulgarian). The
// design rule is "never serve unreviewed content as authoritative" — so we surface it in the UI.
const packUnreviewed = (pack: LanguagePack) => pack.scenarios.length > 0 && pack.scenarios.every((s) => s.confidence === "unreviewed");

// ---- familiarity helpers — unify vocab state + SRS in one store keyed by lexKey ----
// An item is due for REVIEW only once the learner has actually MET it (has a familiarity entry) and its
// SRS due date has arrived. A never-seen word is NOT due — it hasn't been introduced yet; the Today
// "new words" step owns introducing it (with audio + meaning), after which capture makes it due and it
// resurfaces here for spaced review. This keeps warm-up/flashcards to words you're learning, not the
// whole pack. (known ⇒ srs null ⇒ not due.)
const isDue = (p: Progress, item: ReviewItem, now: Date): boolean => {
  const e = p.familiarity[familiarity.deriveKeyForItem(item).lexKey];
  return !!e && familiarity.isStudied(e) && !!e.srs && new Date(e.srs.due) <= now;
};
// Grade a review item → next Progress with its familiarity entry rescheduled via the same FSRS engine.
const gradeItem = (p: Progress, item: ReviewItem, ok: boolean): Progress => {
  const spec = familiarity.deriveKeyForItem(item);
  const entry = p.familiarity[spec.lexKey] ?? familiarity.capture(spec);
  return { ...p, familiarity: { ...p.familiarity, [spec.lexKey]: familiarity.grade(entry, ok ? "good" : "again") } };
};
// Visual familiarity status of a reader word (drives the colored tokens).
const wordStatus = (p: Progress, lexKey: string): string => {
  const e = p.familiarity[lexKey];
  return !e ? "new" : e.status === "known" ? "known" : e.status === "ignored" ? "ignored" : "learning";
};

// ---- daily-flow helpers ----
/** Bump the day-streak the first time an activity completes on a new local day (idempotent per day). */
const bumpStreak = (p: Progress): Progress => {
  const today = localDay();
  const s = p.streak ?? { count: 0, lastDay: "" };
  if (s.lastDay === today) return p;
  const yesterday = localDay(new Date(Date.now() - 86400000));
  const count = s.lastDay === yesterday ? s.count + 1 : 1;
  return { ...p, streak: { count, lastDay: today } };
};
// Mark a grammar concept's rule as introduced (so later it's surfaced just-in-time, not re-taught).
const markSeen = (p: Progress, conceptId: string): Progress => ({ ...p, seenGrammar: { ...p.seenGrammar, [conceptId]: true } });
// Capture a batch of pre-taught words into familiarity (the "new words" step before the story). These
// are STUDIED — the learner just worked through them — so they're eligible for review. A word that was
// only exposed before (seeded by an earlier story read) gets promoted to studied here.
const captureWords = (p: Progress, words: { lexKey: string; gloss?: string }[]): Progress => {
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
const seedStoryVocab = (p: Progress, story: MiniStory): Progress => {
  const fam = { ...p.familiarity };
  for (const v of story.registersVocab) {
    if (!fam[v.lexKey]) fam[v.lexKey] = familiarity.capture({ lexKey: v.lexKey, kind: v.lexKey.includes(" ") ? "chunk" : "word", display: v.lexKey, gloss: v.gloss, tags: [familiarity.EXPOSED_TAG] });
  }
  return { ...p, familiarity: fam };
};
// Functional level from progress signals (glyphs known, criteria met, vocab tracked).
const computeLevel = (pack: LanguagePack, progress: Progress) => {
  const glyphsKnown = focusLetters(pack).filter((a) => progress.letters[a.glyph]).length;
  const criteriaMet = Object.values(progress.scenarios).reduce((n, s) => n + s.metCriteria.length, 0);
  const reviewStrength = Object.keys(progress.familiarity).length;
  return leveling.currentLevel({ glyphsKnown, glyphsTotal: focusLetters(pack).length, criteriaMet, reviewStrength });
};

export default function Home() {
  const store = useMemo(() => getStore(), []);
  const [progress, setProgress] = useState<Progress>(emptyProgress());
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<api.Config | null>(null);
  const [section, setSection] = useState<Section>("today");
  const [libView, setLibView] = useState<LibView>("browse");
  const [acctOpen, setAcctOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const pack = useMemo(() => getPack(progress.activePackId), [progress.activePackId]);

  useEffect(() => {
    (async () => {
      const p = await store.load();
      const loadedPack = getPack(p.activePackId);
      // One-time: migrate legacy reviews (itemId→FSRS) into the lexKey-keyed familiarity store.
      if (p.reviews && Object.keys(p.reviews).length && !Object.keys(p.familiarity).length) {
        p.familiarity = familiarity.migrateReviews(p.reviews, reviewPool(loadedPack));
        delete p.reviews;
      }
      if (!p.pick) p.pick = loadedPack.scenarios[0]!.id;
      setProgress(p);
      setReady(true);
      api.getConfig().then(setConfig).catch(() => {});
    })();
  }, [store]);

  // Who's signed in (drives the header account chip). Re-read when the account panel closes, so signing
  // in/out there reflects immediately.
  useEffect(() => { void currentUser().then(setAuthUser).catch(() => {}); }, [acctOpen]);

  const persist = useCallback(
    (next: Progress) => {
      setProgress(next);
      void store.save(next);
    },
    [store],
  );

  // Jump to a section (optionally a Library sub-view + a pre-picked scenario). Used by the Today flow.
  const navigate = useCallback(
    (sec: Section, lv?: LibView, scenarioId?: string) => {
      if (scenarioId) persist({ ...progress, pick: scenarioId });
      if (lv) setLibView(lv);
      setSection(sec);
    },
    [persist, progress],
  );

  // Open a specific mini-story in the Library reader (used by the partner "shared story" deep-link).
  const goToStory = useCallback(
    (storyId: string) => {
      persist({ ...progress, storyPick: storyId });
      setLibView("story");
      setSection("library");
    },
    [persist, progress],
  );

  // ---- derived progress signals ----
  const lettersDone = focusLetters(pack).every((a) => progress.letters[a.glyph]);
  const dueCount = useMemo(() => {
    const now = new Date();
    const pool = reviewPool(pack);
    const poolKeys = new Set(pool.map((it) => familiarity.deriveKeyForItem(it).lexKey));
    const poolDue = pool.filter((it) => isDue(progress, it, now)).length;
    const capturedDue = Object.values(progress.familiarity).filter((e) => familiarity.isStudied(e) && e.srs && new Date(e.srs.due) <= now && (e.kind === "word" || e.kind === "chunk") && !poolKeys.has(e.lexKey) && !properNounLike(e.display, pack)).length;
    return poolDue + capturedDue;
  }, [progress, pack]);
  const level = useMemo(() => computeLevel(pack, progress), [pack, progress]);
  const vocab = useMemo(() => scoring.computeMetrics(progress.familiarity), [progress.familiarity]);

  if (!ready) return <main style={{ padding: 24 }}>Loading…</main>;

  return (
    <PackContext.Provider value={pack}>
      <SlowContext.Provider value={effectiveRate(progress.settings)}>
      <header>
        <h1>{FLAG[pack.id] ?? "🌐"} {pack.name}</h1>
        <span className="muted small">Level {level.cefrBand} · <b style={{ color: "var(--ok)" }}>{vocab.knownWordCount}</b> words known</span>
        <button className="ghost small" style={{ marginLeft: "auto", marginRight: 6 }} title="Playback speed for all spoken audio" onClick={() => persist({ ...progress, settings: { ...progress.settings, slow: !progress.settings?.slow } })}>{progress.settings?.slow ? "🐢 Slow" : "🔊 Normal"}</button>
        <span className="streak-chip" title="Day streak">🔥 {progress.streak?.count ?? 0}</span>
        <button className="streak-chip" style={{ cursor: "pointer" }} title="Account & settings" onClick={() => setAcctOpen(true)}>👤 {authUser && !authUser.isAnonymous && authUser.email ? authUser.email.split("@")[0] : "Account"}</button>
      </header>
      <nav>
        {([
          ["today", "Today"],
          ["library", "Library"],
          ["progress", "Progress"],
          ["partnered", "Partnered"],
        ] as [Section, string][]).map(([s, label]) => (
          <button key={s} className={section === s ? "active" : ""} onClick={() => setSection(s)}>{label}</button>
        ))}
      </nav>
      <main>
        {/* Today stays MOUNTED (just hidden) across tab switches so your place in the session — the
            step index and the once-built plan — survives. Other sections are cheap to remount. */}
        <div style={{ display: section === "today" ? undefined : "none" }}>
          <Today progress={progress} persist={persist} config={config} navigate={navigate} />
        </div>
        {section === "library" && (
          <LibrarySection progress={progress} persist={persist} config={config} lettersDone={lettersDone} mode={libView} setMode={setLibView} />
        )}
        {section === "progress" && (
          <>
            <ProgressDash progress={progress} dueCount={dueCount} />
            <Review progress={progress} persist={persist} />
          </>
        )}
        {section === "partnered" && <PartnerPanel progress={progress} persist={persist} navigateToStory={goToStory} />}
      </main>
      {acctOpen && <AccountPanel progress={progress} persist={persist} config={config} onClose={() => setAcctOpen(false)} />}
      </SlowContext.Provider>
    </PackContext.Provider>
  );
}

// ---- Today "unit" model ----
// A daily session coheres around ONE unit: a story + the scenario that practises it. Stories follow
// the id convention `<scenarioId>-story`; fall back to a shared theme, then required-vocab overlap.
function partnerScenario(pack: LanguagePack, story: MiniStory): Scenario | undefined {
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
function scenarioVocab(pack: LanguagePack, scen: Scenario): { lexKey: string; gloss?: string }[] {
  return scen.requiredVocab
    .map((id) => pack.vocab.find((v) => v.id === id))
    .filter((v): v is ReviewItem => !!v)
    .map((v) => ({ lexKey: familiarity.deriveKeyForItem(v).lexKey, gloss: v.gloss }));
}
// The current unit's story = the first not-yet-done story; once all are done, review the last one.
function currentStory(pack: LanguagePack, progress: Progress): MiniStory | undefined {
  const stories = pack.stories ?? [];
  return stories.find((s) => !storyDone(progress, s)) ?? stories[stories.length - 1];
}
// Free-writing is the GATED unit capstone: it opens only once the unit's vocab is mostly "known" AND its
// grammar has been practised (introduced/drilled, or produced in Build-a-sentence). Until then, producing
// a free sentence is just frustration — see the writing plan.
function writingUnlocked(pack: LanguagePack, progress: Progress, story: MiniStory): boolean {
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
type TodayStep =
  | { kind: "warmup"; items: ReviewItem[]; conjVerb?: ConjugationSet }
  | { kind: "newwords"; words: { lexKey: string; gloss?: string }[] }
  | { kind: "grammar"; concept: GrammarConcept }
  | { kind: "grammarPractice"; concept: GrammarConcept; dayIndex: number }
  | { kind: "story"; story: MiniStory; dayIndex: number }
  | { kind: "speak"; scenario: Scenario }
  | { kind: "build" }
  | { kind: "writing"; prompt: string };

// Rotate an array left by n (n=0 → unchanged). Used to vary which questions/drills lead each day.
const rotate = <T,>(arr: T[], n: number): T[] => (arr.length ? arr.map((_, i) => arr[(i + n) % arr.length]!) : arr);

// Person order for the warm-up conjugation drill.
const PRONOUNS: { key: keyof ConjugationSet["forms"]; en: string; mk: string }[] = [
  { key: "1sg", en: "I", mk: "јас" },
  { key: "2sg", en: "you", mk: "ти" },
  { key: "3sg", en: "he/she", mk: "тој/таа" },
  { key: "1pl", en: "we", mk: "ние" },
  { key: "2pl", en: "you all", mk: "вие" },
  { key: "3pl", en: "they", mk: "тие" },
];
// The daily conjugation drill picks the first verb not yet drilled (marked seen on completion), so a new
// verb comes up each day; once every verb has been seen it cycles.
const pickConjVerb = (pack: LanguagePack, progress: Progress): ConjugationSet | undefined => {
  const all = pack.conjugations ?? [];
  if (!all.length) return undefined;
  const seen = new Set(progress.seenConjugations ?? []);
  return all.find((v) => !seen.has(v.lemma)) ?? all[(progress.seenConjugations?.length ?? 0) % all.length];
};

function Today({ progress, persist, config, navigate }: {
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  navigate: (sec: Section, lv?: LibView, scenarioId?: string) => void;
}) {
  const pack = usePack();
  const lettersDone = focusLetters(pack).every((a) => progress.letters[a.glyph]);
  // The plan is built once per mount (and when letters finish) so steps don't shift under the user mid-session.
  const steps = useMemo<TodayStep[]>(() => {
    const out: TodayStep[] = [];
    const now = new Date();
    // Due studied items, deduped by lexKey — the pool can hold two items for one word (e.g. an authored
    // vocab entry + a generated one both defining "пиво"), which would otherwise surface it twice.
    const seenDue = new Set<string>();
    const due = reviewPool(pack).filter((it) => {
      if (!isDue(progress, it, now)) return false;
      const k = familiarity.deriveKeyForItem(it).lexKey;
      if (seenDue.has(k)) return false;
      seenDue.add(k);
      return true;
    }).slice(0, 6);
    const conjVerb = pickConjVerb(pack, progress);
    if (due.length || conjVerb) out.push({ kind: "warmup", items: due, conjVerb });

    // One coherent unit per session: a story + the scenario that practises it. The unit stays for a few
    // days (UNIT_MIN_DAYS); dayIndex tracks which day we're on so the day-to-day content rotates.
    const story = currentStory(pack, progress);
    const scen = story ? partnerScenario(pack, story) : undefined;
    const dayIndex = story ? (progress.storyReads?.[story.id]?.length ?? 0) : 0;
    const isNewWord = (v: { lexKey: string }) => { const e = progress.familiarity[v.lexKey]; return !e || e.status === "new"; };

    // New words: teach the paired scenario's required vocab FIRST (so the speak step never needs a word
    // we skipped), then fill up to the cap with the story's own new words. The cap never drops a
    // scenario-required word — that promise matters more than the pacing target.
    if (story) {
      const required = (scen ? scenarioVocab(pack, scen) : []).filter(isNewWord);
      const extra = story.registersVocab.filter(isNewWord);
      // A gentle daily trickle of the core single-word vocabulary (Library → Words also lets you pull more
      // on demand). Rotated by day so different words surface, and interleaved with the story's own words
      // so both get represented within the same pacing cap.
      const coreAll = pack.vocab
        .filter((v) => v.kind === "vocab" && !/\s/.test(v.answer.trim()))
        .map((v) => ({ lexKey: familiarity.deriveKeyForItem(v).lexKey, gloss: v.gloss }))
        .filter(isNewWord);
      const rot = coreAll.length ? dayIndex % coreAll.length : 0;
      const core = [...coreAll.slice(rot), ...coreAll.slice(0, rot)];
      const fill: { lexKey: string; gloss?: string }[] = [];
      for (let i = 0; i < Math.max(extra.length, core.length); i++) { if (extra[i]) fill.push(extra[i]!); if (core[i]) fill.push(core[i]!); }
      const merged = new Map<string, { lexKey: string; gloss?: string }>();
      for (const v of [...required, ...fill]) if (!merged.has(v.lexKey)) merged.set(v.lexKey, v);
      const words = [...merged.values()].slice(0, Math.max(NEW_WORDS_PER_SESSION, required.length));
      if (words.length) out.push({ kind: "newwords", words });
    }

    // Grammar stays tied to the unit: it comes from the paired scenario's requiredStructures. Introduce
    // the first structure the learner hasn't seen; once the unit's structures are all seen, PRACTISE one
    // (rotating by day so the drills change). Only if the scenario declares no grammar do we fall back to
    // the global "next unseen concept" — so grammar no longer drifts to an unrelated concept.
    const reqConcepts = (scen?.requiredStructures ?? [])
      .map((id) => pack.grammar.find((c) => c.id === id))
      .filter((c): c is GrammarConcept => !!c);
    const unseenReq = reqConcepts.find((c) => !progress.seenGrammar?.[c.id]);
    if (unseenReq) out.push({ kind: "grammar", concept: unseenReq });
    else if (reqConcepts.length) out.push({ kind: "grammarPractice", concept: reqConcepts[dayIndex % reqConcepts.length]!, dayIndex });
    else {
      const unseen = pack.grammar.find((c) => !progress.seenGrammar?.[c.id]);
      if (unseen) out.push({ kind: "grammar", concept: unseen });
      else if (pack.grammar.length) out.push({ kind: "grammarPractice", concept: pack.grammar[dayIndex % pack.grammar.length]!, dayIndex });
    }

    if (story) out.push({ kind: "story", story, dayIndex });

    // Build-a-sentence (typed/tiled output) — only when the learner has met enough words to build one.
    const canBuild = (pack.sentences ?? []).some((it) => it.supportWords.every((w) => !!progress.familiarity[familiarity.normalize(w)]));
    if (canBuild) out.push({ kind: "build" });

    // Speak: the story's paired scenario (so it uses what was just read); fall back to first-incomplete.
    const speakScen = scen ?? pack.scenarios.find((s) => {
      const p = progress.scenarios[s.id];
      return !p || s.successCriteria.some((c) => !p.metCriteria.includes(c.id));
    }) ?? pack.scenarios[0];
    if (speakScen) out.push({ kind: "speak", scenario: speakScen });

    // Writing capstone (gated): the unit's culminating free-production step, once vocab is known + grammar
    // practised. Prompt = the paired scenario's goal, scoped to what the learner just consolidated.
    if (story && writingUnlocked(pack, progress, story)) {
      out.push({ kind: "writing", prompt: scen?.goal ?? "Write a short line using today\u2019s words." });
    }

    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack]);

  const [phase, setPhase] = useState<"gate" | "flow">(lettersDone ? "flow" : "gate");
  const [idx, setIdx] = useState(0);
  // Once today's session is finished we record the local day (below). On a later reload/reopen that flag
  // survives even though `idx` resets to 0 — so we open on the "done for today" screen instead of
  // marching the learner back through step 1. "Practice more anyway" opts back into the full flow.
  const completedToday = progress.lastSessionDay === localDay();
  const [practiceMore, setPracticeMore] = useState(false);
  // Items missed this session (auto-collected) → offered as an optional recap once the flow is done.
  const [missed, setMissed] = useState<ReviewItem[]>([]);
  const [recap, setRecap] = useState<"offer" | "review" | "done">("offer");
  const flag = useCallback((item: ReviewItem) => setMissed((m) => (m.some((x) => x.id === item.id) ? m : [...m, item])), []);
  // Missed new words / spoken lines aren't pack ReviewItems — turn them into recall cards (reusing the
  // real vocab item when one matches, so its transliteration and audio come along).
  const flagWord = (w: { lexKey: string; gloss?: string }) => {
    const v = pack.vocab.find((x) => familiarity.deriveKeyForItem(x).lexKey === w.lexKey);
    flag(v ?? { id: `nw-${w.lexKey}`, kind: "vocab", prompt: w.gloss ?? w.lexKey, answer: w.lexKey, gloss: w.gloss ?? w.lexKey, i1Level: 0, tags: [] });
  };
  const flagTurn = (t: DialogueTurn) => flag({ id: `sp-${t.text}`, kind: "phrase", prompt: t.gloss ?? t.text, answer: t.text, translit: t.translit, gloss: t.gloss ?? t.text, i1Level: 0, tags: [] });
  // Today now stays mounted across tab switches (so idx/phase survive). If the letters get finished
  // elsewhere while it's mounted, open the flow rather than leaving the alphabet gate up.
  useEffect(() => { if (lettersDone) setPhase("flow"); }, [lettersDone]);
  // Reaching the end of the plan = today's session is done. Stamp the local day (once) so a reload opens
  // on the "done for today" screen. Guarded by the date check so this persists at most once per day.
  useEffect(() => {
    if (steps.length > 0 && idx >= steps.length && progress.lastSessionDay !== localDay()) {
      persist({ ...progress, lastSessionDay: localDay() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, steps.length]);
  const est = Math.max(5, steps.length * 3);
  // Advance to the next step, persisting a single merged Progress and counting the day toward the streak.
  const done = (mutated: Progress = progress) => {
    persist(bumpStreak(mutated));
    setIdx((i) => i + 1);
  };

  // The alphabet gate runs INLINE inside Today — the whole session is self-contained, no jump to the Library.
  if (phase === "gate")
    return (
      <section className="view">
        <TodayHeader streak={progress.streak?.count ?? 0} />
        <p className="lead">First, the alphabet. Macedonian uses Cyrillic — review all {pack.alphabet.length} letters (I&apos;ll quiz you on the {focusLetters(pack).length} trickiest), then today&apos;s session opens up right here.</p>
        <Letters progress={progress} persist={persist} onDone={() => setPhase("flow")} />
      </section>
    );
  // Already finished today's session (and this is a fresh mount, so idx is back at 0): show the wrap-up
  // screen rather than replaying step 1. "Practice more anyway" drops back into the full flow on demand.
  if (completedToday && !practiceMore && idx < steps.length)
    return (
      <section className="view">
        <TodayHeader streak={progress.streak?.count ?? 0} />
        <h3 style={{ marginTop: 4 }}>Done for today 🎉</h3>
        <p className="lead">You&apos;ve finished today&apos;s session.{(progress.streak?.count ?? 0) > 0 ? ` ${progress.streak?.count}-day streak — come back tomorrow to keep it going.` : " Come back tomorrow for the next one."}</p>
        <div className="row" style={{ marginTop: 4 }}>
          <button className="btn" onClick={() => { setIdx(0); setPracticeMore(true); }}>Practice more anyway →</button>
          <button className="ghost small" onClick={() => navigate("library", "flashcards")}>Flashcards</button>
          <button className="ghost small" onClick={() => navigate("progress")}>Your progress</button>
        </div>
      </section>
    );
  if (steps.length === 0)
    return (
      <section className="view">
        <TodayHeader streak={progress.streak?.count ?? 0} />
        <p className="lead">You&apos;re all caught up for today. 🎉 Come back tomorrow — or dip into the Library for extra practice whenever you like.</p>
        <button className="ghost small" onClick={() => navigate("library", "browse")}>Browse the Library</button>
      </section>
    );
  if (idx >= steps.length) {
    // Offer a quick recap of anything you slipped on before wrapping up — retry it, or skip.
    if (missed.length > 0 && recap === "offer")
      return (
        <section className="view">
          <TodayHeader streak={progress.streak?.count ?? 0} />
          <h3 style={{ marginTop: 4 }}>Session complete 🎉</h3>
          <p className="lead">Nice work — you finished today&apos;s session.</p>
          <div className="fb" style={{ marginTop: 4 }}>
            <div className="muted small" style={{ marginBottom: 6 }}>You slipped on {missed.length} item{missed.length > 1 ? "s" : ""} this session:</div>
            <ul style={{ margin: "0 0 4px", paddingLeft: 18 }}>
              {missed.map((m) => <li key={m.id}><b className="target">{m.answer}</b> <span className="muted small">— {m.gloss}</span></li>)}
            </ul>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => setRecap("review")}>Review {missed.length} missed item{missed.length > 1 ? "s" : ""} →</button>
              <button className="ghost" onClick={() => setRecap("done")}>Skip for now</button>
            </div>
          </div>
        </section>
      );
    if (missed.length > 0 && recap === "review")
      return (
        <section className="view">
          <TodayHeader streak={progress.streak?.count ?? 0} />
          <h3 style={{ marginTop: 4 }}>One more pass</h3>
          <p className="lead">Redo the ones you slipped on — <b>Good</b> clears a card, <b>Again</b> sends it to the back.</p>
          <SessionRecap items={missed} onDone={() => setRecap("done")} />
        </section>
      );
    return (
      <section className="view">
        <TodayHeader streak={progress.streak?.count ?? 0} />
        <h3 style={{ marginTop: 4 }}>Session complete 🎉</h3>
        <p className="lead">Nice work — you finished today&apos;s session.{(progress.streak?.count ?? 0) > 0 ? ` ${progress.streak?.count}-day streak — come back tomorrow to keep it going.` : ""}</p>
        <div className="row" style={{ marginTop: 4 }}>
          <button className="ghost small" onClick={() => navigate("progress")}>See your progress</button>
          <button className="ghost small" onClick={() => navigate("library", "flashcards")}>Flashcards in the Library</button>
        </div>
      </section>
    );
  }

  const step = steps[idx]!;
  return (
    <section className="view">
      <TodayHeader streak={progress.streak?.count ?? 0} />
      <div className="pbar"><div style={{ width: `${(idx / steps.length) * 100}%` }} /></div>
      <div className="muted small" style={{ marginBottom: 14 }}>Step {idx + 1} of {steps.length} · ~{est} min</div>

      <div key={idx}>
        {step.kind === "warmup" && (
          <WarmupSession
            key={idx}
            items={step.items}
            conjVerb={step.conjVerb}
            progress={progress}
            persist={persist}
            onMiss={flag}
            onComplete={(results) => {
              let p = progress;
              for (const r of results) p = gradeItem(p, r.item, r.ok);
              done(p);
            }}
          />
        )}

        {step.kind === "newwords" && (
          <div>
            <Tag>New words · {step.words.length}</Tag>
            <NewWordsCard
              words={step.words}
              onDone={() => done(captureWords(progress, step.words))}
              onMiss={flagWord}
              isStarred={(w) => { const e = progress.familiarity[w.lexKey]; return !!e && familiarity.isStarred(e); }}
              onStar={(w) => toggleStar(progress, persist, w.lexKey, { gloss: w.gloss })}
            />
          </div>
        )}

        {step.kind === "grammar" && (
          <div>
            <Tag>New grammar</Tag>
            <GrammarIntroCard
              concept={step.concept}
              onDone={(ok) => {
                if (!ok && step.concept.drills[0]) flag(step.concept.drills[0]!);
                const base = step.concept.drills[0] ? gradeItem(progress, step.concept.drills[0]!, ok) : progress;
                done(markSeen(base, step.concept.id));
              }}
            />
          </div>
        )}

        {step.kind === "grammarPractice" && (
          <div>
            <Tag>Grammar practice</Tag>
            <GrammarPracticeCard concept={step.concept} dayIndex={step.dayIndex} onDone={() => done()} />
          </div>
        )}

        {step.kind === "story" && (
          <div>
            <Tag>Read the story</Tag>
            <TodayStoryStep
              story={step.story}
              dayIndex={step.dayIndex}
              progress={progress}
              persist={persist}
              config={config}
              onDone={() => done(markStorySeen(seedStoryVocab(progress, step.story), step.story.id))}
            />
          </div>
        )}

        {step.kind === "build" && (
          <div>
            <Tag>Build a sentence</Tag>
            <SentenceBuilder progress={progress} persist={persist} onDone={() => done()} />
          </div>
        )}

        {step.kind === "writing" && (
          <div>
            <Tag>Write it — unit capstone</Tag>
            <WritingCapstone prompt={step.prompt} config={config} onDone={() => done()} />
          </div>
        )}

        {step.kind === "speak" && (
          <div>
            <Tag>Speak · {step.scenario.title}</Tag>
            <p className="muted small">{step.scenario.goal} — use what you just read, out loud.</p>
            <ScenarioView progress={progress} persist={persist} config={config} lettersDone scenarioId={step.scenario.id} hidePicker bare askable onComplete={() => done()} onMiss={flagTurn} />
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="ghost small" onClick={() => done()}>Skip this step →</button>
      </div>
    </section>
  );
}

// End-of-lesson recap: re-drill exactly the items missed this session. "Good" clears a card; "Again"
// sends it to the back — so the ones you're still shaky on loop until cleared (the same requeue idea
// as the alphabet quiz). Pure re-exposure: it doesn't touch SRS (the original misses already did).
function SessionRecap({ items, onDone }: { items: ReviewItem[]; onDone: () => void }) {
  const [queue, setQueue] = useState<ReviewItem[]>(() => items);
  const [n, setN] = useState(0);
  const current = queue[0];
  useEffect(() => { if (!current) onDone(); }, [current, onDone]);
  if (!current) return null;
  const grade = (ok: boolean) => { setQueue((q) => (ok ? q.slice(1) : [...q.slice(1), q[0]!])); setN((x) => x + 1); };
  return (
    <div>
      <Tag>Review misses · {queue.length} to clear</Tag>
      {current.kind === "grammar"
        ? <GrammarCard key={`${current.id}-${n}`} item={current} onGrade={grade} />
        : <PhraseCard key={`${current.id}-${n}`} item={current} onGrade={grade} />}
    </div>
  );
}

// ---------- Warm-up: an engaging, adaptive review opener ----------
// Instead of a flat stack of flip-cards, the warm-up blends formats by how well a word is known:
//  • a MATCHING GAME (tap-to-pair, audio + recognition) for studied-but-not-yet-cemented words,
//  • in-CONTEXT cloze for words captured while reading (we have the sentence they were met in),
//  • plain RECALL for mature words with no saved context, and
//  • the usual grammar multiple-choice for grammar drills.
// Every item is graded exactly once; results are handed back in a single batch so the caller reschedules
// SRS + advances in one step. Recognition-before-recall keeps a shaky word from being a cold wall.
type WarmResult = { item: ReviewItem; ok: boolean };

// A quick tap-to-match game: tap a word (hear it), then tap its meaning. Pairs matched on the first try
// grade "good"; a wrong attempt first marks that word "again". Lighter + more fun than recalling each cold.
function MatchGame({ pairs, onDone, lead }: { pairs: { item: ReviewItem; target: string; gloss: string }[]; onDone: (results: WarmResult[]) => void; lead?: string }) {
  const play = usePlay();
  // Each column shows the same pairs in an independent shuffle; buttons carry the pair index.
  const leftOrder = useMemo(() => shuffle(pairs.map((_, i) => i)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const rightOrder = useMemo(() => shuffle(pairs.map((_, i) => i)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [sel, setSel] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [missed, setMissed] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<number | null>(null);
  const pickTarget = (i: number) => { if (matched.has(i)) return; setSel(i); play(pairs[i]!.target, 0.8); };
  const pickGloss = (i: number) => {
    if (matched.has(i) || sel === null) return;
    if (i === sel) {
      const next = new Set(matched); next.add(i); setMatched(next); setSel(null);
      if (next.size === pairs.length) onDone(pairs.map((p, j) => ({ item: p.item, ok: !missed.has(j) })));
    } else {
      setMissed((m) => new Set(m).add(sel));
      setWrong(i);
      setTimeout(() => setWrong((w) => (w === i ? null : w)), 450);
    }
  };
  return (
    <div className="fb">
      <p className="lead" style={{ marginTop: 0 }}>{lead ?? "Match each word to its meaning — tap a word to hear it, then tap what it means."}</p>
      <div className="match-grid">
        <div className="match-col">
          {leftOrder.map((i) => (
            <button key={i} className={`opt${matched.has(i) ? " right matched" : sel === i ? " sel" : ""}`} disabled={matched.has(i)} onClick={() => pickTarget(i)}>{pairs[i]!.target}</button>
          ))}
        </div>
        <div className="match-col">
          {rightOrder.map((i) => (
            <button key={i} className={`opt${matched.has(i) ? " right matched" : wrong === i ? " wrong" : ""}`} disabled={matched.has(i)} onClick={() => pickGloss(i)}>{pairs[i]!.gloss}</button>
          ))}
        </div>
      </div>
      <div className="muted small" style={{ marginTop: 10 }}>{matched.size}/{pairs.length} matched</div>
    </div>
  );
}

type WarmCard = { item: ReviewItem; format: "cloze" | "recall" | "grammar"; entry?: FamiliarityEntry; context?: string; contextGloss?: string };
type WarmStep = { kind: "match"; pairs: { item: ReviewItem; target: string; gloss: string }[] } | { kind: "card"; card: WarmCard } | { kind: "conjugation"; verb: ConjugationSet };

function WarmupSession({ items, conjVerb, progress, persist, onComplete, onMiss }: {
  items: ReviewItem[];
  conjVerb?: ConjugationSet;
  progress: Progress;
  persist: (p: Progress) => void;
  onComplete: (results: WarmResult[]) => void;
  onMiss: (item: ReviewItem) => void;
}) {
  const pack = usePack();
  // For back-translating a stored sentence when its English wasn't saved (parity with the Library flashcards).
  const lineGlosses = useMemo(() => buildLineGlosses(pack), [pack]);
  // Route each due item to the format that best fits how well it's known (built once, at mount).
  const plan = useMemo<WarmStep[]>(() => {
    const matchPairs: { item: ReviewItem; target: string; gloss: string }[] = [];
    const cards: WarmCard[] = [];
    for (const it of items) {
      if (it.kind === "grammar") { cards.push({ item: it, format: "grammar" }); continue; }
      const spec = familiarity.deriveKeyForItem(it);
      const entry = progress.familiarity[spec.lexKey];
      const context = progress.contexts?.[spec.lexKey];
      // The sentence's English — stored, else back-translated from the pack line. A cloze NEEDS this
      // (a blank with no translation is unsolvable), so a sentence we can't translate isn't clozed.
      const contextGloss = context ? (progress.contextGlosses?.[spec.lexKey] ?? lineGlosses.get(context.trim())) : undefined;
      const reps = entry?.srs?.card?.reps ?? 0;
      // A saved, translatable sentence ⇒ review the word IN CONTEXT (cloze). Otherwise young words go to
      // the match game (recognition), and words drilled a few times get a plain recall card.
      if (context && contextGloss) cards.push({ item: it, format: "cloze", entry, context, contextGloss });
      else if (reps >= 2) cards.push({ item: it, format: "recall" });
      else matchPairs.push({ item: it, target: it.answer, gloss: it.gloss || spec.gloss || it.answer });
    }
    // A one-word "match" is silly — turn a lone match candidate into a recall card instead.
    if (matchPairs.length === 1) { cards.unshift({ item: matchPairs[0]!.item, format: "recall" }); matchPairs.length = 0; }
    const steps: WarmStep[] = [];
    if (conjVerb) steps.push({ kind: "conjugation", verb: conjVerb });
    if (matchPairs.length >= 2) steps.push({ kind: "match", pairs: matchPairs });
    for (const c of cards) steps.push({ kind: "card", card: c });
    return steps;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [stepIdx, setStepIdx] = useState(0);
  const [extra, setExtra] = useState<WarmStep[]>([]); // cards re-queued after "Again", to try again this session
  const allSteps = [...plan, ...extra];
  const results = useRef<WarmResult[]>([]);
  const doneRef = useRef(false);
  const record = (rs: WarmResult[]) => { for (const r of rs) { results.current.push(r); if (!r.ok) onMiss(r.item); } };
  // Fire onComplete exactly once — when we run past the last step (or immediately if the plan is empty).
  useEffect(() => {
    if (doneRef.current) return;
    if (stepIdx >= allSteps.length) { doneRef.current = true; onComplete(results.current); }
  }, [stepIdx, allSteps.length, onComplete]);

  const step = allSteps[stepIdx];
  if (!step) return null;
  const advance = () => setStepIdx((s) => s + 1);
  return (
    <div>
      <Tag>Warm up · {stepIdx + 1} of {allSteps.length}</Tag>
      {step.kind === "conjugation" ? (
        <MatchGame
          key={stepIdx}
          lead={`Match each pronoun to the right form of “${step.verb.gloss}” (${step.verb.lemma}).`}
          pairs={PRONOUNS.map((pr) => ({ item: { id: `conj-${step.verb.lemma}-${pr.key}`, kind: "vocab", prompt: pr.en, answer: step.verb.forms[pr.key], gloss: `${pr.en} · ${pr.mk}`, i1Level: 0, tags: [] }, target: step.verb.forms[pr.key], gloss: `${pr.en} · ${pr.mk}` }))}
          onDone={() => { persist({ ...progress, seenConjugations: [...(progress.seenConjugations ?? []), step.verb.lemma] }); advance(); }}
        />
      ) : step.kind === "match" ? (
        <MatchGame key={stepIdx} pairs={step.pairs} onDone={(rs) => { record(rs); advance(); }} />
      ) : (() => {
        const c = step.card;
        // "Again" (ok=false) re-queues the card to the end so you see it again this session instead of
        // just skipping ahead; "Good" advances.
        const grade = (ok: boolean) => { record([{ item: c.item, ok }]); if (!ok) setExtra((e) => [...e, { kind: "card", card: c }]); advance(); };
        if (c.format === "grammar") return <GrammarCard key={stepIdx} item={c.item} onGrade={grade} />;
        if (c.format === "cloze" && c.entry) return <ClozeCard key={stepIdx} entry={c.entry} context={c.context} contextGloss={c.contextGloss} onGrade={grade} />;
        return <PhraseCard key={stepIdx} item={c.item} onGrade={grade} />;
      })()}
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <div className="muted small" style={{ marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>;
}

function TodayHeader({ streak }: { streak: number }) {
  return (
    <div className="today-head">
      <div>
        <h2 style={{ marginBottom: 2 }}>Today</h2>
        <span className="muted small">your guided session</span>
      </div>
      <span className="streak-chip" title="Day streak">🔥 {streak} day{streak === 1 ? "" : "s"}</span>
    </div>
  );
}

const FALLBACK_GLOSSES = ["hello", "thank you", "please", "yes", "good", "water"];

// Pre-teach the story's new words interactively: hear each, tap its meaning (multiple choice), then
// they're captured. Engages instead of just listing.
function NewWordsCard({ words, onDone, onMiss, onStar, isStarred }: { words: { lexKey: string; gloss?: string }[]; onDone: () => void; onMiss?: (word: { lexKey: string; gloss?: string }) => void; onStar?: (word: { lexKey: string; gloss?: string }) => void; isStarred?: (word: { lexKey: string; gloss?: string }) => boolean }) {
  const play = usePlay();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const word = words[i];
  const correct = word?.gloss ?? word?.lexKey ?? "";
  const options = useMemo(() => {
    if (!word) return [] as string[];
    const others = words.filter((_, j) => j !== i).map((w) => w.gloss).filter((g): g is string => !!g && g !== correct);
    let distract = shuffle(others).slice(0, 2);
    if (distract.length < 2) distract = [...distract, ...FALLBACK_GLOSSES.filter((g) => g !== correct)].slice(0, 2);
    return shuffle([correct, ...distract]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  if (!word) return null;
  const last = i + 1 >= words.length;
  const advance = () => { if (last) onDone(); else { setI(i + 1); setPicked(null); } };
  return (
    <div>
      <p className="lead">New words for today&apos;s story — hear each, then tap its meaning. <span className="muted small">({i + 1}/{words.length})</span></p>
      <div className="fb">
        <div className="row" style={{ alignItems: "center" }}>
          <button className="spk" onClick={() => play(word.lexKey, 0.8)}>🔊</button>
          <b className="target" style={{ fontSize: 26 }}>{word.lexKey}</b>
          {onStar && <button className={`ghost small${isStarred?.(word) ? " active" : ""}`} style={{ marginLeft: "auto" }} title="Save to your flashcard deck" onClick={() => onStar(word)}>{isStarred?.(word) ? "★ Saved" : "☆ Save"}</button>}
        </div>
        <div className="muted small" style={{ margin: "10px 0 6px" }}>Tap the meaning</div>
        <div>
          {options.map((o) => {
            const cls = picked ? (o === correct ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt";
            return <button className={cls} key={o} disabled={!!picked} onClick={() => { setPicked(o); if (o !== correct) onMiss?.(word); }}>{o}</button>;
          })}
        </div>
        {picked && (
          <div className="why">
            {picked === correct ? "✓ " : "✗ "}{word.lexKey} = {correct}
            <button className="btn" style={{ marginLeft: 8 }} onClick={advance}>{last ? "Add these & continue →" : "Next →"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Split an example line "<target> — <English>" into its two halves (audio plays the target half).
function splitExample(s: string): { mk: string; en: string } {
  const i = s.indexOf(" — ");
  return i === -1 ? { mk: s, en: "" } : { mk: s.slice(0, i), en: s.slice(i + 3) };
}

// Shared, accessible rendering of a grammar concept: a plain-English hook, an at-a-glance pattern
// table (the changing part spotlighted), the when/why note, and tappable examples with audio. Used by
// the daily intro card, the reference, and the inline scenario notes (compact ⇒ skip the table).
function GrammarExplainer({ concept, compact }: { concept: GrammarConcept; compact?: boolean }) {
  const play = usePlay();
  const { plain, pattern, explanation, examples } = concept;
  return (
    <>
      {plain && (
        <div className="gram-plain">
          <span className="lab">In plain English</span>
          <p>{plain}</p>
        </div>
      )}
      {!compact && pattern && (
        <table className="gram-table">
          <thead>
            <tr>{pattern.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {pattern.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>{ci === pattern.spotlightCol ? <span className="gram-spot">{cell}</span> : cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {explanation && <p className="gram-when">{!compact && <b>When &amp; why:&nbsp;</b>}<span>{explanation}</span></p>}
      {examples.length > 0 && (
        <div className="gram-ex-list">
          {examples.map((ex, i) => {
            const { mk, en } = splitExample(ex);
            return (
              <div className="gram-ex" key={i}>
                <button className="gram-play" onClick={() => play(mk)} aria-label={`Play ${mk}`}>▶</button>
                <span className="mk">{mk}</span>
                {en && <span className="en">{en}</span>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// First-encounter grammar: the explainer (rule made legible) + up to 3 quick checks. The first check
// still gates "Continue" and reports its result (grading semantics unchanged); the rest are practice.
function GrammarIntroCard({ concept, onDone, dayIndex = 0 }: { concept: GrammarConcept; onDone: (ok: boolean) => void; dayIndex?: number }) {
  const drills = rotate(concept.drills, dayIndex).slice(0, 3);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const firstId = drills[0]?.id;
  const answeredFirst = firstId === undefined || firstId in answers;
  return (
    <div className="fb">
      <div className="gram-kicker">New grammar</div>
      <div className="gram-title">{concept.name}</div>
      {concept.technicalName && <div className="gram-tech">{concept.technicalName}</div>}
      <GrammarExplainer concept={concept} />
      {drills.length > 0 && (
        <div className="gram-checks">
          <div className="muted small" style={{ marginBottom: 6 }}>{drills.length > 1 ? "Quick checks" : "Quick check"}</div>
          {drills.map((d) => <Drill key={d.id} drill={d} onGrade={(ok) => setAnswers((a) => ({ ...a, [d.id]: ok }))} />)}
        </div>
      )}
      {answeredFirst && (
        <button className="btn" style={{ marginTop: 14 }} onClick={() => onDone(firstId === undefined ? true : !!answers[firstId])}>Continue →</button>
      )}
    </div>
  );
}

// A concept is "matchable" into pairs if its pattern has ≥2 rows with DISTINCT left cells (each left
// maps to exactly one right). Clitics — whose rows repeat "ми (to me)" — fail this and fall back to drills.
function isMatchable(concept: GrammarConcept): boolean {
  const p = concept.pattern;
  if (!p || p.rows.length < 2) return false;
  const lefts = p.rows.map((r) => r[0]);
  return new Set(lefts).size === lefts.length && p.rows.every((r) => r.length >= 2);
}

// Matching game: pair each row's first cell with its spotlight cell (noun↔article, impf↔pf, …). Tap a
// chip, then its partner; correct pairs lock green, wrong ones flash. Driven entirely by the lesson's
// pattern table — no new content, and it works for any future matchable lesson.
function GrammarMatch({ concept, onDone }: { concept: GrammarConcept; onDone: () => void }) {
  const pattern = concept.pattern!;
  const bCol = pattern.spotlightCol && pattern.spotlightCol > 0 ? pattern.spotlightCol : 1;
  const rows = pattern.rows.slice(0, 6);
  const rights = useMemo(() => shuffle(rows.map((r, i) => ({ id: i, text: r[bCol]! }))), [concept.id]);
  const [pick, setPick] = useState<{ side: "L" | "R"; id: number } | null>(null);
  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [wrong, setWrong] = useState<{ side: "L" | "R"; id: number } | null>(null);
  const allDone = matched.size === rows.length;

  const tap = (side: "L" | "R", id: number) => {
    if (matched.has(id)) return;
    if (!pick || pick.side === side) { setPick({ side, id }); setWrong(null); return; }
    if (pick.id === id) { setMatched((m) => new Set(m).add(id)); setPick(null); }
    else { setWrong({ side, id }); setPick(null); setTimeout(() => setWrong(null), 600); }
  };
  const cls = (side: "L" | "R", id: number) =>
    matched.has(id) ? "matchchip done"
      : pick && pick.side === side && pick.id === id ? "matchchip sel"
        : wrong && wrong.side === side && wrong.id === id ? "matchchip bad"
          : "matchchip";

  return (
    <div style={{ marginTop: 8 }}>
      <div className="muted small" style={{ marginBottom: 8 }}>Match each pair — tap one, then its partner.</div>
      <div className="matchgrid">
        <div className="matchcol">
          {rows.map((r, i) => <button key={i} className={cls("L", i)} disabled={matched.has(i)} onClick={() => tap("L", i)}>{r[0]}</button>)}
        </div>
        <div className="matchcol">
          {rights.map((r) => <button key={r.id} className={cls("R", r.id)} disabled={matched.has(r.id)} onClick={() => tap("R", r.id)}>{r.text}</button>)}
        </div>
      </div>
      {allDone && (
        <div className="why" style={{ marginTop: 12 }}>✓ All matched — nice.
          <button className="btn" style={{ marginLeft: 8 }} onClick={onDone}>Continue →</button>
        </div>
      )}
    </div>
  );
}

// Fallback practice for non-matchable concepts (e.g. clitics): a couple of multiple-choice drills,
// rotated by day so a repeated unit shows different checks.
function GrammarDrillPractice({ concept, onDone, dayIndex = 0 }: { concept: GrammarConcept; onDone: () => void; dayIndex?: number }) {
  const drills = rotate(concept.drills, dayIndex).slice(0, 2);
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const firstId = drills[0]?.id;
  const ready = firstId === undefined || firstId in answered;
  return (
    <div style={{ marginTop: 8 }}>
      {drills.map((d) => <Drill key={d.id} drill={d} onGrade={(ok) => setAnswered((a) => ({ ...a, [d.id]: ok }))} />)}
      {ready && <button className="btn" style={{ marginTop: 12 }} onClick={onDone}>Continue →</button>}
    </div>
  );
}

// Recurring grammar PRACTICE (after a concept's been introduced): a brief rule reminder + an exercise
// — matching where it fits, else drills. The full rule (table + examples) is one tap away if stuck.
function GrammarPracticeCard({ concept, onDone, dayIndex = 0 }: { concept: GrammarConcept; onDone: () => void; dayIndex?: number }) {
  const [showRule, setShowRule] = useState(false);
  return (
    <div className="fb">
      <div className="gram-kicker">Grammar practice</div>
      <div className="gram-title">{concept.name}</div>
      {concept.plain && <p className="muted small" style={{ margin: "4px 0 0" }}>{concept.plain}</p>}
      <button className="ghost small" style={{ marginTop: 10 }} onClick={() => setShowRule((v) => !v)}>{showRule ? "Hide the rule" : "Show the rule"}</button>
      {showRule && <div style={{ marginTop: 8 }}><GrammarExplainer concept={concept} /></div>}
      {isMatchable(concept)
        ? <GrammarMatch concept={concept} onDone={onDone} />
        : <GrammarDrillPractice concept={concept} onDone={onDone} dayIndex={dayIndex} />}
    </div>
  );
}

// ---------- Library: browse content by difficulty, plus the alphabet/grammar/writing tools ----------
function difficultyChip(familiarPct: number): { label: string; cls: string } {
  if (familiarPct >= 0.9) return { label: "easy review", cls: "easy" };
  if (familiarPct >= 0.55) return { label: "just right", cls: "just" };
  if (familiarPct >= 0.3) return { label: "a stretch", cls: "stretch" };
  return { label: "challenging", cls: "hard" };
}

// Coverage of a text for this learner: knownPct (status known/ignored) for honest display, plus a
// familiarPct that also counts learning words at half weight — used to rank + label by i+1 fit.
function coverageOf(text: string, fam: Progress["familiarity"]): { knownPct: number; familiarPct: number } {
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

function LibrarySection({ progress, persist, config, lettersDone, mode, setMode }: {
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  lettersDone: boolean;
  mode: LibView;
  setMode: (m: LibView) => void;
}) {
  const pack = usePack();

  // All graded content (scenarios + stories + readers) scored by i+1 fit for this learner.
  const items = useMemo(() => {
    const raw = [
      ...pack.scenarios.map((s) => ({ kind: "scenario" as const, id: s.id, title: s.title, sub: s.setting, theme: s.theme, text: s.script.map((t) => t.text).join(" "), unreviewed: s.confidence === "unreviewed" })),
      ...(pack.stories ?? []).map((st) => ({ kind: "story" as const, id: st.id, title: st.title, sub: st.titleGloss ?? st.level, theme: st.theme, text: st.body.map((b) => b.text).join(" "), unreviewed: st.confidence === "unreviewed" })),
      ...pack.readers.map((r) => ({ kind: "reading" as const, id: r.id, title: r.title, sub: r.titleGloss ?? "graded reader", theme: r.theme, text: r.body.map((b) => b.text).join(" "), unreviewed: r.confidence === "unreviewed" })),
    ];
    return raw
      .map((it) => { const c = coverageOf(it.text, progress.familiarity); return { ...it, knownPct: c.knownPct, familiarPct: c.familiarPct, fit: scoring.iPlusOneCurve(c.familiarPct), chip: difficultyChip(c.familiarPct) }; })
      .sort((a, b) => b.fit - a.fit || b.familiarPct - a.familiarPct || ["story", "reading", "scenario"].indexOf(a.kind) - ["story", "reading", "scenario"].indexOf(b.kind));
  }, [pack, progress.familiarity]);

  // Situational collections (themeless content under "More practice"); collections ordered by their
  // most-accessible item so the best-fit situation leads.
  const collections = useMemo(() => {
    const groups = new Map<string, typeof items>();
    for (const it of items) {
      const theme = it.theme || "More practice";
      const arr = groups.get(theme);
      if (arr) arr.push(it); else groups.set(theme, [it]);
    }
    return [...groups.entries()].sort((a, b) => Math.max(...b[1].map((x) => x.fit)) - Math.max(...a[1].map((x) => x.fit)) || a[0].localeCompare(b[0]));
  }, [items]);

  const open = (kind: LibView, id?: string) => {
    if (kind === "scenario" && id) persist({ ...progress, pick: id });
    else if (kind === "story" && id) persist({ ...progress, storyPick: id });
    setMode(kind);
  };

  // The alphabet is a browsable reference that renders its OWN inline back-header (next to the title),
  // so it opts out of the shared floating back-row below — which is what read as "misplaced".
  if (mode === "letters")
    return <Letters progress={progress} persist={persist} reference onBack={() => setMode("reference")} onDone={() => setMode("reference")} />;

  // An opened content item or reference tool → show it with a back link to where it came from.
  if (mode !== "browse" && mode !== "reference" && mode !== "flashcards" && mode !== "words") {
    const isTool = mode === "grammar" || mode === "write" || mode === "build";
    const view =
      mode === "scenario" ? <ScenarioView progress={progress} persist={persist} config={config} lettersDone={lettersDone} /> :
      mode === "story" ? <StoryView progress={progress} persist={persist} config={config} /> :
      mode === "reading" ? <Reading progress={progress} persist={persist} config={config} /> :
      mode === "grammar" ? <Grammar progress={progress} persist={persist} /> :
      mode === "build" ? <SentenceBuilder progress={progress} persist={persist} /> :
      <Writing config={config} />;
    return (
      <>
        <div className="row" style={{ marginBottom: 10 }}><button className="ghost small" onClick={() => setMode(isTool ? "reference" : "browse")}>← {isTool ? "Reference" : "Library"}</button></div>
        {view}
      </>
    );
  }

  const typeLabel: Record<string, string> = { scenario: "🗣 Scenario", story: "★ Story", reading: "📖 Reading" };

  return (
    <section className="view">
      <h2>Library</h2>
      <div className="picker" style={{ margin: "2px 0 14px" }}>
        <button className={mode === "browse" ? "active" : ""} onClick={() => setMode("browse")}>Situations</button>
        <button className={mode === "words" ? "active" : ""} onClick={() => setMode("words")}>Words</button>
        <button className={mode === "flashcards" ? "active" : ""} onClick={() => setMode("flashcards")}>Flashcards</button>
        <button className={mode === "reference" ? "active" : ""} onClick={() => setMode("reference")}>Reference</button>
      </div>

      {mode === "words" ? (
        <Words progress={progress} persist={persist} />
      ) : mode === "flashcards" ? (
        <Review progress={progress} persist={persist} />
      ) : mode === "reference" ? (
        <>
          <p className="lead">Tools to look things up and practise — kept separate from your situational content.</p>
          <div className="cards">
            <button className="contentcard" onClick={() => setMode("letters")}>
              <div className="cc-top"><span className="cc-type">🔤 Alphabet</span>{lettersDone && <span className="diff just">done</span>}</div>
              <div className="cc-title">The alphabet</div>
              <div className="muted small">All {pack.alphabet.length} Cyrillic letters — browse, hear, and quiz</div>
            </button>
            <button className="contentcard" onClick={() => setMode("grammar")}>
              <div className="cc-top"><span className="cc-type">ⓖ Grammar</span></div>
              <div className="cc-title">Grammar reference</div>
              <div className="muted small">Search or browse every point</div>
            </button>
            <button className="contentcard" onClick={() => setMode("write")}>
              <div className="cc-top"><span className="cc-type">✎ Writing</span></div>
              <div className="cc-title">Writing practice</div>
              <div className="muted small">Short prompts; type in Latin, get corrected</div>
            </button>
            <button className="contentcard" onClick={() => setMode("build")}>
              <div className="cc-top"><span className="cc-type">🧩 Build</span></div>
              <div className="cc-title">Build a sentence</div>
              <div className="muted small">Tap tiles to make full sentences — with I/you/we/they tabs</div>
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="lead">Practice by situation — each set is sorted to fit your level right now. Tap any to start.</p>
          {collections.map(([theme, list]) => (
            <div key={theme} style={{ marginBottom: 18 }}>
              <h3 style={{ marginBottom: 8 }}>{theme}</h3>
              <div className="cards">
                {list.map((it) => (
                  <button className="contentcard" key={it.kind + it.id} onClick={() => open(it.kind, it.id)}>
                    <div className="cc-top">
                      <span className="cc-type">{typeLabel[it.kind]}</span>
                      <span className={`diff ${it.chip.cls}`}>{it.chip.label}</span>
                    </div>
                    <div className="cc-title">{it.title}</div>
                    <div className="muted small">{it.sub}</div>
                    <div className="muted small" style={{ marginTop: 2 }} title="words you already know or are learning">{Math.round(it.familiarPct * 100)}% familiar{it.unreviewed ? " · ⚠ unreviewed" : ""}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

// Fisher–Yates shuffle (app runtime — Math.random is fine here, this is not a workflow script).
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

// One letter's study card (glyph, name, sound, example + audio). Shared by the learn + review screens.
function LetterCard({ a, play, done }: { a: GlyphLesson; play: (t: string, s?: number) => void; done?: boolean }) {
  const ex = a.examples[0];
  return (
    <div className={`letter ${done ? "done" : ""}`}>
      <div className="g">{a.glyph}</div>
      <div className="n">{a.name}{a.unique ? <span className="tag uniq">unique</span> : a.falseFriend ? <span className="tag ff">looks Latin</span> : null}</div>
      <div className="s">{a.sound}</div>
      {ex ? (
        <div className="ex">{ex.text} <span className="muted small">{translitOr(ex.text, ex.translit)} · {ex.gloss}</span></div>
      ) : null}
      <div className="acts"><button className="ghost" onClick={() => ex && play(ex.text, 0.7)}>🔊</button></div>
    </div>
  );
}

// ---------- Reference: the alphabet, learned and TESTED set by set ----------
// Study the key letters (unique + false-friends), then a quiz: glyph→sound and sound→glyph (with audio).
// A letter is marked "known" only after a correct answer; misses go to the back of the queue.
function Letters({ progress, persist, onDone, reference, onBack }: { progress: Progress; persist: (p: Progress) => void; onDone: () => void; reference?: boolean; onBack?: () => void }) {
  const pack = usePack();
  const play = usePlay();
  const focus = useMemo(() => focusLetters(pack), [pack]);
  const all = pack.alphabet; // full Cyrillic alphabet — reviewed on day 1, even though we only quiz `focus`
  const unknown = useMemo(() => focus.filter((a) => !progress.letters[a.glyph]), [focus, progress.letters]);
  // Two homes for this component: the Today gate is a learn→quiz→done teaching flow; the Library's
  // Reference tab is a browsable full-alphabet reference (all letters, always — never collapsed to the
  // quiz subset). `reference` selects the browse home + an inline back-header next to the title.
  const [phase, setPhase] = useState<"browse" | "learn" | "quiz" | "done">(reference ? "browse" : unknown.length ? "learn" : "done");
  const [remaining, setRemaining] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const current = remaining[0];
  const a = current ? focus.find((x) => x.glyph === current) ?? null : null;
  const qType = step % 2; // 0 = see glyph, pick sound; 1 = see/hear sound, pick glyph
  const options = useMemo(() => {
    if (!a) return [] as string[];
    const distract = shuffle(all.filter((x) => x.glyph !== a.glyph)).slice(0, 3);
    return shuffle(qType === 0 ? [a.sound, ...distract.map((x) => x.sound)] : [a.glyph, ...distract.map((x) => x.glyph)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, step]);
  const correctAnswer = a ? (qType === 0 ? a.sound : a.glyph) : "";
  const isCorrect = picked != null && picked === correctAnswer;

  // Quiz the not-yet-known tricky letters; if they're all already known (e.g. a returning learner opening
  // the reference), quiz the full tricky set as a refresher so the button never lands on an empty quiz.
  const startQuiz = () => { const q = unknown.length ? unknown : focus; setTotal(q.length); setRemaining(q.map((x) => x.glyph)); setStep(0); setPicked(null); setPhase("quiz"); };
  const next = () => {
    if (!a) return;
    if (isCorrect) {
      persist({ ...progress, letters: { ...progress.letters, [a.glyph]: true } });
      const rest = remaining.slice(1);
      setRemaining(rest);
      if (rest.length === 0) setPhase(reference ? "browse" : "done"); // reference: back to the full grid
    } else {
      setRemaining((r) => [...r.slice(1), r[0]!]); // missed → back of the queue
    }
    setPicked(null);
    setStep((s) => s + 1);
  };

  // Reference home: the ENTIRE alphabet, always — a returning learner (all focus letters "known") still
  // sees every letter here, not just the 13 quizzed ones. Back-link sits inline in the header.
  if (phase === "browse") {
    return (
      <section className="view">
        <div className="row" style={{ alignItems: "center", gap: 10, marginBottom: 6 }}>
          {onBack && <button className="ghost small" onClick={onBack}>‹ Reference</button>}
          <h2 style={{ margin: 0 }}>The {pack.name} alphabet — all {all.length} letters</h2>
        </div>
        <p className="lead">Cyrillic is phonetic — one letter, one sound. The whole alphabet is here for reference; the ones to really drill are the <span style={{ color: "var(--ok)" }}>unique</span> letters and the <span style={{ color: "var(--warn)" }}>false friends</span> that look Latin but sound different. Tap 🔊 to hear any.</p>
        <div className="letters">{all.map((x) => <LetterCard key={x.glyph} a={x} play={play} done={!!progress.letters[x.glyph]} />)}</div>
        <div className="row" style={{ marginTop: 8 }}><button className="btn" onClick={startQuiz}>Quiz me on the tricky ones →</button></div>
      </section>
    );
  }

  if (!reference && (phase === "done" || unknown.length === 0)) {
    return (
      <section className="view">
        <h2>The {pack.name} alphabet</h2>
        <p className="lead">🎉 You can recognise all {focus.length} key letters — the unique ones and the false friends that look Latin. Tap 🔊 to review any.</p>
        <div className="letters">{focus.map((x) => <LetterCard key={x.glyph} a={x} play={play} done />)}</div>
        <div className="row" style={{ marginTop: 14 }}><button className="btn" onClick={onDone}>Continue →</button></div>
      </section>
    );
  }

  if (phase === "learn") {
    return (
      <section className="view">
        <h2>The {pack.name} alphabet — all {all.length} letters</h2>
        <p className="lead">Cyrillic is phonetic: one letter, one sound. Review the whole alphabet below — many letters look and sound like English, so the ones to really learn are the <span style={{ color: "var(--ok)" }}>unique</span> letters and the <span style={{ color: "var(--warn)" }}>false friends</span> that look Latin but sound different. I&apos;ll quiz you on those {focus.length}. Tap 🔊 to hear each.</p>
        <div className="letters">{all.map((x) => <LetterCard key={x.glyph} a={x} play={play} done={!!progress.letters[x.glyph]} />)}</div>
        <div className="row"><button className="btn" onClick={startQuiz}>Quiz me on the tricky ones →</button></div>
      </section>
    );
  }

  if (!a) return null;
  const learned = total - remaining.length;
  return (
    <section className="view">
      <h2>The {pack.name} alphabet</h2>
      <div className="pbar"><div style={{ width: `${(learned / (total || 1)) * 100}%` }} /></div>
      <p className="muted small" style={{ marginBottom: 14 }}>{learned} of {total} learned{remaining.length > 1 ? ` · ${remaining.length} to go` : ""}</p>
      <div className="fb">
        {qType === 0 ? (
          <>
            <div className="muted small">What sound does this letter make?</div>
            <div className="row" style={{ alignItems: "center", margin: "10px 0" }}>
              <div className="target" style={{ fontSize: 46 }}>{a.glyph}</div>
              <button className="ghost" onClick={() => a.examples[0] && play(a.examples[0].text, 0.7)}>🔊 example</button>
            </div>
          </>
        ) : (
          <>
            <div className="muted small">Which letter makes this sound?</div>
            <div className="row" style={{ alignItems: "center", margin: "10px 0" }}>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{a.sound}</div>
              <button className="ghost" onClick={() => a.examples[0] && play(a.examples[0].text, 0.7)}>🔊 hear it</button>
            </div>
          </>
        )}
        <div>
          {options.map((o) => {
            const cls = picked ? (o === correctAnswer ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt";
            return <button className={cls} key={o} disabled={!!picked} onClick={() => setPicked(o)} style={qType === 1 ? { fontSize: 24 } : undefined}>{o}</button>;
          })}
        </div>
        {picked && (
          <div className="why">
            {isCorrect ? "✓ Correct!" : `✗ ${a.glyph} sounds like “${a.sound}” (${a.name})`}
            <button className="btn" style={{ marginLeft: 8 }} onClick={next}>{remaining.length === 1 && isCorrect ? "Finish →" : "Next →"}</button>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- Library view 2: scenarios ----------
function ScenarioView({ progress, persist, config, lettersDone, scenarioId, hidePicker, bare, onComplete, onMiss, askable }: { progress: Progress; persist: (p: Progress) => void; config: api.Config | null; lettersDone: boolean; scenarioId?: string; hidePicker?: boolean; bare?: boolean; onComplete?: () => void; onMiss?: (turn: DialogueTurn) => void; askable?: boolean }) {
  const pack = usePack();
  const s = pack.scenarios.find((x) => x.id === (scenarioId ?? progress.pick)) || pack.scenarios[0]!;
  const sp = progress.scenarios[s.id] || { turnIndex: 0, metCriteria: [] };
  const run: scenario.ScenarioRun = { scenarioId: s.id, turnIndex: sp.turnIndex, metCriteria: sp.metCriteria, done: sp.turnIndex >= s.script.length };

  const saveRun = (r: scenario.ScenarioRun) =>
    persist({ ...progress, scenarios: { ...progress.scenarios, [s.id]: { turnIndex: r.turnIndex, metCriteria: r.metCriteria } } });
  const setPick = (id: string) => persist({ ...progress, pick: id });
  const restart = () => saveRun(scenario.start(s));
  const autoplay = progress.settings?.autoplay ?? false;
  const toggleAutoplay = () => persist({ ...progress, settings: { ...progress.settings, autoplay: !autoplay } });

  const turn = scenario.currentTurn(run, s);
  const done = run.turnIndex >= s.script.length;

  const inner = (
    <>
      {!hidePicker && (
        <div className="picker">
          {pack.scenarios.map((x) => (
            <button key={x.id} className={x.id === s.id ? "active" : ""} onClick={() => setPick(x.id)}>{x.title}</button>
          ))}
        </div>
      )}
      {!lettersDone && !bare && <div className="banner">Tip: finish <b>Letters</b> first — but practice here anyway (transliteration is shown).</div>}
      {!bare && <h2>{s.title}</h2>}
      {!bare && <p className="lead">{s.goal} — <span className="muted">{s.setting}</span></p>}
      <div className="check">
        {s.successCriteria.map((c) => (
          <span key={c.id} className={`crit ${run.metCriteria.includes(c.id) ? "met" : ""}`}>
            {run.metCriteria.includes(c.id) ? "✓ " : ""}{c.description}
          </span>
        ))}
      </div>
      {s.requiredStructures.length > 0 && <ScenarioGrammar ids={s.requiredStructures} />}

      {done ? (
        <Completion scenarioId={s.id} config={config} onComplete={onComplete} />
      ) : turn?.speaker === "partner" ? (
        <PartnerTurn key={run.turnIndex} turn={turn} autoplay={autoplay} onContinue={() => saveRun(scenario.advance(run, s))} />
      ) : turn ? (
        <LearnerTurn
          key={run.turnIndex}
          turn={turn}
          config={config}
          onDone={() => saveRun(scenario.completeTurn(run, s))}
          onMiss={onMiss}
        />
      ) : null}

      {askable && <HaveAQuestion convoId={s.id} lines={s.script} conceptIds={s.requiredStructures} />}

      <div className="row" style={{ marginTop: 14 }}>
        <button className="ghost" onClick={restart}>↺ Restart</button>
        <button className="ghost" onClick={toggleAutoplay} title="Auto-play the other speaker's lines for hands-free listening practice">
          {autoplay ? "🔊 Auto-play: on" : "🔇 Auto-play: off"}
        </button>
      </div>
    </>
  );

  return bare ? inner : <section className="view">{inner}</section>;
}

// Focus-on-form: surface the grammar a scenario uses as bite-size, just-in-time notes — tap to expand
// the rule + examples right where it's relevant, without leaving the conversation.
// The grammar concepts a story exercises. Stories carry no grammar link of their own, but promoted
// story ids follow the `<scenarioId>-story` convention, so we borrow the matching scenario's
// requiredStructures. Falls back to a same-theme scenario (covers the hand-authored `ana-coffee`,
// whose café theme maps to the café scenario's structures). No data changes needed.
function storyGrammarIds(pack: LanguagePack, story: MiniStory): string[] {
  const scenarioId = story.id.replace(/-story$/, "");
  const direct = pack.scenarios.find((s) => s.id === scenarioId);
  if (direct?.requiredStructures.length) return direct.requiredStructures;
  const byTheme = story.theme
    ? pack.scenarios.find((s) => s.theme && s.theme === story.theme && s.requiredStructures.length)
    : undefined;
  return byTheme?.requiredStructures ?? [];
}

function ScenarioGrammar({ ids, label = "Grammar here:" }: { ids: string[]; label?: string }) {
  const pack = usePack();
  const concepts = ids.map((id) => pack.grammar.find((c) => c.id === id)).filter((c): c is GrammarConcept => !!c);
  const [open, setOpen] = useState<string | null>(null);
  if (concepts.length === 0) return null;
  const shown = concepts.find((c) => c.id === open);
  return (
    <div className="gram-inline">
      <span className="muted small">{label}</span>
      {concepts.map((c) => (
        <button key={c.id} className={`ghost small ${open === c.id ? "active" : ""}`} onClick={() => setOpen(open === c.id ? null : c.id)}>ⓖ {c.name}</button>
      ))}
      {shown && (
        <div className="fb" style={{ width: "100%", marginTop: 4 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
            <span className="gram-title" style={{ fontSize: 15 }}>ⓖ {shown.name}</span>
            <button className="ghost small" onClick={() => setOpen(null)}>Hide ▲</button>
          </div>
          <GrammarExplainer concept={shown} compact />
        </div>
      )}
    </div>
  );
}

// "Have a question?" — a scoped AI explainer for the conversation in a Today session step (story read /
// speak scenario). Concept-derived canned chips + a bounded (≤120 char) free-text box; the answer is cached
// cross-user and rate-limited server-side (see DESIGN-ai-explain.md). Rendered ONLY in the Today flow.
function HaveAQuestion({ convoId, lines, conceptIds }: { convoId: string; lines: { text: string; gloss?: string }[]; conceptIds: string[] }) {
  const pack = usePack();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [spin, setSpin] = useState(false);
  const [err, setErr] = useState("");
  const concepts = conceptIds.map((id) => pack.grammar.find((c) => c.id === id)).filter((c): c is GrammarConcept => !!c);

  const ask = async (question: string, canned?: string) => {
    setSpin(true); setErr(""); setAnswer(null);
    try {
      const r = await api.explain({ packId: pack.id, convoId, lines, question, canned });
      if (r.answer) setAnswer(r.answer);
      else if (r.error === "rate_limited") setErr("You've asked a lot today — take a look at the grammar reference for now, and come back tomorrow.");
      else if (r.error === "unconfigured") setErr("AI help isn't configured in this environment.");
      else setErr("Couldn't answer that one — try rephrasing.");
    } catch {
      setErr("Something went wrong — try again.");
    } finally {
      setSpin(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <button className="ghost small" onClick={() => setOpen((o) => !o)}>{open ? "▲" : "▾"} Have a question?</button>
      {open && (
        <div className="fb" style={{ marginTop: 8 }}>
          <div className="muted small">Ask about the grammar or wording in this conversation.</div>
          {concepts.length > 0 && (
            <div className="row" style={{ flexWrap: "wrap", margin: "8px 0" }}>
              {concepts.map((c) => (
                <button key={c.id} className="ghost small" disabled={spin} onClick={() => ask(`Why "${c.name}"? Explain how it shows up in this conversation.`, c.id)}>ⓖ {c.name}?</button>
              ))}
            </div>
          )}
          <div className="row">
            <input className="lang-picker" style={{ flex: 1, minWidth: 180 }} maxLength={120} placeholder="e.g. why is there a тоа here?" value={q}
              onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && q.trim() && !spin) ask(q.trim()); }} />
            <button className="btn" disabled={spin || !q.trim()} onClick={() => ask(q.trim())}>{spin ? "…" : "Ask"}</button>
          </div>
          {err && <div className="muted small" style={{ marginTop: 6 }}>{err}</div>}
          {answer && (
            <div className="fb" style={{ marginTop: 8 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="muted small">Answer</span>
                <button className="ghost small" onClick={() => setAnswer(null)}>Hide ▲</button>
              </div>
              <p style={{ margin: "4px 0 0" }}>{answer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PartnerTurn({ turn, autoplay, onContinue }: { turn: DialogueTurn; autoplay: boolean; onContinue: () => void }) {
  const play = usePlay();
  useEffect(() => {
    if (autoplay) play(turn.text, 0.85);
  }, [turn.text, play, autoplay]);
  return (
    <div>
      <div className="bubble partner">
        <div><button className="spk" onClick={() => play(turn.text, 0.85)}>🔊</button>{turn.text}</div>
        <div className="gloss">{turn.gloss}</div>
      </div>
      <div className="row"><button className="btn" onClick={onContinue}>Continue →</button></div>
    </div>
  );
}

function LearnerTurn({ turn, config, onDone, onMiss }: { turn: DialogueTurn; config: api.Config | null; onDone: () => void; onMiss?: (turn: DialogueTurn) => void }) {
  const pack = usePack();
  const play = usePlay();
  const rec = useRef(makeRecorder());
  const [recording, setRecording] = useState(false);
  const [spin, setSpin] = useState("");
  const [err, setErr] = useState("");
  const [asr, setAsr] = useState<api.AsrResponse | null>(null);
  const [fb, setFb] = useState<api.FeedbackResponse | null>(null);
  const [finished, setFinished] = useState(false);

  const onRec = async () => {
    setErr("");
    if (!recording) {
      try {
        await rec.current.start();
        setRecording(true);
      } catch {
        setErr("Microphone permission denied — use a real Chrome tab.");
      }
      return;
    }
    setRecording(false);
    const blob = await rec.current.stop();
    setSpin("Transcribing…");
    try {
      const a = await api.asr(blob, pack.id);
      if (a.error) throw new Error(a.error);
      setAsr(a);
      if (config?.engines.anthropic) {
        setSpin("Coaching…");
        const f = await api.feedback(
          { answer: turn.text, translit: turn.translit, gloss: turn.gloss },
          { scribe: a.eleven?.text, google: a.google?.text },
          pack.id,
        );
        if (f.error) throw new Error(f.error);
        setFb(f);
        // Flag a missed line for the end-of-lesson recap — but ONLY when the ASR gate is confident.
        // Low-confidence (engines disagree, no target match) is exactly where scoring is unreliable, so
        // we give the benefit of the doubt and don't count it as a miss.
        if (f.score < 60 && f.gate?.confidence === "high") onMiss?.(turn);
      }
      setFinished(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSpin("");
    }
  };

  // Offer a re-record when the attempt scored low (or errored) — clears the result so they can try again.
  const lowScore = !!fb && fb.score < 60;
  const retry = () => { setFinished(false); setAsr(null); setFb(null); setErr(""); };

  return (
    <div>
      <p className="muted small">🐢 Speak slowly and clearly — recognition (and your pronunciation) both improve with deliberate pacing.</p>
      <p className="muted small">Your turn — say:</p>
      <div className="target">{turn.text}</div>
      <div className="translit">{turn.translit}</div>
      <div className="muted">{turn.gloss}</div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="ghost" onClick={() => play(turn.text)}>🔊 Hear it</button>
        <button className={`btn ${recording ? "rec" : ""}`} onClick={onRec}>{recording ? "⏹ Stop" : "⏺ Record"}</button>
        <button className="ghost" onClick={onDone}>Skip / I said it ✓</button>
      </div>
      {asr && (
        <div className="panels">
          {(["eleven", "google"] as const).map((eng) => {
            const e = asr[eng];
            const label = eng === "eleven" ? "Scribe" : "Google";
            return (
              <div className="panel" key={eng}>
                <div className="lab"><span>{label}</span><span>{e?.ok ? `${e.ms}ms` : ""}</span></div>
                <div className="val">{e ? (e.ok ? e.text || "(empty)" : "⚠ " + e.error) : "(off)"}</div>
              </div>
            );
          })}
        </div>
      )}
      {fb && <FeedbackCard fb={fb} />}
      {spin && <div className="spin">{spin}</div>}
      {err && <div className="err">{err}</div>}
      {finished && (
        <div className="row" style={{ marginTop: 12 }}>
          {lowScore && <button className="btn" onClick={retry}>🔁 Try again</button>}
          <button className={lowScore ? "ghost" : "btn"} onClick={onDone}>Next →</button>
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ fb }: { fb: api.FeedbackResponse }) {
  return (
    <div className="fb">
      <div className="line">
        <b>{fb.score}/100</b> {fb.overall}
        <span className={`gate ${fb.gate.confidence}`}>{fb.gate.confidence === "high" ? "high confidence" : "low confidence (ASR)"}</span>
      </div>
      <div className="line">
        {fb.words.map((w, i) => (
          <span className={`pill ${w.status}`} key={i} title={w.note}>{w.target} · {w.status}</span>
        ))}
      </div>
      {fb.tip && <div className="line"><span className="muted">💡</span> {fb.tip}</div>}
      {fb.asrCaveat.likelyAsrError && <div className="flag">⚠ <b>Likely ASR error:</b> {fb.asrCaveat.explanation}</div>}
    </div>
  );
}

function Completion({ scenarioId, config, onComplete }: { scenarioId: string; config: api.Config | null; onComplete?: () => void }) {
  const pack = usePack();
  const play = usePlay();
  const [history, setHistory] = useState<{ role: "learner" | "tutor"; text: string; gloss?: string; corr?: string }[]>([]);
  // Seed response scaffolding from the active pack's phrase vocab (pack-driven — no language baked in).
  const [suggestions, setSuggestions] = useState<{ text: string; gloss: string }[]>(() =>
    pack.vocab.filter((v) => v.kind === "phrase").slice(0, 3).map((v) => ({ text: v.answer, gloss: v.gloss })),
  );
  const [spin, setSpin] = useState("");
  const [err, setErr] = useState("");
  const [input, setInput] = useState("");
  const rec = useRef(makeRecorder());
  const [recording, setRecording] = useState(false);

  const send = async (text: string) => {
    if (!text.trim()) return;
    setErr("");
    setSuggestions([]);
    const nextHist = [...history, { role: "learner" as const, text }];
    setHistory(nextHist);
    setSpin("Replying…");
    try {
      const r = await api.chat(text, nextHist.map((h) => ({ role: h.role, text: h.text })), scenarioId, pack.id);
      if (r.error) throw new Error(r.error);
      setHistory((h) => [...h, { role: "tutor", text: r.reply, gloss: r.replyGloss, corr: r.correction }]);
      play(r.reply, 0.9);
      setSuggestions(r.suggestions);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSpin("");
    }
  };

  const onRec = async () => {
    if (!recording) {
      try { await rec.current.start(); setRecording(true); } catch { setErr("Mic denied — use Chrome."); }
      return;
    }
    setRecording(false);
    setSpin("Transcribing…");
    try {
      const a = await api.asr(await rec.current.stop(), pack.id);
      const t = a.eleven?.text || a.google?.text || "";
      if (!t) throw new Error("No transcript — closer to the mic");
      await send(t);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSpin("");
    }
  };

  return (
    <div>
      <div className="done-card"><h2>🎉 You did it!</h2><p className="lead">You hit the goal. Keep chatting to practise more, or wrap up.</p>{onComplete && <button className="btn" onClick={onComplete}>Finish session →</button>}</div>
      <div>
        {history.map((h, i) => (
          <div className={`bubble ${h.role === "learner" ? "learner" : "partner"}`} key={i}>
            <div>{h.role === "tutor" && <button className="spk" onClick={() => play(h.text, 0.9)}>🔊</button>}{h.text}</div>
            {h.gloss && <div className="gloss">{h.gloss}</div>}
            {h.corr && <div className="corr">✎ <b>correction:</b> {h.corr}</div>}
          </div>
        ))}
      </div>
      {suggestions.length > 0 && (
        <div className="row">
          <span className="muted small">Try saying:</span>
          {suggestions.map((s, i) => (
            <button className="ghost chip" key={i} onClick={() => send(s.text)}>{s.text} <span className="muted">· {s.gloss}</span></button>
          ))}
        </div>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button className={`btn ${recording ? "rec" : ""}`} onClick={onRec} disabled={!config?.engines.anthropic}>{recording ? "⏹ Stop" : "⏺ Speak a turn"}</button>
        <input
          className="text"
          placeholder="…or type a turn, press Enter"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { send(input); setInput(""); } }}
        />
      </div>
      {spin && <div className="spin">{spin}</div>}
      {err && <div className="err">{err}</div>}
    </div>
  );
}

// ---------- Library view 3: grammar (full reference) ----------
function Grammar({ progress, persist }: { progress: Progress; persist: (p: Progress) => void }) {
  const pack = usePack();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const grade = (item: ReviewItem, correct: boolean) => persist(gradeItem(progress, item, correct));
  const needle = q.trim().toLowerCase();
  const concepts = pack.grammar.filter((c) => !needle || `${c.name} ${c.technicalName ?? ""} ${c.plain ?? ""} ${c.explanation}`.toLowerCase().includes(needle));
  return (
    <section className="view">
      <h2>Grammar reference</h2>
      <p className="lead">New concepts are taught inside your daily session — this is the reference to look anything up. Search, or tap a point to expand the rule and drill it.</p>
      <input className="text" placeholder="Search grammar…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", marginBottom: 14 }} />
      {concepts.length === 0 && <p className="muted">No grammar point matches “{q}”.</p>}
      {concepts.map((c) => {
        const isOpen = open === c.id;
        return (
          <div className="concept" key={c.id}>
            <button className="concept-head" onClick={() => setOpen(isOpen ? null : c.id)}>
              <span>{c.name}</span>
              <span className="muted">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div style={{ marginTop: 10 }}>
                {c.technicalName && <div className="gram-tech" style={{ marginTop: -4 }}>{c.technicalName}</div>}
                <GrammarExplainer concept={c} />
                <div className="gram-checks">
                  {c.drills.map((d) => <Drill key={d.id} drill={d} onGrade={(ok) => grade(d, ok)} />)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function Drill({ drill, onGrade }: { drill: ReviewItem; onGrade: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    onGrade(opt === drill.answer);
  };
  return (
    <div>
      <div className="small" style={{ margin: "8px 0 4px" }}><b>{drill.prompt}</b></div>
      <div>
        {(drill.options ?? []).map((o) => {
          const cls = picked ? (o === drill.answer ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt";
          return <button className={cls} key={o} disabled={!!picked} onClick={() => choose(o)}>{o}</button>;
        })}
      </div>
      {picked && <div className="why">{picked === drill.answer ? "✓ " : "✗ "}{drill.why}</div>}
    </div>
  );
}

// ---------- Library view 4: reading (tap-to-capture + import-anything) ----------
function Reading({ progress, persist, config }: { progress: Progress; persist: (p: Progress) => void; config: api.Config | null }) {
  const pack = usePack();
  const play = usePlay();
  const r = pack.readers[0];
  const [sel, setSel] = useState<{ lexKey: string; surface: string; line: string } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [raw, setRaw] = useState("");
  const [imported, setImported] = useState<api.ImportResponse | null>(null);
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState("");

  const onTap = (surface: string, line: string, lineGloss?: string) => {
    const lexKey = captureWord(progress, persist, surface, line, { gloss: lineGloss, reviewable: !properNounLike(surface, pack) });
    if (lexKey) setSel({ lexKey, surface, line });
  };

  const doImport = async () => {
    if (!raw.trim()) return;
    setImporting(true);
    setImportErr("");
    try {
      const res = await api.importText(raw, pack.id);
      if (res.error) throw new Error(res.error);
      setImported(res);
      setShowImport(false);
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  // Active content: imported text (gated) if present, else the built-in reader.
  const lines = imported ? imported.segments : r ? r.body.map((b) => ({ text: b.text, gloss: b.gloss, translit: b.translit ?? "" })) : [];
  const score = scoring.scoreText(lines.map((l) => l.text).join(" "), progress.familiarity);

  return (
    <section className="view">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>Reading {imported ? <span className="muted small">· imported <span className="badge warn">unreviewed</span></span> : r ? <span className="muted small">— {r.title}</span> : ""}</h2>
        <button className="ghost small" onClick={() => setShowImport((s) => !s)}>＋ Import text</button>
      </div>
      {showImport && (
        <div className="fb">
          <textarea className="text" style={{ width: "100%", minHeight: 80 }} placeholder={`Paste ${pack.name} text — it's segmented, translated, and difficulty-scored for you…`} value={raw} onChange={(e) => setRaw(e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={doImport} disabled={importing || !config?.engines.anthropic}>{importing ? "Importing…" : "Import"}</button>
            {!config?.engines.anthropic && <span className="muted small">Claude not configured</span>}
          </div>
          {importErr && <div className="err">{importErr}</div>}
        </div>
      )}
      <p className="lead">
        Tap any word to look it up — it joins your vocabulary. <b>{lines.length ? Math.round(score.knownPct * 100) : 0}% known</b> for you.
      </p>
      <HighlightLegend />
      <div className="reader">
        {lines.length === 0 ? (
          <p className="muted">No content yet — import some text above.</p>
        ) : (
          lines.map((l, i) => <ReaderRow key={i} line={l} progress={progress} play={play} onTapWord={(s) => onTap(s, l.text, l.gloss)} />)
        )}
      </div>
      {imported && <button className="ghost small" style={{ marginTop: 10 }} onClick={() => { setImported(null); setRaw(""); }}>↺ Back to the built-in reader</button>}
      {sel && <WordPanel key={sel.lexKey} sel={sel} progress={progress} persist={persist} config={config} onClose={() => setSel(null)} />}
    </section>
  );
}

function ReaderRow({ line, progress, play, onTapWord }: { line: { text: string; gloss: string; translit?: string }; progress: Progress; play: (t: string, s?: number) => void; onTapWord: (s: string) => void }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="rline2">
      <button className="spk" onClick={() => play(line.text, 0.85)}>🔊</button>
      <TappableText text={line.text} progress={progress} onTapWord={onTapWord} />
      {revealed ? <span className="muted small" style={{ marginLeft: 8 }}>· {line.gloss}</span> : <button className="ghost small" style={{ marginLeft: 8 }} onClick={() => setRevealed(true)}>translate</button>}
    </div>
  );
}

function WordToken({ surface, status, onTap }: { surface: string; status: string; onTap: () => void }) {
  return <span className={`tok ${status}`} onClick={onTap}>{surface}</span>;
}

// A key to the word colors, shared by every tap-to-read view. Also explains the state change on tap
// (a blue "new" word turns yellow once you've met it) so the shifting highlights don't look random.
function HighlightLegend() {
  return (
    <p className="small muted" style={{ margin: "2px 0 0", lineHeight: 1.7 }}>
      <span className="tok new">new</span> not met yet ·{" "}
      <span className="tok learning">learning</span> in your reviews ·{" "}
      <span className="tok known">known</span> mastered (no highlight) ·{" "}
      <span className="tok ignored">Name</span> skipped.{" "}
      Tapping a <span className="tok new">new</span> word looks it up and starts learning it — so it turns{" "}
      <span className="tok learning">yellow</span>.
    </p>
  );
}

// Renders a line as tappable, status-colored word tokens. Shared by the reader + the story player.
function TappableText({ text, progress, onTapWord }: { text: string; progress: Progress; onTapWord: (surface: string) => void }) {
  return (
    <span className="rtext">
      {scoring.tokenize(text).map((t, j) =>
        t.isWord ? (
          <WordToken key={j} surface={t.surface} status={wordStatus(progress, t.lexKey)} onTap={() => onTapWord(t.surface)} />
        ) : (
          <span key={j}>{t.surface}</span>
        ),
      )}
    </span>
  );
}

function WordPanel({ sel, progress, persist, config, onClose }: {
  sel: { lexKey: string; surface: string; line: string };
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  onClose: () => void;
}) {
  const pack = usePack();
  const play = usePlay();
  const [g, setG] = useState<api.GlossResponse | null>(null);
  const [spin, setSpin] = useState(false);
  useEffect(() => {
    let live = true;
    setG(null);
    setSpin(true);
    api.gloss(sel.surface, sel.line, pack.id).then((r) => { if (live) setG(r); }).catch(() => {}).finally(() => { if (live) setSpin(false); });
    return () => { live = false; };
  }, [sel.surface, sel.line, pack.id]);

  const entry = progress.familiarity[sel.lexKey];
  const starred = !!entry && familiarity.isStarred(entry);
  const setStat = (status: "known" | "ignored") => {
    const e = entry ?? familiarity.capture({ lexKey: sel.lexKey, kind: "word", display: sel.surface });
    persist({ ...progress, familiarity: { ...progress.familiarity, [sel.lexKey]: familiarity.setStatus(e, status) } });
    onClose();
  };
  // Save/unsave to the custom deck — remembers the sentence + its English (once we have the gloss) so this
  // word reviews in context. Keeps the panel open so the ★ state visibly flips.
  const star = () => toggleStar(progress, persist, sel.surface, { gloss: g?.gloss || undefined, context: sel.line });

  return (
    <div className="wordpanel">
      <div className="row">
        <b className="target" style={{ fontSize: 20 }}>{sel.surface}</b>
        <button className="spk" onClick={() => play(sel.surface, 0.8)}>🔊</button>
        <button className="ghost small" style={{ marginLeft: "auto" }} onClick={onClose}>✕</button>
      </div>
      {spin ? (
        <div className="spin">Looking up…</div>
      ) : g?.gloss ? (
        <div style={{ marginTop: 4 }}>
          {g.translit && <span className="translit">{g.translit} · </span>}
          <span style={{ fontSize: 16 }}>{g.gloss}</span>
          <span className="muted small"> ({g.source})</span>
        </div>
      ) : (
        <div className="muted small" style={{ marginTop: 4 }}>{config?.engines.anthropic ? "No translation found." : "Translation needs Claude configured."}</div>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button className={`ghost${starred ? " active" : ""}`} onClick={star} title="Save to your flashcard deck">{starred ? "★ Saved" : "☆ Save"}</button>
        <button className="ghost" onClick={() => setStat("known")}>✓ Known</button>
        <button className="ghost" onClick={() => setStat("ignored")}>✕ Ignore</button>
        <span className="muted small">{entry ? `tracked · ${entry.status}` : "captured"}</span>
      </div>
    </div>
  );
}

// ---------- shared story reader (synced audio + tap-capture) — used by Today and the Library Story view ----------
function StoryReader({ story, progress, persist, config, onDone, doneLabel, askable }: {
  story: MiniStory;
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  onDone: () => void;
  doneLabel: string;
  askable?: boolean;
}) {
  const pack = usePack();
  const play = usePlay();
  const [sel, setSel] = useState<{ lexKey: string; surface: string; line: string } | null>(null);
  const [current, setCurrent] = useState(-1);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const speed = useContext(SlowContext);
  const playing = useRef(false);

  // Prefetch glosses for the SLOW words — those NOT in pack vocab, which hit Haiku (~1-3s) on tap — so the
  // word panel is instant when tapped (the lookup already ran in the background). Pack-vocab words are
  // already instant, so we skip them; deduped by word, throttled to 3 at a time, cancelled on unmount.
  useEffect(() => {
    let cancelled = false;
    const vocab = new Set(pack.vocab.map((v) => familiarity.normalize(v.answer)));
    const seen = new Set<string>();
    const jobs: { surface: string; line: string }[] = [];
    for (const l of story.body) {
      for (const t of scoring.tokenize(l.text)) {
        if (!t.isWord) continue;
        const norm = familiarity.normalize(t.surface);
        if (!norm || seen.has(norm) || vocab.has(norm)) continue;
        seen.add(norm);
        jobs.push({ surface: t.surface, line: l.text });
      }
    }
    // Cap eager warm-up cost: the earliest words (reading order) are tapped first; the rest lazy-load on
    // tap and are cached from then on. So this bounds Haiku spend per story open without slowing real taps.
    const queue = jobs.slice(0, 16);
    let i = 0;
    const worker = async () => {
      while (!cancelled && i < queue.length) {
        const j = queue[i++]!;
        try { await api.gloss(j.surface, j.line, pack.id); } catch { /* best-effort warm-up */ }
      }
    };
    void Promise.all([worker(), worker(), worker()]);
    return () => { cancelled = true; };
  }, [story.id, pack.id, pack.vocab]);

  const onTap = (surface: string, line: string, lineGloss?: string) => {
    const lexKey = captureWord(progress, persist, surface, line, { gloss: lineGloss, reviewable: !properNounLike(surface, pack) });
    if (lexKey) setSel({ lexKey, surface, line });
  };

  // Play segments in sequence, highlighting the current line (toggle = stop).
  const playAll = async () => {
    if (playing.current) { playing.current = false; setCurrent(-1); return; }
    playing.current = true;
    for (let i = 0; i < story.body.length; i++) {
      if (!playing.current) break;
      setCurrent(i);
      try { await api.playClip(story.body[i]!.text, speed, pack.id); } catch { break; }
    }
    playing.current = false;
    setCurrent(-1);
  };

  return (
    <>
      <p className="lead">Listen and read along; tap any word to look it up. Read each line, then tap the greyed English on the right to check yourself.</p>
      <HighlightLegend />
      <ScenarioGrammar ids={storyGrammarIds(pack, story)} label="Grammar in this story:" />
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn" onClick={playAll}>{current >= 0 ? "⏹ Stop" : "▶ Play story"}</button>
        <span className="muted small">🐢 shadow each line — listen (speed switch is up top), then say it back.</span>
      </div>
      <div className="reader">
        {story.body.map((l, i) => (
          <div className={`rline2 rline-glossed ${current === i ? "playing" : ""}`} key={i}>
            <div className="rline-mk">
              <button className="spk" onClick={() => play(l.text, speed)}>🔊</button>
              <TappableText text={l.text} progress={progress} onTapWord={(s) => onTap(s, l.text, l.gloss)} />
            </div>
            {l.gloss && (
              <button
                type="button"
                className={`rline-en ${revealed[i] ? "shown" : ""}`}
                title={revealed[i] ? "Tap to hide" : "Tap to reveal the English"}
                onClick={() => setRevealed((r) => ({ ...r, [i]: !r[i] }))}
              >
                {l.gloss}
              </button>
            )}
          </div>
        ))}
      </div>
      {sel && <WordPanel key={sel.lexKey} sel={sel} progress={progress} persist={persist} config={config} onClose={() => setSel(null)} />}
      {askable && <HaveAQuestion convoId={story.id} lines={story.body} conceptIds={storyGrammarIds(pack, story)} />}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" onClick={onDone}>{doneLabel}</button>
      </div>
    </>
  );
}

// ---------- Library view 5: mini-story (read → Q&A → speaking pipeline) ----------
function StoryView({ progress, persist, config, onDone }: { progress: Progress; persist: (p: Progress) => void; config: api.Config | null; onDone?: () => void }) {
  const pack = usePack();
  const story = pack.stories?.find((s) => s.id === progress.storyPick) ?? pack.stories?.[0];
  const [phase, setPhase] = useState<"read" | "qa">("read");

  if (!story) return <section className="view"><h2>Story</h2><p className="lead">No stories yet for this pack.</p></section>;

  // Reading the story seeds its vocab into familiarity → moves the known-word count.
  const toQA = () => {
    persist(seedStoryVocab(progress, story));
    setPhase("qa");
  };

  return (
    <section className="view">
      <h2>★ {story.title} <span className="muted small">· {story.titleGloss}</span></h2>
      {story.audioSource === "tts" && <p className="muted small">audio: synthesized (TTS) — a native recording is pending.</p>}
      {phase === "read" ? (
        <StoryReader
          story={story}
          progress={progress}
          persist={persist}
          config={config}
          doneLabel={`I read it → questions (+${story.registersVocab.length} words)`}
          onDone={toQA}
        />
      ) : (
        <StoryQAView story={story} config={config} onRestart={() => setPhase("read")} onDone={onDone} />
      )}
    </section>
  );
}

function StoryQAView({ story, config, onRestart, onDone, dayIndex = 0 }: { story: MiniStory; config: api.Config | null; onRestart: () => void; onDone?: () => void; dayIndex?: number }) {
  const play = usePlay();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  // Rotate the questions by day so a repeated story asks them in a fresh order (different lead + spoken
  // prompt each pass) rather than an identical quiz.
  const qa = rotate(story.qa, dayIndex);
  return (
    <div>
      <p className="lead">Questions — the story's words again, in a new frame.</p>
      {qa.map((q) => (
        <div className="fb" key={q.id}>
          <div className="row"><button className="spk" onClick={() => play(q.question, 0.9)}>🔊</button><b>{q.question}</b></div>
          <div className="gloss">{q.questionGloss}</div>
          {q.spokenPrompt ? (
            answered[q.id] ? (
              <div className="row" style={{ marginTop: 8 }}>
                <span className="muted small">✓ done —</span>
                <span className="target">{q.answer}</span>
                <span className="muted small">· {q.answerGloss}</span>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <div className="muted small">Answer aloud — say:</div>
                <LearnerTurn turn={{ speaker: "learner", text: q.answer, translit: q.answerTranslit, gloss: q.answerGloss }} config={config} onDone={() => setAnswered((s) => ({ ...s, [q.id]: true }))} />
              </div>
            )
          ) : revealed[q.id] ? (
            <div className="row" style={{ marginTop: 6 }}><button className="spk" onClick={() => play(q.answer, 0.9)}>🔊</button> <span className="target">{q.answer}</span> <span className="muted small">· {q.answerGloss}</span></div>
          ) : (
            <button className="ghost" style={{ marginTop: 8 }} onClick={() => setRevealed((s) => ({ ...s, [q.id]: true }))}>Reveal answer</button>
          )}
        </div>
      ))}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="ghost" onClick={onRestart}>↺ Read again</button>
        {onDone && <button className="btn" onClick={onDone}>Done →</button>}
      </div>
    </div>
  );
}

// Today's story step: read → Q&A → speak. Mirrors the Library's StoryView phasing, but uses the
// session's chosen story and advances the daily flow on completion — the Q&A is the input→output
// bridge (recall the story's words, last question spoken) before the full speak scenario.
function TodayStoryStep({ story, progress, persist, config, onDone, dayIndex = 0 }: {
  story: MiniStory;
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  onDone: () => void;
  dayIndex?: number;
}) {
  const [phase, setPhase] = useState<"read" | "qa">("read");
  const hasQA = story.qa.length > 0;
  // Seed the story's vocab when moving to Q&A so the questions reuse words now marked as met.
  const toQA = () => { persist(seedStoryVocab(progress, story)); setPhase("qa"); };
  return phase === "read" ? (
    <StoryReader
      story={story}
      progress={progress}
      persist={persist}
      config={config}
      askable
      doneLabel={hasQA ? `I read it → ${story.qa.length} questions` : "I read it → speak"}
      onDone={hasQA ? toQA : onDone}
    />
  ) : (
    <StoryQAView story={story} config={config} onRestart={() => setPhase("read")} onDone={onDone} dayIndex={dayIndex} />
  );
}

// ---------- Library view 6: writing (prompted production + correction-why) ----------
// ---------- "Build a sentence" — tap-the-tiles production with I/you/we/they conjugation tabs ----------
const buildNorm = (w: string) => w.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");

function TileBuilder({ variant, verb, onSolved }: { variant: SentenceVariant; verb?: ConjugationSet; onSolved: () => void }) {
  const play = usePlay();
  const targetWords = useMemo(() => variant.mk.split(/\s+/).filter(Boolean), [variant.mk]);
  // Bank = the sentence's words, shuffled, plus up to 2 OTHER forms of the verb as distractors (so picking
  // the right conjugation is part of the task).
  const bank = useMemo(() => {
    const distract: string[] = [];
    if (verb) {
      const cur = new Set(targetWords.map(buildNorm));
      for (const f of Object.values(verb.forms)) { if (distract.length >= 2) break; if (!cur.has(buildNorm(f)) && !distract.includes(f)) distract.push(f); }
    }
    return shuffle([...targetWords, ...distract]).map((w, i) => ({ id: i, w }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant.mk]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [result, setResult] = useState<null | boolean>(null);
  useEffect(() => { setPlaced([]); setResult(null); }, [variant.mk]);
  const placedSet = new Set(placed);
  const wordOf = (id: number) => bank.find((t) => t.id === id)!.w;
  const check = () => {
    const got = placed.map(wordOf);
    const ok = got.length === targetWords.length && got.every((w, i) => buildNorm(w) === buildNorm(targetWords[i]!));
    setResult(ok);
    if (ok) onSolved();
  };
  return (
    <div>
      <div className="muted small" style={{ marginTop: 6 }}>Build: <b>“{variant.en}”</b></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 42, margin: "8px 0", padding: 8, border: "1px dashed var(--border)", borderRadius: 8 }}>
        {placed.length === 0 ? <span className="muted small">tap the tiles below…</span> :
          placed.map((id) => <button key={id} className="opt" onClick={() => { setPlaced((pl) => pl.filter((x) => x !== id)); setResult(null); }}>{wordOf(id)}</button>)}
      </div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {bank.filter((t) => !placedSet.has(t.id)).map((t) => <button key={t.id} className="opt" onClick={() => { setPlaced((pl) => [...pl, t.id]); setResult(null); }}>{t.w}</button>)}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        {result === true ? (
          <span className="target">✓ {variant.mk} <button className="spk" onClick={() => play(variant.mk, 0.85)}>🔊</button></span>
        ) : (
          <>
            <button className="btn" disabled={!placed.length} onClick={check}>Check</button>
            {result === false && <span className="muted small">Not quite — tap a placed tile to remove it, then rearrange.</span>}
          </>
        )}
      </div>
    </div>
  );
}

function SentenceBuilder({ progress, persist, onDone }: { progress: Progress; persist: (p: Progress) => void; onDone?: () => void }) {
  const pack = usePack();
  // Scope to items whose complement words the learner has met (taught-up-to-now).
  const scoped = useMemo(
    () => (pack.sentences ?? []).filter((it) => it.supportWords.every((w) => !!progress.familiarity[familiarity.normalize(w)])),
    [pack, progress.familiarity],
  );
  const [nonce, setNonce] = useState(0);
  // ONE sentence per card. Flatten each verb item into its six person-variants, then pick ~6 cards that
  // cover DIFFERENT conjugations: not-yet-built (verb:person) pairs first, capped to 2 per verb so the
  // session spreads across verbs and persons rather than flipping tabs on a single verb.
  const cards = useMemo(() => {
    const built = new Set(progress.builtConjugations ?? []);
    const flat = scoped.flatMap((it) => (it.verbLemma ? it.variants : it.variants.slice(0, 1)).map((v) => ({ item: it, variant: v })));
    const keyOf = (c: { item: SentenceItem; variant: SentenceVariant }) => (c.item.verbLemma && c.variant.person ? `${c.item.verbLemma}:${c.variant.person}` : c.item.id);
    const ordered = [...shuffle(flat.filter((c) => !built.has(keyOf(c)))), ...shuffle(flat.filter((c) => built.has(keyOf(c))))];
    const pick: { item: SentenceItem; variant: SentenceVariant }[] = [];
    const perVerb = new Map<string, number>();
    for (const c of ordered) {
      if (pick.length >= 6) break;
      const vl = c.item.verbLemma ?? c.item.id;
      if ((perVerb.get(vl) ?? 0) >= 2) continue;
      perVerb.set(vl, (perVerb.get(vl) ?? 0) + 1);
      pick.push(c);
    }
    for (const c of ordered) { if (pick.length >= 6) break; if (!pick.includes(c)) pick.push(c); }
    return pick.slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped.length, nonce]);
  const [idx, setIdx] = useState(0);

  if (!scoped.length) return <p className="lead">Learn a few more words first — then come back to build sentences with the words you know.</p>;
  if (idx >= cards.length || !cards[idx]) return (
    <div className="fb">
      <p className="lead" style={{ color: "var(--ok)" }}>🎉 Nice — you built {cards.length} sentence{cards.length === 1 ? "" : "s"}.</p>
      <div className="row">
        {onDone ? <button className="btn" onClick={onDone}>Done →</button> : <button className="btn" onClick={() => { setIdx(0); setNonce((n) => n + 1); }}>Go again →</button>}
      </div>
    </div>
  );

  const { item, variant } = cards[idx]!;
  const verb = item.verbLemma ? (pack.conjugations ?? []).find((v) => v.lemma === item.verbLemma) : undefined;
  const personEn = variant.person ? PRONOUNS.find((pr) => pr.key === variant.person)?.en : undefined;
  const onSolved = () => {
    let p = progress;
    for (const cid of item.conceptIds) p = gradeItem(p, { id: cid, kind: "grammar", prompt: "", answer: "", gloss: "", i1Level: 0, tags: [] }, true);
    if (verb && variant.person) p = { ...p, builtConjugations: [...new Set([...(p.builtConjugations ?? []), `${verb.lemma}:${variant.person}`])] };
    persist(p);
  };

  return (
    <div className="fb">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <Tag>Build a sentence · {idx + 1} of {cards.length}</Tag>
        {verb && <span className="muted small">{personEn ? `${personEn} · ` : ""}{verb.gloss}</span>}
      </div>
      <TileBuilder key={`${item.id}-${variant.person ?? ""}`} variant={variant} verb={verb} onSolved={onSolved} />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="ghost small" onClick={() => setIdx((i) => i + 1)}>{idx + 1 >= cards.length ? "Finish →" : "Next →"}</button>
      </div>
    </div>
  );
}
// The gated Today writing capstone: one unit-scoped prompt (the scenario goal), free production with the
// same tutor correction as the Library Writing — but woven into the daily flow instead of sitting idle.
function WritingCapstone({ prompt, config, onDone }: { prompt: string; config: api.Config | null; onDone: () => void }) {
  const pack = usePack();
  const [text, setText] = useState("");
  const [spin, setSpin] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<api.WriteResponse | null>(null);
  const submit = async () => {
    if (!text.trim()) return;
    setErr(""); setResult(null); setSpin(true);
    try {
      const r = await api.writeCorrect(text, "", pack.id, prompt);
      if (r.error) throw new Error(r.error);
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSpin(false);
    }
  };
  return (
    <div className="fb">
      <p className="lead" style={{ marginTop: 0 }}>You’ve got the words and the grammar — now put it together in your own words. <b>Latin letters are fine.</b></p>
      <p className="lead"><b>Write:</b> {prompt}</p>
      <textarea className="text" style={{ width: "100%", minHeight: 70 }} placeholder={`Write in ${pack.name} — e.g. "sakam kafe, ve molam"`} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={submit} disabled={spin || !text.trim() || !config?.engines.anthropic}>{spin ? "Checking\u2026" : "Check my writing"}</button>
        {!config?.engines.anthropic && <span className="muted small">Claude not configured</span>}
      </div>
      {err && <div className="err">{err}</div>}
      {result && (
        <div className="fb" style={{ marginTop: 8 }}>
          <div className="line">{result.isCorrect ? "\u2713 " : ""}{result.overall}</div>
          <div className="line"><span className="muted">{result.isCorrect ? `In ${pack.name}:` : "Corrected:"}</span> <span className="target" style={{ fontSize: 18 }}>{result.corrected}</span>{result.correctedTranslit && <span className="translit"> · {result.correctedTranslit}</span>}</div>
          {result.issues.map((it, i) => (
            <div className="line" key={i}><span className="pill wrong">{it.original}</span> → <span className="pill correct">{it.fix}</span><div className="why">{it.why}</div></div>
          ))}
          <div className="line muted">{result.encouragement}</div>
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button className={result ? "btn" : "ghost small"} onClick={onDone}>{result ? "Done \u2192" : "Skip \u2192"}</button>
      </div>
    </div>
  );
}

function Writing({ config }: { config: api.Config | null }) {
  const pack = usePack();
  const tasks = pack.writingTasks ?? [];
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [text, setText] = useState("");
  const [spin, setSpin] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<api.WriteResponse | null>(null);
  const task = tasks.find((t) => t.id === taskId);

  const submit = async () => {
    if (!text.trim() || !task) return;
    setErr("");
    setResult(null);
    setSpin(true);
    try {
      const r = await api.writeCorrect(text, task.id, pack.id);
      if (r.error) throw new Error(r.error);
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSpin(false);
    }
  };

  return (
    <section className="view">
      <h2>Writing</h2>
      <p className="lead">Short production with correction that explains <i>why</i>. Pick a task and write it — <b>typing in Latin letters is fine</b> (e.g. &quot;sakam kafe&quot;); you&apos;ll get it back in {pack.name}.</p>
      <div className="picker">
        {tasks.map((t) => (
          <button key={t.id} className={t.id === taskId ? "active" : ""} onClick={() => { setTaskId(t.id); setText(""); setResult(null); }}>{t.prompt}</button>
        ))}
      </div>
      {task && <p className="lead"><b>Task:</b> {task.prompt}</p>}
      <textarea
        className="text"
        style={{ width: "100%", minHeight: 70 }}
        placeholder={`Write in ${pack.name} — Latin letters are fine, e.g. "sakam kafe"`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={submit} disabled={spin || !config?.engines.anthropic}>{spin ? "Checking…" : "Check my writing"}</button>
        {!config?.engines.anthropic && <span className="muted small">Claude not configured</span>}
      </div>
      {err && <div className="err">{err}</div>}
      {result && (
        <div className="fb">
          <div className="line">{result.isCorrect ? "✓ " : ""}{result.overall}</div>
          <div className="line">
            <span className="muted">{result.isCorrect ? `In ${pack.name}:` : "Corrected:"}</span>{" "}
            <span className="target" style={{ fontSize: 18 }}>{result.corrected}</span>
            {result.correctedTranslit && <span className="translit"> · {result.correctedTranslit}</span>}
          </div>
          {result.issues.map((it, i) => (
            <div className="line" key={i}>
              <span className="pill wrong">{it.original}</span> → <span className="pill correct">{it.fix}</span>
              <div className="why">{it.why}</div>
            </div>
          ))}
          <div className="line muted">{result.encouragement}</div>
          <div className="meta">Claude {result.ms}ms · ~${result.costUsd}</div>
        </div>
      )}
    </section>
  );
}

// ---------- Progress section: functional stats + Strengthen ----------
function ProgressDash({ progress, dueCount }: { progress: Progress; dueCount: number }) {
  const pack = usePack();
  const vocab = scoring.computeMetrics(progress.familiarity);
  const level = computeLevel(pack, progress);
  const streak = progress.streak?.count ?? 0;
  const stat = (l: string, v: ReactNode, accent?: boolean) => (
    <div className="stat" key={l}><div className={`v ${accent ? "accent" : ""}`}>{v}</div><div className="l">{l}</div></div>
  );
  return (
    <section className="view">
      <h2>Your progress</h2>
      <p className="lead">Functional progress — what you can actually understand and say — not just streak days.</p>
      <div className="stats">
        {stat("Words known", vocab.knownWordCount, true)}
        {stat("Learning", vocab.learningCount)}
        {stat("New this week", vocab.movedToKnownThisWeek)}
        {stat("To review", dueCount, dueCount > 0)}
        {stat("Day streak", streak)}
        {stat("Level", level.cefrBand)}
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>
        <b>To review</b> = items due in Flashcards (below, and in Library › Flashcards). <b>Level</b> is an estimate from letters learned, scenario goals met, and words tracked — roughly pre-A1 → A1 → A2.
      </p>
    </section>
  );
}

// ---------- Library → Words: browse the core vocabulary by theme and pick up words on demand ----------
// The flashcard deck only surfaces words you've MET, so this is where you meet single words directly:
// tap ＋ to capture one (it becomes a studied, due card in the Words flashcard filter).
function Words({ progress, persist }: { progress: Progress; persist: (p: Progress) => void }) {
  const pack = usePack();
  const play = usePlay();
  const groups = useMemo(() => {
    // Some older vocab is tagged with pipeline labels ("generated"/"validated"/…) rather than a real
    // theme — bucket those under "more words" so the section headers read cleanly.
    const themeOf = (v: ReviewItem) => { const t = (v.tags[0] || "").trim(); return !t || /^(generated|validated|unreviewed|core|authored)$/i.test(t) ? "more words" : t; };
    const single = pack.vocab.filter((v) => v.kind === "vocab" && !/\s/.test(v.answer.trim()));
    const m = new Map<string, ReviewItem[]>();
    for (const v of single) { const t = themeOf(v); const arr = m.get(t); if (arr) arr.push(v); else m.set(t, [v]); }
    // Themed groups first (alphabetical), the catch-all "more words" last.
    return [...m.entries()].sort((a, b) => (a[0] === "more words" ? 1 : 0) - (b[0] === "more words" ? 1 : 0) || a[0].localeCompare(b[0]));
  }, [pack]);

  const learn = (items: ReviewItem[]) => {
    const fam = { ...progress.familiarity };
    for (const it of items) {
      const spec = familiarity.deriveKeyForItem(it);
      const existing = fam[spec.lexKey];
      fam[spec.lexKey] = existing ? familiarity.markStudied(existing) : familiarity.capture(spec);
    }
    persist({ ...progress, familiarity: fam });
  };

  const all = groups.flatMap(([, v]) => v);
  const started = all.filter((it) => wordStatus(progress, familiarity.deriveKeyForItem(it).lexKey) !== "new").length;

  return (
    <>
      <p className="lead">Browse the vocabulary by theme — tap 🔊 to hear a word, <b>☆</b> to save it to your <b>★ Starred</b> flashcard deck, or <b>＋</b> to mark it started (so it&apos;s prioritised in review). You can drill any of these anytime in <b>Flashcards</b>, filtered by theme. <b>{started}/{all.length}</b> started.</p>
      {groups.map(([theme, items]) => {
        const unmet = items.filter((it) => wordStatus(progress, familiarity.deriveKeyForItem(it).lexKey) === "new");
        return (
          <div key={theme} className="word-group">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ margin: "14px 0 6px", textTransform: "capitalize" }}>{theme}</h3>
              {unmet.length > 0 && <button className="ghost small" onClick={() => learn(unmet)}>＋ Learn all {unmet.length}</button>}
            </div>
            <div className="word-list">
              {items.map((it) => {
                const key = familiarity.deriveKeyForItem(it).lexKey;
                const status = wordStatus(progress, key);
                const gender = it.meta?.gender ? ` · ${String(it.meta.gender)}` : "";
                const on = !!progress.familiarity[key] && familiarity.isStarred(progress.familiarity[key]!);
                return (
                  <div className="word-row" key={it.id}>
                    <button className="spk" onClick={() => play(it.answer, 0.9)}>🔊</button>
                    <span className="word-mk"><b>{it.answer}</b> <span className="translit">{it.translit}</span></span>
                    <span className="word-gloss muted small">{it.gloss}{gender}</span>
                    <button className={`ghost small${on ? " active" : ""}`} title="Save to your flashcard deck" onClick={() => toggleStar(progress, persist, it.answer, { gloss: it.gloss })}>{on ? "★" : "☆"}</button>
                    {status === "new"
                      ? <button className="ghost small" onClick={() => learn([it])}>＋ Learn</button>
                      : <span className={`badge ${status === "known" ? "on" : ""}`}>{status === "known" ? "known ✓" : "learning"}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

// Map a phrase's scenario tag → a readable situational theme for the flashcard theme filter (phrases are
// tagged by the scenario they came from, e.g. "s1-cafe-order"). Words carry their own semantic tag.
const SCENARIO_THEME: Record<string, string> = {
  "s0-repair": "repair & clarify", "s0-greet": "greetings", "s0-survive": "survival basics",
  "s1-cafe-order": "café & ordering", "s1-greet-intro": "introductions", "s1-market": "shopping",
  "s1-directions": "directions", "s2-smalltalk": "small talk", "s2-pasttime": "past & future",
  "s2-home-family": "home & family", "s2-arrange": "phone & plans", "s2-problems": "problems",
  directions: "directions", shopping: "shopping", introductions: "introductions", phone: "phone & plans",
  greeting: "greetings", ordering: "café & ordering", paying: "café & ordering", social: "social", "small-talk": "small talk",
};

// ---------- Progress section: Strengthen (unified SRS over phrases + grammar) ----------
type ReviewUnit =
  | { type: "pool"; key: string; item: ReviewItem; strength: number }
  | { type: "captured"; key: string; entry: FamiliarityEntry; strength: number };

function Review({ progress, persist }: { progress: Progress; persist: (p: Progress) => void }) {
  const pack = usePack();
  // Weakest-first queue of everything due: pack vocab/grammar PLUS words you captured while reading
  // (those are reviewed in the sentence you met them in — cloze).
  // Back-translate a captured word's sentence at review time (covers words saved before we stored the
  // English), so the cloze always shows what to say.
  const lineGlosses = useMemo(() => buildLineGlosses(pack), [pack]);
  // The FULL deck — every pack word/phrase/grammar drill plus words you captured while reading. Nothing is
  // hidden behind "studied": you filter down to what you want to drill. Ordered so anything already due for
  // review (most-due first) leads, then new words before new sentences. Grading a new card enrolls it in SRS.
  const deck = useMemo<ReviewUnit[]>(() => {
    const now = new Date();
    const pool = reviewPool(pack);
    const poolKeys = new Set(pool.map((it) => familiarity.deriveKeyForItem(it).lexKey));
    const poolUnits: ReviewUnit[] = pool.map((it) => {
      const k = familiarity.deriveKeyForItem(it).lexKey;
      return { type: "pool", key: k, item: it, strength: progress.familiarity[k]?.strength ?? 0 };
    });
    const capturedUnits: ReviewUnit[] = Object.values(progress.familiarity)
      .filter((e) => familiarity.isStudied(e) && (e.kind === "word" || e.kind === "chunk") && !poolKeys.has(e.lexKey) && !properNounLike(e.display, pack))
      .map((e) => ({ type: "captured", key: e.lexKey, entry: e, strength: e.strength }));
    const isWord = (u: ReviewUnit) => u.type === "pool" ? (u.item.kind === "vocab" || (u.item.kind === "phrase" && !/\s/.test(u.item.answer.trim()))) : u.entry.kind === "word" && !progress.contexts?.[u.key];
    const dueMs = (u: ReviewUnit): number | null => {
      const srs = u.type === "captured" ? u.entry.srs : progress.familiarity[u.key]?.srs;
      return srs && new Date(srs.due) <= now ? new Date(srs.due).getTime() : null; // null ⇒ not currently due (new / scheduled ahead)
    };
    return [...poolUnits, ...capturedUnits].sort((a, b) => {
      const da = dueMs(a), db = dueMs(b);
      if (da !== null && db !== null) return da - db; // both due → most-due first
      if (da !== null) return -1;
      if (db !== null) return 1;
      return (isWord(a) ? 0 : 1) - (isWord(b) ? 0 : 1); // new items → words before sentences
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack]);

  // Word (single token) vs sentence/phrase, for the type filter.
  const isWordUnit = (u: ReviewUnit): boolean =>
    u.type === "pool"
      ? u.item.kind === "vocab" || (u.item.kind === "phrase" && !/\s/.test(u.item.answer.trim()))
      : u.entry.kind === "word" && !progress.contexts?.[u.key];

  // Saved to the custom deck? Read live from familiarity (not the memoized unit) so a just-starred pool
  // word reflects immediately; captured units carry their own entry.
  const isStarredUnit = (u: ReviewUnit): boolean => {
    const e = u.type === "captured" ? u.entry : progress.familiarity[u.key];
    return !!e && familiarity.isStarred(e);
  };

  // A readable theme per card: words carry a semantic tag ("pronouns", "food & drink"); phrases carry a
  // situational one via their scenario tag; captured words + grammar get their own buckets.
  const themeOf = (u: ReviewUnit): string => {
    if (u.type === "captured") return "from your reading";
    const it = u.item;
    if (it.kind === "grammar") return "grammar";
    const tags = it.tags ?? [];
    for (const t of tags) { const m = SCENARIO_THEME[t]; if (m) return m; }
    const clean = tags.find((t) => t && !/^(generated|validated|unreviewed|core|authored)$/i.test(t) && !/^s\d+-/.test(t));
    return clean ?? "more";
  };

  const [type, setType] = useState<"all" | "words" | "sentences">("all");
  const [themes, setThemes] = useState<Set<string>>(new Set()); // empty ⇒ all themes
  const [starredOnly, setStarredOnly] = useState(false); // the learner's custom "★ saved" deck
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [type, themes, starredOnly]); // restart the deck when a filter changes

  // Scope to the starred (custom) deck first when that toggle is on; type/theme filters then narrow within it.
  const starred = deck.filter(isStarredUnit);
  const scoped = starredOnly ? starred : deck;
  const words = scoped.filter(isWordUnit);
  const sentences = scoped.filter((u) => !isWordUnit(u));
  const byType = type === "words" ? words : type === "sentences" ? sentences : scoped;
  // Themes available within the current type, with counts. "more"/"grammar"/"from your reading" sort last.
  const themeCounts = new Map<string, number>();
  for (const u of byType) themeCounts.set(themeOf(u), (themeCounts.get(themeOf(u)) ?? 0) + 1);
  const LAST = new Set(["more", "grammar", "from your reading"]);
  const themeList = [...themeCounts.entries()].sort((a, b) => (LAST.has(a[0]) ? 1 : 0) - (LAST.has(b[0]) ? 1 : 0) || a[0].localeCompare(b[0]));
  const view = themes.size === 0 ? byType : byType.filter((u) => themes.has(themeOf(u)));

  const toggleTheme = (t: string) => setThemes((prev) => { const next = new Set(prev); if (next.has(t)) next.delete(t); else next.add(t); return next; });

  const gradePool = (item: ReviewItem, ok: boolean) => { persist(gradeItem(progress, item, ok)); setIdx((i) => i + 1); };
  const gradeCaptured = (lexKey: string, ok: boolean) => {
    const e = progress.familiarity[lexKey];
    if (e) persist({ ...progress, familiarity: { ...progress.familiarity, [lexKey]: familiarity.grade(e, ok ? "good" : "again") } });
    setIdx((i) => i + 1);
  };

  const Filters = (
    <>
      <div className="picker small" style={{ marginBottom: 8 }}>
        {([["all", `All · ${scoped.length}`], ["words", `Words · ${words.length}`], ["sentences", `Sentences · ${sentences.length}`]] as const).map(([f, label]) => (
          <button key={f} className={type === f ? "active" : ""} onClick={() => setType(f)}>{label}</button>
        ))}
      </div>
      <div className="theme-chips">
        <button className={`chip-toggle${starredOnly ? " active" : ""}`} onClick={() => setStarredOnly((v) => !v)} title="Your saved words">★ Starred{starred.length ? ` · ${starred.length}` : ""}</button>
        <button className={`chip-toggle${themes.size === 0 ? " active" : ""}`} onClick={() => setThemes(new Set())}>All themes</button>
        {themeList.map(([t, n]) => (
          <button key={t} className={`chip-toggle${themes.has(t) ? " active" : ""}`} onClick={() => toggleTheme(t)} style={{ textTransform: "capitalize" }}>{t} · {n}</button>
        ))}
      </div>
    </>
  );

  if (view.length === 0)
    return <section className="view"><h2>Flashcards</h2><p className="lead" style={{ marginBottom: 12 }}>Pick what to drill — filter by type and theme.</p>{Filters}<p className="lead">{starredOnly && starred.length === 0 ? "No saved words yet. Tap ★ on a word while you learn — in a story, the Words list, or a lesson — to build your own deck here." : "Nothing in this filter. Pick another theme."}</p></section>;
  if (idx >= view.length)
    return <section className="view"><h2>Flashcards</h2><p className="lead" style={{ marginBottom: 12 }}>Pick what to drill — filter by type and theme.</p>{Filters}<p className="lead">Done — {view.length} reviewed. 🎉 <button className="linklike" onClick={() => setIdx(0)}>Go again</button></p></section>;

  const u = view[idx]!;
  return (
    <section className="view">
      <h2>Flashcards <span className="muted small">· {view.length - idx} left</span></h2>
      <p className="lead" style={{ marginBottom: 12 }}>Every word &amp; phrase is here — filter by type and theme to drill what you want. Grading strengthens it in your reviews.</p>
      {Filters}
      {u.type === "pool" ? (
        u.item.kind === "grammar"
          ? <GrammarCard key={u.key} item={u.item} onGrade={(ok) => gradePool(u.item, ok)} />
          : <PhraseCard key={u.key} item={u.item} onGrade={(ok) => gradePool(u.item, ok)} />
      ) : (
        <ClozeCard key={u.key} entry={u.entry} context={progress.contexts?.[u.key]} contextGloss={progress.contextGlosses?.[u.key] ?? (progress.contexts?.[u.key] ? lineGlosses.get(progress.contexts[u.key]!.trim()) : undefined)} onGrade={(ok) => gradeCaptured(u.key, ok)} />
      )}
    </section>
  );
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Captured-word review. When we know the sentence it was met in, blank the word inside it and show the
// English so it's clear what to produce ("Ana wants coffee" → say the missing word). Otherwise it's a
// plain recall card (English → target). Either way the English tells the learner what's being solved for.
// Type-in production for recall cards (Part A): accepts Latin (or Cyrillic) and matches against the
// transliteration, so no Cyrillic keyboard is needed. Comparison strips case/spaces/punctuation.
function typedMatches(typed: string, target: string): boolean {
  const norm = (x: string) => x.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");
  return norm(typed) === norm(target) || norm(romanize(typed)) === norm(romanize(target));
}

function TypedRecall({ onChecked, onReveal }: { onChecked: (val: string) => void; onReveal: () => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
      <input className="lang-picker" placeholder="type it (Latin ok)" value={val} style={{ flex: 1, minWidth: 160 }}
        onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) onChecked(val.trim()); }} />
      <button className="btn" disabled={!val.trim()} onClick={() => onChecked(val.trim())}>Check</button>
      <button className="ghost" onClick={onReveal}>Reveal</button>
    </div>
  );
}

function ClozeCard({ entry, context, contextGloss, onGrade }: { entry: FamiliarityEntry; context?: string; contextGloss?: string; onGrade: (ok: boolean) => void }) {
  const pack = usePack();
  const play = usePlay();
  const [revealed, setRevealed] = useState(false);
  const [typedVal, setTypedVal] = useState<string | null>(null);
  const blanked = context ? context.replace(new RegExp(`(^|[^\\p{L}])(${escapeRe(entry.display)})(?=[^\\p{L}]|$)`, "iu"), (_m, pre) => `${pre}____`) : null;
  // Only blank the sentence when we also have its English — a fill-in-the-blank with no translation gives
  // the learner no way to know which word to produce. Without the English, fall back to the plain recall
  // card below (which shows the word's own gloss).
  const cloze = contextGloss && blanked && blanked !== context ? blanked : null;
  return (
    <div className="fb">
      {cloze ? (
        <>
          <div className="muted small">Say the missing word — “{contextGloss}”:</div>
          <div style={{ fontSize: 19, margin: "8px 0", lineHeight: 1.5 }}>{cloze}</div>
        </>
      ) : (
        <>
          <div className="muted small">Say in {pack.name}{entry.gloss ? ` — “${entry.gloss}”` : ""}:</div>
          <div style={{ fontSize: 19, margin: "8px 0" }}>{entry.gloss ?? entry.display}</div>
        </>
      )}
      {!revealed ? (
        <TypedRecall onChecked={(v) => { setTypedVal(v); setRevealed(true); }} onReveal={() => setRevealed(true)} />
      ) : (
        <div>
          {typedVal !== null && <div className="muted small" style={{ marginBottom: 6 }}>{typedMatches(typedVal, entry.display) ? "✓ correct" : `✗ you wrote “${typedVal}”`}</div>}
          {cloze ? (
            <>
              <div className="target" style={{ fontSize: 20, lineHeight: 1.5 }}>{context}</div>
              <div className="muted small" style={{ marginTop: 2 }}>{entry.display}{entry.gloss ? ` — ${entry.gloss}` : ""}</div>
            </>
          ) : (
            <div className="target" style={{ fontSize: 22 }}>{entry.display}</div>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            {cloze && context ? (
              <>
                <button className="ghost" onClick={() => play(context, 0.8)}>🔊 hear phrase</button>
                <button className="ghost" onClick={() => play(entry.display, 0.8)}>🔊 word</button>
              </>
            ) : (
              <button className="ghost" onClick={() => play(entry.display, 0.8)}>🔊 hear</button>
            )}
            <button className="ghost" onClick={() => onGrade(false)}>Again</button>
            <button className="btn" onClick={() => onGrade(true)}>Good</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Word-by-word breakdown + a one-line "how it fits" takeaway, shown on a phrase/chunk reveal so the
// learner sees which piece means what and how they combine. Renders nothing for single-word items.
function PhraseBreakdown({ item }: { item: ReviewItem }) {
  if (!item.breakdown?.length && !item.takeaway) return null;
  return (
    <div className="breakdown">
      {item.breakdown?.length ? (
        <ul className="bd-list">
          {item.breakdown.map((b, i) => (
            <li key={i}><span className="bd-part">{b.part}</span><span className="bd-gloss">{b.gloss}</span></li>
          ))}
        </ul>
      ) : null}
      {item.takeaway ? <div className="bd-takeaway">💡 {item.takeaway}</div> : null}
    </div>
  );
}

function PhraseCard({ item, onGrade }: { item: ReviewItem; onGrade: (ok: boolean) => void }) {
  const pack = usePack();
  const play = usePlay();
  const [revealed, setRevealed] = useState(false);
  const [typedVal, setTypedVal] = useState<string | null>(null);
  return (
    <div className="fb">
      <div className="muted small">Say in {pack.name}:</div>
      <div style={{ fontSize: 20, margin: "6px 0" }}>{item.gloss}</div>
      {!revealed ? (
        <TypedRecall onChecked={(v) => { setTypedVal(v); setRevealed(true); }} onReveal={() => setRevealed(true)} />
      ) : (
        <div>
          {typedVal !== null && <div className="muted small" style={{ marginBottom: 6 }}>{typedMatches(typedVal, item.answer) ? "✓ correct" : `✗ you wrote “${typedVal}”`}</div>}
          <div className="target" style={{ fontSize: 22 }}>{item.answer}</div>
          <div className="translit">{item.translit}</div>
          <PhraseBreakdown item={item} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="ghost" onClick={() => play(item.answer, 0.8)}>🔊 hear</button>
            <button className="ghost" onClick={() => onGrade(false)}>Again</button>
            <button className="btn" onClick={() => onGrade(true)}>Good</button>
          </div>
        </div>
      )}
    </div>
  );
}

function GrammarCard({ item, onGrade }: { item: ReviewItem; onGrade: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
  };
  const concept = (item.meta?.concept as string) || "";
  return (
    <div className="fb">
      <div className="muted small">{concept}</div>
      <div style={{ fontSize: 18, margin: "6px 0" }}><b>{item.prompt}</b></div>
      <div>
        {(item.options ?? []).map((o) => {
          const cls = picked ? (o === item.answer ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt";
          return <button className={cls} key={o} disabled={!!picked} onClick={() => choose(o)}>{o}</button>;
        })}
      </div>
      {picked && (
        <div className="why">
          {picked === item.answer ? "✓ " : "✗ "}{item.why}
          <button className="btn" style={{ marginLeft: 8 }} onClick={() => onGrade(picked === item.answer)}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ---------- Me: settings ----------
// ---------- Partnered learning (Phase 0): invite/consent, visibility, shared streak, activity, nudges ----------
const NUDGES = ["Proud of you 💪", "Keep the streak 🔥", "Your turn 🎤", "Miss practising with you 👋"];
const VIS_TOGGLES: [keyof VisibilitySettings, string][] = [
  ["shareActivity", "Activity"],
  ["shareStreak", "Streak"],
  ["shareFamiliarity", "Vocabulary"],
  ["allowTeachBack", "Teach-back"],
];
const colStack: CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };

// Async voice role-swap (Phase 1, flagship): split a 2-role scenario across the dyad; each records
// their lines (reusing makeRecorder + the dual-ASR feedback pipeline), the app stitches them into a
// replayable conversation. The session — incl. recorded audio as data-URLs for the MVP — is one
// partner_artifact (kind 'roleswap'); recording re-reads latest before saving to avoid clobber.
const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("audio read failed"));
    r.readAsDataURL(blob);
  });
const playDataUrl = (url: string): Promise<void> =>
  new Promise((res, rej) => {
    const a = new Audio(url);
    a.onended = () => res();
    a.onerror = () => rej(new Error("audio playback error"));
    a.play().catch(rej);
  });

// Live conversation (Phase 4, crown jewel): the app coaches a real-time conversation between the two
// learners over a scenario. The session is a 'live' partner_artifact; both screens stay in sync via
// Supabase Realtime (postgres_changes) + presence, falling back to a manual ↻ if realtime is down.
function LiveConvoSection({ store, partnershipId, onOpen }: { store: PartnerStore; partnershipId: string; onOpen: (id: string | "new") => void }) {
  const pack = usePack();
  const [sessions, setSessions] = useState<PartnerArtifact[]>([]);
  // Realtime so a partner SEES the session the other just started and joins it (stay-in-sync) — instead
  // of the stale on-mount list that let both hit "Start" and create rival sessions.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const a = await store.listArtifacts(partnershipId, "live");
        if (alive) setSessions(a);
      } catch {
        /* tolerate */
      }
    };
    void load();
    const unsub = subscribeArtifacts(partnershipId, () => void load());
    return () => {
      alive = false;
      unsub();
    };
  }, [store, partnershipId]);
  const activeSessions = sessions.filter((a) => (a.payload as LiveSession).status !== "complete");
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="small">Live conversation</span>
        <button className="btn small" onClick={() => onOpen("new")}>Start →</button>
      </div>
      <p className="muted small" style={{ margin: "4px 0 0" }}>Talk through a scenario together in real time — the app keeps you both in sync and coaches each line.</p>
      {activeSessions.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "flex", flexDirection: "column", gap: 4 }}>
          {activeSessions.map((a) => {
            const s = a.payload as LiveSession;
            const title = pack.scenarios.find((x) => x.id === s.scenarioId)?.title ?? s.scenarioId;
            return (
              <li key={a.id} className="row" style={{ justifyContent: "space-between" }}>
                <span className="small">{title} <span className="muted">· live now</span></span>
                <button className="btn small" onClick={() => onOpen(a.id)}>Join</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LiveConvo({ store, partnershipId, packId, myId, partnerId, sessionId }: {
  store: PartnerStore;
  partnershipId: string;
  packId: string;
  myId: string;
  partnerId: string;
  sessionId: string | "new";
}) {
  const pack = usePack();
  const play = usePlay();
  const [session, setSession] = useState<LiveSession | null>(null);
  // Effective session id: tracks the prop, but flips to the real id once a "new" session is created,
  // so refresh + realtime activate for a freshly-started session (not just pre-existing ones).
  const [sid, setSid] = useState<string | "new">(sessionId);
  useEffect(() => {
    setSid(sessionId);
  }, [sessionId]);
  const [online, setOnline] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState(""); // short coaching tip for my last line, fetched off the critical path
  const [err, setErr] = useState(""); // surface start/sync failures instead of a dead click
  const rec = useRef(makeRecorder());

  const refresh = useCallback(async () => {
    if (sid === "new") return;
    try {
      const a = (await store.listArtifacts(partnershipId, "live")).find((x) => x.id === sid);
      if (a) setSession(a.payload as LiveSession);
    } catch {
      /* keep current */
    }
  }, [store, partnershipId, sid]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime: re-sync on any artifact change + track presence. Manual ↻ button covers realtime outages.
  useEffect(() => {
    if (sid === "new") return;
    const unsubArtifacts = subscribeArtifacts(partnershipId, () => void refresh());
    const unsubPresence = joinPresence(partnershipId, myId, setOnline);
    return () => {
      unsubArtifacts();
      unsubPresence();
    };
  }, [partnershipId, sid, myId, refresh]);

  const start = async (scenarioId: string) => {
    const sc = pack.scenarios.find((s) => s.id === scenarioId);
    if (!sc) return;
    setErr("");
    try {
      // Deterministic id per (partnership, scenario): two partners starting the same scenario converge on
      // ONE row (PK upsert) instead of minting rival sessions with swapped roles — the dual-learner/deadlock
      // fix, no migration needed. Join an existing session rather than overwriting its in-progress state.
      const id = await sharedArtifactId("live", partnershipId, scenarioId);
      const existing = (await store.listArtifacts(partnershipId, "live")).find((x) => x.id === id);
      if (existing) {
        setSession(existing.payload as LiveSession);
        setSid(id);
        return;
      }
      const sess = live.startLive(id, packId, sc, live.assignLiveRolesStable(myId, partnerId));
      await store.putArtifact(partnershipId, packId, "live", sess, id);
      setSession(sess);
      setSid(id); // activate refresh + realtime for the just-created session
    } catch (e) {
      setErr((e as { message?: string }).message ?? "Couldn't start the session — try again.");
    }
  };

  const startRec = async () => {
    setRecording(true);
    await rec.current.start();
  };

  const speak = async () => {
    if (!session) return;
    const turn = live.currentTurn(session);
    if (!turn) return;
    const spokenIndex = turn.index;
    setRecording(false);
    setBusy(true);
    setTip("");
    try {
      const blob = await rec.current.stop();
      const asr = await api.asr(blob, packId);
      const transcripts = { scribe: asr.eleven?.text, google: asr.google?.text };
      const transcript = transcripts.scribe || transcripts.google || "";
      // Advance the turn the instant ASR returns — don't make BOTH partners wait ~11s for coaching.
      const latest = ((await store.listArtifacts(partnershipId, "live")).find((x) => x.id === session.id)?.payload as LiveSession) ?? session;
      const next = live.speakTurn(latest, myId, transcript);
      await store.putArtifact(partnershipId, packId, "live", next, next.id);
      setSession(next);
      // Score + a short coaching tip arrive a beat later, off the critical path; realtime backfills both.
      void (async () => {
        try {
          const fb = await api.feedback({ answer: turn.text, translit: turn.translit, gloss: turn.gloss }, transcripts, packId);
          if (fb.error) return;
          if (fb.tip) setTip(fb.tip);
          const cur = ((await store.listArtifacts(partnershipId, "live")).find((x) => x.id === session.id)?.payload as LiveSession) ?? next;
          await store.putArtifact(partnershipId, packId, "live", live.setTurnScore(cur, spokenIndex, fb.score), cur.id);
        } catch {
          /* coaching is best-effort — the turn already advanced */
        }
      })();
    } finally {
      setBusy(false);
    }
  };

  if (sessionId === "new" && !session) {
    return (
      <div style={colStack}>
        <span className="small">Pick a scenario to do live together</span>
        {err ? <div className="err">{err}</div> : null}
        <div className="cards">
          {pack.scenarios.map((s) => (
            <button key={s.id} className="contentcard" onClick={() => start(s.id)}>
              <div className="cc-title">{s.title}</div>
              <div className="muted small">{s.setting}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (!session) return <span className="muted small">…</span>;

  const myRole = live.roleOf(session, myId);
  const turn = live.currentTurn(session);
  const myTurn = live.isMyTurn(session, myId);
  const done = live.isComplete(session);
  const partnerOnline = online.includes(partnerId);

  return (
    <div style={colStack}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="small">Live · <b>{done ? "complete" : myTurn ? "your turn to speak" : "your partner's turn"}</b></span>
        <span className="muted small">{partnerOnline ? "🟢 partner here" : "⚪ waiting for partner"} <button className="ghost small" onClick={refresh}>↻</button></span>
      </div>
      {session.turns.filter((t) => t.spokenBy).map((t) => (
        <div className="fb" key={t.index}>
          <span className="muted small">{t.speaker === myRole ? "you" : "partner"}:</span> <b>{t.text}</b>
          <span className="translit"> · {translitOr(t.text, t.translit)}</span>
          {t.transcript ? <div className="muted small">heard: {t.transcript}{typeof t.score === "number" ? ` · ${t.score}/100` : " · scoring…"}</div> : null}
        </div>
      ))}
      {tip && <div className="fb"><span className="muted small">💡 on your last line: {tip}</span></div>}
      {done ? (
        <p className="lead" style={{ color: "var(--ok)", margin: 0 }}>🎉 Conversation complete — nicely done, both of you!</p>
      ) : myTurn ? (
        <div className="fb">
          <div className="muted small">Your line:</div>
          <div className="row"><button className="spk" onClick={() => turn && play(turn.text, 0.9)}>🔊</button> <b>{turn?.text}</b></div>
          <div className="gloss">{turn?.gloss}{turn ? ` · ${translitOr(turn.text, turn.translit)}` : ""}</div>
          {recording ? <button className="rec" onClick={speak}>⏹ Stop</button> : <button className="btn" disabled={busy} onClick={startRec}>{busy ? "scoring…" : "● say it"}</button>}
        </div>
      ) : (
        <div className="fb">
          <div className="muted small">🎙 Your partner&apos;s line — follow along &amp; help:</div>
          <div className="row"><button className="spk" onClick={() => turn && play(turn.text, 0.9)}>🔊</button> <b>{turn?.text}</b></div>
          <div className="gloss">{turn?.gloss}{turn ? ` · ${translitOr(turn.text, turn.translit)}` : ""}</div>
        </div>
      )}
    </div>
  );
}

// ---------- v2 "Together session" (see DESIGN-partnered-v2.md) ----------
// The re-envisioned flagship: a short, live, two-device co-op recall drill for two matched beginners.
// The launcher shows Start (or Join, if the partner already started one, via Realtime).
function TogetherLauncher({ store, partnershipId, onOpen }: { store: PartnerStore; partnershipId: string; onOpen: (id: string | "new") => void }) {
  const [active, setActive] = useState<PartnerArtifact | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const a = (await store.listArtifacts(partnershipId, "together")).find((x) => (x.payload as together.TogetherSession).status !== "complete") ?? null;
        if (alive) setActive(a);
      } catch {
        /* tolerate — the button still works */
      }
    };
    void load();
    const unsub = subscribeArtifacts(partnershipId, () => void load());
    return () => {
      alive = false;
      unsub();
    };
  }, [store, partnershipId]);
  return (
    <div className="fb" style={{ textAlign: "center" }}>
      <div className="small" style={{ marginBottom: 8 }}>{active ? "Your partner started a session — jump in." : "A quick drill you do together, in real time."}</div>
      {active ? (
        <button className="btn" onClick={() => onOpen(active.id)}>Join the session →</button>
      ) : (
        <button className="btn" onClick={() => onOpen("new")}>▶ Start a session together</button>
      )}
      <div className="muted small" style={{ marginTop: 8 }}>~6 min · you both need to be here now</div>
    </div>
  );
}

// The session itself. One partner PRODUCES (says the target from the English prompt); the other CHECKS
// (holds the answer, taps ✓/↻). Roles flip per item. Synced over the same Realtime channel LiveConvo uses.
// Each partner grades their OWN produced turns into their private SRS (familiarity is per-user).
function TogetherSession({ store, partnershipId, packId, myId, partnerId, progress, persist, partnerProjection, sessionId, onExit }: {
  store: PartnerStore;
  partnershipId: string;
  packId: string;
  myId: string;
  partnerId: string;
  progress: Progress;
  persist: (p: Progress) => void;
  partnerProjection: FamiliarityProjection | null;
  sessionId: string | "new";
  onExit: () => void;
}) {
  const pack = usePack();
  const play = usePlay();
  const [session, setSession] = useState<together.TogetherSession | null>(null);
  const [sid, setSid] = useState<string | "new">(sessionId);
  const [online, setOnline] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const gradedRef = useRef<Set<string>>(new Set()); // "<queue-sig>#<index>" of my produced turns already graded
  useEffect(() => { setSid(sessionId); }, [sessionId]);

  // Drillable pool: single words + phrases with a gloss and a target form.
  const candidates = useMemo<together.TogetherCandidate[]>(
    () => pack.vocab
      .filter((v) => (v.kind === "vocab" || v.kind === "phrase") && !!v.answer && !!v.gloss)
      .map((v) => ({ lexKey: familiarity.deriveKeyForItem(v).lexKey, prompt: v.gloss, answer: v.answer, translit: v.translit })),
    [pack],
  );

  const refresh = useCallback(async () => {
    if (sid === "new") return;
    try {
      const a = (await store.listArtifacts(partnershipId, "together")).find((x) => x.id === sid);
      if (a) setSession(a.payload as together.TogetherSession);
    } catch {
      /* keep current */
    }
  }, [store, partnershipId, sid]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (sid === "new") return;
    const unsubArtifacts = subscribeArtifacts(partnershipId, () => void refresh());
    const unsubPresence = joinPresence(partnershipId, myId, setOnline);
    return () => { unsubArtifacts(); unsubPresence(); };
  }, [partnershipId, sid, myId, refresh]);

  const buildAndStart = useCallback(async () => {
    setErr("");
    try {
      // Deterministic id per partnership (mirrors LiveConvo): both partners converge on ONE session row.
      const id = await sharedArtifactId("together", partnershipId, "recall");
      const existing = (await store.listArtifacts(partnershipId, "together")).find((x) => x.id === id);
      if (existing && (existing.payload as together.TogetherSession).status !== "complete") {
        setSession(existing.payload as together.TogetherSession);
        setSid(id);
        return; // join the partner's in-progress session rather than overwriting it
      }
      const members = [myId, partnerId].sort() as [string, string];
      const myProj = partnerDiff.projectFamiliarity(progress.familiarity, packId);
      const pProj = partnerProjection ?? { packId, entries: {} };
      // Arrange projections to match the sorted members so both clients build an identical queue.
      const projections = (members[0] === myId ? [myProj, pProj] : [pProj, myProj]) as [FamiliarityProjection, FamiliarityProjection];
      const turns = together.buildQueue(members, projections, candidates, { limit: 12 });
      const sess = together.startTogether(id, packId, members[0], members[1], turns);
      await store.putArtifact(partnershipId, packId, "together", sess, id);
      setSession(sess);
      setSid(id);
    } catch (e) {
      setErr((e as { message?: string }).message ?? "Couldn't start — try again.");
    }
  }, [store, partnershipId, packId, myId, partnerId, progress.familiarity, partnerProjection, candidates]);

  useEffect(() => { if (sessionId === "new" && !session) void buildAndStart(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sessionId]);

  // Grade MY produced turns into MY private SRS as the checker's verdicts land (via realtime). Namespaced
  // by the queue signature so a fresh "Go again" session re-grades cleanly.
  useEffect(() => {
    if (!session) return;
    const sig = session.turns.map((t) => t.lexKey).join(",");
    const mine = session.turns.filter((t) => t.result && t.producer === myId && !gradedRef.current.has(`${sig}#${t.index}`));
    if (!mine.length) return;
    let p = progress;
    for (const t of mine) {
      gradedRef.current.add(`${sig}#${t.index}`);
      const base = p.familiarity[t.lexKey] ?? familiarity.capture({ lexKey: t.lexKey, kind: t.answer.includes(" ") ? "chunk" : "word", display: t.answer, gloss: t.prompt });
      p = { ...p, familiarity: { ...p.familiarity, [t.lexKey]: familiarity.grade(familiarity.markStudied(base), t.result === "got" ? "good" : "again") } };
    }
    persist(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const check = async (got: boolean) => {
    if (!session) return;
    setErr("");
    try {
      const latest = ((await store.listArtifacts(partnershipId, "together")).find((x) => x.id === session.id)?.payload as together.TogetherSession) ?? session;
      const next = together.checkTurn(latest, myId, got);
      await store.putArtifact(partnershipId, packId, "together", next, next.id);
      setSession(next);
    } catch (e) {
      setErr((e as { message?: string }).message ?? "Sync hiccup — tap ↻.");
    }
  };

  const partnerOnline = online.includes(partnerId);
  const HeaderRow = (
    <div className="row" style={{ justifyContent: "space-between" }}>
      <button className="ghost small" onClick={onExit}>← Together</button>
      <span className="muted small">{partnerOnline ? "🟢 partner here" : "⚪ waiting for partner"} <button className="ghost small" onClick={refresh}>↻</button></span>
    </div>
  );

  if (!session) return <div style={colStack}>{HeaderRow}{err ? <div className="err">{err}</div> : <span className="muted small">Setting up…</span>}</div>;

  const sc = together.score(session);
  if (session.status === "complete") {
    return (
      <div style={colStack}>
        {HeaderRow}
        {sc.total === 0 ? (
          <p className="lead" style={{ margin: 0 }}>Nothing new to drill together right now — do a solo lesson to build up some words, then come back. 🎉</p>
        ) : (
          <>
            <p className="lead" style={{ color: "var(--ok)", margin: 0 }}>🎉 You cleared <b>{sc.got}/{sc.total}</b> together!</p>
            <p className="muted small" style={{ margin: 0 }}>Each of you kept the words you produced in your own reviews.</p>
          </>
        )}
        <div className="row">
          <button className="btn" onClick={buildAndStart}>Go again →</button>
          <button className="ghost" onClick={onExit}>Done</button>
        </div>
      </div>
    );
  }

  const turn = together.currentTurn(session)!;
  const iProduce = together.isMyTurnToProduce(session, myId);
  const total = session.turns.length;
  return (
    <div style={colStack}>
      {HeaderRow}
      <div className="pbar"><div style={{ width: `${(session.turnIndex / (total || 1)) * 100}%` }} /></div>
      <div className="muted small">Turn {session.turnIndex + 1} of {total} · cleared {sc.got}</div>
      {err ? <div className="err">{err}</div> : null}
      {iProduce ? (
        <div className="fb">
          <div className="muted small">Your turn — say this in {pack.name}, out loud:</div>
          <div className="target" style={{ fontSize: 24, margin: "8px 0" }}>{turn.prompt}</div>
          <div className="muted small">🎙 {partnerOnline ? "Your partner is checking you…" : "waiting for your partner to check…"}</div>
        </div>
      ) : (
        <div className="fb">
          <div className="muted small">Your partner is saying <b>“{turn.prompt}”</b> — did they get it?</div>
          <div className="row" style={{ alignItems: "center", margin: "8px 0" }}>
            <button className="spk" onClick={() => play(turn.answer, 0.9)}>🔊</button>
            <b className="target" style={{ fontSize: 22 }}>{turn.answer}</b>
            <span className="translit"> · {translitOr(turn.answer, turn.translit)}</span>
          </div>
          <div className="row">
            <button className="btn" onClick={() => check(true)}>✓ Got it</button>
            <button className="ghost" onClick={() => check(false)}>↻ Again</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Info-gap (Phase 3, forced interdependence): each partner holds DIFFERENT secret info + a shared
// goal neither can reach alone. The view renders ONLY this partner's half (briefFor) — the asymmetry
// is the task. The shared checklist is one 'infogap' partner_artifact; ticks re-read latest to merge.
function InfoGapSection({ store, partnershipId, onOpen }: { store: PartnerStore; partnershipId: string; onOpen: (id: string | "new") => void }) {
  const pack = usePack();
  const [sessions, setSessions] = useState<PartnerArtifact[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const a = await store.listArtifacts(partnershipId, "infogap");
        if (alive) setSessions(a);
      } catch {
        /* tolerate */
      }
    };
    void load();
    const unsub = subscribeArtifacts(partnershipId, () => void load());
    return () => {
      alive = false;
      unsub();
    };
  }, [store, partnershipId]);
  if (!(pack.infoGapTasks ?? []).length) return null;
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="small">Info-gap challenge</span>
        <button className="btn small" onClick={() => onOpen("new")}>Start →</button>
      </div>
      <p className="muted small" style={{ margin: "4px 0 0" }}>Each of you gets different secret info — you can only finish by talking it out in {pack.name}.</p>
      {sessions.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "flex", flexDirection: "column", gap: 4 }}>
          {sessions.map((a) => {
            const s = a.payload as InfoGapSession;
            const task = pack.infoGapTasks?.find((t) => t.id === s.taskId);
            return (
              <li key={a.id} className="row" style={{ justifyContent: "space-between" }}>
                <span className="small">{task?.title ?? s.taskId} <span className="muted">· {s.status === "complete" ? "done ✓" : `${s.metCriteria.length}/${task?.successCriteria.length ?? "?"}`}</span></span>
                <button className="ghost small" onClick={() => onOpen(a.id)}>Open</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function InfoGap({ store, partnershipId, packId, myId, partnerId, sessionId }: {
  store: PartnerStore;
  partnershipId: string;
  packId: string;
  myId: string;
  partnerId: string;
  sessionId: string | "new";
}) {
  const pack = usePack();
  const play = usePlay();
  const [session, setSession] = useState<InfoGapSession | null>(null);
  const [err, setErr] = useState(""); // surface start failures instead of a dead click

  const refresh = useCallback(async () => {
    if (sessionId === "new") return;
    try {
      const a = (await store.listArtifacts(partnershipId, "infogap")).find((x) => x.id === sessionId);
      if (a) setSession(a.payload as InfoGapSession);
    } catch {
      /* keep current */
    }
  }, [store, partnershipId, sessionId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const start = async (taskId: string) => {
    const task = pack.infoGapTasks?.find((t) => t.id === taskId);
    if (!task) return;
    setErr("");
    try {
      // Deterministic id + join-don't-duplicate: one shared task per (partnership, task) so both halves
      // and the shared checklist live on a single row. Sorted ids keep the A/B assignment stable.
      const id = await sharedArtifactId("infogap", partnershipId, taskId);
      const existing = (await store.listArtifacts(partnershipId, "infogap")).find((x) => x.id === id);
      if (existing) {
        setSession(existing.payload as InfoGapSession);
        return;
      }
      const [lo, hi] = [myId, partnerId].sort();
      const sess = infogap.startInfoGap(id, packId, task, { [lo!]: "A", [hi!]: "B" });
      await store.putArtifact(partnershipId, packId, "infogap", sess, id);
      setSession(sess);
    } catch (e) {
      setErr((e as { message?: string }).message ?? "Couldn't start the challenge — try again.");
    }
  };

  const toggle = async (task: InfoGapTask, criterionId: string) => {
    const latest = ((await store.listArtifacts(partnershipId, "infogap")).find((x) => x.id === session!.id)?.payload as InfoGapSession) ?? session!;
    const next = infogap.toggleCriterion(latest, task, criterionId);
    await store.putArtifact(partnershipId, packId, "infogap", next, next.id);
    setSession(next);
  };

  if (sessionId === "new" && !session) {
    return (
      <div style={colStack}>
        <span className="small">Pick an info-gap challenge</span>
        {err ? <div className="err">{err}</div> : null}
        <div className="cards">
          {(pack.infoGapTasks ?? []).map((t) => (
            <button key={t.id} className="contentcard" onClick={() => start(t.id)}>
              <div className="cc-title">{t.title}</div>
              <div className="muted small">{t.goal}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (!session) return <span className="muted small">…</span>;
  const task = pack.infoGapTasks?.find((t) => t.id === session.taskId);
  if (!task) return <span className="muted small">task not found</span>;
  const role = infogap.roleOf(session, myId) ?? "A";
  const brief = infogap.briefFor(task, role);
  const done = infogap.isComplete(session, task);

  return (
    <div style={colStack}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="small">You are <b>{role === "A" ? "the customer" : "the waiter"}</b></span>
        <button className="ghost small" onClick={refresh}>↻ Refresh</button>
      </div>
      <p className="lead" style={{ margin: 0 }}>{task.goal}</p>
      <div className="fb">
        <b>{brief.brief}</b>
        <div style={{ marginTop: 6 }}>
          <span className="muted small">Only you know:</span>
          <ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>{brief.secretInfo.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <div style={{ marginTop: 6 }}>
          <span className="muted small">You can say:</span>
          {brief.targetPhrases.map((p, i) => (
            <div className="row" key={i} style={{ marginTop: 2 }}>
              <button className="spk" onClick={() => play(p.text, 0.9)}>🔊</button>
              <span><b>{p.text}</b> <span className="muted small">· {translitOr(p.text, p.translit)} — {p.gloss}</span></span>
            </div>
          ))}
        </div>
      </div>
      <span className="small">Together, tick off as you go:</span>
      {task.successCriteria.map((c) => {
        const met = session.metCriteria.includes(c.id);
        return (
          <button key={c.id} className={`badge ${met ? "on" : "off"}`} style={{ textAlign: "left" }} onClick={() => toggle(task, c.id)}>
            {met ? "✓" : "○"} {c.description}
          </button>
        );
      })}
      {done && <p className="lead" style={{ color: "var(--ok)", margin: "6px 0 0" }}>🎉 Gap bridged — you pulled it off together!</p>}
    </div>
  );
}

// Familiarity-driven collaboration (Phase 2): one complementaryDiff over the two partners' gated
// familiarity projections, surfaced two ways — complementary review ("your partner knows this — ask
// them") and the protégé effect (record a short explanation of something you're ahead on). The
// teach-back recordings are 'teachback' partner_artifacts (audio as data-URLs, like role-swap).
function FamiliarityCollab({ store, partnershipId, packId, myId, partnerId, diff, progress }: {
  store: PartnerStore;
  partnershipId: string;
  packId: string;
  myId: string;
  partnerId: string;
  diff: ComplementaryDiff | null;
  progress: Progress;
}) {
  const [inbox, setInbox] = useState<PartnerArtifact[]>([]);
  const [recKey, setRecKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const rec = useRef(makeRecorder());

  const loadInbox = useCallback(async () => {
    try {
      setInbox(await store.listArtifacts(partnershipId, "teachback"));
    } catch {
      /* tolerate a missing list */
    }
  }, [store, partnershipId]);
  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  if (!diff) return <p className="muted small">Turn on “Vocabulary” sharing below to swap review help with your partner.</p>;

  const label = (lexKey: string) => progress.familiarity[lexKey]?.display ?? lexKey;
  const reviewHelp = complementarySrs.routeComplementary(familiarity.dueKeys(progress.familiarity), diff).slice(0, 6);
  const canHelp = diff.partnerCanHelpMe.slice(0, 8);
  const prompts = teachback.proposeTeachBacks(diff, myId, partnerId, { limit: 4 });
  const taught = new Set(inbox.filter((a) => (a.payload as { teacher?: string }).teacher === myId).map((a) => (a.payload as { lexKey?: string }).lexKey));
  const forMe = inbox.filter((a) => {
    const p = a.payload as { learner?: string; audio?: string };
    return p.learner === myId && !!p.audio;
  });

  const startTeach = async (lexKey: string) => {
    setRecKey(lexKey);
    await rec.current.start();
  };
  const stopTeach = async (lexKey: string) => {
    setRecKey(null);
    setBusyKey(lexKey);
    try {
      const audio = await blobToDataUrl(await rec.current.stop());
      await store.putArtifact(partnershipId, packId, "teachback", { lexKey, teacher: myId, learner: partnerId, audio, status: "recorded", createdAt: new Date().toISOString() });
      await loadInbox();
    } finally {
      setBusyKey(null);
    }
  };

  if (!canHelp.length && !prompts.length && !forMe.length) {
    return <p className="muted small">No complementary gaps right now — you two know similar words. 🎯</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="small">Help each other</span>
      {reviewHelp.length > 0 && (
        <p className="muted small" style={{ margin: 0 }}>Due for you & your partner knows: <b>{reviewHelp.map((r) => label(r.lexKey)).join(", ")}</b> — quiz each other.</p>
      )}
      {canHelp.length > 0 && (
        <p className="muted small" style={{ margin: 0 }}>Your partner knows <b>{canHelp.map((i) => label(i.lexKey)).join(", ")}</b> — ask them.</p>
      )}
      {prompts.length > 0 && (
        <div>
          <p className="muted small" style={{ margin: "2px 0 0" }}>You're ahead here — record a quick explanation (teaching helps you most):</p>
          {prompts.map((p) => (
            <div className="row" key={p.lexKey} style={{ marginTop: 4 }}>
              <b>{label(p.lexKey)}</b>
              {taught.has(p.lexKey) ? (
                <span className="badge on">sent ✓</span>
              ) : recKey === p.lexKey ? (
                <button className="rec" onClick={() => stopTeach(p.lexKey)}>⏹ Stop &amp; send</button>
              ) : (
                <button className="ghost small" disabled={busyKey !== null} onClick={() => startTeach(p.lexKey)}>{busyKey === p.lexKey ? "saving…" : "● explain"}</button>
              )}
            </div>
          ))}
        </div>
      )}
      {forMe.length > 0 && (
        <div>
          <p className="muted small" style={{ margin: "2px 0 0" }}>Your partner explained:</p>
          {forMe.map((a) => {
            const pl = a.payload as { lexKey?: string; audio?: string };
            return (
              <div className="row" key={a.id} style={{ marginTop: 4 }}>
                <b>{label(pl.lexKey ?? "")}</b>
                <button className="ghost small" onClick={() => pl.audio && playDataUrl(pl.audio)}>▶ play</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Overview entry: list in-progress/ready role-swaps + start a new one.
function RoleSwapSection({ store, partnershipId, onOpen }: { store: PartnerStore; partnershipId: string; onOpen: (id: string | "new") => void }) {
  const pack = usePack();
  const [sessions, setSessions] = useState<PartnerArtifact[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const a = await store.listArtifacts(partnershipId, "roleswap");
        if (alive) setSessions(a);
      } catch {
        /* overview tolerates a missing list */
      }
    };
    void load();
    const unsub = subscribeArtifacts(partnershipId, () => void load());
    return () => {
      alive = false;
      unsub();
    };
  }, [store, partnershipId]);
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="small">Role-swap</span>
        <button className="btn small" onClick={() => onOpen("new")}>Start →</button>
      </div>
      <p className="muted small" style={{ margin: "4px 0 0" }}>Act out a 2-person dialogue together — each records their lines, then play it back with feedback.</p>
      {sessions.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "flex", flexDirection: "column", gap: 4 }}>
          {sessions.map((a) => {
            const s = a.payload as RoleSwapSession;
            const title = pack.scenarios.find((x) => x.id === s.scenarioId)?.title ?? s.scenarioId;
            const done = s.turns.filter((t) => t.recordedBy).length;
            return (
              <li key={a.id} className="row" style={{ justifyContent: "space-between" }}>
                <span className="small">{title} <span className="muted">· {s.status === "complete" ? "ready ▶" : `${done}/${s.turns.length} lines`}</span></span>
                <button className="ghost small" onClick={() => onOpen(a.id)}>Open</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// The role-swap session: pick a scenario (when "new"), record your role's lines, see the partner's,
// then play the stitched conversation. Each recording runs the dual-ASR feedback pipeline.
function RoleSwap({ store, partnershipId, packId, myId, partnerId, sessionId }: {
  store: PartnerStore;
  partnershipId: string;
  packId: string;
  myId: string;
  partnerId: string;
  sessionId: string | "new";
}) {
  const pack = usePack();
  const [session, setSession] = useState<RoleSwapSession | null>(null);
  const [recIdx, setRecIdx] = useState<number | null>(null);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [err, setErr] = useState(""); // surface start failures instead of a dead click
  const rec = useRef(makeRecorder());

  const refresh = useCallback(async () => {
    if (sessionId === "new") return;
    try {
      const a = (await store.listArtifacts(partnershipId, "roleswap")).find((x) => x.id === sessionId);
      if (a) setSession(a.payload as RoleSwapSession);
    } catch {
      /* keep whatever we have */
    }
  }, [store, partnershipId, sessionId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const start = async (scenarioId: string) => {
    const sc = pack.scenarios.find((s) => s.id === scenarioId);
    if (!sc) return;
    setErr("");
    try {
      // Deterministic id + join-don't-duplicate: both partners land on ONE shared session so their
      // recordings accumulate together instead of two rival half-recorded copies. Roles sorted for stability.
      const id = await sharedArtifactId("roleswap", partnershipId, scenarioId);
      const existing = (await store.listArtifacts(partnershipId, "roleswap")).find((x) => x.id === id);
      if (existing) {
        setSession(existing.payload as RoleSwapSession);
        return;
      }
      const [lo, hi] = [myId, partnerId].sort();
      const sess = roleswap.startRoleSwap(id, packId, sc, roleswap.assignRoles(lo!, hi!));
      await store.putArtifact(partnershipId, packId, "roleswap", sess, id);
      setSession(sess);
    } catch (e) {
      setErr((e as { message?: string }).message ?? "Couldn't start the session — try again.");
    }
  };

  const onRecord = async (turn: RoleSwapTurn) => {
    setRecIdx(turn.index);
    await rec.current.start();
  };

  const onStop = async (turn: RoleSwapTurn) => {
    setRecIdx(null);
    setBusyIdx(turn.index);
    try {
      const blob = await rec.current.stop();
      const dataUrl = await blobToDataUrl(blob);
      const asr = await api.asr(blob, packId);
      const transcripts = { scribe: asr.eleven?.text, google: asr.google?.text };
      // Re-read the latest session so we don't clobber the partner's concurrent recordings.
      const latest = ((await store.listArtifacts(partnershipId, "roleswap")).find((x) => x.id === session!.id)?.payload as RoleSwapSession) ?? session!;
      let next = roleswap.recordTurn(latest, turn.index, myId, dataUrl, transcripts);
      const fb = await api.feedback({ answer: turn.text, translit: turn.translit, gloss: turn.gloss }, transcripts, packId);
      if (!fb.error) next = roleswap.attachFeedback(next, turn.index, fb as unknown as SpeakingFeedback);
      await store.putArtifact(partnershipId, packId, "roleswap", next, next.id);
      setSession(next);
    } finally {
      setBusyIdx(null);
    }
  };

  const playAll = async () => {
    if (!session) return;
    for (const t of session.turns) if (t.audio) await playDataUrl(t.audio);
  };

  if (sessionId === "new" && !session) {
    return (
      <div style={colStack}>
        <span className="small">Pick a scenario to act out together</span>
        {err ? <div className="err">{err}</div> : null}
        <div className="cards">
          {pack.scenarios.map((s) => (
            <button key={s.id} className="contentcard" onClick={() => start(s.id)}>
              <div className="cc-title">{s.title}</div>
              <div className="muted small">{s.setting}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (!session) return <span className="muted small">…</span>;

  const myRole = session.assignment[myId];
  return (
    <div style={colStack}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="small">You play <b>{myRole}</b> · partner plays the other lines</span>
        <button className="ghost small" onClick={refresh}>↻ Refresh</button>
      </div>
      {session.turns.map((t) => {
        const mine = t.speaker === myRole;
        return (
          <div className="fb" key={t.index}>
            <div className="row"><b>{t.text}</b> <span className="muted small">{t.gloss} · {translitOr(t.text, t.translit)}</span></div>
            {t.recordedBy ? (
              <div className="row" style={{ marginTop: 4 }}>
                <button className="ghost small" onClick={() => t.audio && playDataUrl(t.audio)}>▶ play</button>
                <span className="muted small">{t.recordedBy === myId ? "you" : "partner"} recorded{t.feedback ? ` · ${t.feedback.score}/100` : ""}</span>
              </div>
            ) : mine ? (
              recIdx === t.index ? (
                <button className="rec" onClick={() => onStop(t)}>⏹ Stop &amp; save</button>
              ) : (
                <button className="btn small" disabled={busyIdx !== null} onClick={() => onRecord(t)}>{busyIdx === t.index ? "saving…" : "● record your line"}</button>
              )
            ) : (
              <span className="muted small">awaiting partner</span>
            )}
          </div>
        );
      })}
      {roleswap.isStitchable(session) && <button className="btn" onClick={playAll}>▶ Play the whole conversation</button>}
    </div>
  );
}

// Shared story (Phase 1): the pace-handicapping mechanic made concrete — both partners read the SAME
// mini-story (shared experience → conversation fuel), each at their own level (per-partner coverage,
// tap-to-capture, Q&A). The selection is a partner_artifact; reading reuses the existing StoryView.
function SharedStory({ store, partnershipId, packId, progress, navigateToStory }: {
  store: PartnerStore;
  partnershipId: string;
  packId: string;
  progress: Progress;
  navigateToStory: (storyId: string) => void;
}) {
  const pack = usePack();
  const stories = pack.stories ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const arts = await store.listArtifacts(partnershipId, "shared-story");
      setPicked((arts[arts.length - 1]?.payload as { storyId?: string } | undefined)?.storyId ?? null);
    } catch {
      /* empty selection falls back to the first story */
    }
  }, [store, partnershipId]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!stories.length) return null;
  const story = stories.find((s) => s.id === picked) ?? stories[0]!;
  const cov = coverageOf(story.body.map((b) => b.text).join(" "), progress.familiarity);

  const setShared = async (id: string) => {
    setBusy(true);
    try {
      await store.putArtifact(partnershipId, packId, "shared-story", { storyId: id, day: localDay() });
      setPicked(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="small">Shared story</span>
      <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
        <span><b>★ {story.title}</b>{story.titleGloss ? <span className="muted small"> — {story.titleGloss}</span> : null}</span>
        <span className="muted small">{Math.round(cov.familiarPct * 100)}% familiar to you</span>
      </div>
      <p className="muted small" style={{ margin: "4px 0 0" }}>You both read the same story at your own level — compare notes after.</p>
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn" onClick={() => navigateToStory(story.id)}>Read together →</button>
        {stories.length > 1 && (
          <select className="lang-picker" value={story.id} disabled={busy} onChange={(e) => setShared(e.target.value)} aria-label="Shared story">
            {stories.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

// Co-created phrasebook (Phase 1): a shared, growing deck either partner adds to. Each entry is a
// partner_artifact (kind 'phrase'); tapping "＋ my reviews" seeds it into THIS learner's familiarity —
// so a phrase one partner overhears becomes review fuel for both. Reuses api.gloss + familiarity.capture.
function Phrasebook({ store, partnershipId, packId, progress, persist }: {
  store: PartnerStore;
  partnershipId: string;
  packId: string;
  progress: Progress;
  persist: (p: Progress) => void;
}) {
  const [items, setItems] = useState<PartnerArtifact[]>([]);
  const [text, setText] = useState("");
  const [gloss, setGloss] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await store.listArtifacts(partnershipId, "phrase"));
    } catch {
      /* panel surfaces partner errors; an empty phrasebook is a safe fallback */
    }
  }, [store, partnershipId]);
  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    try {
      await store.putArtifact(partnershipId, packId, "phrase", { text: t, gloss: gloss.trim(), day: localDay() });
      setText("");
      setGloss("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const autoGloss = async () => {
    const t = text.trim();
    if (!t) return;
    const g = await api.gloss(t, "", packId);
    if (g.gloss) setGloss(g.gloss);
  };

  // Seed a phrase into the current learner's own familiarity (the cross-partner capture, §2 triage).
  const capture = (phrase: string, g?: string) => {
    const lexKey = familiarity.normalize(phrase);
    if (!lexKey || progress.familiarity[lexKey]) return;
    persist({ ...progress, familiarity: { ...progress.familiarity, [lexKey]: familiarity.capture({ lexKey, kind: "chunk", display: phrase, gloss: g }) } });
  };

  return (
    <div>
      <span className="small">Shared phrasebook</span>
      <div className="row" style={{ marginTop: 6 }}>
        <input className="lang-picker" style={{ minWidth: 150 }} placeholder="Phrase (target language)" value={text} onChange={(e) => setText(e.target.value)} />
        <input className="lang-picker" style={{ minWidth: 110 }} placeholder="meaning" value={gloss} onChange={(e) => setGloss(e.target.value)} />
        <button className="ghost small" disabled={busy || !text.trim()} onClick={autoGloss} title="Suggest a gloss">gloss?</button>
        <button className="btn" disabled={busy || !text.trim()} onClick={add}>Add</button>
      </div>
      {items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((it) => {
            const pl = it.payload as { text?: string; gloss?: string };
            const known = !!progress.familiarity[familiarity.normalize(pl.text ?? "")];
            return (
              <li key={it.id} className="row" style={{ justifyContent: "space-between" }}>
                <span><b>{pl.text}</b>{pl.gloss ? <span className="muted small"> — {pl.gloss}</span> : null}</span>
                <button className={`badge ${known ? "on" : ""}`} disabled={known} onClick={() => capture(pl.text ?? "", pl.gloss)} title="Add to my spaced-repetition reviews">
                  {known ? "in your reviews ✓" : "＋ my reviews"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// The STRUCTURED joint session: a guided, ordered "do this together" plan that reviews each person's
// recent solo work — vs. the flat activity menu below. Daily/weekly is a shared preference; the steps
// deep-link into the existing surfaces (live convo, the help-each-other diff, the shared story).
function PartnerSession({ plan, cadence, onCadence, onSpeak, onScrollTo }: {
  plan: partner.PartnerSessionPlan;
  cadence: partner.PartnerCadence;
  onCadence: (m: partner.PartnerCadence) => void;
  onSpeak: () => void;
  onScrollTo: (anchor: string) => void;
}) {
  const pack = usePack();
  const cadenceBtn = (m: partner.PartnerCadence, label: string) => (
    <button className={cadence === m ? "active" : ""} onClick={() => onCadence(m)}>{label}</button>
  );
  const row = (icon: string, title: string, sub: string, action: () => void, cta: string) => (
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span className="small" style={{ flex: 1 }}>{icon} {title} <span className="muted">· {sub}</span></span>
      <button className="btn small" style={{ whiteSpace: "nowrap" }} onClick={action}>{cta}</button>
    </div>
  );
  return (
    <div className="fb">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <b>Session together</b>
        <div className="picker small">{cadenceBtn("daily", "Today")}{cadenceBtn("weekly", "This week")}</div>
      </div>
      {plan.items.length === 0 ? (
        <p className="muted small">Each of you do a solo session first — then come back to review {plan.window === "this week" ? "the week's" : "today's"} work together.</p>
      ) : (
        <div style={colStack}>
          <p className="muted small" style={{ margin: 0 }}>~{plan.estMinutes} min · hone {plan.window === "this week" ? "the week" : "today"} together, in order:</p>
          {plan.emphasis !== "balanced" && (
            <p className="small" style={{ margin: 0, color: "var(--accent)" }}>
              {plan.emphasis === "you-teach" && `You're ahead ${plan.window} — walk your partner through what you learned.`}
              {plan.emphasis === "partner-teaches" && `Your partner covered more ${plan.window} — have them help you lock it in.`}
              {plan.emphasis === "catch-up" && `Your partner hasn't practised ${plan.window} yet — keep it light and send a nudge.`}
            </p>
          )}
          {plan.items.map((it, i) => {
            const n = `${i + 1}. `;
            if (it.kind === "review-help") return <div key={i}>{row("🤝", `${n}Review ${it.count} words your partner knows`, "lapsed words they can help you lock in", () => onScrollTo("ps-collab"), "Help each other →")}</div>;
            if (it.kind === "teachback") return <div key={i}>{row("🎙", `${n}Teach your partner ${it.count} words`, "explain words you know that they're shaky on", () => onScrollTo("ps-collab"), "Open →")}</div>;
            if (it.kind === "speak") { const sc = pack.scenarios.find((s) => s.id === it.ref); return <div key={i}>{row("🗣", `${n}Speak together: ${sc?.title ?? "a scenario"}`, sc?.setting ?? "take turns live, with coaching", onSpeak, "Start live →")}</div>; }
            const st = pack.stories?.find((s) => s.id === it.ref); return <div key={i}>{row("📖", `${n}Read a story together${st ? `: ${st.title}` : ""}`, "shared text → conversation fuel", () => onScrollTo("ps-story"), "Open →")}</div>;
          })}
        </div>
      )}
    </div>
  );
}

function PartnerPanel({ progress, persist, navigateToStory }: { progress: Progress; persist: (p: Progress) => void; navigateToStory: (storyId: string) => void }) {
  const pack = usePack();
  const packId = pack.id;
  const store = useMemo(() => getPartnerStore(), []);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // All of the learner's partnerships (a person can have several 1:1 partners), plus which one is
  // currently in focus. The heavy per-partnership data below (visibility, partner state, streak…) is
  // loaded for the selected one; switching partners re-runs refresh.
  const [links, setLinks] = useState<Partnership[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false); // showing the invite/join view while other partners exist
  const [vis, setVis] = useState<VisibilitySettings>(partner.DEFAULT_VISIBILITY);
  const [partnerState, setPartnerState] = useState<PublishedState | null>(null);
  const [diff, setDiff] = useState<ComplementaryDiff | null>(null);
  const [shared, setShared] = useState<{ count: number; lastDay: string } | null>(null);
  const [nudges, setNudges] = useState<PartnerArtifact[]>([]);
  const [myId, setMyId] = useState<string>("");
  const [joinCode, setJoinCode] = useState("");
  const [rs, setRs] = useState<string | "new" | null>(null); // open role-swap session id, "new", or none
  const [ig, setIg] = useState<string | "new" | null>(null); // open info-gap session id, "new", or none
  const [lc, setLc] = useState<string | "new" | null>(null); // open live-conversation session id, "new", or none
  const [tg, setTg] = useState<string | "new" | null>(null); // open v2 Together session id, "new", or none
  const [cadence, setCadence] = useState<partner.PartnerCadence>("daily"); // shared joint-session rhythm

  const myActivity = useCallback(
    (): ActivityRecord => ({
      lastActiveDay: progressRef.current.streak?.lastDay ?? "",
      metrics: scoring.computeMetrics(progressRef.current.familiarity),
    }),
    [],
  );

  const refresh = useCallback(async (preferId?: string) => {
    if (!store) return setLoading(false);
    setLoading(true);
    setError(null);
    try {
      const all = await store.myPartnerships(packId);
      setLinks(all);
      // Focus the requested partner (e.g. one just created), else keep the current, else the most recent.
      const wantId = preferId ?? currentId;
      const active = all.find((p) => p.id === wantId) ?? all[0] ?? null;
      if ((active?.id ?? null) !== currentId) setCurrentId(active?.id ?? null);
      if (active) setAdding(false);
      if (active && active.status !== "pending") {
        setMyId(await store.me());
        setVis(await store.getVisibility(active.id));
        await store.publish(active.id, packId, { activity: myActivity(), familiarity: partnerDiff.projectFamiliarity(progressRef.current.familiarity, packId) }); // gated at publish time
        const ps = await store.readPartnerPublished(active.id);
        setPartnerState(ps);
        setDiff(ps?.familiarity ? partnerDiff.complementaryDiff(partnerDiff.projectFamiliarity(progressRef.current.familiarity, packId), ps.familiarity) : null);
        // shared streak: persisted in a single 'streak' artifact both members read/write
        const today = localDay();
        const arts = await store.listArtifacts(active.id, "streak");
        const prev = (arts[0]?.payload as { count: number; lastDay: string; freezes?: number }) ?? { count: 0, lastDay: "", freezes: 2 };
        const next = partner.sharedStreak(myActivity(), ps?.activity ?? { lastActiveDay: "" }, today, { count: prev.count, lastDay: prev.lastDay }, prev.freezes ?? 2);
        if (next.count !== prev.count || next.lastDay !== prev.lastDay) {
          await store.putArtifact(active.id, packId, "streak", { ...next, freezes: prev.freezes ?? 2 }, arts[0]?.id);
        }
        setShared(next);
        setNudges((await store.listArtifacts(active.id, "nudge")).slice(-6).reverse());
        const cadenceArt = (await store.listArtifacts(active.id, "cadence"))[0]?.payload as { mode?: partner.PartnerCadence } | undefined;
        setCadence(cadenceArt?.mode === "weekly" ? "weekly" : "daily");
      } else {
        setPartnerState(null);
        setDiff(null);
        setShared(null);
        setNudges([]);
      }
    } catch (e) {
      const m = e as { message?: string; code?: string };
      const missing = m.code === "PGRST205" || (m.message ?? "").includes("schema cache") || (m.message ?? "").includes("does not exist");
      setError(missing ? "Partner tables not found — run apps/web/supabase/migrations/0002_partnered.sql, then reload." : m.message ?? "Partner sync failed.");
    } finally {
      setLoading(false);
    }
  }, [store, packId, myActivity, currentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!store) {
    return (
      <div className="setting-row" style={{ flexDirection: "column", alignItems: "flex-start" }}>
        <b>Learning partner</b>
        <span className="muted small">Partner learning needs Supabase (cross-device sync). See SUPABASE_SETUP.md.</span>
      </div>
    );
  }

  const act = (fn: () => Promise<unknown>) => async () => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as { message?: string }).message ?? "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  // Invite/join create a NEW partnership and immediately focus it (so its code / new dyad is what you see),
  // rather than defaulting back to whichever partner was already selected.
  const invitePartner = async () => {
    setBusy(true); setError(null);
    try { const { partnership } = await store.invite(packId); setAdding(false); await refresh(partnership.id); }
    catch (e) { setError((e as { message?: string }).message ?? "Action failed."); }
    finally { setBusy(false); }
  };
  const joinPartner = async () => {
    setBusy(true); setError(null);
    try { const p = await store.redeem(joinCode); setJoinCode(""); setAdding(false); await refresh(p.id); }
    catch (e) { setError((e as { message?: string }).message ?? "Action failed."); }
    finally { setBusy(false); }
  };

  // The partnership currently in focus (heavy data below is loaded for it), and a switcher across all of
  // the learner's partners. Numbered because we don't store partner display names.
  const link = links.find((x) => x.id === currentId) ?? null;
  const partnerLabel = (p: Partnership, i: number) =>
    p.status === "pending" ? "Pending invite" : `Partner ${i + 1}${p.status === "paused" ? " · paused" : ""}`;
  const Switcher = links.length > 0 && !adding ? (
    <div className="theme-chips" style={{ marginBottom: 2 }}>
      {links.map((p, i) => (
        <button key={p.id} className={`chip-toggle${p.id === currentId ? " active" : ""}`} onClick={() => setCurrentId(p.id)}>{partnerLabel(p, i)}</button>
      ))}
      <button className="chip-toggle" onClick={() => setAdding(true)} title="Add another learning partner">＋ Add partner</button>
    </div>
  ) : null;

  const content = () => {
    if (loading) return <span className="muted small">…</span>;
    if (adding || !link)
      return (
        <div style={colStack}>
          {links.length > 0 && <button className="ghost small" style={{ alignSelf: "flex-start" }} onClick={() => setAdding(false)}>← Back to partners</button>}
          <p className="small" style={{ margin: 0 }}><b>Learn with someone you trust.</b> This tab is for practising <i>together</i> — link up with a partner to unlock it.</p>
          <p className="muted small" style={{ margin: 0 }}>Then you get: <b>Live conversation</b> (real-time, coached turn-by-turn) · <b>Role-swap</b> · <b>Info-gap</b> · <b>Shared story &amp; phrasebook</b> · <b>Help each other</b> (the app surfaces what your partner knows that you don&apos;t). A shared daily/weekly session reviews each of your solo work.</p>
          <div className="row" style={{ marginTop: 4 }}>
            <button className="btn" disabled={busy} onClick={invitePartner}>Invite a partner</button>
          </div>
          <div className="row">
            <input className="lang-picker" placeholder="Enter invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} style={{ textTransform: "uppercase", minWidth: 150 }} />
            <button className="ghost" disabled={busy || !joinCode.trim()} onClick={joinPartner}>Join</button>
          </div>
          <p className="muted small" style={{ margin: 0 }}>Private to the two of you. Pause (no penalty) or end anytime.</p>
        </div>
      );
    const l = link;
    if (l.status === "pending")
      return (
        <div style={colStack}>
          <p className="small">Invite created. Share this code with your partner:</p>
          <div className="row"><code className="chip" style={{ fontSize: 18, letterSpacing: 3 }}>{l.inviteCode}</code></div>
          <p className="muted small">They open <b>Partnered → Join</b> and enter it. This updates once they join.</p>
          <div className="row">
            <button className="ghost" disabled={busy} onClick={act(async () => {})}>Refresh</button>
            <button className="ghost" disabled={busy} onClick={act(() => store.end(l.id))}>Cancel</button>
          </div>
        </div>
      );
    if (l.status === "paused")
      return (
        <div style={colStack}>
          <p className="small">Paused — no streak pressure. Pick up whenever you both want.</p>
          <div className="row">
            <button className="btn" disabled={busy} onClick={act(() => store.resume(l.id))}>Resume</button>
            <button className="ghost" disabled={busy} onClick={act(() => store.end(l.id))}>End</button>
          </div>
        </div>
      );
    // active
    const partnerId = l.members.find((m) => m && m !== myId) ?? "";
    if (tg) {
      return (
        <TogetherSession
          store={store}
          partnershipId={l.id}
          packId={packId}
          myId={myId}
          partnerId={partnerId}
          progress={progress}
          persist={persist}
          partnerProjection={partnerState?.familiarity ?? null}
          sessionId={tg}
          onExit={() => { setTg(null); void refresh(); }}
        />
      );
    }
    if (rs) {
      return (
        <div style={colStack}>
          <button className="ghost small" style={{ alignSelf: "flex-start" }} onClick={() => setRs(null)}>← Partner</button>
          <RoleSwap store={store} partnershipId={l.id} packId={packId} myId={myId} partnerId={partnerId} sessionId={rs} />
        </div>
      );
    }
    if (ig) {
      return (
        <div style={colStack}>
          <button className="ghost small" style={{ alignSelf: "flex-start" }} onClick={() => setIg(null)}>← Partner</button>
          <InfoGap store={store} partnershipId={l.id} packId={packId} myId={myId} partnerId={partnerId} sessionId={ig} />
        </div>
      );
    }
    if (lc) {
      return (
        <div style={colStack}>
          <button className="ghost small" style={{ alignSelf: "flex-start" }} onClick={() => setLc(null)}>← Partner</button>
          <LiveConvo store={store} partnershipId={l.id} packId={packId} myId={myId} partnerId={partnerId} sessionId={lc} />
        </div>
      );
    }
    const pm = partnerState?.activity?.metrics;
    const pDay = partnerState?.activity?.lastActiveDay;
    const today = localDay();
    return (
      <div style={colStack}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="small">🤝 Linked with your partner</span>
          {pm ? (
            <span className="muted small"><b style={{ color: "var(--ok)" }}>{pm.knownWordCount}</b> words · {pm.movedToKnownThisWeek} new this week</span>
          ) : pDay ? (
            <span className="muted small">partner last active {pDay === today ? "today 🎉" : pDay}</span>
          ) : (
            <span className="muted small">no activity shared yet</span>
          )}
        </div>
        {/* Hero: the one thing to do together — a short live session in real time (DESIGN-partnered-v2.md §2). */}
        <TogetherLauncher store={store} partnershipId={l.id} onOpen={setTg} />

        <div className="row">
          <span className="small">Shared streak</span>
          <span className="muted small">
            {shared && shared.count > 0
              ? `${shared.count} day${shared.count === 1 ? "" : "s"} you both showed up${shared.lastDay === today ? " — including today 🔥" : ""}`
              : "practise on the same day to start a shared streak"}
          </span>
        </div>

        <div>
          <div className="small" style={{ marginBottom: 4 }}>Send a nudge</div>
          <div className="row">
            {NUDGES.map((n) => (
              <button key={n} className="ghost small" disabled={busy} onClick={act(() => store.putArtifact(l.id, packId, "nudge", { text: n, day: localDay() }))}>{n}</button>
            ))}
          </div>
          {nudges.length > 0 && (
            <ul className="muted small" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {nudges.map((nd) => {
                const pl = nd.payload as { text?: string; day?: string };
                return <li key={nd.id}>{nd.createdBy === myId ? "You" : "Partner"}: {pl.text} <span style={{ opacity: 0.6 }}>{pl.day}</span></li>;
              })}
            </ul>
          )}
        </div>

        {/* v1 activities, demoted per v2 §8 — still reachable, no longer competing for the top of the screen. */}
        <details className="partner-more">
          <summary className="small" style={{ cursor: "pointer" }}>More ways to practise</summary>
          <div style={{ ...colStack, marginTop: 10 }}>
            <LiveConvoSection store={store} partnershipId={l.id} onOpen={setLc} />
            <RoleSwapSection store={store} partnershipId={l.id} onOpen={setRs} />
            <InfoGapSection store={store} partnershipId={l.id} onOpen={setIg} />
            <div id="ps-collab"><FamiliarityCollab store={store} partnershipId={l.id} packId={packId} myId={myId} partnerId={partnerId} diff={diff} progress={progress} /></div>
            <div id="ps-story"><SharedStory store={store} partnershipId={l.id} packId={packId} progress={progress} navigateToStory={navigateToStory} /></div>
            <Phrasebook store={store} partnershipId={l.id} packId={packId} progress={progress} persist={persist} />
          </div>
        </details>

        <details className="partner-more">
          <summary className="small" style={{ cursor: "pointer" }}>Partner settings</summary>
          <div style={{ ...colStack, marginTop: 10 }}>
            <div>
              <span className="small">Visible to your partner</span>
              <div className="row" style={{ marginTop: 6 }}>
                {VIS_TOGGLES.map(([key, label]) => (
                  <button
                    key={key}
                    className={`badge ${vis[key] ? "on" : "off"}`}
                    disabled={busy}
                    title="Tap to toggle what your partner can see"
                    onClick={act(async () => {
                      const next: VisibilitySettings = { ...vis, [key]: !vis[key] };
                      setVis(next);
                      await store.setVisibility(l.id, next);
                    })}
                  >
                    {label} {vis[key] ? "✓" : "✗"}
                  </button>
                ))}
              </div>
            </div>
            <div className="row">
              <button className="ghost" disabled={busy} onClick={act(() => store.pause(l.id))}>Pause (no-shame)</button>
              <button className="ghost" disabled={busy} onClick={act(async () => { if (typeof window !== "undefined" && !window.confirm("Unpair from this partner? This ends the partnership — you can always invite them again later.")) return; await store.end(l.id); })}>Unpair (end)</button>
            </div>
            <p className="muted small" style={{ margin: 0 }}>Unpairing affects only this partner{links.length > 1 ? " — your other partners stay linked" : ""}.</p>
          </div>
        </details>
      </div>
    );
  };

  return (
    <section className="view">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0 }}>Partnered</h2>
        {shared && shared.count > 0 && <span className="streak-chip" title="Shared streak — days you both practised">🤝🔥 {shared.count}</span>}
      </div>
      {error && <p className="small" style={{ color: "var(--warn)", margin: "4px 0 0" }}>{error}</p>}
      {Switcher}
      {content()}
    </section>
  );
}

// Account / cross-device profile: magic-link sign-in (passwordless). Since progress already upserts to
// user_state keyed by uid, signing in with the same email on another device makes uid() stable across
// devices ⇒ the same row ⇒ synced learning. Anonymous sessions upgrade in place (no data loss).
function AccountSettings() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void currentUser().then(setUser); }, []);

  if (!supabaseConfigured())
    return (
      <div className="setting-row">
        <b>Account</b>
        <span className="muted small">Cross-device sync needs Supabase — see SUPABASE_SETUP.md.</span>
      </div>
    );

  const send = async () => {
    const e = email.trim();
    if (!e) return;
    setBusy(true);
    setStatus("");
    try {
      const { mode } = await sendMagicLink(e);
      setStatus(`Check ${e} for a sign-in link${mode === "signin" ? " — it signs this device into your existing account" : " to finish setting up your account"}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not send the link — is email sign-in enabled in Supabase?");
    } finally {
      setBusy(false);
    }
  };
  const out = async () => {
    setBusy(true);
    try {
      await signOut();
      setUser(await currentUser());
      setStatus("Signed out on this device.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="setting-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
      <b>Account</b>
      {user && !user.isAnonymous && user.email ? (
        <div className="row" style={{ width: "100%", justifyContent: "space-between" }}>
          <span className="small">Signed in as <b>{user.email}</b> — your learning syncs to any device you sign in on.</span>
          <button className="ghost small" disabled={busy} onClick={out}>Sign out</button>
        </div>
      ) : (
        <>
          <span className="muted small">Sign in to carry your progress across web and phone — we&apos;ll email a one-tap link, no password.</span>
          <div className="row" style={{ width: "100%" }}>
            <input className="lang-picker" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
            <button className="btn" disabled={busy || !email.trim()} onClick={send}>{busy ? "Sending…" : "Send link"}</button>
          </div>
        </>
      )}
      {status && <span className="muted small">{status}</span>}
    </div>
  );
}

// Account & app settings — a header-triggered slide-over (was the "Me" tab body). Everything you-specific
// that's CONFIG lives here; the Partnered tab is now purely the dyad. Backdrop click / ✕ closes it.
function AccountPanel({ progress, persist, config, onClose }: { progress: Progress; persist: (p: Progress) => void; config: api.Config | null; onClose: () => void }) {
  const pack = usePack();
  const autoplay = progress.settings?.autoplay ?? false;
  const slow = progress.settings?.slow ?? false;
  const slowRate = progress.settings?.slowRate ?? 0.75;
  const badge = (l: string, on?: boolean) => <span className={`badge ${on ? "on" : "off"}`} key={l}>{l} {on ? "✓" : "✗"}</span>;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div className="view" onClick={(e) => e.stopPropagation()} style={{ width: "min(440px, 94vw)", height: "100%", borderRadius: 0, overflowY: "auto" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Account &amp; settings</h2>
          <button className="ghost small" onClick={onClose}>✕ Close</button>
        </div>
        <AccountSettings />
      <div className="setting-row">
        <b>Language</b>
        {packList().length > 1 ? (
          <select className="lang-picker" aria-label="Language" value={pack.id} onChange={(e) => persist({ ...progress, activePackId: e.target.value, pick: null })}>
            {packList().map((p) => <option key={p.id} value={p.id}>{(FLAG[p.id] ?? "🌐") + " " + p.name}</option>)}
          </select>
        ) : <span className="muted">{pack.name}</span>}
      </div>
      <div className="setting-row">
        <b>Auto-play audio</b>
        <button className="ghost" onClick={() => persist({ ...progress, settings: { ...progress.settings, autoplay: !autoplay } })}>{autoplay ? "🔊 On" : "🔇 Off"}</button>
        <span className="muted small">Play the other speaker's lines automatically in scenarios and stories.</span>
      </div>
      <div className="setting-row">
        <b>Playback speed</b>
        <button className="ghost" onClick={() => persist({ ...progress, settings: { ...progress.settings, slow: !slow } })}>{slow ? "🐢 Slow" : "🔊 Normal"}</button>
        <span className="muted small">One speed for all spoken audio across the app (also on the header switch).</span>
        {slow && (
          <label className="row small" style={{ width: "100%", gap: 8, marginTop: 6 }}>
            <span className="muted">Slow speed</span>
            <input
              type="range" min={0.5} max={0.9} step={0.05} value={slowRate}
              onChange={(e) => persist({ ...progress, settings: { ...progress.settings, slowRate: Number(e.target.value) } })}
              style={{ flex: 1 }}
            />
            <span className="muted" style={{ minWidth: 64, textAlign: "right" }}>{Math.round(slowRate * 100)}% {slowRate <= 0.55 ? "🐌" : "🐢"}</span>
          </label>
        )}
      </div>
      <div className="setting-row">
        <b>Speech &amp; AI</b>
        {config ? [badge("Scribe", config.engines.eleven), badge("Google", config.engines.google), badge("Claude", config.engines.anthropic)] : <span className="muted small">…</span>}
      </div>
      {packUnreviewed(pack) && (
        <div className="setting-row">
          <span className="badge warn">⚠ unreviewed</span>
          <span className="muted small">This pack's content is machine-generated, pending native review — not yet authoritative.</span>
        </div>
      )}
      </div>
    </div>
  );
}
