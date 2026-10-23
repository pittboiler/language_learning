"use client";
import { useMemo, useState } from "react";
import type { ReviewItem } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import type { FamiliarityEntry } from "@ll/core/familiarity";
import { romanize } from "../../lib/romanize";
import { HintButton, Icon, MixedText, SpeakButton, useHintFor, usePack, usePlay } from "../shared";

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A type-in should be a FILL-IN-THE-BLANK, not a cold "produce the whole sentence" box: a learner three
// days in can't write "Од каде си?" from "Where are you from?", but they can supply the missing word once
// the sentence's shape is in front of them. Blank the most contentful word — the longest, since function
// words (си, во, е) are short, ties going to the later one so a leading pronoun isn't what gets hidden —
// and show the rest. Single-word answers have nothing to scaffold and stay a plain recall card.
export const BLANK_WORD_RE = /\p{L}[\p{L}\p{M}\u2019'-]*/gu;
export function blankOne(answer: string): { skeleton: string; missing: string } | null {
  const words = [...answer.matchAll(BLANK_WORD_RE)];
  if (words.length < 2) return null;
  const pick = words.reduce((a, b) => (b[0].length >= a[0].length ? b : a));
  const at = pick.index ?? 0;
  return { missing: pick[0], skeleton: `${answer.slice(0, at)}____${answer.slice(at + pick[0].length)}` };
}
// Captured-word review. When we know the sentence it was met in, blank the word inside it and show the
// English so it's clear what to produce ("Ana wants coffee" → say the missing word). Otherwise it's a
// plain recall card (English → target). Either way the English tells the learner what's being solved for.
// Type-in production for recall cards (Part A): accepts Latin (or Cyrillic) and matches against the
// transliteration, so no Cyrillic keyboard is needed. Comparison strips case/spaces/punctuation.
export function typedMatches(typed: string, target: string): boolean {
  const norm = (x: string) => x.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");
  return norm(typed) === norm(target) || norm(romanize(typed)) === norm(romanize(target));
}
/** A line with one word missing ("____"), the gap drawn as a dashed line the width of a short word. */
function Skeleton({ text }: { text: string }) {
  const pack = usePack();
  const parts = text.split("____");
  return <div className="card-skeleton" lang={pack.id}>{parts.map((p, i) => <span key={i}>{p}{i < parts.length - 1 && <span className="blank" aria-label="missing word" />}</span>)}</div>;
}
function TypedResult({ ok, typed }: { ok: boolean; typed: string }) {
  return ok
    ? <div className="result-ok" style={{ marginBottom: 4 }}><Icon name="check" size={16} />Correct</div>
    : <div className="result-miss" style={{ marginBottom: 4 }}>You wrote “{typed}”</div>;
}
function GradeRow({ onGrade }: { onGrade: (ok: boolean) => void }) {
  return (
    <div className="grade-row">
      <button className="ghost" onClick={() => onGrade(false)}>Again</button>
      <button className="btn" onClick={() => onGrade(true)}>Good</button>
    </div>
  );
}
export function TypedRecall({ onChecked, onReveal, placeholder }: { onChecked: (val: string) => void; onReveal: () => void; placeholder?: string }) {
  const [val, setVal] = useState("");
  return (
    <div className="recall">
      <input className="text" aria-label="Your answer" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={placeholder ?? "type it (Latin ok)"} value={val}
        onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) onChecked(val.trim()); }} />
      <button className="btn" disabled={!val.trim()} onClick={() => onChecked(val.trim())}>Check</button>
      <button className="quiet" onClick={onReveal}>Show answer</button>
    </div>
  );
}
export function ClozeCard({ entry, context, contextGloss, onGrade }: { entry: FamiliarityEntry; context?: string; contextGloss?: string; onGrade: (ok: boolean) => void }) {
  const pack = usePack();
  const play = usePlay();
  const hint = useHintFor();
  const [revealed, setRevealed] = useState(false);
  const [typedVal, setTypedVal] = useState<string | null>(null);
  const blanked = context ? context.replace(new RegExp(`(^|[^\\p{L}])(${escapeRe(entry.display)})(?=[^\\p{L}]|$)`, "iu"), (_m, pre) => `${pre}____`) : null;
  // Only blank the sentence when we also have its English — a fill-in-the-blank with no translation gives
  // the learner no way to know which word to produce. Without the English, fall back to the plain recall
  // card below (which shows the word's own gloss).
  const cloze = contextGloss && blanked && blanked !== context ? blanked : null;
  // No usable sentence ⇒ recall from the word's own gloss. A multi-word chunk still gets a blank rather
  // than a cold box, so every type-in in the app asks for one missing word.
  const gap = cloze ? null : blankOne(entry.display);
  return (
    <div className="framed flashcard">
      {cloze ? (
        <>
          <div className="overline">Fill in the missing word</div>
          <div className="card-prompt">{contextGloss}</div>
          {!revealed && <Skeleton text={cloze} />}
        </>
      ) : (
        <>
          <div className="overline">Say it in {pack.name}</div>
          <div className="card-prompt">{entry.gloss ?? entry.display}</div>
          {gap && !revealed && <Skeleton text={gap.skeleton} />}
        </>
      )}
      {!revealed ? (
        <>
          <TypedRecall placeholder={gap || cloze ? "type the missing word" : "type it (Latin ok)"} onChecked={(v) => { setTypedVal(v); setRevealed(true); }} onReveal={() => setRevealed(true)} />
          <div className="card-tools"><HintButton hint={hint(entry.lexKey)} /></div>
        </>
      ) : (
        <div style={{ marginTop: 12 }}>
          {typedVal !== null && <TypedResult ok={typedMatches(typedVal, gap ? gap.missing : entry.display)} typed={typedVal} />}
          {cloze ? (
            <>
              <div className="card-answer" lang={pack.id} style={{ fontSize: 24, lineHeight: 1.4 }}>{context}</div>
              <div className="muted small" style={{ marginTop: 2 }}><span lang={pack.id}>{entry.display}</span>{entry.gloss ? ` · ${entry.gloss}` : ""}</div>
            </>
          ) : (
            <div className="card-answer" lang={pack.id}>{entry.display}</div>
          )}
          <div className="card-tools">
            {cloze && context ? (
              <>
                <button className="ghost small" onClick={() => play(context, 0.8)}><Icon name="speaker" size={16} />Hear the line</button>
                <button className="ghost small" onClick={() => play(entry.display, 0.8)}><Icon name="speaker" size={16} />Hear the word</button>
              </>
            ) : (
              <button className="ghost small" onClick={() => play(entry.display, 0.8)}><Icon name="speaker" size={16} />Hear it</button>
            )}
          </div>
          <GradeRow onGrade={onGrade} />
        </div>
      )}
    </div>
  );
}
// Word-by-word breakdown + a one-line "how it fits" takeaway, shown on a phrase/chunk reveal so the
// learner sees which piece means what and how they combine. Renders nothing for single-word items.
export function PhraseBreakdown({ item }: { item: ReviewItem }) {
  const pack = usePack();
  if (!item.breakdown?.length && !item.takeaway) return null;
  return (
    <div className="breakdown">
      {item.breakdown?.length ? (
        <ul className="bd-list">
          {item.breakdown.map((b, i) => (
            <li key={i}><span className="bd-part" lang={pack.id}>{b.part}</span><span className="bd-gloss">{b.gloss}</span></li>
          ))}
        </ul>
      ) : null}
      {item.takeaway ? <div className="bd-takeaway">{item.takeaway}</div> : null}
    </div>
  );
}
export function PhraseCard({ item, onGrade }: { item: ReviewItem; onGrade: (ok: boolean) => void }) {
  const pack = usePack();
  const play = usePlay();
  const hint = useHintFor();
  const [revealed, setRevealed] = useState(false);
  const [typedVal, setTypedVal] = useState<string | null>(null);
  // Say the whole phrase aloud (the spoken task is unchanged); the WRITTEN check is one blank in it.
  const gap = useMemo(() => blankOne(item.answer), [item.answer]);
  return (
    <div className="framed flashcard">
      <div className="overline">Say it in {pack.name}</div>
      <div className="card-prompt">{item.gloss}</div>
      {gap && !revealed && <Skeleton text={gap.skeleton} />}
      {!revealed ? (
        <>
          <TypedRecall placeholder={gap ? "type the missing word" : "type it (Latin ok)"} onChecked={(v) => { setTypedVal(v); setRevealed(true); }} onReveal={() => setRevealed(true)} />
          <div className="card-tools"><HintButton hint={hint(familiarity.deriveKeyForItem(item).lexKey)} /></div>
        </>
      ) : (
        <div style={{ marginTop: 12 }}>
          {typedVal !== null && <TypedResult ok={typedMatches(typedVal, gap ? gap.missing : item.answer)} typed={typedVal} />}
          <div className="card-answer" lang={pack.id}>{item.answer}</div>
          {item.translit && <div className="translit">{item.translit}</div>}
          <PhraseBreakdown item={item} />
          <div className="card-tools"><button className="ghost small" onClick={() => play(item.answer, 0.8)}><Icon name="speaker" size={16} />Hear it</button></div>
          <GradeRow onGrade={onGrade} />
        </div>
      )}
    </div>
  );
}
// A grammar RULE card (course points): a plain question; reveal the one-line answer and an example line,
// then grade yourself. No typing, no options — the simple flashcard the design asks for.
export function RuleCard({ item, onGrade }: { item: ReviewItem; onGrade: (ok: boolean) => void }) {
  const pack = usePack();
  const play = usePlay();
  const [shown, setShown] = useState(false);
  const example = item.meta?.example as string | undefined;
  return (
    <div className="framed flashcard">
      <div className="overline">{(item.meta?.concept as string) || "Grammar"}</div>
      <div className="card-prompt" style={{ fontWeight: 600, fontSize: 21 }}><MixedText text={item.prompt} /></div>
      {!shown ? (
        <button className="btn" style={{ marginTop: 12 }} onClick={() => setShown(true)}>Show answer</button>
      ) : (
        <>
          <p style={{ margin: "10px 0 6px", fontSize: 16, lineHeight: 1.5 }}><MixedText text={item.answer} /></p>
          {example && (
            <div className="gram-ex">
              <SpeakButton label={`Play ${example}`} onClick={() => play(example)} />
              <span className="mk" lang={pack.id}>{example}</span>{item.meta?.exampleGloss ? <span className="en">{item.meta.exampleGloss as string}</span> : null}
            </div>
          )}
          <GradeRow onGrade={onGrade} />
        </>
      )}
    </div>
  );
}
export function GrammarCard({ item, onGrade }: { item: ReviewItem; onGrade: (ok: boolean) => void }) {
  if (item.meta?.ruleCard) return <RuleCard item={item} onGrade={onGrade} />;
  return <ChoiceGrammarCard item={item} onGrade={onGrade} />;
}
export function ChoiceGrammarCard({ item, onGrade }: { item: ReviewItem; onGrade: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
  };
  const concept = (item.meta?.concept as string) || "";
  return (
    <div className="framed flashcard">
      <div className="overline">{concept || "Grammar"}</div>
      <div className="card-prompt" style={{ fontWeight: 600, fontSize: 21 }}><MixedText text={item.prompt} /></div>
      {item.meta?.point ? <div className="gloss" style={{ fontSize: 15 }}>{item.gloss}</div> : null}
      <div className="card-opts">
        {(item.options ?? []).map((o) => {
          const cls = picked ? (o === item.answer ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt";
          return <button className={cls} key={o} disabled={!!picked} onClick={() => choose(o)}><MixedText text={o} /></button>;
        })}
      </div>
      {picked && (
        <div className="quiz-result">
          <div>
            {picked === item.answer ? <span className="result-ok"><Icon name="check" size={16} />Right</span> : <span className="result-miss">Not quite</span>}
            {item.why && <div className="muted small" style={{ marginTop: 2 }}><MixedText text={item.why} /></div>}
          </div>
          <button className="btn" onClick={() => onGrade(picked === item.answer)}>Next</button>
        </div>
      )}
    </div>
  );
}
