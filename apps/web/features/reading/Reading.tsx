"use client";
import { useEffect, useState } from "react";
import * as familiarity from "@ll/core/familiarity";
import * as scoring from "@ll/core/familiarity/scoring";
import * as api from "../../lib/api";
import { type Progress } from "../../lib/store";
import { captureWord, properNounLike, toggleStar } from "../../lib/capture";
import * as live from "@ll/core/live";
import { Icon, MixedText, SpeakButton, pending, usePack, usePlay, wordStatus } from "../shared";

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
      <div className="activity-head" style={{ marginTop: 12, borderBottom: 0, paddingBottom: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div className="overline">Reading</div>
          <h2 style={{ margin: "4px 0 2px" }}>{imported ? "Your text" : r ? <MixedText text={r.title} /> : "Reading"}</h2>
          {imported && <span className="badge warn">Imported · not reviewed yet</span>}
        </div>
        <button className="ghost small" aria-expanded={showImport} onClick={() => setShowImport((s) => !s)}><Icon name="plus" size={14} />Import text</button>
      </div>
      {showImport && (
        <div className="framed write-card" style={{ marginBottom: 14 }}>
          <div className="overline">Import text</div>
          <textarea className="text" aria-label={`${pack.name} text to import`} style={{ width: "100%", minHeight: 90, marginTop: 10 }} placeholder={`Paste ${pack.name} text. It's split into lines, translated and scored for difficulty.`} value={raw} onChange={(e) => setRaw(e.target.value)} />
          <div className="write-actions">
            <button className="btn" onClick={doImport} disabled={importing || !config?.engines.anthropic}>{importing ? "Importing…" : "Import"}</button>
            {!config?.engines.anthropic && <span className="muted small">Importing isn&apos;t available right now.</span>}
          </div>
          {importErr && <div className="err">{importErr}</div>}
        </div>
      )}
      <p className="lead">
        Tap any word to look it up: it joins your vocabulary. <b>{lines.length ? Math.round(score.knownPct * 100) : 0}% known</b> for you.
      </p>
      <HighlightLegend />
      <div className="reader">
        {lines.length === 0 ? (
          <p className="muted">Nothing to read yet: import some text above.</p>
        ) : (
          lines.map((l, i) => <ReaderRow key={i} line={l} progress={progress} play={play} onTapWord={(s) => onTap(s, l.text, l.gloss)} />)
        )}
      </div>
      {imported && <button className="ghost small" style={{ marginTop: 10 }} onClick={() => { setImported(null); setRaw(""); }}><Icon name="restart" size={14} />Back to the built-in reader</button>}
      {sel && <WordPanel key={sel.lexKey} sel={sel} progress={progress} persist={persist} config={config} onClose={() => setSel(null)} />}
    </section>
  );
}
export function ReaderRow({ line, progress, play, onTapWord }: { line: { text: string; gloss: string; translit?: string }; progress: Progress; play: (t: string, s?: number) => void; onTapWord: (s: string) => void }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="rline2">
      <SpeakButton label="Play this line" onClick={() => play(line.text, 0.85)} />
      <TappableText text={line.text} progress={progress} onTapWord={onTapWord} />
      {revealed ? <span className="gloss small" style={{ marginLeft: 8 }}>{line.gloss}</span> : <button className="quiet" style={{ marginLeft: 8 }} onClick={() => setRevealed(true)}>Translate</button>}
    </div>
  );
}
export function WordToken({ surface, status, onTap }: { surface: string; status: string; onTap: () => void }) {
  return <span className={`tok ${status}`} onClick={onTap}>{surface}</span>;
}
// A key to the word marks, shared by every tap-to-read view. Also explains the change on tap (a new word
// moves to learning once you've met it) so the shifting marks don't look random.
export function HighlightLegend() {
  return (
    <p className="small muted legend">
      <span className="tok new">new</span> not met yet · <span className="tok learning">learning</span> in your reviews ·
      known words have no mark · <span className="tok ignored">names</span> are skipped. Tap a word to look it up;
      a new word then moves to learning.
    </p>
  );
}
// Renders a line as tappable, status-colored word tokens. Shared by the reader + the story player.
export function TappableText({ text, progress, onTapWord, focus }: { text: string; progress: Progress; onTapWord: (surface: string) => void; focus?: string[] }) {
  const pack = usePack();
  return (
    <span className="rtext" lang={pack.id}>
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
    <section className="wordpanel" aria-label={`${sel.surface}: ${g?.gloss ?? "looking up"}`}>
      <div className="word-head">
        <div style={{ minWidth: 0 }}>
          <div className="word-big" lang={pack.id}>{sel.surface}</div>
          {spin ? (
            <div className="spin" style={{ marginTop: 2 }}>Looking it up…</div>
          ) : g?.gloss ? (
            <>
              {g.translit && <div className="translit">{g.translit}</div>}
              <div className="word-gloss gloss">{g.gloss}</div>
            </>
          ) : (
            <div className="muted small" style={{ marginTop: 4 }}>{config?.engines.anthropic ? "No translation found." : "Translations aren't available right now."}</div>
          )}
        </div>
        <SpeakButton label={`Play ${sel.surface}`} onClick={() => play(sel.surface, 0.8)} />
        <button className="icon-close" aria-label="Close" onClick={onClose}><Icon name="close" size={16} /></button>
      </div>
      <div className="word-actions">
        <button className={`ghost${starred ? " active" : ""}`} aria-pressed={starred} onClick={star} title="Save to your flashcard deck">
          <Icon name={starred ? "check" : "plus"} size={16} />{starred ? "In your flashcards" : "Add to flashcards"}
        </button>
        <button className="ghost" onClick={() => setStat("known")}>I know it</button>
        <button className="ghost" onClick={() => setStat("ignored")}>Ignore</button>
      </div>
      <div className="muted small" style={{ marginTop: 10 }}>
        {entry ? (entry.status === "learning" ? "In your reviews" : entry.status === "known" ? "You know this one" : entry.status === "ignored" ? "Not in your reviews" : "Just met") : "Just met"}
        {g?.gloss ? (g.source === "llm" || g.source === "cache" ? " · machine translation" : " · from the course") : ""}
      </div>
    </section>
  );
}
