"use client";
import { useMemo, useState } from "react";
import type { GlyphLesson } from "@ll/pack-schema";
import { type Progress } from "../../lib/store";
import { shuffle } from "../../lib/today-plan";
import { translitOr } from "../../lib/romanize";
import { Icon, SpeakButton, Stitches, focusLetters, usePack, usePlay } from "../shared";

// One letter's study card (capital and small letter, name, sound, example + audio). Shared by the learn +
// review screens. Real text is mostly small letters, so both cases are shown.
export function LetterCard({ a, play, done }: { a: GlyphLesson; play: (t: string, s?: number) => void; done?: boolean }) {
  const pack = usePack();
  const ex = a.examples[0];
  return (
    <div className={`letter ${done ? "done" : ""}`}>
      <div className="g" lang={pack.id}>{a.glyph}<span className="lc">{a.glyph.toLocaleLowerCase(pack.id)}</span></div>
      <div className="n">{a.name}{a.unique ? <span className="tag uniq">unique</span> : a.falseFriend ? <span className="tag ff">looks Latin</span> : null}</div>
      <div className="s">{a.sound}</div>
      {ex ? (
        <div className="ex"><span className="ex-word" lang={pack.id}>{ex.text}</span> <span className="muted small">{translitOr(ex.text, ex.translit)} · {ex.gloss}</span></div>
      ) : null}
      {ex && <SpeakButton label={`Play ${ex.text}`} onClick={() => play(ex.text, 0.7)} />}
    </div>
  );
}

/** One question of a letter quiz (see the letter, pick its sound · or hear the sound, pick the letter),
 *  with its result once answered. Shared by the Library alphabet and Today's letter lessons. */
export function LetterQuestion({ a, qType, options, picked, answer, onPick, onNext, nextLabel, label, missNote }: {
  a: GlyphLesson;
  qType: number;
  options: string[];
  picked: string | null;
  answer: string;
  onPick: (o: string) => void;
  onNext: () => void;
  nextLabel: string;
  label: string;
  missNote?: string;
}) {
  const pack = usePack();
  const play = usePlay();
  const right = picked !== null && picked === answer;
  const ex = a.examples[0];
  return (
    <div className="framed quiz-card">
      <div className="overline">{label}</div>
      <p className="quiz-ask">{qType === 0 ? "What sound does this letter make?" : "Which letter makes this sound?"}</p>
      {qType === 0
        ? <div className="quiz-glyph" lang={pack.id}>{a.glyph}<span className="lc">{a.glyph.toLocaleLowerCase(pack.id)}</span></div>
        : <div className="quiz-sound">{a.sound}</div>}
      {ex && <button className="ghost small" onClick={() => play(ex.text, 0.7)}><Icon name="speaker" size={16} />{qType === 0 ? "Hear an example" : "Hear it"}</button>}
      <div className={`quiz-opts${qType === 1 ? " glyphs" : ""}`}>
        {options.map((o) => {
          const cls = picked ? (o === answer ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt";
          return <button className={cls} key={o} lang={qType === 1 ? pack.id : undefined} disabled={!!picked} onClick={() => onPick(o)}>{o}</button>;
        })}
      </div>
      {picked && (
        <div className="quiz-result">
          <div>
            {right
              ? <span className="result-ok"><Icon name="check" size={16} />Correct</span>
              : <span className="result-miss"><span lang={pack.id}>{a.glyph}</span> sounds like “{a.sound}” ({a.name}){missNote}</span>}
            {ex && <div className="muted small" style={{ marginTop: 2 }}><span lang={pack.id}>{ex.text}</span> = {ex.gloss}</div>}
          </div>
          <button className="btn" onClick={onNext}>{nextLabel}</button>
        </div>
      )}
    </div>
  );
}

// ---------- Reference: the alphabet, learned and TESTED set by set ----------
// Study the key letters (unique + false-friends), then a quiz: glyph→sound and sound→glyph (with audio).
// A letter is marked "known" only after a correct answer; misses go to the back of the queue.
export function Letters({ progress, persist, onDone, reference, onBack }: { progress: Progress; persist: (p: Progress) => void; onDone: () => void; reference?: boolean; onBack?: () => void }) {
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

  const intro = (
    <p className="lead">
      Cyrillic is phonetic: one letter, one sound. Many letters look and sound like English, so the ones to really
      learn are the <span className="tag uniq" style={{ marginLeft: 0 }}>unique</span> letters and the{" "}
      <span className="tag ff" style={{ marginLeft: 0 }}>looks Latin</span> false friends that sound different. Tap the speaker on any card to hear it.
    </p>
  );

  // Reference home: the ENTIRE alphabet, always — a returning learner (all focus letters "known") still
  // sees every letter here, not just the 13 quizzed ones. Back-link sits inline in the header.
  if (phase === "browse") {
    return (
      <section className="view">
        {onBack && <button className="ghost small" onClick={onBack} style={{ marginBottom: 12 }}>‹ Reference</button>}
        <div className="overline">Reference</div>
        <h2 style={{ marginTop: 4 }}>The {pack.name} alphabet</h2>
        <div className="muted small" style={{ marginBottom: 10 }}>All {all.length} letters</div>
        {intro}
        <div className="letters">{all.map((x) => <LetterCard key={x.glyph} a={x} play={play} done={!!progress.letters[x.glyph]} />)}</div>
        <div className="row" style={{ marginTop: 8 }}><button className="btn" onClick={startQuiz}>Quiz me on the tricky ones</button></div>
      </section>
    );
  }

  if (!reference && (phase === "done" || unknown.length === 0)) {
    return (
      <section className="view">
        <h2>The {pack.name} alphabet</h2>
        <p className="lead">You can recognise all {focus.length} key letters: the unique ones and the false friends that look Latin. Tap the speaker on any card to review it.</p>
        <div className="letters">{focus.map((x) => <LetterCard key={x.glyph} a={x} play={play} done />)}</div>
        <div className="row" style={{ marginTop: 14 }}><button className="btn" onClick={onDone}>Continue</button></div>
      </section>
    );
  }

  if (phase === "learn") {
    return (
      <section className="view">
        <h2>The {pack.name} alphabet</h2>
        <div className="muted small" style={{ marginBottom: 10 }}>All {all.length} letters · I&apos;ll quiz you on the {focus.length} tricky ones</div>
        {intro}
        <div className="letters">{all.map((x) => <LetterCard key={x.glyph} a={x} play={play} done={!!progress.letters[x.glyph]} />)}</div>
        <div className="row"><button className="btn" onClick={startQuiz}>Quiz me on the tricky ones</button></div>
      </section>
    );
  }

  if (!a) return null;
  const learned = total - remaining.length;
  return (
    <section className="view">
      <h2>The {pack.name} alphabet</h2>
      <div className="today-sub" style={{ marginBottom: 6 }}>
        <Stitches total={total} done={learned} now={learned} size={11} label={`${learned} of ${total} learned`} />
        <span>{learned} of {total} learned{remaining.length > 1 ? ` · ${remaining.length} to go` : ""}</span>
      </div>
      <LetterQuestion a={a} qType={qType} options={options} picked={picked} answer={correctAnswer} onPick={setPicked}
        onNext={next} nextLabel={remaining.length === 1 && isCorrect ? "Finish" : "Next"} label="The tricky letters" />
    </section>
  );
}
