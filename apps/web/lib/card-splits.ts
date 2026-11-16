import type { LanguagePack } from "@ll/pack-schema";
import * as familiarity from "@ll/core/familiarity";
import type { FamiliarityEntry } from "@ll/core/familiarity";

/** Move a learner's progress on cards the pack split up (pack.retiredCards, e.g. "два, три, четири, пет" →
 *  "два, три, четири" + "пет, шест, седум") onto the cards that replace them, then drop the old entries, so
 *  nothing they've studied is taught again as new and no old bundle lingers in the Flashcards deck as a
 *  saved word. A new card made from two old ones is carried over only once the learner has met both; it takes
 *  the entry still only seen in a story if there is one (so it's taught), else the one due soonest. A card
 *  the learner already has an entry for is left alone. Runs on every load; a second run changes nothing. */
export function carryOverSplitCards(fam: Record<string, FamiliarityEntry>, pack: LanguagePack): Record<string, FamiliarityEntry> {
  const retired = Object.entries(pack.retiredCards ?? {});
  const oldKeys = retired.map(([old]) => familiarity.normalize(old)).filter((k) => fam[k]);
  if (!oldKeys.length) return fam;
  const sources = new Map<string, string[]>(); // new answer → the old answers it's made from
  for (const [old, news] of retired) for (const n of news) sources.set(n, [...(sources.get(n) ?? []), familiarity.normalize(old)]);
  const dueOf = (e: FamiliarityEntry) => (e.srs ? new Date(e.srs.due).getTime() : Infinity);
  const out = { ...fam };
  for (const [answer, olds] of sources) {
    const item = pack.vocab.find((v) => v.answer.trim() === answer);
    if (!item) continue;
    const { lexKey, kind, display, gloss } = familiarity.deriveKeyForItem(item);
    if (out[lexKey]) continue;
    const from = olds.map((k) => fam[k]);
    if (!from.every((e): e is FamiliarityEntry => !!e)) continue;
    const pick = from.find((e) => !familiarity.isStudied(e)) ?? [...from].sort((a, b) => dueOf(a) - dueOf(b))[0]!;
    out[lexKey] = { ...pick, lexKey, kind, display, gloss };
  }
  for (const k of oldKeys) delete out[k];
  return out;
}
