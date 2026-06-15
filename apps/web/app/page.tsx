"use client";
// Phase 0-1 UI ported from spike/public/index.html into React, on @ll/core + the ACTIVE language pack.
// The pack is selected by id from the registry (progress.activePackId) and flows through context — the
// UI reads the active pack, never a hardcoded language import. Pure engines (scenario/srs/leveling) run
// client-side; paid calls (tts/asr/feedback/chat) hit the server route handlers that hold the keys.
//
// Navigation is four sections — Today (the guided daily flow) / Library (browse + practice) /
// Progress (stats + Strengthen) / Me (settings). "Today" sequences one session in a building order:
// warm-up review → new words → new grammar → story → speak. See DESIGN notes for the rationale.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { DialogueTurn, GlyphLesson, GrammarConcept, InfoGapTask, LanguagePack, MiniStory, ReviewItem, Scenario } from "@ll/pack-schema";
import * as scenario from "@ll/core/scenario";
import * as familiarity from "@ll/core/familiarity";
import type { FamiliarityEntry } from "@ll/core/familiarity";
import * as scoring from "@ll/core/familiarity/scoring";
import * as leveling from "@ll/core/leveling";
import { makeRecorder } from "../lib/recorder";
import * as api from "../lib/api";
import { getPack, DEFAULT_PACK_ID, packList } from "../lib/packs";
import { getStore, emptyProgress, type Progress } from "../lib/store";
import * as partner from "@ll/core/partner";
import type { Partnership, VisibilitySettings, ActivityRecord } from "@ll/core/partner";
import { getPartnerStore, subscribeArtifacts, joinPresence, type PartnerStore, type PartnerArtifact, type PublishedState } from "../lib/partner-store";
import * as roleswap from "@ll/core/roleswap";
import type { RoleSwapSession, RoleSwapTurn } from "@ll/core/roleswap";
import type { SpeakingFeedback } from "@ll/core/speaking";
import * as partnerDiff from "@ll/core/partner/familiarity-diff";
import type { ComplementaryDiff } from "@ll/core/partner/familiarity-diff";
import * as teachback from "@ll/core/teachback";
import * as complementarySrs from "@ll/core/partner/complementary-srs";
import * as infogap from "@ll/core/infogap";
import type { InfoGapSession } from "@ll/core/infogap";
import * as live from "@ll/core/live";
import type { LiveSession } from "@ll/core/live";

type Section = "today" | "library" | "progress" | "me";
type LibView = "browse" | "reference" | "letters" | "scenario" | "grammar" | "reading" | "story" | "write";

// The active pack flows through context so every view reads the same selected language.
const PackContext = createContext<LanguagePack>(getPack(DEFAULT_PACK_ID));
const usePack = () => useContext(PackContext);
/** Play TTS in the active pack's voice. Stable across renders (keyed on pack id). */
function usePlay() {
  const pack = usePack();
  return useCallback((text: string, speed = 1) => api.playTts(text, speed, pack.id).catch(() => {}), [pack.id]);
}

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
// new (no entry) ⇒ due; known (no SRS card) ⇒ not due; else the SRS due date governs.
const isDue = (p: Progress, item: ReviewItem, now: Date): boolean => {
  const e = p.familiarity[familiarity.deriveKeyForItem(item).lexKey];
  return !e ? true : e.srs ? new Date(e.srs.due) <= now : false;
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
// Capture a tapped word into familiarity + SRS if it's new, and remember the sentence it came from
// (for in-context cloze review). Returns its lexKey ("" if not a word).
const captureWord = (progress: Progress, persist: (p: Progress) => void, surface: string, context?: string): string => {
  const lexKey = familiarity.normalize(surface);
  if (!lexKey) return "";
  const isNew = !progress.familiarity[lexKey];
  const needContext = !!context && !progress.contexts?.[lexKey];
  if (!isNew && !needContext) return lexKey;
  persist({
    ...progress,
    familiarity: isNew ? { ...progress.familiarity, [lexKey]: familiarity.capture({ lexKey, kind: "word", display: surface }) } : progress.familiarity,
    contexts: needContext ? { ...progress.contexts, [lexKey]: context! } : progress.contexts,
  });
  return lexKey;
};

// ---- daily-flow helpers ----
const pad2 = (n: number) => String(n).padStart(2, "0");
const localDay = (d = new Date()): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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
// Capture a batch of pre-taught words into familiarity (the "new words" step before the story).
const captureWords = (p: Progress, words: { lexKey: string; gloss?: string }[]): Progress => {
  const fam = { ...p.familiarity };
  for (const w of words) {
    if (!fam[w.lexKey]) fam[w.lexKey] = familiarity.capture({ lexKey: w.lexKey, kind: w.lexKey.includes(" ") ? "chunk" : "word", display: w.lexKey, gloss: w.gloss });
  }
  return { ...p, familiarity: fam };
};
// Seed a story's registered vocab into familiarity (reading it "teaches" those words).
const seedStoryVocab = (p: Progress, story: MiniStory): Progress => {
  const fam = { ...p.familiarity };
  for (const v of story.registersVocab) {
    if (!fam[v.lexKey]) fam[v.lexKey] = familiarity.capture({ lexKey: v.lexKey, kind: v.lexKey.includes(" ") ? "chunk" : "word", display: v.lexKey, gloss: v.gloss });
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
    const capturedDue = Object.values(progress.familiarity).filter((e) => e.srs && new Date(e.srs.due) <= now && (e.kind === "word" || e.kind === "chunk") && !poolKeys.has(e.lexKey)).length;
    return poolDue + capturedDue;
  }, [progress, pack]);
  const level = useMemo(() => computeLevel(pack, progress), [pack, progress]);
  const vocab = useMemo(() => scoring.computeMetrics(progress.familiarity), [progress.familiarity]);

  if (!ready) return <main style={{ padding: 24 }}>Loading…</main>;

  return (
    <PackContext.Provider value={pack}>
      <header>
        <h1>{FLAG[pack.id] ?? "🌐"} {pack.name}</h1>
        <span className="muted small">Level {level.cefrBand} · <b style={{ color: "var(--ok)" }}>{vocab.knownWordCount}</b> words known</span>
        <span className="streak-chip" style={{ marginLeft: "auto" }} title="Day streak">🔥 {progress.streak?.count ?? 0}</span>
      </header>
      <nav>
        {([
          ["today", "Today"],
          ["library", "Library"],
          ["progress", `Progress${dueCount ? " " + dueCount : ""}`],
          ["me", "Me"],
        ] as [Section, string][]).map(([s, label]) => (
          <button key={s} className={section === s ? "active" : ""} onClick={() => setSection(s)}>{label}</button>
        ))}
      </nav>
      <main>
        {section === "today" && <Today progress={progress} persist={persist} config={config} navigate={navigate} />}
        {section === "library" && (
          <LibrarySection progress={progress} persist={persist} config={config} lettersDone={lettersDone} mode={libView} setMode={setLibView} />
        )}
        {section === "progress" && (
          <>
            <ProgressDash progress={progress} />
            <Review progress={progress} persist={persist} />
          </>
        )}
        {section === "me" && <Settings progress={progress} persist={persist} config={config} navigateToStory={goToStory} />}
      </main>
    </PackContext.Provider>
  );
}

