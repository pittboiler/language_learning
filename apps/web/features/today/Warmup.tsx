"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ConjugationSet, ReviewItem } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import type { FamiliarityEntry } from "@ll/core/familiarity";
import { type Progress } from "../../lib/store";
import { buildLineGlosses } from "../../lib/capture";
import { firstTries, sendBack, shuffle } from "../../lib/today-plan";
import { ClozeCard, GradeWords, GrammarCard, PhraseCard } from "../flashcards/Cards";
import { MixedText, PRONOUNS, Stitches, usePack, usePlay } from "../shared";
import { Tag } from "./TodayHeader";

/** The line under the counter after "Again", so the press visibly did something: the card is coming back. */
export function SentBackNote({ wait }: { wait: number }) {
  return <p className="muted small" style={{ margin: "0 0 8px" }}>Again: that card comes back {wait === 1 ? "right after this one" : "after this one and the next"}.</p>;
}
/** " · once more" in the step label, on a card that's back after an "Again". */
export function OnceMore() {
  return <span style={{ color: "var(--accent)" }}> · once more</span>;
}
export function SessionRecap({ items, onDone }: { items: ReviewItem[]; onDone: () => void }) {
  const [queue, setQueue] = useState<{ item: ReviewItem; again?: boolean }[]>(() => items.map((item) => ({ item })));
  const [n, setN] = useState(0);
  const [wait, setWait] = useState(0); // after an "Again": the cards before it comes back (0: none, or it's next)
  const current = queue[0];
  useEffect(() => { if (!current) onDone(); }, [current, onDone]);
  if (!current) return null;
  const grade = (ok: boolean) => {
    const rest = queue.slice(1);
    if (ok) { setQueue(rest); setWait(0); }
    else { const back = sendBack(rest, { item: current.item, again: true }); setQueue(back.rest); setWait(back.wait); }
    setN((x) => x + 1);
  };
  const it = current.item;
  return (
    <div>
      <Tag>Review misses · {queue.length} to clear{current.again && <OnceMore />}</Tag>
      {wait > 0 && <SentBackNote wait={wait} />}
      {it.kind === "grammar"
        ? <GrammarCard key={`${it.id}-${n}`} item={it} onGrade={grade} />
        : <PhraseCard key={`${it.id}-${n}`} item={it} onGrade={grade} />}
    </div>
  );
}
// ---------- Warm-up: an engaging, adaptive review opener ----------
// Instead of a flat stack of flip-cards, the warm-up blends formats by how well a word is known:
//  • a MATCHING GAME (tap-to-pair, audio + recognition) for studied-but-not-yet-cemented words,
//  • in-CONTEXT cloze for words captured while reading (we have the sentence they were met in),
//  • plain RECALL for mature words with no saved context, and
//  • the usual grammar multiple-choice for grammar drills.
// Every item is graded exactly once; results are handed back in a single batch so the caller reschedules
// SRS + advances in one step. Recognition-before-recall keeps a shaky word from being a cold wall.
/** `retry`: the second (or later) go at a card after "Again". It still reschedules the card, but a score
 *  (checkpoint, stage review) counts first tries only, or each "Again" would add a free point. */
