"use client";
import { useCallback, useEffect, useState } from "react";
import * as familiarity from "@ll/core/familiarity";
import { type Progress } from "../../lib/store";
import { type PartnerStore, type PartnerArtifact } from "../../lib/partner-store";
import type { ComplementaryDiff } from "@ll/core/partner/familiarity-diff";
import * as teachback from "@ll/core/teachback";
import * as complementarySrs from "@ll/core/partner/complementary-srs";
import { blobToDataUrl, playDataUrl } from "./shared";
import { Icon, useRecorder } from "../shared";

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

  if (!diff) return <div className="framed partner-card"><div className="overline">Help each other</div><p style={{ margin: "8px 0 0", lineHeight: 1.55 }}>Turn on “Vocabulary” in Partner settings to swap review help with your partner.</p></div>;

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
    return <div className="framed partner-card"><div className="overline">Help each other</div><p style={{ margin: "8px 0 0", lineHeight: 1.55 }}>Nothing to swap right now: you two know much the same words.</p></div>;
  }
  const words = (keys: string[]) => keys.map((k, i) => <span key={k}>{i > 0 && ", "}<b lang={packId} className="rmk" style={{ fontSize: 17 }}>{label(k)}</b></span>);

  return (
    <div className="framed partner-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="overline">Help each other</div>
      {reviewHelp.length > 0 && (
        <div>
          <div className="activity-sub">Quiz each other</div>
          <p style={{ margin: "4px 0 0", lineHeight: 1.6 }}>Due for you, and your partner knows them: {words(reviewHelp.map((r) => r.lexKey))}</p>
        </div>
      )}
      {canHelp.length > 0 && (
        <div>
          <div className="activity-sub">Ask your partner</div>
          <p style={{ margin: "4px 0 0", lineHeight: 1.6 }}>Your partner knows {words(canHelp.map((i) => i.lexKey))}</p>
        </div>
      )}
      {prompts.length > 0 && (
        <div>
          <div className="activity-sub">Explain one</div>
          <p className="muted small" style={{ margin: "4px 0 4px" }}>You&apos;re ahead on these. Record a quick explanation: teaching it helps you most.</p>
          {prompts.map((p) => (
            <div className="word-row" key={p.lexKey}>
              <b lang={packId} className="rmk" style={{ flex: 1, minWidth: 0, fontSize: 17 }}>{label(p.lexKey)}</b>
              {taught.has(p.lexKey) ? (
                <span className="result-ok"><Icon name="check" size={14} />Sent</span>
              ) : recKey === p.lexKey ? (
                <button className="rec" onClick={() => stopTeach(p.lexKey)}><Icon name="stop" size={16} />Stop and send</button>
              ) : (
                <button className="ghost small" disabled={busyKey !== null} onClick={() => startTeach(p.lexKey)}><Icon name="mic" size={14} />{busyKey === p.lexKey ? "Saving…" : "Explain"}</button>
              )}
            </div>
          ))}
        </div>
      )}
      {forMe.length > 0 && (
        <div>
          <div className="activity-sub">Your partner explained</div>
          {forMe.map((a) => {
            const pl = a.payload as { lexKey?: string; audio?: string };
            return (
              <div className="word-row" key={a.id}>
                <b lang={packId} className="rmk" style={{ flex: 1, minWidth: 0, fontSize: 17 }}>{label(pl.lexKey ?? "")}</b>
                <button className="ghost small" onClick={() => pl.audio && playDataUrl(pl.audio)}><Icon name="speaker" size={16} />Play</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
