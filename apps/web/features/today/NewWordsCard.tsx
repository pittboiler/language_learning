"use client";
import { useMemo, useState } from "react";
import { shuffle } from "../../lib/today-plan";
import { usePlay } from "../shared";

export const FALLBACK_GLOSSES = ["hello", "thank you", "please", "yes", "good", "water"];
// Pre-teach the story's new words interactively: hear each, tap its meaning (multiple choice), then
// they're captured. Engages instead of just listing.
export function NewWordsCard({ words, onDone, onMiss, onStar, isStarred, noteFor }: { words: { lexKey: string; gloss?: string }[]; onDone: () => void; onMiss?: (word: { lexKey: string; gloss?: string }) => void; onStar?: (word: { lexKey: string; gloss?: string }) => void; isStarred?: (word: { lexKey: string; gloss?: string }) => boolean; noteFor?: (lexKey: string) => string | undefined }) {
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
      <p className="lead">New words for today&apos;s story — hear each, then tap its meaning. <span className="muted small">({i + 1}/{words.length})</span></p>
      <div className="fb">
        <div className="row" style={{ alignItems: "center" }}>
          <button className="spk" onClick={() => play(word.lexKey, 0.8)}>🔊</button>
          <b className="target" style={{ fontSize: 26 }}>{word.lexKey}</b>
          {onStar && <button className={`ghost small${isStarred?.(word) ? " active" : ""}`} style={{ marginLeft: "auto" }} title="Save to your flashcard deck" onClick={() => onStar(word)}>{isStarred?.(word) ? "★ Saved" : "☆ Save"}</button>}
        </div>
        <div className="muted small" style={{ margin: "10px 0 6px" }}>Tap the meaning</div>
        <div>
          {options.map((o) => {
            const cls = picked ? (o === correct ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt";
            return <button className={cls} key={o} disabled={!!picked} onClick={() => { setPicked(o); if (o !== correct) onMiss?.(word); }}>{o}</button>;
          })}
        </div>
        {picked && (
          <div className="why">
            {picked === correct ? "✓ " : "✗ "}{word.lexKey} = {correct}
            <button className="btn" style={{ marginLeft: 8 }} onClick={advance}>{last ? "Add these & continue →" : "Next →"}</button>
            {/* A phrase that leans on later grammar says so here, with its meaning: learn it whole for now. */}
            {noteFor?.(word.lexKey) && <div className="muted small" style={{ marginTop: 8 }}>💬 {noteFor(word.lexKey)}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