// ---------- Today: the guided daily flow (building order: review → new words → grammar → story → speak) ----------
type TodayStep =
  | { kind: "warmup"; items: ReviewItem[] }
  | { kind: "newwords"; words: { lexKey: string; gloss?: string }[] }
  | { kind: "grammar"; concept: GrammarConcept }
  | { kind: "story"; story: MiniStory }
  | { kind: "speak"; scenario: Scenario };

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
    const due = reviewPool(pack).filter((it) => isDue(progress, it, now)).slice(0, 6);
    if (due.length) out.push({ kind: "warmup", items: due });
    const story = pack.stories?.[0];
    if (story) {
      const words = story.registersVocab.filter((v) => {
        const e = progress.familiarity[v.lexKey];
        return !e || e.status === "new";
      });
      if (words.length) out.push({ kind: "newwords", words: words.slice(0, 5) });
    }
    const concept = pack.grammar.find((c) => !progress.seenGrammar?.[c.id]);
    if (concept) out.push({ kind: "grammar", concept });
    if (story) out.push({ kind: "story", story });
    const scen = pack.scenarios.find((s) => {
      const p = progress.scenarios[s.id];
      return !p || s.successCriteria.some((c) => !p.metCriteria.includes(c.id));
    }) ?? pack.scenarios[0];
    if (scen) out.push({ kind: "speak", scenario: scen });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack]);

  const [phase, setPhase] = useState<"gate" | "flow">(lettersDone ? "flow" : "gate");
  const [idx, setIdx] = useState(0);
  const [subIdx, setSubIdx] = useState(0);
  const est = Math.max(5, steps.length * 3);
  // Advance to the next step, persisting a single merged Progress and counting the day toward the streak.
  const done = (mutated: Progress = progress) => {
    persist(bumpStreak(mutated));
    setSubIdx(0);
    setIdx((i) => i + 1);
  };

  // The alphabet gate runs INLINE inside Today — the whole session is self-contained, no jump to the Library.
  if (phase === "gate")
    return (
      <section className="view">
        <TodayHeader streak={progress.streak?.count ?? 0} />
        <p className="lead">First, the alphabet. Macedonian uses Cyrillic — learn and pass these {focusLetters(pack).length} key letters, then today&apos;s session opens up right here.</p>
        <Letters progress={progress} persist={persist} onDone={() => setPhase("flow")} />
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
  if (idx >= steps.length)
    return (
      <section className="view">
        <TodayHeader streak={progress.streak?.count ?? 0} />
        <h3 style={{ marginTop: 4 }}>Session complete 🎉</h3>
        <p className="lead">Nice work — you finished today&apos;s session.{(progress.streak?.count ?? 0) > 0 ? ` ${progress.streak?.count}-day streak — come back tomorrow to keep it going.` : ""}</p>
        <div className="row" style={{ marginTop: 4 }}>
          <button className="ghost small" onClick={() => navigate("progress")}>See your progress</button>
          <button className="ghost small" onClick={() => navigate("library", "browse")}>Extra practice in the Library</button>
        </div>
      </section>
    );

  const step = steps[idx]!;
  return (
    <section className="view">
      <TodayHeader streak={progress.streak?.count ?? 0} />
      <div className="pbar"><div style={{ width: `${(idx / steps.length) * 100}%` }} /></div>
      <div className="muted small" style={{ marginBottom: 14 }}>Step {idx + 1} of {steps.length} · ~{est} min</div>

      <div key={idx}>
        {step.kind === "warmup" && (() => {
          const item = step.items[subIdx]!;
          const grade = (ok: boolean) => {
            const graded = gradeItem(progress, item, ok);
            if (subIdx + 1 >= step.items.length) done(graded);
            else { persist(graded); setSubIdx((s) => s + 1); }
          };
          return (
            <div>
              <Tag>Warm up · {step.items.length - subIdx} to review</Tag>
              {item.kind === "grammar"
                ? <GrammarCard key={item.id} item={item} onGrade={grade} />
                : <PhraseCard key={item.id} item={item} onGrade={grade} />}
            </div>
          );
        })()}

        {step.kind === "newwords" && (
          <div>
            <Tag>New words · {step.words.length}</Tag>
            <NewWordsCard words={step.words} onDone={() => done(captureWords(progress, step.words))} />
          </div>
        )}

        {step.kind === "grammar" && (
          <div>
            <Tag>New grammar</Tag>
            <GrammarIntroCard
              concept={step.concept}
              onDone={(ok) => {
                const base = step.concept.drills[0] ? gradeItem(progress, step.concept.drills[0]!, ok) : progress;
                done(markSeen(base, step.concept.id));
              }}
            />
          </div>
        )}

        {step.kind === "story" && (
          <div>
            <Tag>Read the story</Tag>
            <StoryReader
              story={step.story}
              progress={progress}
              persist={persist}
              config={config}
              doneLabel="I read it → speak"
              onDone={() => done(seedStoryVocab(progress, step.story))}
            />
          </div>
        )}

        {step.kind === "speak" && (
          <div>
            <Tag>Speak · {step.scenario.title}</Tag>
            <p className="muted small">{step.scenario.goal} — use what you just read, out loud.</p>
            <ScenarioView progress={progress} persist={persist} config={config} lettersDone scenarioId={step.scenario.id} hidePicker bare onComplete={() => done()} />
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="ghost small" onClick={() => done()}>Skip this step →</button>
      </div>
    </section>
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
function NewWordsCard({ words, onDone }: { words: { lexKey: string; gloss?: string }[]; onDone: () => void }) {
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
        </div>
        <div className="muted small" style={{ margin: "10px 0 6px" }}>Tap the meaning</div>
        <div>
          {options.map((o) => {
            const cls = picked ? (o === correct ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt";
            return <button className={cls} key={o} disabled={!!picked} onClick={() => setPicked(o)}>{o}</button>;
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

// First-encounter grammar: state the rule + examples (deductive), then one drill. Later it's just-in-time.
function GrammarIntroCard({ concept, onDone }: { concept: GrammarConcept; onDone: (ok: boolean) => void }) {
  const drill = concept.drills[0];
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="fb">
      <h3 style={{ marginTop: 0 }}>{concept.name}</h3>
      <p>{concept.explanation}</p>
      <p className="muted small">{concept.examples.join("   ·   ")}</p>
      {drill ? (
        <div style={{ marginTop: 12 }}>
          <div className="muted small">Quick check:</div>
          <div className="small" style={{ margin: "6px 0 4px" }}><b>{drill.prompt}</b></div>
          <div>
            {(drill.options ?? []).map((o) => {
              const cls = picked ? (o === drill.answer ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt";
              return <button className={cls} key={o} disabled={!!picked} onClick={() => setPicked(o)}>{o}</button>;
            })}
          </div>
          {picked && (
            <div className="why">
              {picked === drill.answer ? "✓ " : "✗ "}{drill.why}
              <button className="btn" style={{ marginLeft: 8 }} onClick={() => onDone(picked === drill.answer)}>Next →</button>
            </div>
          )}
        </div>
      ) : (
        <button className="btn" style={{ marginTop: 10 }} onClick={() => onDone(true)}>Got it →</button>
      )}
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

  // An opened content item or reference tool → show it with a back link to where it came from.
  if (mode !== "browse" && mode !== "reference") {
    const isTool = mode === "letters" || mode === "grammar" || mode === "write";
    const view =
      mode === "scenario" ? <ScenarioView progress={progress} persist={persist} config={config} lettersDone={lettersDone} /> :
      mode === "story" ? <StoryView progress={progress} persist={persist} config={config} /> :
      mode === "reading" ? <Reading progress={progress} persist={persist} config={config} /> :
      mode === "grammar" ? <Grammar progress={progress} persist={persist} /> :
      mode === "letters" ? <Letters progress={progress} persist={persist} onDone={() => setMode("reference")} /> :
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
        <button className={mode === "browse" ? "active" : ""} onClick={() => setMode("browse")}>Practice</button>
        <button className={mode === "reference" ? "active" : ""} onClick={() => setMode("reference")}>Reference</button>
      </div>

      {mode === "reference" ? (
        <>
          <p className="lead">Tools to look things up and practise — kept separate from your situational content.</p>
          <div className="cards">
            <button className="contentcard" onClick={() => setMode("letters")}>
              <div className="cc-top"><span className="cc-type">🔤 Alphabet</span>{lettersDone && <span className="diff just">done</span>}</div>
              <div className="cc-title">Learn the letters</div>
              <div className="muted small">Cyrillic, learned and tested set by set</div>
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
      <div className="ex">{ex?.text} <span className="muted small">· {ex?.gloss}</span></div>
      <div className="acts"><button className="ghost" onClick={() => ex && play(ex.text, 0.7)}>🔊</button></div>
    </div>
  );
}

// ---------- Reference: the alphabet, learned and TESTED set by set ----------
// Study the key letters (unique + false-friends), then a quiz: glyph→sound and sound→glyph (with audio).
// A letter is marked "known" only after a correct answer; misses go to the back of the queue.
function Letters({ progress, persist, onDone }: { progress: Progress; persist: (p: Progress) => void; onDone: () => void }) {
  const pack = usePack();
  const play = usePlay();
  const focus = useMemo(() => focusLetters(pack), [pack]);
  const unknown = useMemo(() => focus.filter((a) => !progress.letters[a.glyph]), [focus, progress.letters]);
  const [phase, setPhase] = useState<"learn" | "quiz" | "done">(unknown.length ? "learn" : "done");
  const [remaining, setRemaining] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const current = remaining[0];
  const a = current ? focus.find((x) => x.glyph === current) ?? null : null;
  const qType = step % 2; // 0 = see glyph, pick sound; 1 = see/hear sound, pick glyph
  const options = useMemo(() => {
    if (!a) return [] as string[];
    const distract = shuffle(focus.filter((x) => x.glyph !== a.glyph)).slice(0, 3);
    return shuffle(qType === 0 ? [a.sound, ...distract.map((x) => x.sound)] : [a.glyph, ...distract.map((x) => x.glyph)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, step]);
  const correctAnswer = a ? (qType === 0 ? a.sound : a.glyph) : "";
  const isCorrect = picked != null && picked === correctAnswer;

  const startQuiz = () => { setTotal(unknown.length); setRemaining(unknown.map((x) => x.glyph)); setStep(0); setPicked(null); setPhase("quiz"); };
  const next = () => {
    if (!a) return;
    if (isCorrect) {
      persist({ ...progress, letters: { ...progress.letters, [a.glyph]: true } });
      const rest = remaining.slice(1);
      setRemaining(rest);
      if (rest.length === 0) setPhase("done");
    } else {
      setRemaining((r) => [...r.slice(1), r[0]!]); // missed → back of the queue
    }
    setPicked(null);
    setStep((s) => s + 1);
  };

  if (phase === "done" || unknown.length === 0) {
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
        <h2>The {pack.name} alphabet — {unknown.length} key letters</h2>
        <p className="lead">Cyrillic is phonetic: one letter, one sound. Study these — the <span style={{ color: "var(--ok)" }}>unique</span> letters and the <span style={{ color: "var(--warn)" }}>false friends</span> that look Latin but sound different — then I&apos;ll quiz you. Tap 🔊 to hear each.</p>
        <div className="letters">{unknown.map((x) => <LetterCard key={x.glyph} a={x} play={play} />)}</div>
        <div className="row"><button className="btn" onClick={startQuiz}>Quiz me on these →</button></div>
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
function ScenarioView({ progress, persist, config, lettersDone, scenarioId, hidePicker, bare, onComplete }: { progress: Progress; persist: (p: Progress) => void; config: api.Config | null; lettersDone: boolean; scenarioId?: string; hidePicker?: boolean; bare?: boolean; onComplete?: () => void }) {
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
        />
      ) : null}

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
function ScenarioGrammar({ ids }: { ids: string[] }) {
  const pack = usePack();
  const concepts = ids.map((id) => pack.grammar.find((c) => c.id === id)).filter((c): c is GrammarConcept => !!c);
  const [open, setOpen] = useState<string | null>(null);
  if (concepts.length === 0) return null;
  const shown = concepts.find((c) => c.id === open);
  return (
    <div className="gram-inline">
      <span className="muted small">Grammar here:</span>
      {concepts.map((c) => (
        <button key={c.id} className={`ghost small ${open === c.id ? "active" : ""}`} onClick={() => setOpen(open === c.id ? null : c.id)}>ⓖ {c.name}</button>
      ))}
      {shown && (
        <div className="fb" style={{ width: "100%", marginTop: 4 }}>
          <p className="small" style={{ marginTop: 0 }}>{shown.explanation}</p>
          <p className="small muted" style={{ marginBottom: 0 }}>{shown.examples.join("   ·   ")}</p>
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

function LearnerTurn({ turn, config, onDone }: { turn: DialogueTurn; config: api.Config | null; onDone: () => void }) {
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
      }
      setFinished(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSpin("");
    }
  };

  return (
    <div>
      <p className="muted small">🐢 Speak slowly and clearly — recognition (and your pronunciation) both improve with deliberate pacing.</p>
      <p className="muted small">Your turn — say:</p>
      <div className="target">{turn.text}</div>
      <div className="translit">{turn.translit}</div>
      <div className="muted">{turn.gloss}</div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="ghost" onClick={() => play(turn.text, 1)}>▶︎ Play native</button>
        <button className="ghost" onClick={() => play(turn.text, 0.7)}>🐢 Slow</button>
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
        <div className="row" style={{ marginTop: 12 }}><button className="btn" onClick={onDone}>Next →</button></div>
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
      <div className="line"><span className="muted">Stress:</span> {fb.stress}</div>
      <div className="line"><span className="muted">Tip:</span> {fb.tip}</div>
      {fb.asrCaveat.likelyAsrError && <div className="flag">⚠ <b>Likely ASR error:</b> {fb.asrCaveat.explanation}</div>}
      <div className="meta">Claude {fb.ms}ms · ~${fb.costUsd}</div>
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
  const concepts = pack.grammar.filter((c) => !needle || `${c.name} ${c.explanation}`.toLowerCase().includes(needle));
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
                <p className="small">{c.explanation}</p>
                <p className="small muted">{c.examples.join("   ·   ")}</p>
                {c.drills.map((d) => <Drill key={d.id} drill={d} onGrade={(ok) => grade(d, ok)} />)}
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

  const onTap = (surface: string, line: string) => {
    const lexKey = captureWord(progress, persist, surface, line);
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
        Tap any word to look it up — it joins your vocabulary. <b>{lines.length ? Math.round(score.knownPct * 100) : 0}% known</b> for you.{" "}
        <span className="tok new">new</span> <span className="tok learning">learning</span> <span className="tok known">known</span>
      </p>
      <div className="reader">
        {lines.length === 0 ? (
          <p className="muted">No content yet — import some text above.</p>
        ) : (
          lines.map((l, i) => <ReaderRow key={i} line={l} progress={progress} play={play} onTapWord={(s) => onTap(s, l.text)} />)
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
  const setStat = (status: "known" | "ignored") => {
    const e = entry ?? familiarity.capture({ lexKey: sel.lexKey, kind: "word", display: sel.surface });
    persist({ ...progress, familiarity: { ...progress.familiarity, [sel.lexKey]: familiarity.setStatus(e, status) } });
    onClose();
  };

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
        <button className="ghost" onClick={() => setStat("known")}>✓ Known</button>
        <button className="ghost" onClick={() => setStat("ignored")}>✕ Ignore</button>
        <span className="muted small">{entry ? `tracked · ${entry.status}` : "captured"}</span>
      </div>
    </div>
  );
}

// ---------- shared story reader (synced audio + tap-capture) — used by Today and the Library Story view ----------
function StoryReader({ story, progress, persist, config, onDone, doneLabel }: {
  story: MiniStory;
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  onDone: () => void;
  doneLabel: string;
}) {
  const pack = usePack();
  const play = usePlay();
  const [sel, setSel] = useState<{ lexKey: string; surface: string; line: string } | null>(null);
  const [current, setCurrent] = useState(-1);
  const [slow, setSlow] = useState(false);
  const playing = useRef(false);
  const speed = slow ? 0.7 : 0.9;

  const onTap = (surface: string, line: string) => {
    const lexKey = captureWord(progress, persist, surface, line);
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
      <p className="lead">Listen and read along; tap any word to look it up.</p>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn" onClick={playAll}>{current >= 0 ? "⏹ Stop" : "▶ Play story"}</button>
        <button className="ghost" onClick={() => setSlow((s) => !s)}>{slow ? "🐢 Slow" : "▶︎ Normal"}</button>
        <span className="muted small">🐢 shadow each line: listen, then say it back.</span>
      </div>
      <div className="reader">
        {story.body.map((l, i) => (
          <div className={`rline2 ${current === i ? "playing" : ""}`} key={i}>
            <button className="spk" onClick={() => play(l.text, speed)}>🔊</button>
            <TappableText text={l.text} progress={progress} onTapWord={(s) => onTap(s, l.text)} />
          </div>
        ))}
      </div>
      {sel && <WordPanel key={sel.lexKey} sel={sel} progress={progress} persist={persist} config={config} onClose={() => setSel(null)} />}
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

function StoryQAView({ story, config, onRestart, onDone }: { story: MiniStory; config: api.Config | null; onRestart: () => void; onDone?: () => void }) {
  const play = usePlay();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  return (
    <div>
      <p className="lead">Questions — the story's words again, in a new frame. The last one is spoken.</p>
      {story.qa.map((q) => (
        <div className="fb" key={q.id}>
          <div className="row"><button className="spk" onClick={() => play(q.question, 0.9)}>🔊</button><b>{q.question}</b></div>
          <div className="gloss">{q.questionGloss}</div>
          {q.spokenPrompt ? (
            <div style={{ marginTop: 8 }}>
              <div className="muted small">Answer aloud — say:</div>
              <LearnerTurn turn={{ speaker: "learner", text: q.answer, translit: q.answerTranslit, gloss: q.answerGloss }} config={config} onDone={() => {}} />
            </div>
          ) : revealed[q.id] ? (
            <div style={{ marginTop: 6 }}><span className="target">{q.answer}</span> <span className="muted small">· {q.answerGloss}</span></div>
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

// ---------- Library view 6: writing (prompted production + correction-why) ----------
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
function ProgressDash({ progress }: { progress: Progress }) {
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
        {stat("Day streak", streak)}
        {stat("Level", level.cefrBand)}
      </div>
    </section>
  );
}

// ---------- Progress section: Strengthen (unified SRS over phrases + grammar) ----------
type ReviewUnit =
  | { type: "pool"; key: string; item: ReviewItem; strength: number }
  | { type: "captured"; key: string; entry: FamiliarityEntry; strength: number };

function Review({ progress, persist }: { progress: Progress; persist: (p: Progress) => void }) {
  const pack = usePack();
  // Weakest-first queue of everything due: pack vocab/grammar PLUS words you captured while reading
  // (those are reviewed in the sentence you met them in — cloze).
  const queue = useMemo<ReviewUnit[]>(() => {
    const now = new Date();
    const pool = reviewPool(pack);
    const poolKeys = new Set(pool.map((it) => familiarity.deriveKeyForItem(it).lexKey));
    const poolUnits: ReviewUnit[] = pool
      .filter((it) => isDue(progress, it, now))
      .map((it) => {
        const k = familiarity.deriveKeyForItem(it).lexKey;
        return { type: "pool", key: k, item: it, strength: progress.familiarity[k]?.strength ?? 0 };
      });
    const capturedUnits: ReviewUnit[] = Object.values(progress.familiarity)
      .filter((e) => e.srs && new Date(e.srs.due) <= now && (e.kind === "word" || e.kind === "chunk") && !poolKeys.has(e.lexKey))
      .map((e) => ({ type: "captured", key: e.lexKey, entry: e, strength: e.strength }));
    const nowMs = now.getTime();
    const dueMs = (u: ReviewUnit) => {
      const srs = u.type === "captured" ? u.entry.srs : progress.familiarity[u.key]?.srs;
      return srs ? new Date(srs.due).getTime() : nowMs; // untracked pool items count as due now
    };
    return [...poolUnits, ...capturedUnits].sort((a, b) => dueMs(a) - dueMs(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack]);
  const [idx, setIdx] = useState(0);

  const gradePool = (item: ReviewItem, ok: boolean) => { persist(gradeItem(progress, item, ok)); setIdx((i) => i + 1); };
  const gradeCaptured = (lexKey: string, ok: boolean) => {
    const e = progress.familiarity[lexKey];
    if (e) persist({ ...progress, familiarity: { ...progress.familiarity, [lexKey]: familiarity.grade(e, ok ? "good" : "again") } });
    setIdx((i) => i + 1);
  };

  if (queue.length === 0)
    return <section className="view"><h2>Strengthen</h2><p className="lead">Nothing to strengthen right now — you're caught up. New words and grammar you meet show up here to lock in.</p></section>;
  if (idx >= queue.length)
    return <section className="view"><h2>Strengthen</h2><p className="lead">Done — {queue.length} strengthened. 🎉</p></section>;

  const u = queue[idx]!;
  return (
    <section className="view">
      <h2>Strengthen <span className="muted small">· {queue.length - idx} left</span></h2>
      <p className="lead">Recall each before you reveal — your most-due items first, including words you saved while reading.</p>
      {u.type === "pool" ? (
        u.item.kind === "grammar"
          ? <GrammarCard key={u.key} item={u.item} onGrade={(ok) => gradePool(u.item, ok)} />
          : <PhraseCard key={u.key} item={u.item} onGrade={(ok) => gradePool(u.item, ok)} />
      ) : (
        <ClozeCard key={u.key} entry={u.entry} context={progress.contexts?.[u.key]} onGrade={(ok) => gradeCaptured(u.key, ok)} />
      )}
    </section>
  );
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Captured-word review shown in context: the word blanked inside the sentence you met it in.
function ClozeCard({ entry, context, onGrade }: { entry: FamiliarityEntry; context?: string; onGrade: (ok: boolean) => void }) {
  const play = usePlay();
  const [revealed, setRevealed] = useState(false);
  const blanked = context ? context.replace(new RegExp(`(^|[^\\p{L}])(${escapeRe(entry.display)})(?=[^\\p{L}]|$)`, "iu"), (_m, pre) => `${pre}____`) : null;
  const cloze = blanked && blanked !== context ? blanked : null;
  return (
    <div className="fb">
      <div className="muted small">{cloze ? "Fill the blank" : "Recall this word"}{entry.gloss ? ` — “${entry.gloss}”` : ""}:</div>
      <div style={{ fontSize: 19, margin: "8px 0", lineHeight: 1.5 }}>{cloze ?? entry.gloss ?? entry.display}</div>
      {!revealed ? (
        <button className="btn" onClick={() => setRevealed(true)}>Reveal</button>
      ) : (
        <div>
          <div className="target" style={{ fontSize: 22 }}>{entry.display}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="ghost" onClick={() => play(entry.display, 0.8)}>🔊 hear</button>
            <button className="ghost" onClick={() => onGrade(false)}>Again</button>
            <button className="btn" onClick={() => onGrade(true)}>Good</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PhraseCard({ item, onGrade }: { item: ReviewItem; onGrade: (ok: boolean) => void }) {
  const pack = usePack();
  const play = usePlay();
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="fb">
      <div className="muted small">Say in {pack.name}:</div>
      <div style={{ fontSize: 20, margin: "6px 0" }}>{item.gloss}</div>
      {!revealed ? (
        <button className="btn" onClick={() => setRevealed(true)}>Reveal</button>
      ) : (
        <div>
          <div className="target" style={{ fontSize: 22 }}>{item.answer}</div>
          <div className="translit">{item.translit}</div>
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
  useEffect(() => {
    (async () => {
      try {
        setSessions(await store.listArtifacts(partnershipId, "live"));
      } catch {
        /* tolerate */
      }
    })();
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
    const id = crypto.randomUUID();
    const sess = live.startLive(id, packId, sc, live.assignLiveRoles(myId, partnerId));
    await store.putArtifact(partnershipId, packId, "live", sess, id);
    setSession(sess);
    setSid(id); // activate refresh + realtime for the just-created session
  };

  const startRec = async () => {
    setRecording(true);
    await rec.current.start();
  };

  const speak = async () => {
    if (!session) return;
    const turn = live.currentTurn(session);
    if (!turn) return;
    setRecording(false);
    setBusy(true);
    try {
      const blob = await rec.current.stop();
      const asr = await api.asr(blob, packId);
      const transcripts = { scribe: asr.eleven?.text, google: asr.google?.text };
      const fb = await api.feedback({ answer: turn.text, translit: turn.translit, gloss: turn.gloss }, transcripts, packId);
      const transcript = transcripts.scribe || transcripts.google || "";
      const score = fb.error ? 0 : fb.score;
      const latest = ((await store.listArtifacts(partnershipId, "live")).find((x) => x.id === session.id)?.payload as LiveSession) ?? session;
      const next = live.speakTurn(latest, myId, transcript, score);
      await store.putArtifact(partnershipId, packId, "live", next, next.id);
      setSession(next);
    } finally {
      setBusy(false);
    }
  };

  if (sessionId === "new" && !session) {
    return (
      <div style={colStack}>
        <span className="small">Pick a scenario to do live together</span>
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
        <span className="small">Live · you are <b>{myRole}</b></span>
        <span className="muted small">{partnerOnline ? "🟢 partner here" : "⚪ waiting for partner"} <button className="ghost small" onClick={refresh}>↻</button></span>
      </div>
      {session.turns.filter((t) => t.spokenBy).map((t) => (
        <div className="fb" key={t.index}>
          <span className="muted small">{t.speaker === myRole ? "you" : "partner"}:</span> <b>{t.text}</b>
          {t.transcript ? <div className="muted small">heard: {t.transcript}{typeof t.score === "number" ? ` · ${t.score}/100` : ""}</div> : null}
        </div>
      ))}
      {done ? (
        <p className="lead" style={{ color: "var(--ok)", margin: 0 }}>🎉 Conversation complete — nicely done, both of you!</p>
      ) : myTurn ? (
        <div className="fb">
          <div className="muted small">Your line:</div>
          <div className="row"><button className="spk" onClick={() => turn && play(turn.text, 0.9)}>🔊</button> <b>{turn?.text}</b></div>
          <div className="gloss">{turn?.gloss}{turn?.translit ? ` · ${turn.translit}` : ""}</div>
          {recording ? <button className="rec" onClick={speak}>⏹ Stop</button> : <button className="btn" disabled={busy} onClick={startRec}>{busy ? "scoring…" : "● say it"}</button>}
        </div>
      ) : (
        <div className="fb"><span className="muted small">🎙 Waiting for your partner to say their line…</span></div>
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
    (async () => {
      try {
        setSessions(await store.listArtifacts(partnershipId, "infogap"));
      } catch {
        /* tolerate */
      }
    })();
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
    const id = crypto.randomUUID();
    const sess = infogap.startInfoGap(id, packId, task, { [myId]: "A", [partnerId]: "B" });
    await store.putArtifact(partnershipId, packId, "infogap", sess, id);
    setSession(sess);
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
              <span><b>{p.text}</b> <span className="muted small">— {p.gloss}</span></span>
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
    (async () => {
      try {
        setSessions(await store.listArtifacts(partnershipId, "roleswap"));
      } catch {
        /* overview tolerates a missing list */
      }
    })();
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
    const id = crypto.randomUUID();
    const sess = roleswap.startRoleSwap(id, packId, sc, roleswap.assignRoles(myId, partnerId));
    await store.putArtifact(partnershipId, packId, "roleswap", sess, id);
    setSession(sess);
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
            <div className="row"><b>{t.text}</b> <span className="muted small">{t.gloss}</span></div>
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

function PartnerPanel({ progress, persist, navigateToStory }: { progress: Progress; persist: (p: Progress) => void; navigateToStory: (storyId: string) => void }) {
  const pack = usePack();
  const packId = pack.id;
  const store = useMemo(() => getPartnerStore(), []);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<Partnership | null>(null);
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

  const myActivity = useCallback(
    (): ActivityRecord => ({
      lastActiveDay: progressRef.current.streak?.lastDay ?? "",
      metrics: scoring.computeMetrics(progressRef.current.familiarity),
    }),
    [],
  );

  const refresh = useCallback(async () => {
    if (!store) return setLoading(false);
    setLoading(true);
    setError(null);
    try {
      const active = (await store.myPartnerships(packId))[0] ?? null;
      setLink(active);
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
  }, [store, packId, myActivity]);

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

  const content = () => {
    if (loading) return <span className="muted small">…</span>;
    if (!link)
      return (
        <div style={colStack}>
          <p className="muted small">Learn with someone you trust — invite them, then build a shared streak now and (soon) swap spoken roles.</p>
          <div className="row">
            <button className="btn" disabled={busy} onClick={act(() => store.invite(packId))}>Invite a partner</button>
          </div>
          <div className="row">
            <input className="lang-picker" placeholder="Enter invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} style={{ textTransform: "uppercase", minWidth: 150 }} />
            <button className="ghost" disabled={busy || !joinCode.trim()} onClick={act(() => store.redeem(joinCode).then(() => setJoinCode("")))}>Join</button>
          </div>
        </div>
      );
    const l = link;
    if (l.status === "pending")
      return (
        <div style={colStack}>
          <p className="small">Invite created. Share this code with your partner:</p>
          <div className="row"><code className="chip" style={{ fontSize: 18, letterSpacing: 3 }}>{l.inviteCode}</code></div>
          <p className="muted small">They open <b>Me → Join</b> and enter it. This updates once they join.</p>
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
    return (
      <div style={colStack}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="small">Your partner</span>
          {pm ? (
            <span className="muted small"><b style={{ color: "var(--ok)" }}>{pm.knownWordCount}</b> words known · {pm.movedToKnownThisWeek} new this week</span>
          ) : pDay ? (
            <span className="muted small">last active {pDay === localDay() ? "today 🎉" : pDay}</span>
          ) : (
            <span className="muted small">no activity shared yet</span>
          )}
        </div>
        <div className="row">
          <span className="small">Shared streak</span>
          <span className="muted small">
            {shared && shared.count > 0
              ? `${shared.count} day${shared.count === 1 ? "" : "s"} you both showed up${shared.lastDay === localDay() ? " — including today 🔥" : ""}`
              : "practise on the same day to start a shared streak"}
          </span>
        </div>
        <div className="row">
          {NUDGES.map((n) => (
            <button key={n} className="ghost small" disabled={busy} onClick={act(() => store.putArtifact(l.id, packId, "nudge", { text: n, day: localDay() }))}>{n}</button>
          ))}
        </div>
        {nudges.length > 0 && (
          <ul className="muted small" style={{ margin: 0, paddingLeft: 18 }}>
            {nudges.map((nd) => {
              const pl = nd.payload as { text?: string; day?: string };
              return <li key={nd.id}>{nd.createdBy === myId ? "You" : "Partner"}: {pl.text} <span style={{ opacity: 0.6 }}>{pl.day}</span></li>;
            })}
          </ul>
        )}
        <LiveConvoSection store={store} partnershipId={l.id} onOpen={setLc} />
        <RoleSwapSection store={store} partnershipId={l.id} onOpen={setRs} />
        <InfoGapSection store={store} partnershipId={l.id} onOpen={setIg} />
        <FamiliarityCollab store={store} partnershipId={l.id} packId={packId} myId={myId} partnerId={partnerId} diff={diff} progress={progress} />
        <SharedStory store={store} partnershipId={l.id} packId={packId} progress={progress} navigateToStory={navigateToStory} />
        <Phrasebook store={store} partnershipId={l.id} packId={packId} progress={progress} persist={persist} />
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
          <button className="ghost" disabled={busy} onClick={act(() => store.end(l.id))}>End partnership</button>
        </div>
      </div>
    );
  };

  return (
    <div className="setting-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>Learning partner</b>
        {shared && shared.count > 0 && <span className="streak-chip" title="Shared streak — days you both practised">🤝🔥 {shared.count}</span>}
      </div>
      {error && <p className="small" style={{ color: "var(--warn)", margin: "4px 0 0" }}>{error}</p>}
      {content()}
    </div>
  );
}

function Settings({ progress, persist, config, navigateToStory }: { progress: Progress; persist: (p: Progress) => void; config: api.Config | null; navigateToStory: (storyId: string) => void }) {
  const pack = usePack();
  const autoplay = progress.settings?.autoplay ?? false;
  const badge = (l: string, on?: boolean) => <span className={`badge ${on ? "on" : "off"}`} key={l}>{l} {on ? "✓" : "✗"}</span>;
  return (
    <section className="view">
      <h2>Settings</h2>
      <PartnerPanel progress={progress} persist={persist} navigateToStory={navigateToStory} />
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
        <b>Speech &amp; AI</b>
        {config ? [badge("Scribe", config.engines.eleven), badge("Google", config.engines.google), badge("Claude", config.engines.anthropic)] : <span className="muted small">…</span>}
      </div>
      {packUnreviewed(pack) && (
        <div className="setting-row">
          <span className="badge warn">⚠ unreviewed</span>
          <span className="muted small">This pack's content is machine-generated, pending native review — not yet authoritative.</span>
        </div>
      )}
    </section>
  );
}
