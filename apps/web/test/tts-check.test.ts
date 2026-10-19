// Runnable check for the TTS take check — run with: npx tsx apps/web/test/tts-check.test.ts
// A take counts when what Scribe heard has the line's letters (romanized, so spelling and script don't
// matter); the takes Jake heard as English (2026-10-19) don't.
import assert from "node:assert/strict";
import { lineSimilarity, TAKE_OK } from "../lib/tts-cache";

const ok = (line: string, heard: string) => lineSimilarity(line, heard) >= TAKE_OK;
// Right takes, however Scribe spells them.
assert.ok(ok("тој", "Тој"));
assert.ok(ok("Не знам.", "Незнам"), "a word break doesn't matter");
assert.ok(ok("Што значи …?", "Što znači?"), "Latin letters for the same sound, and the … placeholder");
assert.ok(ok("Здраво", "Здраво!"));
assert.ok(ok("бев", "Беф"), "devoiced at the end of the word, as it's said");
assert.ok(!ok("тие", "Дие"), "but not at the start: тие isn't дие");
// The bad takes from the audit.
for (const [line, heard] of [["е", "This is for each"], ["тие", "T"], ["тој", "Joy"], ["сум", "Zoom"], ["сакам", "Suck 'em!"], ["таа", "Да."], ["бев", "Beth"]]) {
  assert.ok(!ok(line, heard), `${line} heard as “${heard}” is not a take`);
}
console.log("tts-check.test.ts: all assertions passed");
