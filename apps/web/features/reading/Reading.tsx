"use client";
import { useEffect, useState } from "react";
import * as familiarity from "@ll/core/familiarity";
import * as scoring from "@ll/core/familiarity/scoring";
import * as api from "../../lib/api";
import { type Progress } from "../../lib/store";
import { captureWord, properNounLike, toggleStar } from "../../lib/capture";
import * as live from "@ll/core/live";
import { pending, usePack, usePlay, wordStatus } from "../shared";

// ---------- Library view 4: reading (tap-to-capture + import-anything) ----------
export function Reading({ progress, persist, config }: { progress: Progress; persist: (p: Progress) => void; config: api.Config | null }) {
  const pack = usePack();
  const play = usePlay();
  const [readerId] = useState(() => { const id = pending.readerId; pending.readerId = null; return id; });
  const r = pack.readers.find((x) => x.id === readerId) ?? pack.readers[0];
  const [sel, setSel] = useState<{ lexKey: string; surface: string; line: string } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [raw, setRaw] = useState("");
  const [imported, setImported] = useState<api.ImportResponse | null>(null);
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState("");

  const onTap = (surface: string, line: string, lineGloss?: string) => {
    const lexKey = captureWord(progress, persist, surface, line, { gloss: lineGloss, reviewable: !properNounLike(surface, pack) });
    if (lexKey) setSel({ lexKey, surface, line });
  };

  const doImport = async () => {
    if (!raw.trim()) return;
    setImporting(true);
    setImportErr("");
    try {
      const res = await api.importText(raw, pack.id);
      if (res.error) throw new Error(res.error);
      setImported(res);
      setShowImport(false);
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  // Active content: imported text (gated) if present, else the built-in reader.
  const lines = imported ? imported.segments : r ? r.body.map((b) => ({ text: b.text, gloss: b.gloss, translit: b.translit ?? "" })) : [];
  const score = scoring.scoreText(lines.map((l) => l.text).join(" "), progress.familiarity);

  return (
    <section className="view">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>Reading {imported ? <span className="muted small">· imported <span className="badge warn">unreviewed</span></span> : r ? <span className="muted small">— {r.title}</span> : ""}</h2>
        <button className="ghost small" onClick={() => setShowImport((s) => !s)}>＋ Import text</button>
      </div>
      {showImport && (
        <div className="fb">
          <textarea className="text" style={{ width: "100%", minHeight: 80 }} placeholder={`Paste ${pack.name} text — it's segmented, translated, and difficulty-scored for you…`} value={raw} onChange={(e) => setRaw(e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={doImport} disabled={importing || !config?.engines.anthropic}>{importing ? "Importing…" : "Import"}</button>
            {!config?.engines.anthropic && <span className="muted small">Claude not configured</span>}
          </div>
          {importErr && <div className="err">{importErr}</div>}
        </div>
      )}
      <p className="lead">
        Tap any word to look it up — it joins your vocabulary. <b>{lines.length ? Math.round(score.knownPct * 100) : 0}% known</b> for you.
      </p>
      <HighlightLegend />
      <div className="reader">
        {lines.length === 0 ? (
          <p className="muted">No content yet — import some text above.</p>
        ) : (
          lines.map((l, i) => <ReaderRow key={i} line={l} progress={progress} play={play} onTapWord={(s) => onTap(s, l.text, l.gloss)} />)
        )}
      </div>
      {imported && <button className="ghost small" style={{ marginTop: 10 }} onClick={() => { setImported(null); setRaw(""); }}>↺ Back to the built-in reader</button>}
      {sel && <WordPanel key={sel.lexKey} sel={sel} progress={progress} persist={persist} config={config} onClose={() => setSel(null)} />}
    </section>
  );
}
export function ReaderRow({ line, progress, play, onTapWord }: { line: { text: string; gloss: string; translit?: string }; progress: Progress; play: (t: string, s?: number) => void; onTapWord: (s: string) => void }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="rline2">
      <button className="spk" onClick={() => play(line.text, 0.85)}>🔊</button>
      <TappableText text={line.text} progress={progress} onTapWord={onTapWord} />
      {revealed ? <span className="muted small" style={{ marginLeft: 8 }}>· {line.gloss}</span> : <button className="ghost small" style={{ marginLeft: 8 }} onClick={() => setRevealed(true)}>translate</button>}
    </div>
  );
}
export function WordToken({ surface, status, onTap }: { surface: string; status: string; onTap: () => void }) {
  return <span className={`tok ${status}`} onClick={onTap}>{surface}</span>;
}
// A key to the word colors, shared by every tap-to-read view. Also explains the state change on tap
// (a blue "new" word turns yellow once you've met it) so the shifting highlights don't look random.
export function HighlightLegend() {
  return (
    <p className="small muted" style={{ margin: "2px 0 0", lineHeight: 1.7 }}>
      <span className="tok new">new</span> not met yet ·{" "}
      <span className="tok learning">learning</span> in your reviews ·{" "}
      <span className="tok known">known</span> mastered (no highlight) ·{" "}
      <span className="tok ignored">Name</span> skipped.{" "}
      Tapping a <span className="tok new">new</span> word looks it up and starts learning it — so it turns{" "}
      <span className="tok learning">yellow</span>.
    </p>
  );
}
// Renders a line as tappable, status-colored word tokens. Shared by the reader + the story player.
export function TappableText({ text, progress, onTapWord, focus }: { text: string; progress: Progress; onTapWord: (surface: string) => void; focus?: string[] }) {
  return (
    <span className="rtext">
      {scoring.tokenize(text).map((t, j) =>
        t.isWord ? (
          <WordToken key={j} surface={t.surface} status={`${wordStatus(progress, t.lexKey)}${focus?.includes(t.surface) ? " focus" : ""}`} onTap={() => onTapWord(t.surface)} />
        ) : (
          <span key={j}>{t.surface}</span>
        ),
      )}
    </span>
  );
}
export function WordPanel({ sel, progress, persist, config, onClose }: {
  sel: { lexKey: string; surface: string; line: string };
  progress: Progress;
  persist: (p: Progress) => void;
  config: api.Config | null;
  onClose: () => void;
}) {
  const pack = usePack();
  const play = usePlay();
  const [g, setG] = useState<api.GlossResponse | null>(null);
  const [spin, setSpin] = useState(false);
  useEffect(() => {
    let live = true;
    setG(null);
    setSpin(true);
    api.gloss(sel.surface, sel.line, pack.id).then((r) => { if (live) setG(r); }).catch(() => {}).finally(() => { if (live) setSpin(false); });
    return () => { live = false; };
  }, [sel.surface, sel.line, pack.id]);

  const entry = progress.familiarity[sel.lexKey];
  const starred = !!entry && familiarity.isStarred(entry);
  const setStat = (status: "known" | "ignored") => {
    const e = entry ?? familiarity.capture({ lexKey: sel.lexKey, kind: "word", display: sel.surface });
    persist({ ...progress, familiarity: { ...progress.familiarity, [sel.lexKey]: familiarity.setStatus(e, status) } });
    onClose();
  };
  // Save/unsave to the custom deck — remembers the sentence + its English (once we have the gloss) so this
  // word reviews in context. Keeps the panel open so the ★ state visibly flips.
  const star = () => toggleStar(progress, persist, sel.surface, { gloss: g?.gloss || undefined, context: sel.line });

  return (
    <div className="wordpanel">
      <div className="row">
        <b className="target" style={{ fontSize: 20 }}>{sel.surface}</b>
        <button className="spk" onClick={() => play(sel.surface, 0.8)}>🔊</button>
        <button className="ghost small" style={{ marginLeft: "auto" }} onClick={onClose}>✕</button>
      </div>
      {spin ? (
        <div className="spin">Looking up…</div>
      ) : g?.gloss ? (
        <div style={{ marginTop: 4 }}>
          {g.translit && <span className="translit">{g.translit} · </span>}
          <span style={{ fontSize: 16 }}>{g.gloss}</span>
          <span className="muted small"> ({g.source})</span>
        </div>
      ) : (
        <div className="muted small" style={{ marginTop: 4 }}>{config?.engines.anthropic ? "No translation found." : "Translation needs Claude configured."}</div>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button className={`ghost${starred ? " active" : ""}`} onClick={star} title="Save to your flashcard deck">{starred ? "★ Saved" : "☆ Save"}</button>
        <button className="ghost" onClick={() => setStat("known")}>✓ Known</button>
        <button className="ghost" onClick={() => setStat("ignored")}>✕ Ignore</button>
        <span className="muted small">{entry ? `tracked · ${entry.status}` : "captured"}</span>
      </div>
    </div>
  );
}
