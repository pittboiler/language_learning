"use client";
import { useEffect, useRef, useState } from "react";
import type { Chapter, DialogueTurn, ReviewItem } from "@ll/pack-schema";
import * as api from "../../lib/api";
import { type Progress } from "../../lib/store";
import { cardsPass, needed, partsOf, roundMinutes } from "../../lib/checkpoint";
import { firstTries, type CheckpointRound } from "../../lib/today-plan";
import { ScenarioView } from "../conversation/ScenarioView";
import { ChapterGlance } from "../progress/Notes";
import { UseIt } from "../reading/StoryReader";
import { Icon, LibView, Section, gradeItem } from "../shared";
import { ChapterCheckpoint } from "./Checkpoint";
import { SayIt } from "./Lessons";
import { Tag } from "./TodayHeader";
import { WarmResult, WarmupSession } from "./Warmup";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// The end of a chapter (lib/checkpoint.ts): rather than drop you into the checkpoint, the chapter's last
// session lets you choose: take the checkpoint (the gate to the next chapter), practise this chapter or
// everything so far (counts as today's lesson, doesn't move the course on), or read the chapter summary.
// The screen says what the checkpoint asks, what passing takes, and what you've already passed.
export function ChapterEnd({ chapter, checkpoint, practice, progress, persist, config, navigate, onMiss, onMissTurn, nextLabel, doneLabel, onPractised, onFinished, onDone }: {
  chapter: Chapter;
  checkpoint: CheckpointRound;
  practice: { chapter: CheckpointRound; all: CheckpointRound };
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  navigate: (sec: Section, lv?: LibView) => void;
  onMiss: (item: ReviewItem) => void;
  onMissTurn: (t: DialogueTurn) => void;
  /** What a pass leads to ("chapter 4, At the café"). */
  nextLabel?: string;
  doneLabel?: string;
  /** A practice round reached its result: today's lesson is done, the course stays put. */
  onPractised: (p: Progress) => void;
  /** The checkpoint reached its result. */
  onFinished: (p: Progress, passed: boolean) => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "summary" | "checkpoint" | "chapter" | "all">("choose");
  const [goes, setGoes] = useState(0); // remount a round each time it's started
  const start = (m: typeof mode) => { setGoes((g) => g + 1); setMode(m); };
  const parts = partsOf(progress, chapter.id);
  const scen = checkpoint.scenario;
  const words = checkpoint.items.filter((i) => i.kind !== "grammar").length;
  const gram = checkpoint.items.length - words;
  const own = words - checkpoint.earlier;
  const left = { cards: !parts.cards, conversation: !!scen && !parts.conversation };
  const cpMin = roundMinutes({ cards: left.cards ? checkpoint.items.length : 0, switches: left.cards ? checkpoint.switches.length : 0, say: left.cards ? checkpoint.say.length : 0, conversation: left.conversation });
  const prMin = roundMinutes({ cards: practice.chapter.items.length, switches: practice.chapter.switches.length, say: practice.chapter.say.length, conversation: !!practice.chapter.scenario });
  // Chapter 1 has nothing before it (chapter 0 is the letters), so "everything so far" would be this chapter.
  const firstChapter = chapter.order <= 1;

  if (mode === "summary")
    return <ChapterGlance chapterId={chapter.id} progress={progress} navigate={navigate} onBack={() => setMode("choose")} backLabel="Back to the end of the chapter" />;
  if (mode === "checkpoint")
    return (
      <ChapterCheckpoint
        key={goes}
        chapter={chapter}
        items={checkpoint.items}
        persons={{ switches: checkpoint.switches, say: checkpoint.say }}
        scenario={scen}
        earlier={checkpoint.earlier}
        progress={progress}
        persist={persist}
        config={config}
        onMiss={onMiss}
        onMissTurn={onMissTurn}
        nextLabel={nextLabel}
        doneLabel={doneLabel}
        onStop={() => setMode("choose")}
        onFinished={onFinished}
        onDone={onDone}
      />
    );
  if (mode === "chapter" || mode === "all")
    return (
      <PracticeRound
        key={goes}
        round={mode === "chapter" ? practice.chapter : practice.all}
        title={mode === "chapter" ? chapter.shortTitle : "everything so far"}
        progress={progress}
        persist={persist}
        config={config}
        onMiss={onMiss}
        onMissTurn={onMissTurn}
        onPractised={onPractised}
        onTakeCheckpoint={() => start("checkpoint")}
        onDone={onDone}
        doneLabel={doneLabel}
      />
    );

  const status = (iso?: string, rest?: string) => iso
    ? <span className="result-ok small"><Icon name="check" size={14} />Passed{new Date(iso).toDateString() === new Date().toDateString() ? " today" : ` on ${shortDate(iso)}`}</span>
    : rest ? <span className="muted small">{rest}</span> : null;
  const last = parts.last && !parts.cards ? `Last go: ${parts.last.got} of ${parts.last.total}; a pass needs ${needed(parts.last.total)}` : undefined;
  const takeLabel = !left.cards ? "Finish the checkpoint: the conversation" : !left.conversation && scen ? "Finish the checkpoint: the cards" : "Take the checkpoint";
  return (
    <div>
      <div className="overline">Chapter {chapter.order} · the end</div>
      <h2 className="lesson-title">Finish {chapter.shortTitle}</h2>
      <p className="lead">The checkpoint is what moves the course on{nextLabel ? <> to <b>{nextLabel}</b></> : ""}. Take it whenever you&apos;re ready: until then, a practice round counts as your lesson for the day.</p>

      <div className="framed write-card recap-card">
        <div className="overline">The checkpoint · about {cpMin} min</div>
        <ul className="recap-list">
          <li className="word-row" style={{ display: "block" }}>
            <div><b>{scen ? "Part 1: the cards" : "The cards"}</b></div>
            <div className="small" style={{ marginTop: 2 }}>
              {plural(own, "word")} from this chapter{checkpoint.earlier ? `, ${checkpoint.earlier} of your weakest from earlier chapters` : ""}{gram ? `, ${plural(gram, "grammar card")}` : ""}{checkpoint.switches.length ? `, ${plural(checkpoint.switches.length, "person swap")}` : ""}{checkpoint.say.length ? `, then ${plural(checkpoint.say.length, "line")} to say` : ""}.
              {" "}To pass: {needed(checkpoint.items.length + checkpoint.switches.length)} of {checkpoint.items.length + checkpoint.switches.length} right on the first try (7 in 10).
            </div>
            <div style={{ marginTop: 4 }}>{status(parts.cards, last)}</div>
          </li>
          {scen && (
            <li className="word-row" style={{ display: "block" }}>
              <div><b>Part 2: the conversation</b></div>
              <div className="small" style={{ marginTop: 2 }}>{scen.title}. To pass: get through it to the end.</div>
              <div style={{ marginTop: 4 }}>{status(parts.conversation)}</div>
            </li>
          )}
        </ul>
        <p className="muted small" style={{ margin: "10px 0 0" }}>A part you pass stays passed: next time you only do what&apos;s left. Stopping part-way never counts against you.</p>
        <div className="write-actions">
          <button className="btn" onClick={() => start("checkpoint")}>{takeLabel}</button>
        </div>
      </div>

      <div className="framed write-card recap-card">
        <div className="overline">Not today? Practise instead · about {prMin} min</div>
        <p className="small" style={{ margin: "4px 0 0", lineHeight: 1.5 }}>
          A short round in the same format as the checkpoint, scored the same way, so you can see whether you&apos;re ready: {plural(practice.chapter.items.filter((i) => i.kind !== "grammar").length, "word")}, a couple of grammar cards, a person swap, a line to say, then the conversation if you like.{parts.last?.missed.length ? " What you missed last time comes first." : ""}
        </p>
        <div className="write-actions">
          <button className="ghost" onClick={() => start("chapter")}>Practise this chapter</button>
          {!firstChapter && <button className="ghost" onClick={() => start("all")}>Practise everything so far</button>}
        </div>
      </div>

      <p className="muted small" style={{ marginTop: 14 }}>
        Want a refresher first? <button className="linklike small" onClick={() => setMode("summary")}>Read the chapter summary</button>: every rule with examples, the words, and the conversation&apos;s lines.
      </p>
    </div>
  );
}

// A practice round: the checkpoint's shape, smaller (lib/checkpoint.ts PRACTICE). Cards ("Again" brings a card
// back, as anywhere outside the checkpoint), a person swap, a line to say, then the conversation if you like;
// scored on first tries the way the checkpoint is, so the result says whether you'd pass.
function PracticeRound({ round, title, progress, persist, config, onMiss, onMissTurn, onPractised, onTakeCheckpoint, onDone, doneLabel }: {
  round: CheckpointRound;
  title: string;
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  onMiss: (item: ReviewItem) => void;
  onMissTurn: (t: DialogueTurn) => void;
  onPractised: (p: Progress) => void;
  onTakeCheckpoint: () => void;
  onDone: () => void;
  doneLabel?: string;
}) {
  const [phase, setPhase] = useState<"drill" | "persons" | "say" | "offer" | "speak" | "result">(round.items.length ? "drill" : round.switches.length ? "persons" : "say");
  const latest = useRef(progress);
  latest.current = progress;
  const score = useRef({ got: 0, total: 0 });
  const missedSwitch = useRef(new Set<string>());
  const [spoke, setSpoke] = useState(false);
  const reported = useRef(false);
  const afterCards = () => setPhase(round.scenario ? "offer" : "result");
  const afterPersons = () => (round.say.length ? setPhase("say") : afterCards());
  const finishDrill = (results: WarmResult[]) => {
    let p = latest.current;
    for (const r of results) p = gradeItem(p, r.item, r.ok);
    persist(p);
    score.current = firstTries(results);
    if (round.switches.length) setPhase("persons"); else afterPersons();
  };
  // Reaching the result is today's lesson done (after the conversation's own save, if there was one).
  useEffect(() => {
    if (phase !== "result" || reported.current) return;
    reported.current = true;
    onPractised(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  const tag = <Tag>Practice · {title}</Tag>;

  if (phase === "drill")
    return (
      <div>
        {tag}
        <p className="lead" style={{ marginTop: 0 }}>Same format as the checkpoint, smaller, and scored the same way: 7 in 10 right on the first try. Here <b>Again</b> brings a card back, so you can fix it.</p>
        <WarmupSession items={round.items} progress={progress} persist={persist} onMiss={onMiss} onComplete={finishDrill} label="Practice" tally />
      </div>
    );
  if (phase === "persons")
    return (
      <div>
        {tag}
        <UseIt items={round.switches} config={config} lead="A line from a story, told about someone else: pick the form that fits."
          onMiss={(it) => { missedSwitch.current.add(it.id); onMiss(it); }}
          onDone={() => { score.current = { got: score.current.got + round.switches.length - missedSwitch.current.size, total: score.current.total + round.switches.length }; afterPersons(); }} />
      </div>
    );
  if (phase === "say")
    return (
      <div>
        {tag}
        <p className="lead" style={{ marginTop: 0 }}>A line to say out loud, as in the checkpoint.</p>
        <SayIt lines={round.say} config={config} onMiss={onMissTurn} onDone={afterCards} />
      </div>
    );
  if (phase === "offer" && round.scenario)
    return (
      <div className="framed write-card">
        <div className="overline">Practice · the conversation</div>
        <p className="lesson-rule">In the checkpoint, <b>{round.scenario.title}</b> is part 2. Want to try it now? It&apos;s optional.</p>
        <div className="write-actions">
          <button className="btn" onClick={() => setPhase("speak")}>Try the conversation</button>
          <button className="ghost" onClick={() => setPhase("result")}>Skip it: see how I did</button>
        </div>
      </div>
    );
  if (phase === "speak" && round.scenario)
    return (
      <div>
        <Tag>Practice · {round.scenario.title}</Tag>
        <ScenarioView progress={progress} persist={persist} config={config} lettersDone scenarioId={round.scenario.id} hidePicker bare askable restartIfDone
          onComplete={() => { setSpoke(true); setPhase("result"); }} onMiss={onMissTurn} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="quiet" onClick={() => setPhase("result")}>Stop here: see how I did</button>
        </div>
      </div>
    );

  const sc = score.current;
  const ready = cardsPass(sc);
  return (
    <div className="framed write-card">
      <div className="overline">Practice · {title}</div>
      <h3 className="lesson-title" style={{ fontSize: 24 }}>{sc.total ? `${sc.got} of ${sc.total} right first time` : "Practice done"}</h3>
      {sc.total > 0 && (
        <p className="lesson-rule">
          {ready
            ? <>The checkpoint needs 7 in 10: at this rate you&apos;d pass the cards part.</>
            : <>The checkpoint needs 7 in 10 ({needed(sc.total)} of {sc.total} here). Another round, or the chapter summary, should help.</>}
          {spoke ? " Conversation: done." : ""} This counts as today&apos;s lesson; the checkpoint waits until you take it.
        </p>
      )}
      <div className="write-actions">
        <button className={ready ? "btn" : "ghost"} onClick={onTakeCheckpoint}>Take the checkpoint now</button>
        <button className={ready ? "ghost" : "btn"} onClick={onDone}>{(doneLabel ?? "Done for today").replace(/^Go to summary$/, "Done for today")}</button>
      </div>
    </div>
  );
}
