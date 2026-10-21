"use client";
import { useCallback, useEffect, useState } from "react";
import * as familiarity from "@ll/core/familiarity";
import { type Progress } from "../../lib/store";
import { type PartnerStore, type PartnerArtifact } from "../../lib/partner-store";
import type { ComplementaryDiff } from "@ll/core/partner/familiarity-diff";
import * as teachback from "@ll/core/teachback";
import * as complementarySrs from "@ll/core/partner/complementary-srs";
import { blobToDataUrl, playDataUrl } from "./shared";
import { useRecorder } from "../shared";

// Familiarity-driven collaboration (Phase 2): one complementaryDiff over the two partners' gated
// familiarity projections, surfaced two ways — complementary review ("your partner knows this — ask
// them") and the protégé effect (record a short explanation of something you're ahead on). The
// teach-back recordings are 'teachback' partner_artifacts (audio as data-URLs, like role-swap).
export function FamiliarityCollab({ store, partnershipId, packId, myId, partnerId, diff, progress }: {
  store: PartnerStore;
  partnershipId: string;
  packId: string;
  myId: string;
  partnerId: string;
  diff: ComplementaryDiff | null;
  progress: Progress;
}) {
  const [inbox, setInbox] = useState<PartnerArtifact[]>([]);
  const [recKey, setRecKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const rec = useRecorder();

  const loadInbox = useCallback(async () => {
    try {
      setInbox(await store.listArtifacts(partnershipId, "teachback"));
    } catch {
      /* tolerate a missing list */
    }
  }, [store, partnershipId]);
  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  if (!diff) return <p className="muted small">Turn on “Vocabulary” sharing below to swap review help with your partner.</p>;

  const label = (lexKey: string) => progress.familiarity[lexKey]?.display ?? lexKey;
  // These surfaces are word/phrase oriented ("ask them", "record an explanation") — keep grammar patterns
  // out (they'd render as a raw drill prompt); words and chunks/phrases both flow through.
  const notGrammar = (lexKey: string) => progress.familiarity[lexKey]?.kind !== "grammar";
  const reviewHelp = complementarySrs.routeComplementary(familiarity.dueKeys(progress.familiarity), diff).filter((r) => notGrammar(r.lexKey)).slice(0, 6);
  const canHelp = diff.partnerCanHelpMe.filter((i) => notGrammar(i.lexKey)).slice(0, 8);
  const prompts = teachback.proposeTeachBacks(diff, myId, partnerId, { limit: 8 }).filter((p) => notGrammar(p.lexKey)).slice(0, 4);
  const taught = new Set(inbox.filter((a) => (a.payload as { teacher?: string }).teacher === myId).map((a) => (a.payload as { lexKey?: string }).lexKey));
  const forMe = inbox.filter((a) => {
    const p = a.payload as { learner?: string; audio?: string };
    return p.learner === myId && !!p.audio;
  });

  const startTeach = async (lexKey: string) => {
    setRecKey(lexKey);
    await rec.current.start();
  };
  const stopTeach = async (lexKey: string) => {
    setRecKey(null);
    setBusyKey(lexKey);
    try {
      const audio = await blobToDataUrl(await rec.current.stop());
      await store.putArtifact(partnershipId, packId, "teachback", { lexKey, teacher: myId, learner: partnerId, audio, status: "recorded", createdAt: new Date().toISOString() });
      await loadInbox();
    } finally {
      setBusyKey(null);
    }
  };

  if (!canHelp.length && !prompts.length && !forMe.length) {
    return <p className="muted small">No complementary gaps right now — you two know similar words. 🎯</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="small">Help each other</span>
      {reviewHelp.length > 0 && (
        <p className="muted small" style={{ margin: 0 }}>Due for you & your partner knows: <b>{reviewHelp.map((r) => label(r.lexKey)).join(", ")}</b> — quiz each other.</p>
      )}
      {canHelp.length > 0 && (
        <p className="muted small" style={{ margin: 0 }}>Your partner knows <b>{canHelp.map((i) => label(i.lexKey)).join(", ")}</b> — ask them.</p>
      )}
      {prompts.length > 0 && (
        <div>
          <p className="muted small" style={{ margin: "2px 0 0" }}>You're ahead here — record a quick explanation (teaching helps you most):</p>
          {prompts.map((p) => (
            <div className="row" key={p.lexKey} style={{ marginTop: 4 }}>
              <b>{label(p.lexKey)}</b>
              {taught.has(p.lexKey) ? (
                <span className="badge on">sent ✓</span>
              ) : recKey === p.lexKey ? (
                <button className="rec" onClick={() => stopTeach(p.lexKey)}>⏹ Stop &amp; send</button>
              ) : (
                <button className="ghost small" disabled={busyKey !== null} onClick={() => startTeach(p.lexKey)}>{busyKey === p.lexKey ? "saving…" : "● explain"}</button>
              )}
            </div>
          ))}
        </div>
      )}
      {forMe.length > 0 && (
        <div>
          <p className="muted small" style={{ margin: "2px 0 0" }}>Your partner explained:</p>
          {forMe.map((a) => {
            const pl = a.payload as { lexKey?: string; audio?: string };
            return (
              <div className="row" key={a.id} style={{ marginTop: 4 }}>
                <b>{label(pl.lexKey ?? "")}</b>
                <button className="ghost small" onClick={() => pl.audio && playDataUrl(pl.audio)}>▶ play</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
