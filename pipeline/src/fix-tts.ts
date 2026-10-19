// Redo the cached TTS clips the audit flagged (pipeline/src/audit-tts.ts → output/tts-audit.json), and make
// the not-yet-cached ones now instead of at first play. Each line gets checked takes (synthesizeChecked: Scribe
// must hear the line) and is cached only when a take passes; a flagged clip whose redo still fails is left
// as it was, and reported. A line the default never says right is tried as a sentence of its own („Тие.“), on
// the older model (eleven_multilingual_v2), or both; a variant that passes is printed as a
// PRONUNCIATION_OVERRIDES entry to add to apps/web/lib/tts-cache.ts (its clip is already cached under it).
//
//   DRY=1 pipeline/node_modules/.bin/tsx pipeline/src/fix-tts.ts   # list what would be redone
//   pipeline/node_modules/.bin/tsx pipeline/src/fix-tts.ts         # redo them (ElevenLabs spend: small)
import "./env.js"; // MUST be first — populates process.env that tts-cache reads
import { readFileSync } from "node:fs";
import { macedonian as mk } from "@ll/pack-mk";
import { createHash } from "node:crypto";
import { resolveTts, putCached, synthesizeChecked, TAKE_OK } from "../../apps/web/lib/tts-cache.js";

const VOICE = process.env.ELEVENLABS_VOICE_ID || mk.voiceId;
const AUDIT = new URL(`../output/${process.env.AUDIT ?? "tts-audit.json"}`, import.meta.url);
const opts = { languageCode: mk.languageCode, scribeLang: mk.asr.languageHints[0] ?? "mkd" };

interface Audited { text: string; cached: boolean; sim?: number; flags: string[] }
const audit = JSON.parse(readFileSync(AUDIT, "utf8")) as Audited[];
const only = process.env.ONLY?.split("|");
// FORCE=1 with ONLY: redo those lines whatever the audit said.
const bad = audit.filter((a) => a.cached && (!!process.env.FORCE || (a.sim ?? 1) < 0.6 || a.flags.some((f) => f.startsWith("scribe error"))) && (!only || only.includes(a.text)));
const missing = audit.filter((a) => !a.cached && (!only || only.includes(a.text)));
console.log(`${bad.length} flagged clips to redo · ${missing.length} not cached yet to make now`);
if (process.env.DRY) { for (const a of bad) console.log(`  redo ${a.text}`); process.exit(0); }

const overrides: string[] = [];
const report: string[] = [];
const cap = (t: string) => t[0]!.toUpperCase() + t.slice(1) + (/[.!?…]$/.test(t) ? "" : ".");
const pathOf = (speakText: string, voice: string, model: string) => `${createHash("sha256").update(`${speakText}|${voice}|${model}`).digest("hex")}.mp3`;
async function fix(a: Audited) {
  const r = resolveTts(a.text, VOICE);
  let res = await synthesizeChecked(a.text, r, { ...opts, tries: a.cached ? 4 : 3 });
  if (res.ok || !a.cached) { await putCached(r.path, res.bytes); report.push(`${res.ok ? "✓" : "~"} ${a.text} → “${res.heard ?? ""}” (${res.tries} take${res.tries > 1 ? "s" : ""}${res.ok ? "" : ", best kept"})`); return; }
  // The default doesn't say it: try it as a sentence of its own („Тие.“), on the older model, or both — and
  // keep the first that passes as a PRONUNCIATION_OVERRIDES entry (so its cache key says how it was made).
  const V2 = "eleven_multilingual_v2";
  let best = { ...res, speakText: r.speakText, model: r.model };
  for (const v of [{ speakText: cap(r.speakText), model: r.model }, { speakText: r.speakText, model: V2 }, { speakText: cap(r.speakText), model: V2 }]) {
    if (v.speakText === r.speakText && v.model === r.model) continue;
    res = await synthesizeChecked(a.text, { ...r, ...v }, { ...opts, tries: 3 });
    if (res.sim > best.sim) best = { ...res, ...v };
    if (res.ok) break;
  }
  // Clearly closer than the cached take (or a pass): keep it.
  if (best.ok || (a.sim !== undefined && best.sim > a.sim + 0.15)) {
    const same = best.speakText === r.speakText && best.model === r.model;
    await putCached(same ? r.path : pathOf(best.speakText, r.voice, best.model), best.bytes);
    if (!same) overrides.push(`  "${a.text}": { ${best.speakText !== r.speakText ? `speakText: "${best.speakText}"` : ""}${best.speakText !== r.speakText && best.model !== r.model ? ", " : ""}${best.model !== r.model ? `model: "${best.model}"` : ""} },`);
    report.push(`${best.ok ? "✓" : "~"} ${a.text}${same ? "" : ` as „${best.speakText}“ on ${best.model}`} → “${best.heard}”${best.ok ? "" : ` (better than before: ${a.sim?.toFixed(2)} → ${best.sim.toFixed(2)})`}`);
    return;
  }
  report.push(`✗ ${a.text}: best take heard “${best.heard}” (${best.sim.toFixed(2)} < ${TAKE_OK}); left as it was`);
}

let next = 0;
const all = [...bad, ...missing];
await Promise.all(Array.from({ length: 3 }, async () => { for (let i = next++; i < all.length; i = next++) { try { await fix(all[i]!); } catch (e) { report.push(`✗ ${all[i]!.text}: ${e instanceof Error ? e.message : e}`); } } }));
console.log(report.sort().join("\n"));
if (overrides.length) console.log(`\nAdd to PRONUNCIATION_OVERRIDES:\n${overrides.join("\n")}`);
