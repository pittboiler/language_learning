// @ll/core/familiarity — the comprehensible-input substrate. A persistent, per-user, LANGUAGE-level
// vocabulary state for words, chunks, AND grammar patterns. Language-agnostic: it operates on
// normalized lexical keys + the FSRS card from core/srs. See DESIGN-comprehensible-input.md §1.1.
//
// THE UNIFICATION: a FamiliarityEntry HOLDS the existing core/srs ReviewState (entry.srs). The SRS
// scheduler reads/writes entry.srs.card — there is NO parallel vocab store. `status`/`strength` are a
// cached PROJECTION of the card, re-derived on every review.
//
// API style is FUNCTIONAL/immutable (entry-in → entry-out) so it composes with React state + JSON
// persistence: callers merge the returned entry into their familiarity record.
import { State } from "ts-fsrs";
import { initState, schedule, dueItems, type ReviewState, type Grade } from "../srs/index.js";
import type { ReviewItem } from "@ll/pack-schema";

/** Words and multi-word chunks are first-class (chunks matter most for a conversation-first app);
 *  grammar patterns are tracked too so i+1 and SRS span all three. */
export type LexKind = "word" | "chunk" | "grammar";

/** A familiarity state that PROGRESSES (state machine over a numeric strength), not a boolean. */
export type FamiliarityStatus = "new" | "learning" | "known" | "ignored";

export interface FamiliarityEntry {
  /** The unification key: a normalized lexical form / chunk text / grammar-concept id. */
  lexKey: string;
  kind: LexKind;
  /** Surface form to display (pre-normalization). */
  display: string;
  gloss?: string;
  /** The EXISTING core/srs state, verbatim. The scheduler owns `srs.card`. null ⇒ known/ignored
   *  without active scheduling (e.g. a cognate the learner marked known). */
  srs: ReviewState | null;
  /** Derived from `srs.card` and cached for fast text scoring (see deriveStatus). */
  status: FamiliarityStatus;
  /** 0..1, derived from `srs.card.stability`. */
  strength: number;
  createdAt: Date;
  lastSeenAt: Date;
  /** When the item first reached "known" — powers the "moved to known this week" metric. */
  knownAt?: Date;
  tags?: string[];
}

/** The whole per-user, per-language vocabulary state, keyed by lexKey. Plain object so it serializes
 *  to JSON and merges immutably in React state. */
export type FamiliarityIndex = Record<string, FamiliarityEntry>;

/** Stability (days) at/above which an item is treated as "known". Tunable. */
export const KNOWN_THRESHOLD = 21;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Normalize a surface form to a lexKey: NFC, lowercase, trim, strip edge punctuation, collapse ws.
 *  Surface-form only for MVP — real lemmatization is language-specific and deferred (DESIGN-CI §1.5). */