export type WarmResult = { item: ReviewItem; ok: boolean; retry?: boolean };
// A quick tap-to-match game: tap a word (hear it), then tap its meaning. Pairs matched on the first try
// grade "good"; a wrong attempt first marks that word "again". Lighter + more fun than recalling each cold.
// `glossFirst`: the English column comes first (left) and you start there, then find the form, rather
// than starting from the form (the conjugation match alternates the two).
export function MatchGame({ pairs, onDone, lead, glossFirst = false }: { pairs: { item: ReviewItem; target: string; gloss: string }[]; onDone: (results: WarmResult[]) => void; lead?: string; glossFirst?: boolean }) {
  const pack = usePack();
  const play = usePlay();
  // Each column shows the same pairs in an independent shuffle; buttons carry the pair index.
  const leftOrder = useMemo(() => shuffle(pairs.map((_, i) => i)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const rightOrder = useMemo(() => shuffle(pairs.map((_, i) => i)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [sel, setSel] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [missed, setMissed] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<number | null>(null);
  // Tapping a form always plays it, whichever column you start from.
  const pickFirst = (i: number) => { if (matched.has(i)) return; setSel(i); if (!glossFirst) play(pairs[i]!.target, 0.8); };
  const pickSecond = (i: number) => {
    if (glossFirst) play(pairs[i]!.target, 0.8);
    if (matched.has(i) || sel === null) return;
    if (i === sel) {
      const next = new Set(matched); next.add(i); setMatched(next); setSel(null);
      if (next.size === pairs.length) onDone(pairs.map((p, j) => ({ item: p.item, ok: !missed.has(j) })));
    } else {
      setMissed((m) => new Set(m).add(sel));
      setWrong(i);
      setTimeout(() => setWrong((w) => (w === i ? null : w)), 450);
    }
  };
  const target = (i: number) => <span lang={pack.id}>{pairs[i]!.target}</span>;
  const gloss = (i: number) => <MixedText text={pairs[i]!.gloss} />;
  return (
    <div className="framed match-card">
      <p style={{ margin: "0 0 4px", lineHeight: 1.5 }}><MixedText text={lead ?? "Match each word to its meaning: tap a word to hear it, then tap what it means."} /></p>
      <div className="match-grid">
        <div className="match-col">
          {leftOrder.map((i) => (
            <button key={i} className={`opt${matched.has(i) ? " right matched" : sel === i ? " sel" : ""}`} disabled={matched.has(i)} onClick={() => pickFirst(i)}>{glossFirst ? gloss(i) : target(i)}</button>
          ))}
        </div>
        <div className="match-col">
          {rightOrder.map((i) => (
            <button key={i} className={`opt${matched.has(i) ? " right matched" : wrong === i ? " wrong" : ""}`} disabled={matched.has(i)} onClick={() => pickSecond(i)}>{glossFirst ? target(i) : gloss(i)}</button>
          ))}
        </div>
      </div>
      <div className="match-count">
        <Stitches total={pairs.length} done={matched.size} size={10} label={`${matched.size} of ${pairs.length} matched`} />
        <span>{matched.size} of {pairs.length} matched</span>
      </div>
    </div>
  );
}
export type WarmCard = { item: ReviewItem; format: "cloze" | "recall" | "grammar"; entry?: FamiliarityEntry; context?: string; contextGloss?: string };
export type WarmStep = { kind: "match"; pairs: { item: ReviewItem; target: string; gloss: string }[] } | { kind: "card"; card: WarmCard; again?: boolean } | { kind: "conjugation"; verb: ConjugationSet; personFirst: boolean };
export function WarmupSession({ items, conjVerb, progress, persist, onComplete, onMiss, label = "Warm up", requeue = true, tally = false }: {
  items: ReviewItem[];
  conjVerb?: ConjugationSet;
  progress: Progress;
  persist: (p: Progress) => void;
  onComplete: (results: WarmResult[]) => void;
  onMiss: (item: ReviewItem) => void;
  /** The counter's name: "Warm up · 3 of 9" (a checkpoint says "Checkpoint", a practice round "Practice"). */
  label?: string;
  /** "Again" brings a card back later (the default). A checkpoint is a test: a miss is a miss and it moves on. */
  requeue?: boolean;
  /** Show "4 of 6 right so far" (first tries) beside the counter. */
  tally?: boolean;
}) {
  const pack = usePack();
  // For back-translating a stored sentence when its English wasn't saved (parity with the Library flashcards).
  const lineGlosses = useMemo(() => buildLineGlosses(pack), [pack]);
  // Route each due item to the format that best fits how well it's known (built once, at mount).
  const plan = useMemo<WarmStep[]>(() => {
    const matchPairs: { item: ReviewItem; target: string; gloss: string }[] = [];
    const cards: WarmCard[] = [];
    for (const it of items) {
      if (it.kind === "grammar") { cards.push({ item: it, format: "grammar" }); continue; }
      const spec = familiarity.deriveKeyForItem(it);
      const entry = progress.familiarity[spec.lexKey];
      const context = progress.contexts?.[spec.lexKey];
      // The sentence's English — stored, else back-translated from the pack line. A cloze NEEDS this
      // (a blank with no translation is unsolvable), so a sentence we can't translate isn't clozed.
      const contextGloss = context ? (progress.contextGlosses?.[spec.lexKey] ?? lineGlosses.get(context.trim())) : undefined;
      const reps = entry?.srs?.card?.reps ?? 0;
      // A saved, translatable sentence ⇒ review the word IN CONTEXT (cloze). Otherwise young words go to
      // the match game (recognition), and words drilled a few times get a plain recall card.
      if (context && contextGloss) cards.push({ item: it, format: "cloze", entry, context, contextGloss });
      else if (reps >= 2) cards.push({ item: it, format: "recall" });
      else matchPairs.push({ item: it, target: it.answer, gloss: it.gloss || spec.gloss || it.answer });
    }
    // A one-word "match" is silly — turn a lone match candidate into a recall card instead.
    if (matchPairs.length === 1) { cards.unshift({ item: matchPairs[0]!.item, format: "recall" }); matchPairs.length = 0; }
    const steps: WarmStep[] = [];
    // The columns swap from one drill to the next (Jake, 2026-10-31): person → form one day, form → person
    // the next, so you both produce the endings and recognise them. Fixed at mount, so finishing can't flip it.
    if (conjVerb) steps.push({ kind: "conjugation", verb: conjVerb, personFirst: (progress.seenConjugations?.length ?? 0) % 2 === 0 });
    // A big set (a checkpoint's whole chapter) is matched six at a time: one grid of eighteen is a wall.
    if (matchPairs.length >= 2) {
      const groups = Math.ceil(matchPairs.length / 6);
      const size = Math.ceil(matchPairs.length / groups);
      for (let g = 0; g < matchPairs.length; g += size) steps.push({ kind: "match", pairs: matchPairs.slice(g, g + size) });
    }
    for (const c of cards) steps.push({ kind: "card", card: c });
    return steps;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [stepIdx, setStepIdx] = useState(0);
  // The steps to play: the plan, plus each card marked "Again" slotted back in a couple of cards on (sendBack).
  const [allSteps, setAllSteps] = useState<WarmStep[]>(plan);
  // After an "Again": the step showing the note that it's coming back, and how many cards until it does.
  const [sentBack, setSentBack] = useState<{ at: number; wait: number } | null>(null);
  const results = useRef<WarmResult[]>([]);
  const doneRef = useRef(false);
  const record = (rs: WarmResult[]) => { for (const r of rs) { results.current.push(r); if (!r.ok) onMiss(r.item); } };
  // Fire onComplete exactly once — when we run past the last step (or immediately if the plan is empty).
  useEffect(() => {
    if (doneRef.current) return;
    if (stepIdx >= allSteps.length) { doneRef.current = true; onComplete(results.current); }
  }, [stepIdx, allSteps.length, onComplete]);

  const step = allSteps[stepIdx];
  if (!step) return null;
  const advance = () => setStepIdx((s) => s + 1);
  return (
    <div>
      <div className="row" style={{ gap: 10, marginBottom: 8 }}>
        <span className="overline">{label} · {stepIdx + 1} of {allSteps.length}{step.kind === "card" && step.again && <OnceMore />}</span>
        <Stitches total={allSteps.length} done={stepIdx} now={stepIdx} size={10} label={`${label} step ${stepIdx + 1} of ${allSteps.length}`} />
        {tally && results.current.length > 0 && (() => { const t = firstTries(results.current); return <span className="muted small">{t.got} of {t.total} right so far</span>; })()}
      </div>
      {sentBack?.at === stepIdx && sentBack.wait > 0 && <SentBackNote wait={sentBack.wait} />}
      {step.kind === "conjugation" ? (
        <MatchGame
          key={stepIdx}
          glossFirst={step.personFirst}
          lead={step.personFirst
            ? `Tap a person, then the form of “${step.verb.gloss}” (${step.verb.lemma}) that goes with it.`
            : `Tap a form of “${step.verb.gloss}” (${step.verb.lemma}) to hear it, then the person it goes with.`}
          pairs={PRONOUNS.map((pr) => ({ item: { id: `conj-${step.verb.lemma}-${pr.key}`, kind: "vocab", prompt: pr.en, answer: step.verb.forms[pr.key], gloss: `${pr.en} · ${pr.mk}`, i1Level: 0, tags: [] }, target: step.verb.forms[pr.key], gloss: `${pr.en} · ${pr.mk}` }))}
          onDone={() => { persist({ ...progress, seenConjugations: [...(progress.seenConjugations ?? []), step.verb.lemma] }); advance(); }}
        />
      ) : step.kind === "match" ? (
        <MatchGame key={stepIdx} pairs={step.pairs} onDone={(rs) => { record(rs); advance(); }} />
      ) : (() => {
        const c = step.card;
        // "Again" (ok=false) slots the card back in a couple of cards on, with a note saying so, so you see it
        // again this session while it's fresh; "Good" moves on.
        const grade = (ok: boolean) => {
          record([{ item: c.item, ok, ...(step.again ? { retry: true } : {}) }]);
          if (ok || !requeue) setSentBack(null);
          else {
            const back = sendBack(allSteps.slice(stepIdx + 1), { kind: "card", card: c, again: true });
            setAllSteps([...allSteps.slice(0, stepIdx + 1), ...back.rest]);
            setSentBack({ at: stepIdx + 1, wait: back.wait });
          }
          advance();
        };
        const card = c.format === "grammar" ? <GrammarCard key={stepIdx} item={c.item} onGrade={grade} />
          : c.format === "cloze" && c.entry ? <ClozeCard key={stepIdx} entry={c.entry} context={c.context} contextGloss={c.contextGloss} onGrade={grade} />
          : <PhraseCard key={stepIdx} item={c.item} onGrade={grade} />;
        return requeue ? card : <GradeWords.Provider value={{ miss: "Missed it", ok: "Got it" }}>{card}</GradeWords.Provider>;
      })()}
    </div>
  );
}
