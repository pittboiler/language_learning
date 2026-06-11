// Persistence behind a small async Store interface, so the localStorage adapter can be swapped for a
// Supabase adapter without touching the UI. getStore() picks Supabase when configured (env present),
// else localStorage — so pasting creds + restarting is the whole swap. Review scheduling uses the
// real FSRS engine from core.
import * as srs from "@ll/core/srs";
import { createClient } from "@supabase/supabase-js";

export interface Progress {
  letters: Record<string, boolean>; // glyph → known
  scenarios: Record<string, { turnIndex: number; metCriteria: string[] }>;
  reviews: Record<string, srs.ReviewState>; // itemId → FSRS state
  pick: string | null; // active scenario id
}

export interface Store {
  load(): Promise<Progress>;
  save(p: Progress): Promise<void>;
}

export const emptyProgress = (): Progress => ({ letters: {}, scenarios: {}, reviews: {}, pick: null });

// FSRS cards serialize Dates to strings in JSON; revive them so core.srs works on reload.
function revive(p: Progress): Progress {
  for (const id of Object.keys(p.reviews)) {
    const r = p.reviews[id];
    if (!r) continue;
    r.due = new Date(r.due);
    const card = r.card as { due?: unknown; last_review?: unknown } | undefined;
    if (card) {
      if (card.due) card.due = new Date(card.due as string);
      if (card.last_review) card.last_review = new Date(card.last_review as string);
    }
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
export function supabaseStore(url: string, anonKey: string): Store {
  const sb = createClient(url, anonKey);

  async function uid(): Promise<string> {
    let { data } = await sb.auth.getSession();
    if (!data.session) {
      await sb.auth.signInAnonymously();
      ({ data } = await sb.auth.getSession());
    }
    if (!data.session) throw new Error("Supabase anonymous sign-in failed (is Anonymous auth enabled?)");
    return data.session.user.id;
  }

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? supabaseStore(url, anonKey) : localStore();
}
