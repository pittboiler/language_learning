// Persistence behind a small async Store interface, so the localStorage adapter can be swapped for a
// Supabase adapter without touching the UI. Review scheduling uses the real FSRS engine from core.
import * as srs from "@ll/core/srs";

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

/** localStorage-backed Store (default for Phase 2 until Supabase auth lands). */
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
