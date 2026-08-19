// Persistence behind a small async Store interface, so the localStorage adapter can be swapped for a
// Supabase adapter without touching the UI. getStore() picks Supabase when configured (env present),
// else localStorage — so pasting creds + restarting is the whole swap. Review scheduling uses the
// real FSRS engine from core.
import type * as srs from "@ll/core/srs";
import type { FamiliarityEntry } from "@ll/core/familiarity";
import { supabase, uid, supabaseConfigured } from "./supabase";

export interface Progress {
  activePackId: string | null; // selected language pack (null ⇒ registry default). Generic — no language baked in.
  letters: Record<string, boolean>; // glyph → known
  scenarios: Record<string, { turnIndex: number; metCriteria: string[] }>;
  /** Unified vocab + SRS state, keyed by lexKey (the familiarity engine owns this). */
  familiarity: Record<string, FamiliarityEntry>;
  /** @deprecated legacy itemId→FSRS map; migrated into `familiarity` on first load (see page.tsx). */
  reviews?: Record<string, srs.ReviewState>;
  pick: string | null; // active scenario id
  /** Active mini-story id for the story reader (null ⇒ first story). Lets the partner "shared story" deep-link. */
  storyPick?: string | null;
  /** App-level user settings (not pack data) — e.g. whether the other speaker's lines auto-play. */
  settings?: { autoplay?: boolean; slow?: boolean; slowRate?: number; partnerIntroSeen?: boolean };
  /** Daily-flow habit: consecutive days with ≥1 completed activity. lastDay is a local YYYY-MM-DD. */
  streak?: { count: number; lastDay: string };
  /** Verb lemmas already drilled in the warm-up conjugation match game — so each day picks a new one. */
  seenConjugations?: string[];
  /** "<lemma>:<person>" pairs the learner has correctly BUILT in the sentence exercise — steers toward
   *  not-yet-produced persons so every conjugation gets practised. */
  builtConjugations?: string[];
  /** Local day (YYYY-MM-DD) the daily session was last finished. When it equals today, Today opens on the
   *  "done for today" screen instead of replaying step 1 after a reload/reopen. */
  lastSessionDay?: string;
  /** Grammar concepts whose rule has been explicitly introduced once (→ later it's just-in-time). */
  seenGrammar?: Record<string, boolean>;
  /** @deprecated legacy "read once → done" flag; superseded by `storyReads` (still honored on read so
   *  already-completed stories stay done). */
  seenStories?: Record<string, boolean>;
  /** Distinct local days (YYYY-MM-DD) a story was read in the daily flow. A unit stays in rotation for
   *  a few days of repetition before Today advances — see UNIT_MIN_DAYS. */
  storyReads?: Record<string, string[]>;
  /** The sentence each tapped/captured word was met in — powers in-context (cloze) review. */
  contexts?: Record<string, string>;
  /** English translation of that sentence — shown on the cloze card so it's clear what to produce. */
  contextGlosses?: Record<string, string>;
  /** Epoch-ms of the last save (stamped by the Store on write). Used only to reconcile the Supabase row
   *  with the synchronous localStorage mirror on load, so a last-write-before-exit that didn't reach the
   *  network (e.g. finishing a session then immediately closing the app) isn't lost to a stale remote row. */
  savedAt?: number;
}

export interface Store {
  load(): Promise<Progress>;
  save(p: Progress): Promise<void>;
}

export const emptyProgress = (): Progress => ({ activePackId: null, letters: {}, scenarios: {}, familiarity: {}, pick: null, settings: { autoplay: false }, streak: { count: 0, lastDay: "" }, seenGrammar: {}, seenStories: {}, storyReads: {}, contexts: {}, contextGlosses: {} });

// FSRS cards + familiarity timestamps serialize Dates to strings in JSON; revive them on reload.
function reviveReviewState(r: srs.ReviewState): void {
  r.due = new Date(r.due);
  const card = r.card as { due?: unknown; last_review?: unknown } | undefined;
  if (card) {
    if (card.due) card.due = new Date(card.due as string);
    if (card.last_review) card.last_review = new Date(card.last_review as string);
  }
}

function revive(p: Progress): Progress {
  for (const e of Object.values(p.familiarity ?? {})) {
    if (!e) continue;
    e.createdAt = new Date(e.createdAt);
    e.lastSeenAt = new Date(e.lastSeenAt);
    if (e.knownAt) e.knownAt = new Date(e.knownAt);
    if (e.srs) reviveReviewState(e.srs);
  }
  // Legacy blobs: revive the deprecated reviews map so page.tsx can migrate it into familiarity.
  for (const r of Object.values(p.reviews ?? {})) {
    if (r) reviveReviewState(r);
  }
  return p;
}

const KEY = "ll-mk-p2";

/** localStorage-backed Store (default until Supabase creds are present). */
export function localStore(): Store {
  return {
    async load() {
      if (typeof localStorage === "undefined") return emptyProgress();
      try {
        const raw = localStorage.getItem(KEY);
        return raw ? revive({ ...emptyProgress(), ...JSON.parse(raw) }) : emptyProgress();
      } catch {
        return emptyProgress();
      }
    },
    async save(p) {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(KEY, JSON.stringify({ ...p, savedAt: Date.now() }));
    },
  };
}

/**
 * Supabase-backed Store: anonymous auth gives a zero-friction per-device user; the whole Progress
 * blob is upserted into one RLS-protected row (public.user_state). Generic — no language in here.
 */
export function supabaseStore(): Store {
  const sb = supabase()!;
  const local = localStore();

  const save: Store["save"] = async (p) => {
    const stamped = { ...p, savedAt: Date.now() };
    // Mirror to localStorage synchronously (fast optimistic reads / offline resilience) BEFORE the
    // network round-trip — so even if the upsert never lands (app closed right after), the mirror holds it.
    void local.save(stamped);
    const id = await uid();
    await sb.from("user_state").upsert({ user_id: id, data: stamped, updated_at: new Date().toISOString() });
  };

  return {
    async load() {
      // The synchronous mirror always reflects this device's most recent write; the Supabase row may lag
      // if the last upsert was interrupted (finishing a session, then immediately closing the app).
      const cached = await local.load();
      try {
        const id = await uid();
        const { data } = await sb.from("user_state").select("data").eq("user_id", id).maybeSingle();
        const blob = (data as { data?: Partial<Progress> } | null)?.data;
        const remote = blob ? revive({ ...emptyProgress(), ...blob }) : null;
        // Prefer whichever was saved more recently. A newer local mirror means a write didn't reach the
        // network — use it (and heal the remote so other devices catch up). A newer remote means another
        // device moved ahead — use it. Ties favour the canonical remote.
        if (remote && (remote.savedAt ?? 0) >= (cached.savedAt ?? 0)) return remote;
        if ((cached.savedAt ?? 0) > 0) {
          void save(cached); // reconcile the stale remote in the background
          return cached;
        }
        return remote ?? cached;
      } catch {
        // Fall back to local cache if Supabase is unreachable, so the app still works offline.
        return cached;
      }
    },
    save,
  };
}

/** Pick the persistence backend from the environment. */
export function getStore(): Store {
  return supabaseConfigured() ? supabaseStore() : localStore();
}
