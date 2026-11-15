"use client";
// Library → Reference → Verb patterns (batch 3, 2026-11-14). The six ways Macedonian makes its tenses, each with
// its endings, the verbs you know that follow it and when to use it; "Practise this pattern" once the course has
// taught it; and every verb's full table, in its aspect pair. Generic: it reads pack.verbPatterns / pack.verbs.
import { useEffect, useMemo, useState } from "react";
import type { VerbEntry, VerbPattern, VerbPerson, VerbTense } from "@ll/pack-schema";
import { type Progress } from "../../lib/store";
import * as vd from "../../lib/verb-drills";
import { pending, usePack } from "../shared";
import { VerbDrill } from "./VerbDrill";

const TENSES: { t: VerbTense; label: string }[] = [
  { t: "present", label: "Now" },
  { t: "pastOngoing", label: "Past, ongoing" },
  { t: "pastDone", label: "Past, done" },
  { t: "future", label: "Later" },
  { t: "haveDone", label: "Have done" },
];
const PERSONS: VerbPerson[] = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"];
const WHO: Record<VerbPerson, string> = { "1sg": "јас · I", "2sg": "ти · you", "3sg": "таа · she", "1pl": "ние · we", "2pl": "вие · you all", "3pl": "тие · they" };
const COMMAND_WHO: Partial<Record<VerbPerson, string>> = { "2sg": "one friend", "2pl": "several, or polite" };
/** A form as the table shows it: "have done" in the singular gives a man's and a woman's -л form (сум дошол /
 *  дошла), since таа, "she", heads the row. */
function withFeminine(t: VerbTense, x: VerbPerson, v: VerbEntry): string {
  const f = v.forms[t]?.[x];
  if (!f) return "–";
  return t === "haveDone" && x.endsWith("sg") && v.lform ? `${f} / ${v.lform.f}` : f;
}
const ASPECT = { ongoing: "ongoing", done: "done (once, finished)", both: "both ongoing and done" };

