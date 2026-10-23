"use client";
import { useMemo, useState } from "react";
import type { GrammarConcept } from "@ll/pack-schema";
import { rotate, shuffle } from "../../lib/today-plan";
import { Drill } from "./PointLibrary";
import { Icon, MixedText, SpeakButton, usePack, usePlay } from "../shared";

// Split an example line "<target> — <English>" into its two halves (audio plays the target half).
export function splitExample(s: string): { mk: string; en: string } {
  const i = s.indexOf(" — ");
  return i === -1 ? { mk: s, en: "" } : { mk: s.slice(0, i), en: s.slice(i + 3) };
}
// Shared, accessible rendering of a grammar concept: a plain-English hook, an at-a-glance pattern
// table (the changing part spotlighted), the when/why note, and tappable examples with audio. Used by
// the daily intro card, the reference, and the inline scenario notes (compact ⇒ skip the table).
export function GrammarExplainer({ concept, compact }: { concept: GrammarConcept; compact?: boolean }) {
  const pack = usePack();
  const play = usePlay();
  const { plain, pattern, explanation, examples } = concept;
  return (
    <>
      {plain && (
        <div className="gram-plain">
          <span className="lab">In plain English</span>
          <p><MixedText text={plain} /></p>
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
                  <td key={ci}>{ci === pattern.spotlightCol ? <span className="gram-spot"><MixedText text={cell} /></span> : <MixedText text={cell} />}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {explanation && <p className="gram-when">{!compact && <b>When &amp; why:&nbsp;</b>}<span><MixedText text={explanation} /></span></p>}
      {examples.length > 0 && (
        <div className="gram-ex-list">
          {examples.map((ex, i) => {
            const { mk, en } = splitExample(ex);
            return (
              <div className="gram-ex" key={i}>
                <SpeakButton label={`Play ${mk}`} onClick={() => play(mk)} />
                <span className="ex-text"><span className="mk" lang={pack.id}>{mk}</span>{en && <span className="en">{en}</span>}</span>
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
export function GrammarIntroCard({ concept, onDone, dayIndex = 0 }: { concept: GrammarConcept; onDone: (ok: boolean) => void; dayIndex?: number }) {
  const drills = rotate(concept.drills, dayIndex).slice(0, 3);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const firstId = drills[0]?.id;
  const answeredFirst = firstId === undefined || firstId in answers;
  return (
    <div>
      <div className="overline" style={{ color: "var(--accent)" }}>New rule</div>
      <h3 className="lesson-title"><MixedText text={concept.name} /></h3>
      {concept.technicalName && <div className="gram-tech">{concept.technicalName}</div>}
      <GrammarExplainer concept={concept} />
      {drills.length > 0 && (
        <div className="framed checks-card">
          <div className="overline">{drills.length > 1 ? "Quick checks" : "Quick check"}</div>
          {drills.map((d) => <Drill key={d.id} drill={d} onGrade={(ok) => setAnswers((a) => ({ ...a, [d.id]: ok }))} />)}
        </div>
      )}
      {answeredFirst && (
        <button className="btn" style={{ marginTop: 16 }} onClick={() => onDone(firstId === undefined ? true : !!answers[firstId])}>Continue</button>
      )}
    </div>
  );
}
// A concept is "matchable" into pairs if its pattern has ≥2 rows with DISTINCT left cells (each left
// maps to exactly one right). Clitics — whose rows repeat "ми (to me)" — fail this and fall back to drills.
export function isMatchable(concept: GrammarConcept): boolean {
  const p = concept.pattern;
  if (!p || p.rows.length < 2) return false;
  const lefts = p.rows.map((r) => r[0]);
  return new Set(lefts).size === lefts.length && p.rows.every((r) => r.length >= 2);
}
// Matching game: pair each row's first cell with its spotlight cell (noun↔article, impf↔pf, …). Tap a
// chip, then its partner; correct pairs lock green, wrong ones flash. Driven entirely by the lesson's
// pattern table — no new content, and it works for any future matchable lesson.
export function GrammarMatch({ concept, onDone }: { concept: GrammarConcept; onDone: () => void }) {
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
      <div className="muted small" style={{ marginBottom: 8 }}>Match each pair: tap one, then its partner.</div>
      <div className="matchgrid">
        <div className="matchcol">
          {rows.map((r, i) => <button key={i} className={cls("L", i)} disabled={matched.has(i)} onClick={() => tap("L", i)}><MixedText text={r[0]!} /></button>)}
        </div>
        <div className="matchcol">
          {rights.map((r) => <button key={r.id} className={cls("R", r.id)} disabled={matched.has(r.id)} onClick={() => tap("R", r.id)}><MixedText text={r.text} /></button>)}
        </div>
      </div>
      {allDone && (
        <div className="quiz-result">
          <span className="result-ok"><Icon name="check" size={16} />All matched</span>
          <button className="btn" onClick={onDone}>Continue</button>
        </div>
      )}
    </div>
  );
}
// Fallback practice for non-matchable concepts (e.g. clitics): a couple of multiple-choice drills,
// rotated by day so a repeated unit shows different checks.
export function GrammarDrillPractice({ concept, onDone, dayIndex = 0 }: { concept: GrammarConcept; onDone: () => void; dayIndex?: number }) {
  const drills = rotate(concept.drills, dayIndex).slice(0, 2);
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const firstId = drills[0]?.id;
  const ready = firstId === undefined || firstId in answered;
  return (
    <div style={{ marginTop: 8 }}>
      {drills.map((d) => <Drill key={d.id} drill={d} onGrade={(ok) => setAnswered((a) => ({ ...a, [d.id]: ok }))} />)}
      {ready && <button className="btn" style={{ marginTop: 14 }} onClick={onDone}>Continue</button>}
    </div>
  );
}
// Recurring grammar PRACTICE (after a concept's been introduced): a brief rule reminder + an exercise
// — matching where it fits, else drills. The full rule (table + examples) is one tap away if stuck.
export function GrammarPracticeCard({ concept, onDone, dayIndex = 0 }: { concept: GrammarConcept; onDone: () => void; dayIndex?: number }) {
  const [showRule, setShowRule] = useState(false);
  return (
    <div>
      <div className="overline">Grammar practice</div>
      <h3 className="lesson-title"><MixedText text={concept.name} /></h3>
      {concept.plain && <p className="lesson-rule muted"><MixedText text={concept.plain} /></p>}
      <button className="quiet" onClick={() => setShowRule((v) => !v)}>{showRule ? "Hide the rule" : "Show the rule"}</button>
      {showRule && <div style={{ marginTop: 8 }}><GrammarExplainer concept={concept} /></div>}
      {isMatchable(concept)
        ? <GrammarMatch concept={concept} onDone={onDone} />
        : <GrammarDrillPractice concept={concept} onDone={onDone} dayIndex={dayIndex} />}
    </div>
  );
}
