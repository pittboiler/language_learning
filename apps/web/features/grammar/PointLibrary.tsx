"use client";
import { useEffect, useMemo, useState } from "react";
import type { GrammarPoint, ReviewItem } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import { type Progress } from "../../lib/store";
import { starMany } from "../../lib/capture";
import * as cp from "../../lib/course-player";
import { GrammarExplainer } from "./GrammarCards";
import { NoteAt, gradeItem, pending, usePack, usePlay } from "../shared";

// ---------- Library view 3: grammar (full reference) ----------
// Set by Today's agenda link so the Library opens straight onto that grammar point.

// The Library's grammar, new course (DESIGN §7): one page per point, grouped by chapter. Points you've been
// taught are marked; upcoming ones are greyed but readable. Each page holds the full rule, the "why is it
// like this" notes, common mistakes, the examples (plus every line from stories you've read that uses it),
// the set phrases it explains, and its flashcards to save or try.
export function PointLibrary({ progress, persist, openNotes }: { progress: Progress; persist: (p: Progress) => void; openNotes?: (at: NoteAt) => void }) {
  const pack = usePack();
  const play = usePlay();
  const course = pack.course!;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(() => { const f = pending.pointFocus; pending.pointFocus = null; return f; });
  useEffect(() => { if (open) document.getElementById(`pt-${open}`)?.scrollIntoView({ block: "start" }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const needle = q.trim().toLowerCase();
  const matches = (p: GrammarPoint) => !needle || `${p.title} ${p.rule} ${p.library.rule} ${p.library.why.join(" ")}`.toLowerCase().includes(needle);
  const readStories = new Set(Object.entries(progress.storyReads ?? {}).filter(([, d]) => d.length).map(([id]) => id));
  const starred = (k: string) => { const e = progress.familiarity[k]; return !!e && familiarity.isStarred(e); };
  // The session that taught each point, for "your notes from that lesson".
  const taughtIn = useMemo(() => new Map([...cp.pointSlots(course)].map(([id, at]) => [id, { ...at, chapterId: course.chapters.find((c) => c.order === at.order)?.chapterId ?? "" }])), [course]);
  const LineRow = ({ l }: { l: { text: string; gloss: string; source: string } }) => (
    <div className="gram-ex">
      <button className="gram-play" onClick={() => play(l.text)} aria-label={`Play ${l.text}`}>▶</button>
      <span className="mk">{l.text}</span><span className="en">{l.gloss}</span>
    </div>
  );
  return (
    <section className="view">
      <h2>Grammar</h2>
      <p className="lead">Every grammar point in the course, chapter by chapter. Your daily sessions teach them in order; this is where to read more or look something up.</p>
      <input className="text" placeholder="Search grammar…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", marginBottom: 14 }} />
      {course.chapters.map((cc, ci) => {
        const ch = pack.chapters?.find((c) => c.id === cc.chapterId);
        const pts = cc.pointIds.map((id) => course.points.find((p) => p.id === id)).filter((p): p is GrammarPoint => !!p && matches(p));
        if (!pts.length) return null;
        return (
          <div key={cc.chapterId} style={{ marginBottom: 14 }}>
            <div className="muted small" style={{ textTransform: "uppercase", letterSpacing: 0.5, margin: "6px 0" }}>Chapter {ch?.order ?? ci + 1} · {ch?.shortTitle}</div>
            {pts.map((p) => {
              const learned = !!progress.seenGrammar?.[p.id];
              const isOpen = open === p.id;
              const fromReading = (pack.stories ?? []).filter((st) => readStories.has(st.id)).flatMap((st) =>
                st.body.flatMap((b, i) => (course.lineTags[`story:${st.id}#${i}`] ?? []).includes(p.id) ? [{ text: b.text, gloss: b.gloss, source: `story:${st.id}#${i}` }] : []))
                .filter((l) => !p.examples.some((e) => e.text === l.text)).slice(0, 8);
              const cards = cp.pointItems(p);
              return (
                <div className="concept" key={p.id} id={`pt-${p.id}`} style={learned ? undefined : { opacity: 0.7 }}>
                  <button className="concept-head" onClick={() => setOpen(isOpen ? null : p.id)}>
                    <span>{learned ? "✓ " : ""}{p.title}{p.depth === "recognize" ? <span className="muted small"> · recognize</span> : null}</span>
                    <span className="muted">{learned ? "" : "upcoming "}{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && (
                    <div style={{ marginTop: 10 }}>
                      {learned && openNotes && taughtIn.get(p.id) && (
                        <p className="muted small" style={{ marginTop: 0 }}>
                          Taught in chapter {taughtIn.get(p.id)!.order}, session {taughtIn.get(p.id)!.n} ·{" "}
                          <button className="linklike small" onClick={() => openNotes({ chapterId: taughtIn.get(p.id)!.chapterId, n: taughtIn.get(p.id)!.n })}>your notes from that lesson</button>
                        </p>
                      )}
                      <p style={{ marginTop: 0 }}>{p.library.rule}</p>
                      <div className="gram-kicker" style={{ marginTop: 10 }}>Why it&apos;s like this</div>
                      <ul style={{ margin: "4px 0", paddingLeft: 18 }}>{p.library.why.map((w, i) => <li key={i} style={{ margin: "4px 0" }}>{w}</li>)}</ul>
                      <div className="gram-kicker" style={{ marginTop: 10 }}>Common mistakes</div>
                      <ul style={{ margin: "4px 0", paddingLeft: 18 }}>{p.library.mistakes.map((w, i) => <li key={i} style={{ margin: "4px 0" }}>{w}</li>)}</ul>
                      <div className="gram-kicker" style={{ marginTop: 10 }}>Examples</div>
                      <div className="gram-ex-list">{p.examples.map((l) => <LineRow key={l.source} l={l} />)}</div>
                      {fromReading.length > 0 && (
                        <>
                          <div className="gram-kicker" style={{ marginTop: 10 }}>In stories you&apos;ve read</div>
                          <div className="gram-ex-list">{fromReading.map((l) => <LineRow key={l.source} l={l} />)}</div>
                        </>
                      )}
                      {p.callbacks.length > 0 && (
                        <>
                          <div className="gram-kicker" style={{ marginTop: 10 }}>Set phrases it explains</div>
                          <div className="gram-ex-list">{p.callbacks.map((l) => <LineRow key={l.source} l={l} />)}</div>
                        </>
                      )}
                      <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
                        <div className="gram-kicker">Flashcards · {cards.length}</div>
                        <button className="ghost small" onClick={() => persist(starMany(progress, cards.map((c) => ({ lexKey: familiarity.deriveKeyForItem(c).lexKey, display: c.prompt, gloss: c.gloss }))))}>
                          {cards.every((c) => starred(familiarity.deriveKeyForItem(c).lexKey)) ? "★ All saved" : "★ Save all"}
                        </button>
                      </div>
                      <div className="gram-checks">
                        {cards.filter((c) => !c.meta?.ruleCard).map((c) => <Drill key={c.id} drill={c} onGrade={(ok) => persist(gradeItem(progress, c, ok))} />)}
                        {cards.filter((c) => c.meta?.ruleCard).map((c) => <div key={c.id} className="small" style={{ margin: "6px 0" }}><b>{c.prompt}</b> <span className="muted">— {c.answer}</span></div>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
export function Grammar({ progress, persist }: { progress: Progress; persist: (p: Progress) => void }) {
  const pack = usePack();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const grade = (item: ReviewItem, correct: boolean) => persist(gradeItem(progress, item, correct));
  const needle = q.trim().toLowerCase();
  const concepts = pack.grammar.filter((c) => !needle || `${c.name} ${c.technicalName ?? ""} ${c.plain ?? ""} ${c.explanation}`.toLowerCase().includes(needle));
  return (
    <section className="view">
      <h2>Grammar reference</h2>
      <p className="lead">New concepts are taught inside your daily session — this is the reference to look anything up. Search, or tap a point to expand the rule and drill it.</p>
      <input className="text" placeholder="Search grammar…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", marginBottom: 14 }} />
      {concepts.length === 0 && <p className="muted">No grammar point matches “{q}”.</p>}
      {concepts.map((c) => {
        const isOpen = open === c.id;
        return (
          <div className="concept" key={c.id}>
            <button className="concept-head" onClick={() => setOpen(isOpen ? null : c.id)}>
              <span>{c.name}</span>
              <span className="muted">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div style={{ marginTop: 10 }}>
                {c.technicalName && <div className="gram-tech" style={{ marginTop: -4 }}>{c.technicalName}</div>}
                <GrammarExplainer concept={c} />
                <div className="gram-checks">
                  {c.drills.map((d) => <Drill key={d.id} drill={d} onGrade={(ok) => grade(d, ok)} />)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
export function Drill({ drill, onGrade }: { drill: ReviewItem; onGrade: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    onGrade(opt === drill.answer);
  };
  return (
    <div>
      <div className="small" style={{ margin: "8px 0 4px" }}><b>{drill.prompt}</b></div>
      {/* A blank card's English disambiguates it ("Морам да ___" has one answer once you see "I have to go"). */}
      {drill.meta?.point ? <div className="muted small" style={{ marginBottom: 4 }}>{drill.gloss}</div> : null}
      <div>
        {(drill.options ?? []).map((o) => {
          const cls = picked ? (o === drill.answer ? "opt right" : o === picked ? "opt wrong" : "opt") : "opt";
          return <button className={cls} key={o} disabled={!!picked} onClick={() => choose(o)}>{o}</button>;
        })}
      </div>
      {picked && <div className="why">{picked === drill.answer ? "✓ " : "✗ "}{drill.why}</div>}
    </div>
  );
}
