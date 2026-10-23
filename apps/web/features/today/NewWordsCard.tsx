"use client";
import { useMemo, useState } from "react";
import { shuffle } from "../../lib/today-plan";
import { Icon, SpeakButton, usePack, usePlay } from "../shared";

export const FALLBACK_GLOSSES = ["hello", "thank you", "please", "yes", "good", "water"];
// Pre-teach the story's new words interactively: hear each, tap its meaning (multiple choice), then
// they're captured. Engages instead of just listing.
export function NewWordsCard({ words, onDone, onMiss, onStar, isStarred, noteFor }: { words: { lexKey: string; gloss?: string }[]; onDone: () => void; onMiss?: (word: { lexKey: string; gloss?: string }) => void; onStar?: (word: { lexKey: string; gloss?: string }) => void; isStarred?: (word: { lexKey: string; gloss?: string }) => boolean; noteFor?: (lexKey: string) => string | undefined }) {
  const pack = usePack();
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
      <p className="lead">New words for today&apos;s story: hear each one, then tap its meaning.</p>
      <div className="framed write-card">
        <div className="recap-head">
          <div className="overline">Word {i + 1} of {words.length}</div>
          {onStar && <button className={`ghost small${isStarred?.(word) ? " active" : ""}`} aria-pressed={!!isStarred?.(word)} title="Save to your flashcard deck" onClick={() => onStar(word)}>{isStarred?.(word) ? "★ Saved" : "☆ Save"}</button>}
        </div>
        <div className="model-line" style={{ margin: "10px 0 4px" }}>
          <SpeakButton label={`Play ${word.lexKey}`} onClick={() => play(word.lexKey, 0.8)} />
          <span className="say-line" lang={pack.id} style={{ margin: 0 }}>{word.lexKey}</span>
        </div>
        <div className="recap-sub">Tap the meaning</div>
        <div className="quiz-opts" style={{ marginTop: 10 }}>
          {options.map((o) => {
            const cls = picked ? (o === correct ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt";
            return <button className={cls} key={o} disabled={!!picked} onClick={() => { setPicked(o); if (o !== correct) onMiss?.(word); }}>{o}</button>;
          })}
        </div>
        {picked && (
          <>
            <div className="drill-why">
              {picked === correct ? <span className="result-ok"><Icon name="check" size={15} />Right</span> : <span className="result-miss">Not quite</span>}
              <span lang={pack.id}>{word.lexKey}</span> means “{correct}”.
            </div>
            {/* A phrase that leans on later grammar says so here, with its meaning: learn it whole for now. */}
            {noteFor?.(word.lexKey) && <div className="muted small" style={{ marginTop: 8 }}>{noteFor(word.lexKey)}</div>}
            <div className="write-actions"><button className="btn" onClick={advance}>{last ? "Add these and continue" : "Next"}</button></div>
          </>
        )}
      </div>
    </div>
  );
}
