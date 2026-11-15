"use client";
// Verb pattern questions (lib/verb-drills.ts), one at a time: tap one of three, see why, move on. The same
// runner serves the warm-up, the checkpoint, the practice rounds and the Library's "Practise this pattern".
import { useMemo, useState } from "react";
import * as vd from "../../lib/verb-drills";
import { shuffle } from "../../lib/today-plan";
import { Icon, MixedText, SpeakButton, usePack, usePlay } from "../shared";

export function VerbDrill({ questions, onDone, onAnswer, lead, counter = true }: {
  questions: vd.VerbQuestion[];
  /** Every first try, once the last question is done. */
  onDone: (results: vd.VerbResult[]) => void;
  /** Each answer as it's given (the checkpoint's tally). */
  onAnswer?: (r: vd.VerbResult) => void;
  lead?: string;
  /** Show "2 of 3" (off when the surrounding counter already counts these). */
  counter?: boolean;
}) {
  const pack = usePack();
  const play = usePlay();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<vd.VerbResult[]>([]);
  const q = questions[i];
  const options = useMemo(() => (q ? shuffle(q.options) : []), [q]);
  if (!q) return null;
  const variant = vd.variantsOf(pack).find((v) => v.variant.id === q.variant);
  const choose = (o: string) => {
    if (picked) return;
    setPicked(o);
    const r = { q, ok: o === q.answer };
    setResults((rs) => [...rs, r]);
    onAnswer?.(r);
  };
  const next = () => {
    setPicked(null);
    if (i + 1 < questions.length) setI(i + 1);
    else onDone(results);
  };
  const optClass = (o: string) => (picked ? (o === q.answer ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt");
  const head = { same: "Same pattern, another verb", time: "Switch the time", which: "Which past?" }[q.kind];
  return (
    <div>
      {lead && <p className="lead" style={{ marginBottom: 6 }}>{lead}</p>}
      <div className="framed write-card">
        <div className="recap-head">
          <div className="overline">{head}{variant ? ` · ${variant.pattern.title.replace(/^[^:]*:\s*/, "")}` : ""}</div>
          {counter && <span className="muted small">{i + 1} of {questions.length}</span>}
        </div>

        {q.kind === "same" && q.model && (
          <div className="verb-model">
            <span className="muted small">{variant?.variant.label}: {variant?.variant.endings[q.person]} {q.tense === "command" ? "" : `for ${vd.PRONOUN[q.person].en}`}</span>
            <div><b lang={pack.id}>{q.model.lemma}</b> <span className="muted">· {q.model.gloss}</span> → <span lang={pack.id}>{q.tense === "present" || q.tense === "pastOngoing" || q.tense === "pastDone" ? `${vd.PRONOUN[q.person].mk} ` : ""}{q.model.form}</span></div>
          </div>
        )}
        {q.kind === "time" && q.line && (
          <>
            <div className="model-line" style={{ margin: "10px 0 2px" }}><SpeakButton label="Play the line" onClick={() => play(q.line!.text)} /><span className="mk" lang={pack.id} style={{ fontSize: 20 }}>{q.line.text}</span></div>
            <div className="say-gloss">{q.line.gloss}</div>
          </>
        )}
        {q.kind === "which" && q.cue && <div className="say-gloss" style={{ fontSize: 18, margin: "10px 0 4px" }}>{q.cue}</div>}

        <div className="activity-sub" style={{ marginTop: 14 }}>
          {q.kind === "same" ? <><b lang={pack.id}>{q.lemma}</b> <span className="muted">· {q.gloss}{q.isNew ? " · a new verb" : ""} ·</span> follows the same pattern. {q.tense === "command" ? (q.person === "2sg" ? "Say it to one friend:" : "Say it to several people, or politely:") : <>Now {q.who ?? `${vd.PRONOUN[q.person].mk} (${vd.PRONOUN[q.person].en})`}:</>}</> : q.ask}
        </div>
        {/* "Which past?" has nothing around its blank: the line appears once it's answered, to hear. */}
        {(picked || q.kind !== "which") && (
          <div className="model-line" style={{ margin: "4px 0 2px" }}>
            <span className="say-line" lang={pack.id} style={{ fontSize: 24, margin: 0 }}>{picked ? q.filled : q.shown}</span>
            {picked && <SpeakButton label="Play it" onClick={() => play(q.filled)} />}
          </div>
        )}
        <div className="quiz-opts" style={{ marginTop: 12 }}>
          {options.map((o) => <button key={o} lang={pack.id} className={optClass(o)} disabled={!!picked} onClick={() => choose(o)}>{o}</button>)}
        </div>
        {picked && (
          <div className="drill-why">
            {picked === q.answer ? <span className="result-ok"><Icon name="check" size={15} />Right</span> : <span className="result-miss">Not quite</span>}
            <MixedText text={q.why} />
          </div>
        )}
        {picked && (
          <div className="write-actions">
            <button className="btn" onClick={next}>{i + 1 < questions.length ? "Next" : "Done"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
