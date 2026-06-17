// Offline TTS pre-warm — synthesize every speakable line in the served MK pack ONCE and cache it in the
// `tts-audio` bucket, so the FIRST in-app play is already a cache hit (no ElevenLabs spend at runtime).
// Idempotent: lists what's already cached and only synthesizes the misses. Reuses the SAME resolver +
// overrides + cache as the live /api/tts route (apps/web/lib/tts-cache). See DESIGN-tts-caching.md.
//
//   DRY=1 pipeline/node_modules/.bin/tsx pipeline/src/prewarm-tts.ts   # size it, no synth/spend
//   pipeline/node_modules/.bin/tsx pipeline/src/prewarm-tts.ts         # warm the cache for real
import "./env.js"; // MUST be first — populates process.env that tts-cache reads
import { macedonian as mk } from "@ll/pack-mk";
import { tokenize } from "@ll/core/familiarity/scoring";
import { resolveTts, synthesize, putCached, listCachedPaths } from "../../apps/web/lib/tts-cache.js";

const DRY = !!process.env.DRY;
const VOICE = process.env.ELEVENLABS_VOICE_ID || mk.voiceId;

/** Every distinct target-language string the app can speak (mirrors the player's 🔊 surfaces). */
function speakables(): string[] {
  const set = new Set<string>();
  const add = (s?: string) => { if (s && s.trim() && !s.includes("…")) set.add(s.trim()); };
  mk.vocab.forEach((v) => add(v.answer));
  mk.scenarios.forEach((s) => s.script.forEach((t) => add(t.text)));
  (mk.stories ?? []).forEach((s) => { s.body.forEach((b) => add(b.text)); s.qa.forEach((q) => { add(q.question); add(q.answer); }); });
  mk.readers.forEach((r) => r.body.forEach((b) => add(b.text)));
  (mk.infoGapTasks ?? []).forEach((t) => [t.roleA, t.roleB].forEach((r) => r.targetPhrases.forEach((p) => add(p.text))));
  mk.grammar.forEach((g) => g.drills.forEach((d) => add(d.answer)));
  (mk.alphabet ?? []).forEach((a) => a.examples.forEach((e) => add(e.text)));
  return [...set];
}

/** Distinct word SURFACES the learner can tap-to-hear in a story/reader. Uses the SAME tokenizer the UI
 *  does (core/familiarity/scoring) and the surface form the tap plays (sel.surface), so keys hit. */
function tappableSurfaces(): string[] {
  const set = new Set<string>();
  const addLine = (text?: string) => {
    if (!text) return;
    for (const t of tokenize(text)) if (t.isWord && t.surface.trim()) set.add(t.surface);
  };
  (mk.stories ?? []).forEach((s) => s.body.forEach((b) => addLine(b.text))); // TappableText: story player
  mk.readers.forEach((r) => r.body.forEach((b) => addLine(b.text))); //          TappableText: reader
  return [...set];
}

async function main() {
  // Full lines (play-story / 🔊-line) + the individual word surfaces a tap plays — deduped by string,
  // since the same string resolves to the same cache key.
  const lines = [...new Set([...speakables(), ...tappableSurfaces()])];
  const cached = await listCachedPaths();
  const work = lines.map((text) => ({ text, ...resolveTts(text, VOICE) }));
  const misses = work.filter((w) => !cached.has(w.path));
  const chars = misses.reduce((n, w) => n + w.speakText.length, 0);
  const byModel = misses.reduce<Record<string, number>>((m, w) => ((m[w.model] = (m[w.model] ?? 0) + 1), m), {});

  console.log(`\n=== MK TTS pre-warm${DRY ? " — DRY (no synth / no spend)" : ""} ===`);
  console.log(`  ${lines.length} unique strings (lines + tappable words) · ${lines.length - misses.length} already cached · ${misses.length} to synthesize (${chars} chars)`);
  console.log(`  models for the misses: ${Object.entries(byModel).map(([k, v]) => `${k}×${v}`).join(", ") || "—"}`);
  if (DRY) { console.log(`  dry run — nothing synthesized.\n`); return; }

  let done = 0, failed = 0;
  for (const w of misses) {
    try {
      const bytes = await synthesize(w.speakText, w.model, w.voice);
      await putCached(w.path, bytes);
      done++;
      if (done % 20 === 0) process.stdout.write(`  …${done}/${misses.length} synthesized\r`);
    } catch (e) {
      failed++;
      console.log(`  ✗ "${w.text.slice(0, 32)}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\n  done · synthesized + cached ${done} · failed ${failed} · ~${chars} chars one-time\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
