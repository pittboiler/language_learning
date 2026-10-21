"use client";
import { useCallback, useEffect, useState } from "react";
import * as familiarity from "@ll/core/familiarity";
import * as api from "../../lib/api";
import { type Progress } from "../../lib/store";
import { localDay } from "../../lib/daily";
import { type PartnerStore, type PartnerArtifact } from "../../lib/partner-store";
import { coverageOf, usePack } from "../shared";

// Shared story (Phase 1): the pace-handicapping mechanic made concrete — both partners read the SAME
// mini-story (shared experience → conversation fuel), each at their own level (per-partner coverage,
// tap-to-capture, Q&A). The selection is a partner_artifact; reading reuses the existing StoryView.
export function SharedStory({ store, partnershipId, packId, progress, navigateToStory }: {
  store: PartnerStore;
  partnershipId: string;
  packId: string;
  progress: Progress;
  navigateToStory: (storyId: string) => void;
}) {
  const pack = usePack();
  const stories = pack.stories ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const arts = await store.listArtifacts(partnershipId, "shared-story");
      setPicked((arts[arts.length - 1]?.payload as { storyId?: string } | undefined)?.storyId ?? null);
    } catch {
      /* empty selection falls back to the first story */
    }
  }, [store, partnershipId]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!stories.length) return null;
  // Nothing shared yet: your current chapter's story rather than the pack's first one.
  const myStory = progress.course ? stories.find((s) => s.id === `gen-${progress.course!.chapterId}-story`) : undefined;
  const story = stories.find((s) => s.id === picked) ?? myStory ?? stories[0]!;
  const cov = coverageOf(story.body.map((b) => b.text).join(" "), progress.familiarity);

  const setShared = async (id: string) => {
    setBusy(true);
    try {
      await store.putArtifact(partnershipId, packId, "shared-story", { storyId: id, day: localDay() });
      setPicked(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="small">Shared story</span>
      <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
        <span><b>★ {story.title}</b>{story.titleGloss ? <span className="muted small"> — {story.titleGloss}</span> : null}</span>
        <span className="muted small">{Math.round(cov.familiarPct * 100)}% familiar to you</span>
      </div>
      <p className="muted small" style={{ margin: "4px 0 0" }}>You both read the same story at your own level — compare notes after.</p>
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn" onClick={() => navigateToStory(story.id)}>Read together →</button>
        {stories.length > 1 && (
          <select className="lang-picker" value={story.id} disabled={busy} onChange={(e) => setShared(e.target.value)} aria-label="Shared story">
            {stories.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}
// Co-created phrasebook (Phase 1): a shared, growing deck either partner adds to. Each entry is a
// partner_artifact (kind 'phrase'); tapping "＋ my reviews" seeds it into THIS learner's familiarity —
// so a phrase one partner overhears becomes review fuel for both. Reuses api.gloss + familiarity.capture.
export function Phrasebook({ store, partnershipId, packId, progress, persist }: {
  store: PartnerStore;
  partnershipId: string;
  packId: string;
  progress: Progress;
  persist: (p: Progress) => void;
}) {
  const [items, setItems] = useState<PartnerArtifact[]>([]);
  const [text, setText] = useState("");
  const [gloss, setGloss] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await store.listArtifacts(partnershipId, "phrase"));
    } catch {
      /* panel surfaces partner errors; an empty phrasebook is a safe fallback */
    }
  }, [store, partnershipId]);
  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    try {
      await store.putArtifact(partnershipId, packId, "phrase", { text: t, gloss: gloss.trim(), day: localDay() });
      setText("");
      setGloss("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const autoGloss = async () => {
    const t = text.trim();
    if (!t) return;
    const g = await api.gloss(t, "", packId);
    if (g.gloss) setGloss(g.gloss);
  };

  // Seed a phrase into the current learner's own familiarity (the cross-partner capture, §2 triage).
  const capture = (phrase: string, g?: string) => {
    const lexKey = familiarity.normalize(phrase);
    if (!lexKey || progress.familiarity[lexKey]) return;
    persist({ ...progress, familiarity: { ...progress.familiarity, [lexKey]: familiarity.capture({ lexKey, kind: "chunk", display: phrase, gloss: g }) } });
  };

  return (
    <div>
      <span className="small">Shared phrasebook</span>
      <div className="row" style={{ marginTop: 6 }}>
        <input className="lang-picker" style={{ minWidth: 150 }} placeholder="Phrase (target language)" value={text} onChange={(e) => setText(e.target.value)} />
        <input className="lang-picker" style={{ minWidth: 110 }} placeholder="meaning" value={gloss} onChange={(e) => setGloss(e.target.value)} />
        <button className="ghost small" disabled={busy || !text.trim()} onClick={autoGloss} title="Suggest a gloss">gloss?</button>
        <button className="btn" disabled={busy || !text.trim()} onClick={add}>Add</button>
      </div>
      {items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((it) => {
            const pl = it.payload as { text?: string; gloss?: string };
            const known = !!progress.familiarity[familiarity.normalize(pl.text ?? "")];
            return (
              <li key={it.id} className="row" style={{ justifyContent: "space-between" }}>
                <span><b>{pl.text}</b>{pl.gloss ? <span className="muted small"> — {pl.gloss}</span> : null}</span>
                <button className={`badge ${known ? "on" : ""}`} disabled={known} onClick={() => capture(pl.text ?? "", pl.gloss)} title="Add to my spaced-repetition reviews">
                  {known ? "in your reviews ✓" : "＋ my reviews"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
