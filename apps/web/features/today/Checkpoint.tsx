"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Chapter, DialogueTurn, ReviewItem, Scenario } from "@ll/pack-schema";
import * as scenario from "@ll/core/scenario";
import * as chapterSpine from "@ll/core/chapters";
import * as api from "../../lib/api";
import { type Progress } from "../../lib/store";
import * as cp from "../../lib/course-player";
import { ScenarioView } from "../conversation/ScenarioView";
import { UseIt } from "../reading/StoryReader";
import { Icon, gradeItem, usePack } from "../shared";
import { SayIt } from "./Lessons";
import { Tag } from "./TodayHeader";
import { WarmResult, WarmupSession } from "./Warmup";

// End-of-lesson recap: re-drill exactly the items missed this session. "Good" clears a card; "Again"
// sends it to the back — so the ones you're still shaky on loop until cleared (the same requeue idea
// as the alphabet quiz). Pure re-exposure: it doesn't touch SRS (the original misses already did).
// ---------- The chapter checkpoint: a consolidation gate between chapters ----------
// When a chapter's content is finished, the next session opens with this instead of the usual warm-up:
// recall its words + its grammar, then run its conversation again. Passing (PASS_MARK of the recall
// graded right, and the conversation's goals met) records the chapter as checked in Progress.chapters;
// failing records nothing, so the checkpoint simply comes round again tomorrow. That's the brake — the
// course doesn't quietly move on from a chapter the learner can't yet use.
export const CHECKPOINT_PASS = 0.7;
export function ChapterCheckpoint({ chapter, items, persons, onMissTurn, scenario, progress, persist, config, onMiss, onDone, onFinished, doneLabel, nextLabel }: {
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
}) {
  const [phase, setPhase] = useState<"drill" | "persons" | "say" | "speak" | "result">("drill");
  const finished = useRef(false);
  const [score, setScore] = useState({ got: 0, total: 0 });
  const [spoke, setSpoke] = useState(false);
  const recallOk = score.total === 0 || score.got / score.total >= CHECKPOINT_PASS;
  const passed = recallOk && (!scenario || spoke);
  const switches = persons?.switches ?? [];
  const sayLines = persons?.say ?? [];
  const afterPersons = () => setPhase(sayLines.length ? "say" : scenario ? "speak" : "result");
  // A switch missed counts against the recall score, like a word or a card.
  const missedSwitch = useRef(new Set<string>());

  // Reaching the result IS finishing: record it once, there — not on the button (a learner who stops on the
  // result screen has still done the lesson).
  useEffect(() => {
    if (phase !== "result" || finished.current) return;
    finished.current = true;
    const p = passed ? { ...progress, chapters: chapterSpine.passCheckpoint(progress.chapters, chapter.id) as Progress["chapters"] } : progress;
    if (onFinished) onFinished(p, passed); else persist(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const finishDrill = useCallback((results: WarmResult[]) => {
    setScore({ got: results.filter((r) => r.ok).length, total: results.length });
    setPhase(switches.length ? "persons" : sayLines.length ? "say" : scenario ? "speak" : "result");
  }, [scenario, switches.length, sayLines.length]);


  if (phase === "drill")
    return (
      <div>
        <Tag>Checkpoint · chapter {chapter.order}</Tag>
        <p className="lead" style={{ marginTop: 0 }}>Before we move on from <b>{chapter.shortTitle}</b>: everything it taught, {items.filter((i) => i.kind !== "grammar").length} words and {items.filter((i) => i.kind === "grammar").length} grammar cards{switches.length ? ", then the people swap" : ""}{scenario ? ", then the conversation" : ""}.</p>
        <WarmupSession items={items} progress={progress} persist={persist} onMiss={onMiss} onComplete={finishDrill} />
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
          onDone={() => { setScore((sc) => ({ got: sc.got + switches.length - missedSwitch.current.size, total: sc.total + switches.length })); afterPersons(); }}
        />
      </div>
    );

  if (phase === "say")
    return (
      <div>
        <Tag>Checkpoint · out loud</Tag>
        <p className="lead" style={{ marginTop: 0 }}>One line for each of the other persons, from this chapter&apos;s stories.</p>
        <SayIt lines={sayLines} config={config} onMiss={(t) => onMissTurn?.(t)} onDone={() => setPhase(scenario ? "speak" : "result")} />
      </div>
    );

  if (phase === "speak" && scenario)
    return (
      <div>
        <Tag>Checkpoint · use it</Tag>
        <p className="lead" style={{ marginTop: 0 }}>{score.got}/{score.total} recalled. Now use it for real: <b>{scenario.title}</b>.</p>
        <ScenarioView
          progress={progress} persist={persist} config={config} lettersDone
          scenarioId={scenario.id} hidePicker bare askable restartIfDone
          onComplete={() => { setSpoke(true); setPhase("result"); }}
        />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="quiet" onClick={() => setPhase("result")}>Not now: finish the checkpoint</button>
        </div>
      </div>
    );

  return (
    <div className="framed write-card">
      <div className="overline">Checkpoint · chapter {chapter.order}</div>
      {passed ? (
        <>
          <h3 className="lesson-title" style={{ fontSize: 24, display: "flex", alignItems: "center", gap: 8 }}><span className="result-ok"><Icon name="check" size={20} /></span>{chapter.shortTitle} is checked off</h3>
          <p className="lesson-rule">{score.got} of {score.total} recalled{scenario ? ", conversation done" : ""}. It stays in your reviews, but Today will move on to {nextLabel ?? `chapter ${chapter.order + 1}`}.</p>
        </>
      ) : (
        <>
          <h3 className="lesson-title" style={{ fontSize: 24 }}>Not quite yet</h3>
          <p className="lesson-rule">{score.got} of {score.total} recalled{scenario && !spoke ? ", conversation not done" : ""}. No harm done: this lesson still counts. <b>{chapter.shortTitle}</b> stays with you, and the checkpoint comes round again next session, after a short review of the words you found hardest.</p>
        </>
      )}
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
          setScore({ got: rs.filter((r) => r.ok).length, total: rs.length });
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
