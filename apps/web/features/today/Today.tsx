"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DialogueTurn, GrammarConcept, ReviewItem } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import * as chapterSpine from "@ll/core/chapters";
import * as sentenceScope from "@ll/core/sentences";
import * as api from "../../lib/api";
import { type Progress } from "../../lib/store";
import { REVIEW_DAY_ITEMS, WARMUP_ITEMS, isReviewDay, localDay, markStorySeen, planNewWords } from "../../lib/daily";
import { toggleStar } from "../../lib/capture";
import * as cp from "../../lib/course-player";
import { courseSteps, pickConjVerb, reviewPool, shuffle, type TodayStep } from "../../lib/today-plan";
import { SentenceBuilder } from "../build/SentenceBuilder";
import { ScenarioView } from "../conversation/ScenarioView";
import { ExamView } from "../exam/Exam";
import { GrammarIntroCard, GrammarPracticeCard } from "../grammar/GrammarCards";
import { Letters } from "../letters/Letters";
import { TodayStoryStep } from "../reading/StoryReader";
import { LibView, NoteAt, Section, Stitches, bumpStreak, captureWords, currentStory, focusLetters, gradeItem, isDue, markSeen, partnerScenario, pending, scenarioVocab, seedStoryVocab, usePack, writingUnlocked } from "../shared";
import { AgendaCard } from "./AgendaCard";
import { ChapterCheckpoint, StageReview } from "./Checkpoint";
import { CourseRecap } from "./CourseRecap";
import { LetterLesson, PointLesson, SayIt } from "./Lessons";
import { NewWordsCard } from "./NewWordsCard";
import { Tag, TodayHeader } from "./TodayHeader";
import { SessionRecap, WarmupSession } from "./Warmup";
import { WritingCapstone, WritingLines } from "../writing/Writing";

