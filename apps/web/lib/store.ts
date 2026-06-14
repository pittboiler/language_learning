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
  /** App-level user settings (not pack data) — e.g. whether the other speaker's lines auto-play. */
  settings?: { autoplay?: boolean };
  /** Daily-flow habit: consecutive days with ≥1 completed activity. lastDay is a local YYYY-MM-DD. */
  streak?: { count: number; lastDay: string };
  /** Grammar concepts whose rule has been explicitly introduced once (→ later it's just-in-time). */
  seenGrammar?: Record<string, boolean>;
  /** The sentence each tapped/captured word was met in — powers in-context (cloze) review. */
  contexts?: Record<string, string>;
}

export interface Store {
  load(): Promise<Progress>;
  save(p: Progress): Promise<void>;
}

export const emptyProgress = (): Progress => ({ activePackId: null, letters: {}, scenarios: {}, familiarity: {}, pick: null, settings: { autoplay: false }, streak: { count: 0, lastDay: "" }, seenGrammar: {}, contexts: {} });

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
      localStorage.setItem(KEY, JSON.stringify(p));
    },
  };
}

/**
 * Supabase-backed Store: anonymous auth gives a zero-friction per-device user; the whole Progress
 * blob is upserted into one RLS-protected row (public.user_state). Generic — no language in here.
 */
export function supabaseStore(): Store {
  const sb = supabase()!;

  return {
    async load() {
      try {
        const id = await uid();
        const { data } = await sb.from("user_state").select("data").eq("user_id", id).maybeSingle();
        const blob = (data as { data?: Partial<Progress> } | null)?.data;
        return blob ? revive({ ...emptyProgress(), ...blob }) : emptyProgress();
      } catch {
        // Fall back to local cache if Supabase is unreachable, so the app still works offline.
        return localStore().load();
      }
    },
    async save(p) {
      // Mirror to localStorage too (fast optimistic reads / offline resilience).
      void localStore().save(p);
      const id = await uid();
      await sb.from("user_state").upsert({ user_id: id, data: p, updated_at: new Date().toISOString() });
    },
  };
}

/** Pick the persistence backend from the environment. */
export function getStore(): Store {
  return supabaseConfigured() ? supabaseStore() : localStore();
}
