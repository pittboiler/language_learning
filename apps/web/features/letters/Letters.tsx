"use client";
import { useMemo, useState } from "react";
import type { GlyphLesson } from "@ll/pack-schema";
import { type Progress } from "../../lib/store";
import { shuffle } from "../../lib/today-plan";
import { translitOr } from "../../lib/romanize";
import { focusLetters, usePack, usePlay } from "../shared";

// One letter's study card (glyph, name, sound, example + audio). Shared by the learn + review screens.
export function LetterCard({ a, play, done }: { a: GlyphLesson; play: (t: string, s?: number) => void; done?: boolean }) {
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
