"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReviewItem } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import type { FamiliarityEntry } from "@ll/core/familiarity";
import * as chapterSpine from "@ll/core/chapters";
import { type Progress } from "../../lib/store";
import { buildLineGlosses } from "../../lib/capture";
import * as cp from "../../lib/course-player";
import { reviewPool } from "../../lib/today-plan";
import { ClozeCard, GrammarCard, PhraseCard } from "./Cards";
import { gradeItem, nameCard, usePack } from "../shared";

// ---------- Progress section: Strengthen (unified SRS over phrases + grammar) ----------
export type ReviewUnit =
  | { type: "pool"; key: string; item: ReviewItem; strength: number }
  | { type: "captured"; key: string; entry: FamiliarityEntry; strength: number };
export function Review({ progress, persist }: { progress: Progress; persist: (p: Progress) => void }) {
  const pack = usePack();
  // Weakest-first queue of everything due: pack vocab/grammar PLUS words you captured while reading
  // (those are reviewed in the sentence you met them in — cloze).
  // Back-translate a captured word's sentence at review time (covers words saved before we stored the
  // English), so the cloze always shows what to say.
  const lineGlosses = useMemo(() => buildLineGlosses(pack), [pack]);
  // The FULL deck — every pack word/phrase/grammar drill plus words you captured while reading. Nothing is
  // hidden behind "studied": you filter down to what you want to drill. Ordered so anything already due for
  // review (most-due first) leads, then new words before new sentences. Grading a new card enrolls it in SRS.
  const v2 = cp.courseV2On(pack, progress);
  const deck = useMemo<ReviewUnit[]>(() => {
    const now = new Date();
    // New course: grammar is the taught points' cards (rule + blank), not the old per-concept drills.
    const pool = v2 && pack.course ? [...pack.vocab, ...cp.taughtPointItems(pack.course, progress)] : reviewPool(pack);
    const poolKeys = new Set(pool.map((it) => familiarity.deriveKeyForItem(it).lexKey));
    const poolUnits: ReviewUnit[] = pool.map((it) => {
      const k = familiarity.deriveKeyForItem(it).lexKey;
      return { type: "pool", key: k, item: it, strength: progress.familiarity[k]?.strength ?? 0 };
    });
    const capturedUnits: ReviewUnit[] = Object.values(progress.familiarity)
      .filter((e) => familiarity.isStudied(e) && (e.kind === "word" || e.kind === "chunk") && !poolKeys.has(e.lexKey) && !nameCard(e.display, pack))
      .map((e) => ({ type: "captured", key: e.lexKey, entry: e, strength: e.strength }));
    const isWord = (u: ReviewUnit) => u.type === "pool" ? (u.item.kind === "vocab" || (u.item.kind === "phrase" && !/\s/.test(u.item.answer.trim()))) : u.entry.kind === "word" && !progress.contexts?.[u.key];
    const dueMs = (u: ReviewUnit): number | null => {
      const srs = u.type === "captured" ? u.entry.srs : progress.familiarity[u.key]?.srs;
      return srs && new Date(srs.due) <= now ? new Date(srs.due).getTime() : null; // null ⇒ not currently due (new / scheduled ahead)
    };
    return [...poolUnits, ...capturedUnits].sort((a, b) => {
      const da = dueMs(a), db = dueMs(b);
      if (da !== null && db !== null) return da - db; // both due → most-due first
      if (da !== null) return -1;
      if (db !== null) return 1;
      return (isWord(a) ? 0 : 1) - (isWord(b) ? 0 : 1); // new items → words before sentences
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack, v2]);

  // Word (single token) vs sentence/phrase, for the type filter.
  const isWordUnit = (u: ReviewUnit): boolean =>
    u.type === "pool"
      ? u.item.kind === "vocab" || (u.item.kind === "phrase" && !/\s/.test(u.item.answer.trim()))
      : u.entry.kind === "word" && !progress.contexts?.[u.key];

  // Saved to the custom deck? Read live from familiarity (not the memoized unit) so a just-starred pool
  // word reflects immediately; captured units carry their own entry.
  const isStarredUnit = (u: ReviewUnit): boolean => {
    const e = u.type === "captured" ? u.entry : progress.familiarity[u.key];
    return !!e && familiarity.isStarred(e);
  };

  // A card's bucket is the CHAPTER that teaches it, labelled exactly as the Library and Progress label
  // it, so a word lives under the same heading everywhere. Captured words and grammar keep their own
  // buckets, sorted after the chapters.
  const bucketOf = useCallback((u: ReviewUnit): { key: string; label: string; order: number } => {
    if (u.type === "captured") return { key: "captured", label: "saved by you", order: 1001 };
    if (u.item.kind === "grammar") return { key: "grammar", label: "grammar", order: 1002 };
    if (v2 && pack.course) {
      const at = cp.chapterOfWord(pack.course, u.key);
      const pc = at ? (pack.chapters ?? []).find((c) => c.id === at.chapterId) : undefined;
      return pc ? { key: pc.id, label: `${pc.order}. ${pc.shortTitle}`, order: pc.order } : { key: "more", label: "not in the lessons", order: 1000 };
    }
    const ch = chapterSpine.chapterOfVocab(pack, u.item);
    return ch ? { key: ch.id, label: `${ch.order}. ${ch.shortTitle}`, order: ch.order } : { key: "more", label: "more", order: 1000 };
  }, [pack, v2]);

  const [type, setType] = useState<"all" | "words" | "sentences" | "grammar">("all");
  const [themes, setThemes] = useState<Set<string>>(new Set()); // empty ⇒ all themes
  const [starredOnly, setStarredOnly] = useState(false); // the learner's custom "★ saved" deck
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [type, themes, starredOnly]); // restart the deck when a filter changes

  // Scope to the starred (custom) deck first when that toggle is on; type/theme filters then narrow within it.
  const starred = deck.filter(isStarredUnit);
  const scoped = starredOnly ? starred : deck;
  const isGrammarUnit = (u: ReviewUnit) => u.type === "pool" && u.item.kind === "grammar";
  const words = scoped.filter(isWordUnit);
  const grammarUnits = scoped.filter(isGrammarUnit);
  const sentences = scoped.filter((u) => !isWordUnit(u) && !isGrammarUnit(u));
  const byType = type === "words" ? words : type === "sentences" ? sentences : type === "grammar" ? grammarUnits : scoped;
  // Chapters present in the current type, with counts, in course order.
  const buckets = new Map<string, { label: string; order: number; n: number }>();
  for (const u of byType) {
    const b = bucketOf(u);
    const cur = buckets.get(b.key);
    if (cur) cur.n++; else buckets.set(b.key, { label: b.label, order: b.order, n: 1 });
  }
  const themeList = [...buckets.entries()].sort((a, b) => a[1].order - b[1].order);
  const view = themes.size === 0 ? byType : byType.filter((u) => themes.has(bucketOf(u).key));

  const toggleTheme = (t: string) => setThemes((prev) => { const next = new Set(prev); if (next.has(t)) next.delete(t); else next.add(t); return next; });

  const gradePool = (item: ReviewItem, ok: boolean) => { persist(gradeItem(progress, item, ok)); setIdx((i) => i + 1); };
  const gradeCaptured = (lexKey: string, ok: boolean) => {
    const e = progress.familiarity[lexKey];
    if (e) persist({ ...progress, familiarity: { ...progress.familiarity, [lexKey]: familiarity.grade(e, ok ? "good" : "again") } });
    setIdx((i) => i + 1);
  };

  const Filters = (
    <>
      <div className="picker small" style={{ marginBottom: 8 }}>
        {([["all", `All · ${scoped.length}`], ["words", `Words · ${words.length}`], ["sentences", `Sentences · ${sentences.length}`], ["grammar", `Grammar · ${grammarUnits.length}`]] as const).map(([f, label]) => (
          <button key={f} className={type === f ? "active" : ""} onClick={() => setType(f)}>{label}</button>
        ))}
      </div>
      <div className="theme-chips">
        <button className={`chip-toggle${starredOnly ? " active" : ""}`} onClick={() => setStarredOnly((v) => !v)} title="Your saved words">★ Starred{starred.length ? ` · ${starred.length}` : ""}</button>
        <button className={`chip-toggle${themes.size === 0 ? " active" : ""}`} onClick={() => setThemes(new Set())}>All chapters</button>
        {themeList.map(([key, b]) => (
          <button key={key} className={`chip-toggle${themes.has(key) ? " active" : ""}`} onClick={() => toggleTheme(key)}>{b.label} · {b.n}</button>
        ))}
      </div>
    </>
  );

  if (view.length === 0)
    return <section className="view"><h2>Flashcards</h2><p className="lead" style={{ marginBottom: 12 }}>Pick what to drill: filter by type and chapter.</p>{Filters}<p className="lead">{starredOnly && starred.length === 0 ? "No saved words yet. Add words while you learn (in a story, the Words list or a lesson) to build your own deck here." : "Nothing in this filter. Pick another chapter."}</p></section>;
  if (idx >= view.length)
    return <section className="view"><h2>Flashcards</h2><p className="lead" style={{ marginBottom: 12 }}>Pick what to drill: filter by type and chapter.</p>{Filters}<div className="framed flashcard" style={{ textAlign: "center" }}><div className="overline">Deck done</div><div className="card-prompt">{view.length} reviewed</div><button className="linklike" onClick={() => setIdx(0)}>Go through them again</button></div></section>;

  const u = view[idx]!;
  return (
    <section className="view">
      <div className="deck-head"><h2>Flashcards</h2><span className="left">{view.length - idx} left</span></div>
      <p className="lead" style={{ marginBottom: 12 }}>Every word and phrase in the course, filtered by type and chapter. How you grade each card sets when it comes back.</p>
      {Filters}
      {u.type === "pool" ? (
        u.item.kind === "grammar"
          ? <GrammarCard key={u.key} item={u.item} onGrade={(ok) => gradePool(u.item, ok)} />
          : <PhraseCard key={u.key} item={u.item} onGrade={(ok) => gradePool(u.item, ok)} />
      ) : (
        <ClozeCard key={u.key} entry={u.entry} context={progress.contexts?.[u.key]} contextGloss={progress.contextGlosses?.[u.key] ?? (progress.contexts?.[u.key] ? lineGlosses.get(progress.contexts[u.key]!.trim()) : undefined)} onGrade={(ok) => gradeCaptured(u.key, ok)} />
      )}
    </section>
  );
}