export function normalize(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The familiarity key + metadata for an authored ReviewItem. Words/phrases key by normalized answer
 *  (so text tokens unify with drilled vocab); grammar/glyph key by a namespaced id (not text tokens). */
export function deriveKeyForItem(item: ReviewItem): { lexKey: string; kind: LexKind; display: string; gloss: string } {
  if (item.kind === "grammar") return { lexKey: `grammar:${item.id}`, kind: "grammar", display: item.prompt || item.answer, gloss: item.gloss };
  if (item.kind === "glyph") return { lexKey: `glyph:${item.id}`, kind: "word", display: item.answer, gloss: item.gloss };
  return { lexKey: normalize(item.answer), kind: item.kind === "phrase" ? "chunk" : "word", display: item.answer, gloss: item.gloss };
}

/** Project a FamiliarityStatus + 0..1 strength from the SRS card (THE single source of truth). */
export function deriveStatus(srs: ReviewState | null): { status: FamiliarityStatus; strength: number } {
  if (!srs) return { status: "known", strength: 1 }; // null ⇒ explicitly known (ignored is set on the entry)
  const card = srs.card;
  const strength = clamp01((card.stability ?? 0) / KNOWN_THRESHOLD);
  // A TRACKED entry is at least "learning" — capturing a word means you're now learning it (LingQ-style).
  // "new" is reserved for UNTRACKED words (no entry); the app renders those from the absence of an entry.
  if (card.state === State.Review && (card.stability ?? 0) >= KNOWN_THRESHOLD) return { status: "known", strength };
  return { status: "learning", strength };
}

/** Frictionless capture: a fresh entry enrolled into the SRS queue (srs.initState). The caller inserts
 *  the returned entry into its FamiliarityIndex (immutable merge). */
export function capture(spec: { lexKey: string; kind: LexKind; display: string; gloss?: string; tags?: string[] }, now: Date = new Date()): FamiliarityEntry {
  const srs = initState("local", spec.lexKey, now);
  const { status, strength } = deriveStatus(srs);
  return { lexKey: spec.lexKey, kind: spec.kind, display: spec.display, gloss: spec.gloss, srs, status, strength, createdAt: now, lastSeenAt: now, tags: spec.tags };
}

/** Record a successful/failed encounter or review on an entry → reschedule (srs.schedule), re-derive
 *  status/strength. Re-enrolls if the entry had no card (was marked known). */
export function grade(entry: FamiliarityEntry, g: Grade, now: Date = new Date()): FamiliarityEntry {
  const srs = entry.srs ? schedule(entry.srs, g, now) : initState("local", entry.lexKey, now);
  const { status, strength } = deriveStatus(srs);
  const knownAt = status === "known" && entry.status !== "known" ? now : entry.knownAt;
  return { ...entry, srs, status, strength, lastSeenAt: now, knownAt };
}

/** Mark an item known (no scheduling) or ignored (excluded from new-item counts + scoring). */
export function setStatus(entry: FamiliarityEntry, status: "known" | "ignored", now: Date = new Date()): FamiliarityEntry {
  const knownAt = status === "known" ? entry.knownAt ?? now : entry.knownAt;
  return { ...entry, srs: null, status, strength: status === "known" ? 1 : 0, lastSeenAt: now, knownAt };
}

/** The SRS states in the index (entries with active scheduling) — adapter to srs.dueItems/nextBatch. */
export function toReviewStates(index: FamiliarityIndex): ReviewState[] {
  return Object.values(index)
    .map((e) => e.srs)
    .filter((s): s is ReviewState => s !== null);
}

/** lexKeys whose SRS `due` <= now, urgency-ordered (delegates to srs.dueItems). */
export function dueKeys(index: FamiliarityIndex, now: Date = new Date()): string[] {
  return dueItems(toReviewStates(index), now);
}

/** Wrap one legacy ReviewState into a FamiliarityEntry under the given lexKey/meta. */
export function fromReviewState(srs: ReviewState, spec: { lexKey: string; kind: LexKind; display: string; gloss?: string }, now: Date = new Date()): FamiliarityEntry {
  const reKeyed: ReviewState = { ...srs, itemId: spec.lexKey };
  const { status, strength } = deriveStatus(reKeyed);
  return { lexKey: spec.lexKey, kind: spec.kind, display: spec.display, gloss: spec.gloss, srs: reKeyed, status, strength, createdAt: now, lastSeenAt: now };
}

/** Migrate the legacy `reviews` map (keyed by authored item id) into a familiarity index (keyed by
 *  lexKey), resolving each id via the provided item pool. One-time, on load; preserves all FSRS state. */
export function migrateReviews(reviews: Record<string, ReviewState>, items: ReviewItem[], now: Date = new Date()): FamiliarityIndex {
  const byId = new Map(items.map((it) => [it.id, it] as const));
  const index: FamiliarityIndex = {};
  for (const [itemId, srs] of Object.entries(reviews)) {
    const item = byId.get(itemId);
    const spec = item ? deriveKeyForItem(item) : { lexKey: itemId, kind: "word" as LexKind, display: itemId };
    index[spec.lexKey] = fromReviewState(srs, spec, now);
  }
  return index;
}
