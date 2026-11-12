"use client";
import { useEffect, useRef, useState } from "react";
import type { Chapter, DialogueTurn, ReviewItem, Scenario } from "@ll/pack-schema";
import * as scenario from "@ll/core/scenario";
import * as chapterSpine from "@ll/core/chapters";
import * as api from "../../lib/api";
import { type CheckpointParts, type Progress } from "../../lib/store";
import * as cp from "../../lib/course-player";
import { firstTries } from "../../lib/today-plan";
import { CHECKPOINT_PASS, cardsPass, checkpointPassed, clearParts, needed, partsOf, recordCards, recordConversation } from "../../lib/checkpoint";
import { ScenarioView } from "../conversation/ScenarioView";
import { UseIt } from "../reading/StoryReader";
import { Icon, gradeItem, usePack } from "../shared";
import { SayIt } from "./Lessons";
import { Tag } from "./TodayHeader";
import { WarmResult, WarmupSession } from "./Warmup";

// End-of-lesson recap: re-drill exactly the items missed this session. "Good" clears a card; "Again"
// brings it back a couple of cards on — so the ones you're still shaky on loop until cleared (the same
// requeue idea as the alphabet quiz). Pure re-exposure: it doesn't touch SRS (the original misses already did).
// ---------- The chapter checkpoint: a consolidation gate between chapters ----------
// The gate between chapters (lib/checkpoint.ts). On the course it's one of the choices at a chapter's end
// (ChapterEnd); it has two parts, each kept once passed: the cards (words, grammar cards, person swaps, then
// lines to say; 7 in 10 right on the first try) and the conversation. Passing both records the chapter in
// Progress.chapters and the course moves on; otherwise what's left waits, and nothing counts against you.
// Stopping part-way (onStop) records nothing; putting the conversation off keeps the cards.
export { CHECKPOINT_PASS };
export function ChapterCheckpoint({ chapter, items, persons, onMissTurn, scenario, progress, persist, config, onMiss, onDone, onFinished, doneLabel, nextLabel, earlier = 0, onStop }: {
  /** New course: what a pass leads to (the next chapter, a stage review, or the end). */
  nextLabel?: string;
  /** Called once, when the result screen appears: the progress with the pass recorded (if passed). */
  onFinished?: (p: Progress, passed: boolean) => void;
  /** The result screen's button (default "Carry on"). */
  doneLabel?: string;
  chapter: Chapter;
  items: ReviewItem[];
  /** The person round (cp.checkpointPersons): "Switch the person" on the chapter's stories, then lines to say. */
  persons?: { switches: cp.UseItItem[]; say: { text: string; gloss: string; focus?: string[] }[] };
  onMissTurn?: (t: DialogueTurn) => void;
  scenario?: Scenario;
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  onMiss: (item: ReviewItem) => void;
  onDone: (p: Progress) => void;
  /** How many of the words come from earlier chapters (the intro says so). */
  earlier?: number;
  /** Leave without finishing: back to the chapter's choices, nothing recorded. */
  onStop?: () => void;
}) {
  // What was already passed on an earlier go decides where this one starts.
  const [before] = useState(() => partsOf(progress, chapter.id));
  const needConversation = !!scenario && !before.conversation;
  const [phase, setPhase] = useState<"drill" | "persons" | "say" | "speak" | "result">(() => (before.cards ? (needConversation ? "speak" : "result") : "drill"));
  const finished = useRef(false);
  const latest = useRef(progress);
  latest.current = progress;
  const score = useRef({ got: 0, total: 0 });
  const missedIds = useRef<string[]>([]);
  const [cards, setCards] = useState<{ got: number; total: number } | null>(null);
  const [spoke, setSpoke] = useState(false);
  const [outcome, setOutcome] = useState<{ passed: boolean; parts: CheckpointParts } | null>(null);
  const switches = persons?.switches ?? [];
  const sayLines = persons?.say ?? [];
  const words = items.filter((i) => i.kind !== "grammar").length;
  const gram = items.filter((i) => i.kind === "grammar").length;
  // A switch missed counts against the recall score, like a word or a card.
  const missedSwitch = useRef(new Set<string>());

  // The cards part is over (drill, person swaps, lines to say): record it now, so leaving during the
  // conversation still keeps it. Then the conversation, unless it's already passed.
  const cardsDone = () => {
    const sc = score.current;
    persist(recordCards(latest.current, chapter.id, sc, missedIds.current));
    setCards(sc);
    setPhase(needConversation ? "speak" : "result");
  };
  const afterPersons = () => (sayLines.length ? setPhase("say") : cardsDone());

  // Reaching the result IS finishing: record it once, there, not on the button (a learner who stops on the
  // result screen has still done the lesson). Runs after the conversation's own save has landed.
  useEffect(() => {
    if (phase !== "result" || finished.current) return;
    finished.current = true;
    let p = spoke ? recordConversation(progress, chapter.id) : progress;
    const parts = partsOf(p, chapter.id);
    const passed = checkpointPassed(parts, !!scenario);
    if (passed) p = clearParts({ ...p, chapters: chapterSpine.passCheckpoint(p.chapters, chapter.id) as Progress["chapters"] }, chapter.id);
    setOutcome({ passed, parts });
    if (onFinished) onFinished(p, passed); else persist(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const finishDrill = (results: WarmResult[]) => {
    // Checkpoint answers are real recall: they reschedule the cards like any review.
    let p = latest.current;
    for (const r of results) p = gradeItem(p, r.item, r.ok);
    persist(p);
    score.current = firstTries(results);
    missedIds.current = [...new Set(results.filter((r) => !r.ok && !r.retry).map((r) => r.item.id))];
    if (switches.length) setPhase("persons"); else if (sayLines.length) setPhase("say"); else cardsDone();
  };
  const stop = onStop && <div className="row" style={{ marginTop: 14 }}><button className="quiet" onClick={onStop}>Stop for now: the checkpoint will wait, nothing counts against you</button></div>;
  const parts = scenario ? 2 : 1;

  if (phase === "drill")
    return (
      <div>
        <Tag>Checkpoint · chapter {chapter.order}{parts > 1 ? " · part 1 of 2: the cards" : ""}</Tag>
        <p className="lead" style={{ marginTop: 0 }}>
          {words - earlier} words from <b>{chapter.shortTitle}</b>{earlier ? `, ${earlier} from earlier chapters` : ""}{gram ? `, ${gram} grammar card${gram > 1 ? "s" : ""}` : ""}{switches.length ? `, then ${switches.length} person swap${switches.length > 1 ? "s" : ""}` : ""}{sayLines.length ? ` and ${sayLines.length} line${sayLines.length > 1 ? "s" : ""} to say` : ""}.
          {" "}To pass: 7 in 10 right on the first try. A miss just counts as a miss: no second goes in the checkpoint.
        </p>
        <WarmupSession items={items} progress={progress} persist={persist} onMiss={onMiss} onComplete={finishDrill} label="Checkpoint" requeue={false} tally />
        {stop}
      </div>
    );

  if (phase === "persons")
    return (
      <div>
        <Tag>Checkpoint · switch the person</Tag>
        <UseIt
          items={switches}
          config={config}
          lead="Lines from this chapter's stories, told about someone else: pick the form that fits."
          onMiss={(it) => { missedSwitch.current.add(it.id); onMiss(it); }}
          onDone={() => { score.current = { got: score.current.got + switches.length - missedSwitch.current.size, total: score.current.total + switches.length }; afterPersons(); }}
        />
        {stop}
      </div>
    );

  if (phase === "say")
    return (
      <div>
        <Tag>Checkpoint · out loud</Tag>
        <p className="lead" style={{ marginTop: 0 }}>One line for each of the other persons, from this chapter&apos;s stories. These aren&apos;t scored.</p>
        <SayIt lines={sayLines} config={config} onMiss={(t) => onMissTurn?.(t)} onDone={cardsDone} />
        {stop}
      </div>
    );

  if (phase === "speak" && scenario)
    return (
      <div>
        <Tag>Checkpoint · chapter {chapter.order} · part 2 of 2: the conversation</Tag>
        <p className="lead" style={{ marginTop: 0 }}>
          {cards ? <>{cardsPass(cards) ? <>Cards passed, and kept: {cards.got} of {cards.total} right first time.</> : <>Cards: {cards.got} of {cards.total} right first time; a pass needs {needed(cards.total)}. The conversation counts on its own: pass it now and it&apos;s kept.</>}{" "}</>
            : before.cards ? <>You passed the cards part already: just the conversation left.{" "}</> : null}
          To pass: get through <b>{scenario.title}</b> to the end.
        </p>
        <ScenarioView
          progress={progress} persist={persist} config={config} lettersDone
          scenarioId={scenario.id} hidePicker bare askable restartIfDone
          onComplete={() => { setSpoke(true); setPhase("result"); }}
        />
        <div className="row" style={{ marginTop: 12 }}>
          {cards
            ? <button className="quiet" onClick={() => setPhase("result")}>{cardsPass(cards) ? "Not now: keep the cards and do the conversation another time" : "Not now: do the conversation another time"}</button>
            : stop}
        </div>
      </div>
    );

  if (!outcome) return null;
  const p = outcome.parts;
  const when = (iso?: string) => (iso && new Date(iso).toDateString() !== new Date().toDateString() ? ` on ${new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "");
  const cardsLine = p.cards
    ? <>Cards: passed{cards ? `, ${cards.got} of ${cards.total} right first time` : when(p.cards)}.</>
    : cards ? <>Cards: {cards.got} of {cards.total} right first time; a pass needs {needed(cards.total)}.</> : <>Cards: still to do.</>;
  const convoLine = !scenario ? null : p.conversation ? <>Conversation: passed{spoke ? "" : when(p.conversation)}.</> : <>Conversation: still to do.</>;
  const left = [!p.cards ? "the cards" : "", scenario && !p.conversation ? "the conversation" : ""].filter(Boolean).join(" and ");
  return (
    <div className="framed write-card">
      <div className="overline">Checkpoint · chapter {chapter.order}</div>
      {outcome.passed ? (
        <h3 className="lesson-title" style={{ fontSize: 24, display: "flex", alignItems: "center", gap: 8 }}><span className="result-ok"><Icon name="check" size={20} /></span>{chapter.shortTitle} is checked off</h3>
      ) : (
        <h3 className="lesson-title" style={{ fontSize: 24 }}>Not quite yet</h3>
      )}
      <ul className="recap-list">
        <li className="word-row">{p.cards ? <span className="result-ok"><Icon name="check" size={15} /></span> : null}<span>{cardsLine}</span></li>
        {convoLine && <li className="word-row">{p.conversation ? <span className="result-ok"><Icon name="check" size={15} /></span> : null}<span>{convoLine}</span></li>}
      </ul>
      <p className="lesson-rule" style={{ marginTop: 12 }}>
        {outcome.passed
          ? <>It stays in your reviews, but Today moves on to {nextLabel ?? `chapter ${chapter.order + 1}`}.</>
          : <>No harm done: this lesson still counts, and what you passed is kept. Next time it&apos;s just {left}, whenever you&apos;re ready; you can practise first.</>}
      </p>
      <div className="write-actions">
        {/* The pass rides out with the same Progress the parent persists, so it can't be lost to a race
            between an effect-write and the step advance. */}
        <button className="btn" onClick={() => onDone(progress)}>{(doneLabel ?? "Carry on").replace(/\s*→$/, "")}</button>
      </div>
    </div>
  );
}
// A stage review (DESIGN §4a item 6): a sample of every chapter in the stage, one card per grammar point,
// then one of the stage's conversations. It's consolidation, not a gate: it always completes, and what you
// miss goes back into review through the normal grading.
export function StageReview({ afterChapterId, items, scenario, progress, persist, config, onMiss, onDone }: {
  afterChapterId: string;
  items: ReviewItem[];
  scenario?: Scenario;
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  onMiss: (item: ReviewItem) => void;
  onDone: (p: Progress) => void;
}) {
  const pack = usePack();
  const [phase, setPhase] = useState<"drill" | "speak" | "result">(items.length ? "drill" : scenario ? "speak" : "result");
  const [graded, setGraded] = useState<Progress>(progress);
  const [score, setScore] = useState({ got: 0, total: 0 });
  const review = pack.course?.stageReviews.find((r) => r.afterChapterId === afterChapterId);
  const titles = (review?.chapterIds ?? []).map((id) => pack.chapters?.find((c) => c.id === id)?.shortTitle).filter(Boolean).join(" · ");
  if (phase === "drill")
    return (
      <div>
        <Tag>Stage review</Tag>
        <p className="lead" style={{ marginTop: 0 }}>A look back over everything in this stage: <b>{titles}</b>.</p>
        <WarmupSession items={items} progress={progress} persist={persist} onMiss={onMiss} onComplete={(rs) => {
          let p = progress;
          for (const r of rs) p = gradeItem(p, r.item, r.ok);
          setGraded(p);
          setScore(firstTries(rs));
          setPhase(scenario ? "speak" : "result");
        }} />
      </div>
    );
  if (phase === "speak" && scenario)
    return (
      <div>
        <Tag>Stage review · use it</Tag>
        <p className="lead" style={{ marginTop: 0 }}>Now a conversation from this stage: <b>{scenario.title}</b>.</p>
        <ScenarioView progress={graded} persist={persist} config={config} lettersDone scenarioId={scenario.id} hidePicker bare askable restartIfDone onComplete={() => setPhase("result")} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="quiet" onClick={() => setPhase("result")}>Not now</button>
        </div>
      </div>
    );
  return (
    <div className="framed write-card">
      <div className="overline">Stage review</div>
      <h3 className="lesson-title" style={{ fontSize: 24, display: "flex", alignItems: "center", gap: 8 }}><span className="result-ok"><Icon name="check" size={20} /></span>Stage done</h3>
      <p className="lesson-rule">{score.total ? `${score.got} of ${score.total} recalled. ` : ""}Anything you missed comes back in your reviews.</p>
      <div className="write-actions">
        <button className="btn" onClick={() => onDone(graded)}>Carry on</button>
      </div>
    </div>
  );
}
