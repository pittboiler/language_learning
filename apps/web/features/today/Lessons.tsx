"use client";
import { useMemo, useState } from "react";
import type { DialogueTurn, GlyphLesson, GrammarPoint, ReviewItem } from "@ll/pack-schema";
import * as api from "../../lib/api";
import { type Progress } from "../../lib/store";
import * as cp from "../../lib/course-player";
import { rotate, shuffle } from "../../lib/today-plan";
import { romanize } from "../../lib/romanize";
import { FocusText, LearnerTurn } from "../conversation/ScenarioView";
import { GrammarMatch, isMatchable } from "../grammar/GrammarCards";
import { Drill } from "../grammar/PointLibrary";
import { LetterCard, LetterQuestion } from "../letters/Letters";
import { Icon, MixedText, SpeakButton, usePack, usePlay } from "../shared";
import { WarmResult } from "./Warmup";

// A grammar point from the course blueprint (DESIGN-course-spine.md §3). TEACH: the short rule, the
// concept's pattern table when it has one, the point's example lines (existing, so they play cached audio)
// and up to three quick checks from its blank cards. PRACTICE: a one-line reminder, the matching game when
// the concept tabulates, then the blank cards rotated by session. Checks are graded into SRS by the caller.
export function PointLesson({ point, mode, dayIndex, onDone, onMiss }: {
  point: GrammarPoint;
  mode: "teach" | "practice";
  dayIndex: number;
  onDone: (results: WarmResult[]) => void;
  onMiss: (item: ReviewItem) => void;
}) {
  const pack = usePack();
  const play = usePlay();
  const conceptId = pack.course ? cp.patternConceptFor(pack.course, point) : undefined;
  const concept = pack.grammar.find((g) => g.id === conceptId && !!g.pattern);
  const cards = useMemo(() => rotate(cp.blankCardItems(point), dayIndex).slice(0, mode === "teach" ? 3 : 2), [point, dayIndex, mode]);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [showMore, setShowMore] = useState(false);
  const [matched, setMatched] = useState(!(mode === "practice" && concept && isMatchable(concept)));
  const allAnswered = cards.every((c) => c.id in answers);
  const pattern = concept?.pattern ? (
    <table className="gram-table">
      <thead><tr>{concept.pattern.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
      <tbody>
        {concept.pattern.rows.map((row, ri) => (
          <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{ci === concept.pattern!.spotlightCol ? <span className="gram-spot"><MixedText text={cell} /></span> : <MixedText text={cell} />}</td>)}</tr>
        ))}
      </tbody>
    </table>
  ) : null;
  // An example that leans on a later point (rare: the pack had no cleaner line) carries its set-phrase note.
  const noteFor = (source: string) => pack.course?.chunkNotes.find((n) => n.source === source)?.note;
  const examples = (
    <div className="gram-ex-list">
      {point.examples.map((ex) => (
        <div className="gram-ex" key={ex.source}>
          <SpeakButton label={`Play ${ex.text}`} onClick={() => play(ex.text)} />
          <span className="ex-text">
            <span className="mk" lang={pack.id}><FocusText text={ex.text} words={pack.course ? cp.focusWords(pack.course, ex.source, [point.id]) : undefined} /></span>
            <span className="en">{ex.gloss}</span>
            {noteFor(ex.source) && <span className="muted small"><MixedText text={noteFor(ex.source)!} /></span>}
          </span>
        </div>
      ))}
    </div>
  );
  return (
    <div>
      <div className="overline" style={mode === "teach" ? { color: "var(--accent)" } : undefined}>{mode === "teach" ? "New rule" : "Grammar practice"}{point.depth === "recognize" ? " · just recognize it for now" : ""}</div>
      <h3 className="lesson-title"><MixedText text={point.title} /></h3>
      {mode === "teach" ? (
        <>
          <p className="lesson-rule"><MixedText text={point.rule} /></p>
          {pattern}
          {point.examples.length > 0 && <div className="overline" style={{ marginTop: 4 }}>Examples</div>}
          {examples}
        </>
      ) : (
        <>
          <p className="lesson-rule muted"><MixedText text={point.rule} /></p>
          <button className="quiet" onClick={() => setShowMore((v) => !v)}>{showMore ? "Hide examples" : "Show examples"}</button>
          {showMore && <div style={{ marginTop: 8 }}>{pattern}{examples}</div>}
          {!matched && concept && <GrammarMatch concept={concept} onDone={() => setMatched(true)} />}
        </>
      )}
      {matched && cards.length > 0 && (
        <div className="framed checks-card">
          <div className="overline">{cards.length > 1 ? "Quick checks" : "Quick check"}</div>
          {cards.map((c) => <Drill key={c.id} drill={c} onGrade={(ok) => { setAnswers((a) => ({ ...a, [c.id]: ok })); if (!ok) onMiss(c); }} />)}
        </div>
      )}
      {matched && allAnswered && (
        <button className="btn" style={{ marginTop: 16 }} onClick={() => onDone(cards.map((c) => ({ item: c, ok: !!answers[c.id] })))}>Continue</button>
      )}
    </div>
  );
}
// Chapter 0 (letters & sounds): learn a group of letters — each with its sound and an example word to
// hear — then a quick quiz (letter → sound, sound → letter) until every one is right. The checkpoint
// quizzes the tricky letters straight away. Letters answered right are recorded in progress.letters.
export function LetterLesson({ lesson, checkpoint, progress, persist, onDone }: {
  lesson: { title: string; glyphs: string[]; note?: string };
  checkpoint: boolean;
  progress: Progress;
  persist: (p: Progress) => void;
  onDone: (p: Progress) => void;
}) {
  const pack = usePack();
  const play = usePlay();
  const group = useMemo(() => lesson.glyphs.map((g) => pack.alphabet.find((a) => a.glyph === g)).filter((a): a is GlyphLesson => !!a), [lesson, pack]);
  const [phase, setPhase] = useState<"learn" | "quiz" | "done">(checkpoint ? "quiz" : "learn");
  const [queue, setQueue] = useState<string[]>(() => shuffle(lesson.glyphs));
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [known, setKnown] = useState<Record<string, boolean>>({});
  const a = group.find((x) => x.glyph === queue[0]);
  const qType = step % 2; // 0: see the letter, pick its sound · 1: see the sound, pick the letter
  const options = useMemo(() => {
    if (!a) return [] as string[];
    const pool = [...group, ...pack.alphabet].filter((x, i, all) => x.glyph !== a.glyph && all.findIndex((y) => y.glyph === x.glyph) === i);
    const distract = shuffle(pool.slice(0, Math.max(group.length - 1, 3))).slice(0, 3);
    return shuffle(qType === 0 ? [a.sound, ...distract.map((x) => x.sound)] : [a.glyph, ...distract.map((x) => x.glyph)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue[0], step]);
  const answer = a ? (qType === 0 ? a.sound : a.glyph) : "";
  const right = picked !== null && picked === answer;
  const next = () => {
    if (!a) return;
    if (right) { setKnown((k) => ({ ...k, [a.glyph]: true })); const rest = queue.slice(1); setQueue(rest); if (!rest.length) setPhase("done"); }
    else setQueue((q) => [...q.slice(1), q[0]!]);
    setPicked(null);
    setStep((x) => x + 1);
  };
  const finish = () => onDone({ ...progress, letters: { ...progress.letters, ...known } });

  if (phase === "learn")
    return (
      <div>
        <div className="overline">Letters · {lesson.title}</div>
        {lesson.note && <p style={{ margin: "8px 0 14px", fontSize: 16, lineHeight: 1.5 }}>{lesson.note}</p>}
        <div className="letters">{group.map((x) => <LetterCard key={x.glyph} a={x} play={play} done={!!progress.letters[x.glyph]} />)}</div>
        <button className="btn" style={{ marginTop: 6 }} onClick={() => setPhase("quiz")}>Quiz me on these {group.length}</button>
      </div>
    );
  if (phase === "done" || !a)
    return (
      <div className="framed quiz-card">
        <div className="overline">Letters · {lesson.title}</div>
        <div className="quiz-glyph" lang={pack.id} style={{ fontSize: 44, letterSpacing: ".12em" }}>{lesson.glyphs.join(" ")}</div>
        <p className="result-ok" style={{ margin: "0 0 16px" }}><Icon name="check" size={16} />All {group.length} right</p>
        <div><button className="btn" onClick={finish}>Continue</button></div>
      </div>
    );
  return (
    <LetterQuestion a={a} qType={qType} options={options} picked={picked} answer={answer} onPick={setPicked} onNext={next} nextLabel="Next"
      label={`${checkpoint ? "Checkpoint · the tricky letters" : `Quiz · ${lesson.title}`} · ${lesson.glyphs.length - queue.length} of ${lesson.glyphs.length}`}
      missNote="; it comes back at the end" />
  );
}
// "Say it" (teach + practice sessions, and chapter 0): a few lines from today — the new phrases, the
// grammar point's examples, or the letters' example words — said out loud with the usual speech feedback.
export function SayIt({ lines, config, onMiss, onDone }: { lines: { text: string; gloss: string; translit?: string; focus?: string[] }[]; config: api.Config | null; onMiss: (t: DialogueTurn) => void; onDone: () => void }) {
  const [i, setI] = useState(0);
  const line = lines[i];
  if (!line) return null;
  return (
    <div className="framed write-card">
      <div className="overline">Say it · {i + 1} of {lines.length}</div>
      <LearnerTurn
        key={i}
        turn={{ speaker: "learner", text: line.text, gloss: line.gloss, translit: line.translit ?? romanize(line.text) }}
        config={config}
        onMiss={onMiss}
        focusWords={line.focus}
        onDone={() => (i + 1 < lines.length ? setI(i + 1) : onDone())}
      />
    </div>
  );
}
