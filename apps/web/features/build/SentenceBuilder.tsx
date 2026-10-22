"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConjugationSet, SentenceItem, SentenceVariant } from "@ll/pack-schema";
import * as sentenceScope from "@ll/core/sentences";
import { type Progress } from "../../lib/store";
import * as api from "../../lib/api";
import * as cp from "../../lib/course-player";
import { shuffle } from "../../lib/today-plan";
import { useChapterMap } from "../course/ChapterHeading";
import { Icon, MixedText, PRONOUNS, SpeakButton, Stitches, gradeItem, usePack, usePlay } from "../shared";

// ---------- Library view 6: writing (prompted production + correction-why) ----------
// ---------- "Build a sentence" — tap-the-tiles production, one person form per card ----------
export const buildNorm = (w: string) => w.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");
// English collapses 2sg and 2pl into one "you", so "You ask the doctor" is the prompt for BOTH Прашуваш
// and Прашувате — and the person chip in the corner is easy to miss. Spell the person out inside the
// sentence itself so the prompt alone determines the verb form.
export const YOU_LABEL: Record<string, string> = { "2sg": "You (one person)", "2pl": "You all" };
export function personedEn(variant: SentenceVariant): string {
  const label = variant.person ? YOU_LABEL[variant.person] : undefined;
  if (!label) return variant.en;
  if (!/\byou\b/i.test(variant.en)) return `${label}: ${variant.en}`;
  // Expand contractions so the label doesn't strand them: "you're" → "you (one person) are".
  const CONTR: Record<string, string> = { "'re": " are", "'ll": " will", "'ve": " have", "'d": " would" };
  return variant.en.replace(/\byou('re|'ll|'ve|'d)?\b/i, (m, c?: string) => (m[0] === "Y" ? label : label.toLowerCase()) + (c ? CONTR[c.toLowerCase()] : ""));
}
// How many wrong checks before the builder shows the answer. Three is enough to think it through;
// beyond that the learner is just permuting tiles, which teaches nothing.
export const BUILD_TRIES = 3;
export function TileBuilder({ variant, verb, onFinish }: {
  variant: SentenceVariant;
  verb?: ConjugationSet;
  onFinish: (outcome: "solved" | "revealed") => void;
}) {
  const play = usePlay();
  const targetWords = useMemo(() => variant.mk.split(/\s+/).filter(Boolean), [variant.mk]);
  // Bank = the sentence's words, shuffled, plus up to 2 OTHER forms of the verb as distractors (so picking
  // the right conjugation is part of the task).
  const bank = useMemo(() => {
    const distract: string[] = [];
    if (verb) {
      const cur = new Set(targetWords.map(buildNorm));
      for (const f of Object.values(verb.forms)) { if (distract.length >= 2) break; if (!cur.has(buildNorm(f)) && !distract.includes(f)) distract.push(f); }
    }
    return shuffle([...targetWords, ...distract]).map((w, i) => ({ id: i, w }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant.mk]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [result, setResult] = useState<null | boolean>(null);
  const [tries, setTries] = useState(0);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { setPlaced([]); setResult(null); setTries(0); setRevealed(false); }, [variant.mk]);
  // Fetch the line while it's being built, so it's said the moment it's right; and when the card moves on,
  // drop anything still loading or playing, so the last sentence never talks over the next one.
  const pack = usePack();
  useEffect(() => { api.prefetchTts(variant.mk, pack.id); return () => api.stopTts(); }, [variant.mk, pack.id]);
  const placedSet = new Set(placed);
  const wordOf = (id: number) => bank.find((t) => t.id === id)!.w;
  const done = result === true || revealed;

  // ---- dragging -------------------------------------------------------------------------------
  // Pointer events rather than HTML5 drag-and-drop: the same code then works with a mouse and with a
  // finger (HTML5 DnD never fires on touch). A press that doesn't move is still a tap, so the original
  // tap-to-place behaviour is untouched — dragging only adds placing at a position and reordering.
  const slotRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<null | { id: number; from: "bank" | "slot"; x: number; y: number }>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const movedRef = useRef(false);

  /** Where a drop at (x,y) would insert, or null when the pointer isn't over the answer area. */
  const indexAt = useCallback((x: number, y: number): number | null => {
    const slot = slotRef.current;
    if (!slot) return null;
    const r = slot.getBoundingClientRect();
    const pad = 28; // a near-miss still counts as a drop — fingers aren't precise
    if (x < r.left - pad || x > r.right + pad || y < r.top - pad || y > r.bottom + pad) return null;
    const tiles = [...slot.querySelectorAll<HTMLElement>("[data-tile]")];
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i]!.getBoundingClientRect();
      if (y < t.bottom && x < t.left + t.width / 2) return i;
    }
    return tiles.length;
  }, []);

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) movedRef.current = true;
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
      setDropIdx(movedRef.current ? indexAt(e.clientX, e.clientY) : null);
    };
    const up = (e: PointerEvent) => {
      const at = indexAt(e.clientX, e.clientY);
      const fromSlot = drag.from === "slot";
      setPlaced((pl) => {
        // A press with no movement is a tap: append from the bank, remove from the answer.
        if (!movedRef.current) return fromSlot ? pl.filter((x) => x !== drag.id) : [...pl, drag.id];
        if (at === null) return fromSlot ? pl.filter((x) => x !== drag.id) : pl; // dragged out = put it back
        const without = pl.filter((x) => x !== drag.id);
        const at2 = fromSlot && pl.indexOf(drag.id) < at ? at - 1 : at; // index shifts once it's lifted
        return [...without.slice(0, at2), drag.id, ...without.slice(at2)];
      });
      setResult(null);
      setDrag(null);
      setDropIdx(null);
    };
    // A drag that never gets its pointerup — released outside the window, interrupted by a tab switch,
    // cancelled by the browser — would otherwise leave a tile stuck half-lifted. Abort rather than drop.
    const cancel = () => { setDrag(null); setDropIdx(null); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", cancel);
    };
  }, [drag, indexAt]);

  const grab = (id: number, from: "bank" | "slot") => (e: React.PointerEvent) => {
    if (done || e.button !== 0) return;
    movedRef.current = false;
    setDrag({ id, from, x: e.clientX, y: e.clientY });
  };

  const check = () => {
    const got = placed.map(wordOf);
    const ok = got.length === targetWords.length && got.every((w, i) => buildNorm(w) === buildNorm(targetWords[i]!));
    setResult(ok);
    if (ok) { play(variant.mk, 0.85); return; }
    const used = tries + 1;
    setTries(used);
    // Out of tries: lay the sentence out correctly in the tray, say it, and let them move on. Seeing the
    // right order built from the same tiles is the lesson; another blind permutation isn't.
    if (used >= BUILD_TRIES) {
      const byWord = new Map<string, number[]>();
      for (const t of bank) { const k = buildNorm(t.w); byWord.set(k, [...(byWord.get(k) ?? []), t.id]); }
      setPlaced(targetWords.map((w) => byWord.get(buildNorm(w))?.shift()).filter((x): x is number => x !== undefined));
      setRevealed(true);
      play(variant.mk, 0.85);
    }
  };

  const left = BUILD_TRIES - tries;
  return (
    <div>
      <div className="card-prompt">{personedEn(variant)}</div>
      <div ref={slotRef} aria-label="Your sentence so far" className={`tile-slot${drag && dropIdx !== null ? " over" : ""}`}>
        {placed.length === 0 && !drag ? <span className="muted small">Tap a tile, or drag one up here</span> : null}
        {placed.map((id, i) => (
          <span key={id} className="tile-wrap">
            {dropIdx === i && <span className="drop-marker" />}
            <button
              data-tile
              lang={pack.id}
              className={`opt tile${drag?.id === id ? " dragging" : ""}${revealed ? " right" : ""}`}
              onPointerDown={grab(id, "slot")}
            >{wordOf(id)}</button>
          </span>
        ))}
        {dropIdx === placed.length && <span className="drop-marker" />}
      </div>
      <div className="tile-bank">
        {bank.filter((t) => !placedSet.has(t.id)).map((t) => (
          <button key={t.id} lang={pack.id} className={`opt tile${drag?.id === t.id ? " dragging" : ""}`} disabled={done} onPointerDown={grab(t.id, "bank")}>{t.w}</button>
        ))}
      </div>
      {/* The tile under the cursor/finger while dragging — fixed to the viewport, never intercepting events. */}
      {drag && movedRef.current && (
        <div className="opt tile ghost" style={{ left: drag.x, top: drag.y }}>{wordOf(drag.id)}</div>
      )}
      <div className="build-result">
        {result === true ? (
          <>
            <span className="result-ok" role="img" aria-label="Correct"><Icon name="check" size={18} /></span>
            <span className="build-answer" lang={pack.id}>{variant.mk}</span>
            <SpeakButton label={`Play ${variant.mk}`} onClick={() => play(variant.mk, 0.85)} />
            <button className="btn" onClick={() => onFinish("solved")}>Next</button>
          </>
        ) : revealed ? (
          <>
            <span className="muted small" style={{ width: "100%" }}>Here&apos;s the order: read it aloud, then carry on. It&apos;ll come round again.</span>
            <span className="build-answer" lang={pack.id}>{variant.mk}</span>
            <SpeakButton label={`Play ${variant.mk}`} onClick={() => play(variant.mk, 0.85)} />
            <button className="btn" onClick={() => onFinish("revealed")}>Got it</button>
          </>
        ) : (
          <>
            <button className="btn" disabled={!placed.length} onClick={check}>Check</button>
            {result === false && (
              <span className="result-miss" style={{ fontWeight: 500 }}>Not quite: drag a tile to move it. {left} {left === 1 ? "try" : "tries"} left.</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
// A session mixes tiers per SESSION_TIERS — a short one or two to warm up, most at the learner's current
// rung — ordered short → long. Which rung that is, and which sentences are even eligible, is decided by
// @ll/core/sentences from course position + cards built (a sentence's VERB is never in its supportWords,
// so scoping on those alone drills verbs the course hasn't introduced).
// Tier-1 keys stay `lemma:person` (pre-ladder progress keeps counting).
export const SESSION_TIERS: Record<number, number[]> = { 1: [1, 1, 1, 1, 1, 1], 2: [1, 1, 2, 2, 2, 2], 3: [1, 2, 2, 3, 3, 3], 4: [1, 2, 3, 3, 4, 4] };
export const builtKey = (item: SentenceItem, variant: SentenceVariant) =>
  (item.tier ?? 1) === 1 && item.verbLemma ? `${item.verbLemma}:${variant.person}` : `${item.id}:${variant.person ?? ""}`;
export function SentenceBuilder({ progress, persist, onDone, preferIds, chapterOrderOverride }: {
  progress: Progress;
  persist: (p: Progress) => void;
  onDone?: () => void;
  /** New course: the blueprint's candidates for this session (today's point and words first, then at least
   *  one from an earlier chapter). Used when any of them are buildable right now; else the usual scope. */
  preferIds?: string[];
  /** New course: the chapter the learner is on, from the blueprint rather than the old chapter map. */
  chapterOrderOverride?: number;
}) {
  const pack = usePack();
  const { current } = useChapterMap(progress);
  // On the course, its chapter and its rule (verb + grammar taught) decide; the old chapter map only otherwise.
  const onCourse = cp.courseV2On(pack, progress) && !!pack.course;
  const allow = useMemo(() => (onCourse ? cp.sentenceAllowed(pack, pack.course!, progress) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onCourse, pack, progress.course, progress.seenGrammar]);
  const chapterOrder = chapterOrderOverride ?? (onCourse ? Math.min(cp.currentSlot(pack.course!, progress).order, Math.max(...pack.course!.chapters.map((c) => c.order))) : current ? (pack.chapters ?? []).find((c) => c.id === current.id)?.order ?? 1 : (pack.chapters?.length ?? 1));
  const builtCount = (progress.builtConjugations ?? []).length;
  // Eligible sentences: introduced by the course already (verb included), built from words the learner has
  // met, and no longer than their rung allows.
  const { items: scoped, usedFallback, source } = useMemo(() => {
    const r = sentenceScope.withFallback(pack, { chapterOrder, builtCount, hasMet: (k) => !!progress.familiarity[k], allow });
    if (!preferIds?.length) return r;
    // Phrase cards are built on demand by id; sentence items come from the pack. Keep the blueprint's order.
    const phrases = sentenceScope.phraseCards(pack, { chapterOrder, hasMet: (k) => !!progress.familiarity[k] }, 200);
    const pool = new Map([...r.items, ...phrases, ...(pack.sentences ?? [])].map((it) => [it.id, it]));
    const inScope = new Set([...r.items.map((it) => it.id), ...phrases.map((it) => it.id)]);
    const preferred = preferIds.filter((id) => inScope.has(id)).map((id) => pool.get(id)!).filter(Boolean);
    return preferred.length ? { ...r, items: preferred, usedFallback: false } : r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack, chapterOrder, builtCount, progress.familiarity, preferIds?.join(), allow]);
  const top = sentenceScope.maxTier({ chapterOrder, builtCount });
  const [nonce, setNonce] = useState(0);
  // ONE sentence per card. Flatten each verb item into its six person-variants, then pick 6 cards along a
  // COMPLEXITY LADDER: items carry a tier (1 = two words … 4 = two clauses), higher tiers unlock as the
  // learner builds more, and each session mixes a short warm-up with longer ones (SESSION_TIERS), ordered
  // short → long. Within a tier: not-yet-built (item:person) first, capped to 2 per verb for spread.
  const cards = useMemo(() => {
    const built = new Set(progress.builtConjugations ?? []);
    const flat = scoped
      .flatMap((it) => (it.verbLemma ? it.variants : it.variants.slice(0, 1)).map((v) => ({ item: it, variant: v })));
    const ordered = [...shuffle(flat.filter((c) => !built.has(builtKey(c.item, c.variant)))), ...shuffle(flat.filter((c) => built.has(builtKey(c.item, c.variant))))];
    const pick: { item: SentenceItem; variant: SentenceVariant }[] = [];
    const perVerb = new Map<string, number>();
    const take = (ok: (c: { item: SentenceItem; variant: SentenceVariant }) => boolean, capped: boolean) => {
      const c = ordered.find((c) => !pick.includes(c) && ok(c) && (!capped || (perVerb.get(c.item.verbLemma ?? c.item.id) ?? 0) < 2));
      if (!c) return false;
      const vl = c.item.verbLemma ?? c.item.id;
      perVerb.set(vl, (perVerb.get(vl) ?? 0) + 1);
      pick.push(c);
      return true;
    };
    // Each slot wants a tier; fall back to the nearest lower tier the learner has in scope, then anything.
    for (const want of SESSION_TIERS[top]!) {
      let got = false;
      for (let t = want; t >= 1 && !got; t--) got = take((c) => (c.item.tier ?? 1) === t, true);
      if (!got) take(() => true, false);
    }
    return pick.sort((x, y) => (x.item.tier ?? 1) - (y.item.tier ?? 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped.length, top, nonce]);
  const [idx, setIdx] = useState(0);

  if (!scoped.length) return <p className="lead">Nothing to build yet — learn a few words or phrases first, and this fills up.</p>;
  if (idx >= cards.length || !cards[idx]) return (
    <div className="framed write-card" style={{ textAlign: "center" }}>
      <div className="overline">Build a sentence</div>
      <p className="result-ok" style={{ margin: "12px 0 16px", fontSize: 18 }}><Icon name="check" size={18} />You built {cards.length} sentence{cards.length === 1 ? "" : "s"}</p>
      <div>
        {onDone ? <button className="btn" onClick={onDone}>Done</button> : <button className="btn" onClick={() => { setIdx(0); setNonce((n) => n + 1); }}>Go again</button>}
      </div>
    </div>
  );

  const { item, variant } = cards[idx]!;
  const verb = item.verbLemma ? (pack.conjugations ?? []).find((v) => v.lemma === item.verbLemma) : undefined;
  const person = variant.person ? PRONOUNS.find((pr) => pr.key === variant.person) : undefined;
  const personEn = person ? `${person.en} (${person.mk})` : undefined;
  // One way off a card: build it, or run out of tries and be shown it. A revealed card grades its grammar
  // as missed (so it comes back sooner) and doesn't count as built, so it stays in the rotation.
  const finish = (outcome: "solved" | "revealed") => {
    let p = progress;
    for (const cid of item.conceptIds) p = gradeItem(p, { id: cid, kind: "grammar", prompt: "", answer: "", gloss: "", i1Level: 0, tags: [] }, outcome === "solved");
    if (outcome === "solved") p = { ...p, builtConjugations: [...new Set([...(p.builtConjugations ?? []), builtKey(item, variant)])] };
    persist(p);
    setIdx((i) => i + 1);
  };

  return (
    <div className="framed write-card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="overline">Build a sentence · {idx + 1} of {cards.length}</span>
          <Stitches total={cards.length} done={idx} now={idx} size={10} label={`Sentence ${idx + 1} of ${cards.length}`} />
        </div>
        {verb && <span className="muted small"><MixedText text={`${personEn ? `${personEn} · ` : ""}${verb.gloss}`} /></span>}
      </div>
      {source === "phrases" && <p className="muted small" style={{ margin: "0 0 6px" }}>Put a phrase you&apos;ve learned back together, piece by piece.</p>}
      {usedFallback && <p className="muted small" style={{ margin: "0 0 6px" }}>A word or two here is new; they&apos;ll come round in your reviews.</p>}
      <TileBuilder key={`${item.id}-${variant.person ?? ""}`} variant={variant} verb={verb} onFinish={finish} />
    </div>
  );
}
