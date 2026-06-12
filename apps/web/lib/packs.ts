// The pack registry — the app-level seam that selects the ACTIVE language pack by id.
//
// This is the Phase-3 leak point made explicit. Route handlers and the UI resolve the active pack
// through getPack(activePackId) instead of importing one language directly. `packages/core` never
// imports a pack — every engine takes the pack/context as a parameter — so adding a language is a
// single registry entry here (+ its workspace dep + next.config transpilePackages), NOT a core change.
import type { LanguagePack } from "@ll/pack-schema";
import { macedonian } from "@ll/pack-mk";
import { bulgarian } from "@ll/pack-bg";

/** packId → LanguagePack. Adding a language is exactly this one line — no core/app-logic change. */
export const PACKS: Record<string, LanguagePack> = {
  [macedonian.id]: macedonian,
  [bulgarian.id]: bulgarian,
};

/** The pack used when no active pack is selected (first run) or an id is unknown. */
export const DEFAULT_PACK_ID = macedonian.id;

/** Resolve the active pack; falls back to the default for a missing/unknown id. */
export function getPack(packId?: string | null): LanguagePack {
  return (packId && PACKS[packId]) || PACKS[DEFAULT_PACK_ID]!;
}

/** Lightweight {id, name} list for a language picker — no heavy pack data. */
export function packList(): { id: string; name: string }[] {
  return Object.values(PACKS).map((p) => ({ id: p.id, name: p.name }));
}