export function Today({ progress, persist, config, navigate, replay }: {
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  navigate: (sec: Section, lv?: LibView, scenarioId?: string) => void;
  /** Do a finished lesson again: planned from that session, and finishing it changes nothing about your place
   *  in the course (no advance, no lesson log, no "done for today"). What you practise still counts. */
  replay?: { at: NoteAt; onExit: () => void };
}) {
  const pack = usePack();
  // The position the session is planned from: yours, or the lesson being replayed.
  const planCourse = replay && pack.course ? { chapterId: replay.at.chapterId, session: replay.at.n, v: pack.course.version } : progress.course;
  const lettersDone = focusLetters(pack).every((a) => progress.letters[a.glyph]);
  // The plan is built once per mount (and when letters finish) so steps don't shift under the user mid-session.
  // planVersion bumps when the learner starts the next course session straight away (new course only).
  const [planVersion, setPlanVersion] = useState(0);
  // …as it was when this session's plan was made (the course moves on as soon as the session completes,
  // which can be on a last step's end screen — the header should still name the session you're in).
  const planned = useMemo(() => planCourse,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planVersion]);
  const v2 = cp.courseV2On(pack, progress);
  const steps = useMemo<TodayStep[]>(() => {
    if (cp.courseV2On(pack, progress)) return courseSteps(pack, { ...progress, course: planCourse });
    const out: TodayStep[] = [];
    const now = new Date();
    // Due studied items, deduped by lexKey — the pool can hold two items for one word (e.g. an authored
    // vocab entry + a generated one both defining "пиво"), which would otherwise surface it twice.
    // Every Nth session introduces nothing new — warm-up, production from words already met, and a
    // revisit of something already read. The rest of this plan is skipped on those days.
    const reviewDay = isReviewDay(progress.sessions ?? 0);
    const seenDue = new Set<string>();
    const due = reviewPool(pack).filter((it) => {
      if (!isDue(progress, it, now)) return false;
      const k = familiarity.deriveKeyForItem(it).lexKey;
      if (seenDue.has(k)) return false;
      seenDue.add(k);
      return true;
    }).slice(0, reviewDay ? REVIEW_DAY_ITEMS : WARMUP_ITEMS);
    const conjVerb = pickConjVerb(pack, progress);

    // A finished chapter owes a CHECKPOINT before the flow moves on: a recap of that chapter's own words
    // and grammar, then its conversation again. It replaces the warm-up (both are review — doing both
    // would make the session a slog) and always leads the session, so consolidation comes before new
    // material. Failing it simply doesn't record a pass, so it comes back tomorrow.
    const owed = chapterSpine.nextCheckpoint(pack, progress);
    const owedContent = owed ? chapterSpine.resolveChapters(pack).find((c) => c.chapter.id === owed.id) : undefined;
    if (owed && owedContent) {
      // Only what the learner has actually studied — a checkpoint should test the chapter, not ambush it
      // with words that were never taught. Grammar drills for its concepts come along in the same pass.
      const studied = owedContent.vocab.filter((v) => !!progress.familiarity[familiarity.deriveKeyForItem(v).lexKey]);
      const drills = owedContent.grammarIds.flatMap((id) => pack.grammar.find((c) => c.id === id)?.drills.slice(0, 1) ?? []);
      const items = [...shuffle(studied).slice(0, 8), ...drills];
      if (items.length) out.push({ kind: "checkpoint", chapter: owedContent.chapter, items, scenario: owedContent.scenarios[0] });
    } else if (due.length || conjVerb) {
      out.push({ kind: "warmup", items: due, conjVerb });
    }

    if (reviewDay) {
      // Production from what's already known, then re-read the most recent finished story. No new words,
      // no new grammar, nothing that advances the chapter.
      const buildChapterNow = chapterSpine.currentChapter(pack, progress);
      const orderNow = buildChapterNow ? (pack.chapters ?? []).find((c) => c.id === buildChapterNow.id)?.order ?? 1 : (pack.chapters?.length ?? 1);
      if (sentenceScope.withFallback(pack, { chapterOrder: orderNow, builtCount: (progress.builtConjugations ?? []).length, hasMet: (k) => !!progress.familiarity[k] }).items.length) {
        out.push({ kind: "build" });
      }
      const readAlready = (pack.stories ?? []).filter((st) => (progress.storyReads?.[st.id]?.length ?? 0) > 0);
      const revisit = readAlready[(progress.sessions ?? 0) % Math.max(1, readAlready.length)];
      if (revisit) out.push({ kind: "story", story: revisit, dayIndex: progress.storyReads?.[revisit.id]?.length ?? 0, revisit: true });
      // Nothing to review yet (nothing due, nothing read, nothing buildable) ⇒ fall through to a normal
      // session rather than handing back an empty one.
      if (out.length) return out;
      out.length = 0;
    }

    // One coherent unit per session: a story + the scenario that practises it. The unit stays for a few
    // days (UNIT_MIN_DAYS); dayIndex tracks which day we're on so the day-to-day content rotates.
    const story = currentStory(pack, progress);
    const scen = story ? partnerScenario(pack, story) : undefined;
    const dayIndex = story ? (progress.storyReads?.[story.id]?.length ?? 0) : 0;
    const isNewWord = (v: { lexKey: string }) => { const e = progress.familiarity[v.lexKey]; return !e || e.status === "new"; };
    let taughtToday: { lexKey: string; gloss?: string }[] = [];
    let requiredLeftToday = 0;

    // New words: teach the paired scenario's required vocab FIRST (so the speak step never needs a word
    // we skipped), then fill up to the cap with the story's own new words. The cap never drops a
    // scenario-required word — that promise matters more than the pacing target.
    if (story) {
      const required = (scen ? scenarioVocab(pack, scen) : []).filter(isNewWord);
      const storyWords = story.registersVocab.filter(isNewWord);
      // A gentle daily trickle of the core single-word vocabulary (Library → Words also lets you pull
      // more on demand), rotated by day so different words surface.
      const coreWords = pack.vocab
        .filter((v) => v.kind === "vocab" && !/\s/.test(v.answer.trim()))
        .map((v) => ({ lexKey: familiarity.deriveKeyForItem(v).lexKey, gloss: v.gloss }))
        .filter(isNewWord);
      // Aim the trickle at words that unlock something buildable, so the Build step keeps its place in
      // the day rather than depending on the rotation happening to surface the right word.
      const unlocking = sentenceScope.unlockingWords(pack, {
        chapterOrder: chapterSpine.currentChapter(pack, progress) ? (pack.chapters ?? []).find((c) => c.id === chapterSpine.currentChapter(pack, progress)!.id)?.order ?? 1 : 1,
        builtCount: (progress.builtConjugations ?? []).length,
        hasMet: (k) => !!progress.familiarity[k],
      });
      const priority = coreWords.filter((v) => unlocking.includes(v.lexKey));
      const plan = planNewWords({ required, storyWords, coreWords, priority, dayIndex });
      taughtToday = plan.teach;
      requiredLeftToday = plan.requiredLeft;
      if (plan.teach.length) out.push({ kind: "newwords", words: plan.teach });
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
    // Same gate the builder itself uses — otherwise Today offers a Build step that opens on "learn a few
    // more words first". Sentences stay within what the course has introduced, verb included.
    const here = chapterSpine.currentChapter(pack, progress);
    const buildChapter = here ? (pack.chapters ?? []).find((c) => c.id === here.id)?.order ?? 1 : (pack.chapters?.length ?? 1);
    const canBuild = sentenceScope.withFallback(pack, {
      chapterOrder: buildChapter,
      builtCount: (progress.builtConjugations ?? []).length,
      hasMet: (k) => !!progress.familiarity[k],
    }).items.length > 0;
    if (canBuild) out.push({ kind: "build" });

    // Speak: the story's paired scenario (so it uses what was just read); fall back to first-incomplete.
    // It waits until the scenario's required vocabulary has actually been taught — with the new-words cap
    // honoured, that's usually the second day of a chapter. Asking someone to produce a word they met
    // five minutes ago in the same session was a big part of why a day felt like a lot.
    const speakScen = scen ?? pack.scenarios.find((s) => {
      const p = progress.scenarios[s.id];
      return !p || s.successCriteria.some((c) => !p.metCriteria.includes(c.id));
    }) ?? pack.scenarios[0];
    if (speakScen && requiredLeftToday === 0) out.push({ kind: "speak", scenario: speakScen });

    // Writing capstone (gated): the unit's culminating free-production step, once vocab is known + grammar
    // practised. Prompt = the paired scenario's goal, scoped to what the learner just consolidated.
    if (story && writingUnlocked(pack, progress, story)) {
      out.push({ kind: "writing", prompt: scen?.goal ?? "Write a short line using today\u2019s words." });
    }

    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack, planVersion, v2]);

  const reviewDay = !v2 && isReviewDay(progress.sessions ?? 0);
  const [phase, setPhase] = useState<"gate" | "flow">(lettersDone || v2 ? "flow" : "gate");
  const [idx, setIdx] = useState(0);
  // Once today's session is finished we record the local day (below). On a later reload/reopen that flag
  // survives even though `idx` resets to 0 — so we open on the "done for today" screen instead of
  // marching the learner back through step 1. "Practice more anyway" opts back into the full flow.
  const completedToday = !replay && progress.lastSessionDay === localDay();
  const [practiceMore, setPracticeMore] = useState(false);
  // Items missed this session (auto-collected) → offered as an optional recap once the flow is done.
  const [missed, setMissed] = useState<ReviewItem[]>([]);
  // When this session's plan started — the recap lists words captured since then.
  const startedAt = useMemo(() => new Date(), [planVersion]);
  // The position the session was planned from (the course advances as soon as it ends, so the recap must
  // describe the session just finished, not the next one).
  const playedPos = useMemo(() => (v2 ? cp.position(pack.course!, planCourse) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planVersion, v2]);
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
  // A checkpoint passed during THIS session (the course only moves past a checkpoint on a pass).
  const checkpointPassed = useRef(false);
  const advancedFor = useRef(-1);
  // Finish the session: advance the blueprint exactly once (the learner may start the next one straight away,
  // so this can't key on the calendar day), log it for lesson notes, mark the day done — in ONE save, on top
  // of whatever the last step changed (`base`). Called when the plan runs out, or as soon as a last step's
  // own end screen appears (a checkpoint's result, the writing summary), so the lesson counts as done there.
  // The verbs whose every form today's warm-up matched (the recap says so).
  const drilled = steps.flatMap((s) => (s.kind === "warmup" && s.conjVerb ? [s.conjVerb.lemma] : []));
  const completeSession = (base: Progress = progress) => {
    if (replay || !v2 || advancedFor.current === planVersion) return; // a replay never moves the course on
    advancedFor.current = planVersion;
    const course = cp.advance(pack.course!, base.course, { checkpointPassed: checkpointPassed.current });
    // Keep a small record of the session so its recap can be reopened later as lesson notes.
    const entry = playedPos ? cp.logEntry(playedPos, startedAt, new Date(), missed.map((m) => ({ answer: m.answer, gloss: m.gloss })), drilled) : undefined;
    persist(bumpStreak({ ...base, lastSessionDay: localDay(), sessions: (base.sessions ?? 0) + 1, course, ...(entry ? { courseLog: [...(base.courseLog ?? []), entry] } : {}) }));
  };
  useEffect(() => {
    if (steps.length === 0 || idx < steps.length) return;
    if (replay) return;
    if (v2) { completeSession(); return; }
    if (progress.lastSessionDay !== localDay()) {
      persist({ ...progress, lastSessionDay: localDay(), sessions: (progress.sessions ?? 0) + 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, steps.length, planVersion]);
  // Flipping the course switch mid-session starts today's session over on the other planner.
  const firstV2 = useRef(v2);
  useEffect(() => { if (firstV2.current !== v2) { firstV2.current = v2; setIdx(0); } }, [v2]);
  // About three minutes a step; a checkpoint is a whole chapter's worth (words, cards, persons, conversation).
  const est = Math.max(5, steps.length * 3 + (steps.some((x) => x.kind === "checkpoint") ? 12 : 0));
  // Advance to the next step, persisting a single merged Progress and counting the day toward the streak.
  const done = (mutated: Progress = progress) => {
    persist(bumpStreak(mutated));
    setIdx((i) => i + 1);
  };

  // The alphabet gate runs INLINE inside Today — the whole session is self-contained, no jump to the Library.
  if (phase === "gate")
    return (
      <section className="view">
        <TodayHeader progress={{ ...progress, course: idx < steps.length ? planned : planCourse }} replay={replay} />
        <p className="lead">First, the alphabet. Macedonian uses Cyrillic: review all {pack.alphabet.length} letters (I&apos;ll quiz you on the {focusLetters(pack).length} trickiest), then today&apos;s session opens up right here.</p>
        <Letters progress={progress} persist={persist} onDone={() => setPhase("flow")} />
      </section>
    );
  // Already finished today's session (and this is a fresh mount, so idx is back at 0): show the wrap-up
  // screen rather than replaying step 1. "Practice more anyway" drops back into the full flow on demand.
  // (Only at step 0: a lesson now completes on its last step's own end screen, which must stay up.)
  if (completedToday && !practiceMore && idx === 0 && advancedFor.current !== planVersion)
    return (
      <section className="view">
        <TodayHeader progress={{ ...progress, course: idx < steps.length ? planned : planCourse }} replay={replay} />
        <h2 style={{ marginTop: 4 }}>Done for today</h2>
        <p className="lead">You&apos;ve finished today&apos;s session.{(progress.streak?.count ?? 0) > 0 ? ` ${progress.streak?.count}-day streak: come back tomorrow to keep it going.` : " Come back tomorrow for the next one."}</p>
        <div className="row" style={{ marginTop: 4 }}>
          {v2
            ? <button className="btn" onClick={() => { setPlanVersion((v) => v + 1); checkpointPassed.current = false; setIdx(0); setPracticeMore(true); }}>Start the next session now</button>
            : <button className="btn" onClick={() => { setIdx(0); setPracticeMore(true); }}>Practice more anyway</button>}
          <button className="ghost small" onClick={() => navigate("library", "flashcards")}>Flashcards</button>
          <button className="ghost small" onClick={() => navigate("progress")}>Your progress</button>
        </div>
      </section>
    );
  if (steps.length === 0)
    return (
      <section className="view">
        <TodayHeader progress={{ ...progress, course: idx < steps.length ? planned : planCourse }} replay={replay} />
        <p className="lead">You&apos;re all caught up for today. Come back tomorrow, or dip into the Library for extra practice whenever you like.</p>
        <button className="ghost small" onClick={() => navigate("library", "browse")}>Browse the Library</button>
      </section>
    );
  if (idx >= steps.length && v2 && playedPos && recap !== "review")
    return (
      <section className="view">
        <TodayHeader progress={{ ...progress, course: idx < steps.length ? planned : planCourse }} replay={replay} />
        <CourseRecap
          pos={playedPos}
          since={startedAt}
          progress={progress}
          persist={persist}
          missed={missed}
          drilled={drilled}
          onReviewMissed={() => setRecap("review")}
          onNext={replay ? replay.onExit : () => { setPlanVersion((v) => v + 1); checkpointPassed.current = false; setMissed([]); setRecap("offer"); setIdx(0); setPracticeMore(true); }}
          nextLabel={replay ? "Back to where you were" : undefined}
          navigate={navigate}
        />
      </section>
    );
  if (idx >= steps.length && v2 && recap === "review" && missed.length)
    return (
      <section className="view">
        <TodayHeader progress={{ ...progress, course: idx < steps.length ? planned : planCourse }} replay={replay} />
        <h3 style={{ marginTop: 4 }}>One more pass</h3>
        <p className="lead">Redo the ones you slipped on: <b>Good</b> clears a card, <b>Again</b> sends it to the back.</p>
        <SessionRecap items={missed} onDone={() => { setMissed([]); setRecap("done"); }} />
      </section>
    );
  if (idx >= steps.length) {
    // Offer a quick recap of anything you slipped on before wrapping up — retry it, or skip.
    if (missed.length > 0 && recap === "offer")
      return (
        <section className="view">
          <TodayHeader progress={{ ...progress, course: idx < steps.length ? planned : planCourse }} replay={replay} />
          <h2 style={{ marginTop: 4 }}>Session done</h2>
          <p className="lead">Nice work: you finished today&apos;s session.</p>
          <div className="framed write-card recap-card">
            <div className="overline">You slipped on {missed.length} this session</div>
            <ul className="recap-list">
              {missed.map((m) => <li key={m.id} className="word-row"><b lang={pack.id} className="rmk">{m.answer}</b> <span className="muted small">{m.gloss}</span></li>)}
            </ul>
            <div className="write-actions">
              <button className="btn" onClick={() => setRecap("review")}>Review the {missed.length} you missed</button>
              <button className="ghost" onClick={() => setRecap("done")}>Skip for now</button>
            </div>
          </div>
        </section>
      );
    if (missed.length > 0 && recap === "review")
      return (
        <section className="view">
          <TodayHeader progress={{ ...progress, course: idx < steps.length ? planned : planCourse }} replay={replay} />
          <h3 style={{ marginTop: 4 }}>One more pass</h3>
          <p className="lead">Redo the ones you slipped on: <b>Good</b> clears a card, <b>Again</b> sends it to the back.</p>
          <SessionRecap items={missed} onDone={() => setRecap("done")} />
        </section>
      );
    return (
      <section className="view">
        <TodayHeader progress={{ ...progress, course: idx < steps.length ? planned : planCourse }} replay={replay} />
        <h2 style={{ marginTop: 4 }}>Session done</h2>
        <p className="lead">Nice work: you finished today&apos;s session.{(progress.streak?.count ?? 0) > 0 ? ` ${progress.streak?.count}-day streak: come back tomorrow to keep it going.` : ""}</p>
        <div className="row" style={{ marginTop: 4 }}>
          {v2 && <button className="btn" onClick={() => { setPlanVersion((v) => v + 1); checkpointPassed.current = false; setMissed([]); setRecap("offer"); setIdx(0); setPracticeMore(true); }}>Start the next session now</button>}
          <button className="ghost small" onClick={() => navigate("progress")}>See your progress</button>
          <button className="ghost small" onClick={() => navigate("library", "flashcards")}>Flashcards in the Library</button>
        </div>
      </section>
    );
  }

  const step = steps[idx]!;
  return (
    <section className="view">
      <TodayHeader progress={{ ...progress, course: idx < steps.length ? planned : planCourse }} replay={replay} />
      <div className="step-meta">
        <Stitches total={steps.length} done={idx} now={idx} size={10} label={`Step ${idx + 1} of ${steps.length}`} />
        <span>Step {idx + 1} of {steps.length} · about {est} min</span>
        {reviewDay && <span>· <b>review day</b>: nothing new, just what you&apos;ve already met</span>}
      </div>

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

        {step.kind === "checkpoint" && (
          <ChapterCheckpoint
            key={idx}
            chapter={step.chapter}
            items={step.items}
            persons={step.persons}
            onMissTurn={flagTurn}
            scenario={step.scenario}
            progress={progress}
            persist={persist}
            config={config}
            onMiss={flag}
            nextLabel={v2 && pack.course ? cp.afterCheckpoint(pack, pack.course, planned) : undefined}
            // The result screen is the end of the lesson: record the pass (or not) and complete the session there.
            onFinished={(p, passed) => { checkpointPassed.current = passed; if (idx === steps.length - 1 && v2 && !replay) completeSession(p); else persist(p); }}
            doneLabel={idx === steps.length - 1 ? "Go to summary" : undefined}
            onDone={() => done()}
          />
        )}

        {step.kind === "letters" && (
          <LetterLesson
            key={idx}
            lesson={step.lesson}
            checkpoint={step.checkpoint}
            progress={progress}
            persist={persist}
            onDone={(p) => { if (step.checkpoint) checkpointPassed.current = true; done(p); }}
          />
        )}

        {step.kind === "sayit" && <SayIt key={idx} lines={step.lines} config={config} onMiss={flagTurn} onDone={() => done()} />}

        {step.kind === "agenda" && (
          <AgendaCard
            agenda={step.agenda}
            onSkipChapter={playedPos && cp.canSkipChapter(playedPos) ? () => {
              // Skip chapter 0: the letters count as known, and today's plan restarts on chapter 1.
              const letters = Object.fromEntries(pack.alphabet.map((a) => [a.glyph, true]));
              persist({ ...progress, letters: { ...progress.letters, ...letters }, course: cp.skipChapter(pack.course!, progress.course) });
              setPlanVersion((v) => v + 1); checkpointPassed.current = false; setIdx(0);
            } : undefined}
            pointId={steps.find((x): x is Extract<TodayStep, { kind: "point" }> => x.kind === "point")?.point.id}
            onOpenPoint={(id) => { pending.pointFocus = id; navigate("library", "grammar"); }}
            onStart={() => done()}
          />
        )}

        {step.kind === "exam" && (
          <ExamView key={idx} exam={step.exam} progress={progress} persist={persist} onFinish={(p) => done(p)} onLater={() => done()} />
        )}

        {step.kind === "stage" && (
          <StageReview
            key={idx}
            afterChapterId={step.afterChapterId}
            items={step.items}
            scenario={step.scenario}
            progress={progress}
            persist={persist}
            config={config}
            onMiss={flag}
            onDone={(p) => done(p)}
          />
        )}

        {step.kind === "point" && (
          <div>
            <PointLesson
              point={step.point}
              mode={step.mode}
              dayIndex={step.dayIndex}
              onMiss={flag}
              onDone={(results) => {
                let p = progress;
                for (const r of results) p = gradeItem(p, r.item, r.ok);
                if (step.mode === "teach") {
                  // The rule cards enter review now: you've just read the rule they ask about.
                  for (const rc of cp.ruleCardItems(step.point)) p = gradeItem(p, rc, true);
                  p = markSeen(p, step.point.id);
                  for (const g of step.point.grammarIds) p = markSeen(p, g);
                }
                done(p);
              }}
            />
          </div>
        )}

        {step.kind === "newwords" && (
          <div>
            <Tag>New words · {step.words.length}</Tag>
            <NewWordsCard
              words={step.words}
              noteFor={(k) => { const v = pack.vocab.find((x) => familiarity.deriveKeyForItem(x).lexKey === k); return v ? pack.course?.chunkNotes.find((n) => n.source === `vocab:${v.id}`)?.note ?? (v.meta?.wordNote as string | undefined) : undefined; }}
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
            <Tag>{step.revisit ? "Read it again" : "Read the story"}</Tag>
            <TodayStoryStep
              story={step.story}
              lens={step.lens}
              dayIndex={step.dayIndex}
              progress={progress}
              persist={persist}
              config={config}
              /* A revisit is consolidation: it must not mark a day against the chapter's unit, or a
                 review day would quietly push the chapter along. */
              onDone={() => done(step.revisit ? progress : markStorySeen(seedStoryVocab(progress, step.story), step.story.id))}
              onMiss={flag}
            />
          </div>
        )}

        {step.kind === "build" && (
          <div>
            <Tag>Build a sentence</Tag>
            <SentenceBuilder progress={progress} persist={persist} onDone={() => done()} preferIds={step.ids} chapterOrderOverride={step.chapterOrder} />
          </div>
        )}

        {step.kind === "writing" && (
          <div>
            <Tag>Write it</Tag>
            {step.set
              ? <WritingLines set={step.set} config={config} onMiss={flag} onDone={() => done()}
                  onFinished={idx === steps.length - 1 ? () => completeSession() : undefined}
                  doneLabel={idx === steps.length - 1 ? "Go to summary" : undefined} />
              : <WritingCapstone prompt={step.prompt} config={config} onDone={() => done()} />}
          </div>
        )}

        {step.kind === "speak" && (
          <div>
            <Tag>Speak · {step.scenario.title}</Tag>
            {/* The brief, never a generated scenario's goal (that's the generator's brief: "Practise these functions…"). */}
            <p className="muted small">{(step.scenario.brief ?? (/^Practise these functions/.test(step.scenario.goal) ? "Your lines are below." : step.scenario.goal)).replace(/([^.!?])$/, "$1.")} Use what you just read, out loud.</p>
            <ScenarioView progress={progress} persist={persist} config={config} lettersDone scenarioId={step.scenario.id} hidePicker bare askable restartIfDone onComplete={() => done()} onMiss={flagTurn} focusPoints={step.focus} />
          </div>
        )}
      </div>

      {/* The exam has its own skips (per task, and "take it later") — a generic skip would drop it unsaved.
          The menu's own button already moves on, so it needs no second one. */}
      {step.kind !== "exam" && step.kind !== "agenda" && (
        <div className="row" style={{ marginTop: 18 }}>
          <button className="quiet" onClick={() => done()}>Skip this step</button>
        </div>
      )}
    </section>
  );
}