export function VerbPatterns({ progress, persist }: { progress: Progress; persist: (p: Progress) => void }) {
  const pack = usePack();
  const patterns = pack.verbPatterns ?? [];
  const verbs = pack.verbs ?? [];
  const known = useMemo(() => vd.knownVerbs(pack, progress), [pack, progress]);
  const unlocked = useMemo(() => new Set(vd.unlockedVariants(pack, progress).map((v) => v.variant.id)), [pack, progress]);
  const [practising, setPractising] = useState<{ id: string; questions: vd.VerbQuestion[] } | null>(null);
  const [lastGo, setLastGo] = useState<Record<string, { got: number; total: number }>>({});
  const [verb, setVerb] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  // Opened from a grammar point: scroll to its pattern.
  useEffect(() => { const id = pending.verbPattern; pending.verbPattern = null; if (id) document.getElementById(`pattern-${id}`)?.scrollIntoView({ block: "start" }); }, []);

  if (!patterns.length) return <p className="lead">No verb patterns for this language yet.</p>;
  const byLemma = new Map(verbs.map((v) => [v.lemma, v]));
  const open = verb ? byLemma.get(verb) : undefined;
  if (open) return <VerbTable v={open} known={known.has(open.lemma)} partner={open.partner ? byLemma.get(open.partner) : undefined} patterns={patterns} onOpen={setVerb} onBack={() => setVerb(null)} />;

  const practise = (p: VerbPattern) => {
    const only = p.variants.map((v) => v.id).filter((id) => unlocked.has(id));
    const questions = vd.buildVerbDrill(pack, progress, { size: 5, only, seed: Object.keys(progress.verbPractice ?? {}).length + Date.now() % 97 });
    if (questions.length) setPractising({ id: p.id, questions });
  };
  const shownVerbs = verbs.filter((v) => !filter.trim() || v.lemma.includes(filter.trim()) || v.gloss.toLowerCase().includes(filter.trim().toLowerCase()))
    .sort((a, b) => Number(known.has(b.lemma)) - Number(known.has(a.lemma)));

  return (
    <section className="view">
      <h2>Verb patterns</h2>
      <p className="lead">Macedonian makes each tense the same way for most verbs. Learn a pattern once and you can use it with every verb that follows it: the examples are verbs you know.</p>

      {patterns.map((p) => {
        const chapter = vd.chapterOfPoint(pack, p.pointId);
        const taught = p.variants.some((v) => unlocked.has(v.id));
        const strength = p.variants.map((v) => vd.variantStrength(progress, v.id)).filter((s): s is { right: number; wrong: number } => !!s)
          .reduce<{ right: number; wrong: number } | undefined>((a, s) => ({ right: (a?.right ?? 0) + s.right, wrong: (a?.wrong ?? 0) + s.wrong }), undefined);
        if (practising?.id === p.id)
          return (
            <div key={p.id} style={{ margin: "18px 0" }}>
              <VerbDrill
                questions={practising.questions}
                lead={`Practise: ${p.title}`}
                onDone={(rs) => { persist(vd.recordVerbResults(progress, rs)); setLastGo((g) => ({ ...g, [p.id]: { got: rs.filter((r) => r.ok).length, total: rs.length } })); setPractising(null); }}
              />
              <button className="quiet" onClick={() => setPractising(null)}>Stop</button>
            </div>
          );
        return (
          <div key={p.id} className="framed write-card verb-pattern" id={`pattern-${p.id}`}>
            <div className="recap-head">
              <div className="overline">{chapter ? `Chapter ${chapter}` : "Verbs"}{!taught && chapter ? " · coming up" : ""}</div>
              {strength && <span className="muted small">{strength.right} of {strength.right + strength.wrong} right first time</span>}
            </div>
            <h3 style={{ margin: "4px 0 6px" }}>{p.title}</h3>
            <p style={{ margin: "0 0 4px" }}>{p.how}</p>
            <p className="muted small" style={{ margin: "0 0 10px" }}><b>When:</b> {p.when}</p>
            {p.variants.map((variant) => {
              const followers = vd.followers(pack, { pattern: p, variant }).sort((a, b) => Number(known.has(b.lemma)) - Number(known.has(a.lemma)));
              const examples = followers.slice(0, 3);
              const persons = PERSONS.filter((x) => variant.endings[x] !== undefined);
              return (
                <div key={variant.id} style={{ marginTop: 10 }}>
                  {p.variants.length > 1 && <div className="activity-sub" style={{ marginBottom: 2 }}><b>{variant.label}</b></div>}
                  <div className="muted small" style={{ marginBottom: 4 }}>{variant.spot}</div>
                  <div className="verb-table-scroll">
                    <table className="gram-table verb-endings">
                      <thead><tr><th>{p.tense === "command" ? "To" : "Who"}</th><th>Ending</th>{examples.map((v) => <th key={v.lemma} lang={pack.id}>{v.lemma}</th>)}</tr></thead>
                      <tbody>
                        {persons.map((x) => (
                          <tr key={x}>
                            <td className="small">{p.tense === "command" ? COMMAND_WHO[x] : WHO[x]}</td>
                            <td lang={pack.id}><b>{variant.endings[x]}</b></td>
                            {examples.map((v) => <td key={v.lemma} lang={pack.id}>{withFeminine(p.tense, x, v)}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {followers.length > examples.length && (
                    <div className="muted small">Also: {followers.slice(examples.length).map((v, i) => (
                      <span key={v.lemma}>{i ? ", " : ""}<button className="linklike" lang={pack.id} onClick={() => setVerb(v.lemma)}>{v.lemma}</button></span>
                    ))}</div>
                  )}
                </div>
              );
            })}
            {p.notes?.length ? <ul className="small verb-notes">{p.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
            <div className="write-actions">
              {taught
                ? <button className="btn ghost" onClick={() => practise(p)}>Practise this pattern</button>
                : <span className="muted small">You&apos;ll practise this once chapter {chapter} teaches it.</span>}
              {lastGo[p.id] && <span className="result-ok small">{lastGo[p.id]!.got} of {lastGo[p.id]!.total} right</span>}
            </div>
          </div>
        );
      })}

      <h3 style={{ marginTop: 28 }}>Look up a verb</h3>
      <p className="muted small" style={{ marginTop: 0 }}>Every verb in the course, with its forms in each tense and the other half of its pair. The ones you know come first.</p>
      <input className="text" aria-label="Search verbs" placeholder="Search: гледа, or “watch”" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: "100%", maxWidth: 360, marginBottom: 10 }} />
      <div className="lib-list">
        {shownVerbs.map((v) => (
          <button className="lib-item plain" key={v.lemma} onClick={() => setVerb(v.lemma)}>
            <span><span className="lib-title" lang={pack.id}>{v.lemma}{v.partner ? <span className="muted"> · {v.partner}</span> : null}</span><span className="lib-sub">{v.gloss}</span></span>
            <span className="lib-fit just">{known.has(v.lemma) ? "known" : ""}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function VerbTable({ v, known, partner, patterns, onOpen, onBack }: { v: VerbEntry; known: boolean; partner?: VerbEntry; patterns: VerbPattern[]; onOpen: (lemma: string) => void; onBack: () => void }) {
  const pack = usePack();
  const label = (t: VerbTense) => {
    const id = v.patterns[t];
    if (id === "irregular") return t === "haveDone" ? "its -л form is its own" : "learnt on its own";
    for (const p of patterns) { const x = p.variants.find((y) => y.id === id); if (x) return p.variants.length > 1 ? x.label : ""; }
    return "";
  };
  return (
    <section className="view">
      <div className="row" style={{ marginBottom: 10 }}><button className="ghost small" onClick={onBack}>← Verb patterns</button></div>
      <h2 lang={pack.id} style={{ marginBottom: 2 }}>{v.lemma}</h2>
      <p className="lead" style={{ marginTop: 0 }}>{v.gloss} · {ASPECT[v.aspect]}{known ? "" : " · not in your lessons yet"}</p>
      {partner && (
        <p className="small">Its pair: <button className="linklike" lang={pack.id} onClick={() => onOpen(partner.lemma)}>{partner.lemma}</button> ({partner.gloss}, {ASPECT[partner.aspect]}). {v.aspect === "ongoing" ? "Use this one for habits and things going on; the other for one finished action." : "Use this one for one finished action; the other for habits and things going on."}</p>
      )}
      {v.note && <p className="small">{v.note}</p>}
      {v.impersonal && <p className="small">Used only in the he/she and they forms (ми треба, тие чинат), so it isn&apos;t drilled across persons.</p>}
      {v.aspect === "done" && <p className="muted small">A done verb&apos;s present only comes after да or ќе: Сакам да {v.forms.present?.["1sg"]}, Ќе {v.forms.present?.["1sg"]}.</p>}
      <div className="verb-tenses">
        {TENSES.filter(({ t }) => v.forms[t]).map(({ t, label: name }) => (
          <div key={t} className="framed verb-tense">
            <div className="overline">{name}{label(t) ? ` · ${label(t)}` : ""}</div>
            <table className="gram-table">
              <tbody>
                {PERSONS.filter((x) => v.forms[t]![x]).map((x) => (
                  <tr key={x}><td className="small">{WHO[x]}</td><td lang={pack.id}>{withFeminine(t, x, v)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {v.forms.command && (
          <div className="framed verb-tense">
            <div className="overline">Commands{label("command") ? ` · ${label("command")}` : ""}</div>
            <table className="gram-table"><tbody>
              {(["2sg", "2pl"] as const).map((x) => <tr key={x}><td className="small">{COMMAND_WHO[x]}</td><td lang={pack.id}>{v.forms.command![x]}</td></tr>)}
            </tbody></table>
          </div>
        )}
        {v.lform && !v.impersonal && (
          <div className="framed verb-tense">
            <div className="overline">The -л form</div>
            <table className="gram-table"><tbody>
              <tr><td className="small">a man</td><td lang={pack.id}>{v.lform.m}</td></tr>
              <tr><td className="small">a woman</td><td lang={pack.id}>{v.lform.f}</td></tr>
              <tr><td className="small">it</td><td lang={pack.id}>{v.lform.n}</td></tr>
              <tr><td className="small">several</td><td lang={pack.id}>{v.lform.pl}</td></tr>
            </tbody></table>
          </div>
        )}
      </div>
      {v.confidence !== "validated" && <p className="muted small" style={{ marginTop: 12 }}>Made by the pattern rules and checked against a dictionary; not yet reviewed by a native speaker.</p>}
    </section>
  );
}
