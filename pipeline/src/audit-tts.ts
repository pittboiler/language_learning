// Audit the cached TTS clips (2026-10-19, Jake: "occasional english speaking sounds in the matching game").
// Every clip is made once and cached forever (content-addressed), so a bad take plays the same every time.
// This downloads the cached clip for every word/phrase a card or match game can play, and every verb form
// the conjugation match plays, runs it through Scribe WITHOUT a language hint, and flags clips that come
// back as another language, with Latin letters, or not matching the line. Read-only: nothing re-synthesized.
//
//   pipeline/node_modules/.bin/tsx pipeline/src/audit-tts.ts            # all vocab + verb forms
//   ONLY="ти,тие" pipeline/node_modules/.bin/tsx pipeline/src/audit-tts.ts
//   SURFACES=1 …   # also every word you can tap in a story or reader
import "./env.js"; // MUST be first — populates process.env that tts-cache reads
import { writeFileSync } from "node:fs";
import { macedonian as mk } from "@ll/pack-mk";
import { resolveTts, getCached, lineSimilarity } from "../../apps/web/lib/tts-cache.js";
import { tokenize } from "@ll/core/familiarity/scoring";

const VOICE = process.env.ELEVENLABS_VOICE_ID || mk.voiceId;
const OUT = new URL(`../output/${process.env.OUT ?? "tts-audit.json"}`, import.meta.url);
const SLAVIC = new Set(["mkd", "mk", "bul", "bg", "srp", "sr", "hrv", "hr", "bos", "bs", "slv", "rus", "ukr"]);

function lines(): { text: string; from: string }[] {
  const out = new Map<string, string>();
  const add = (t: string | undefined, from: string) => { const s = t?.trim(); if (s && !out.has(s)) out.set(s, from); };
  for (const v of mk.vocab) add(v.answer, `vocab:${v.id}`);
  for (const c of mk.conjugations ?? []) for (const f of Object.values(c.forms)) add(f, `conj:${c.lemma}`);
  // SURFACES=1: also every word you can tap to hear in a story or reader (the same surfaces the pre-warm makes).
  if (process.env.SURFACES) {
    for (const st of mk.stories ?? []) for (const b of st.body) for (const t of tokenize(b.text)) if (t.isWord) add(t.surface, `tap:${st.id}`);
    for (const r of mk.readers) for (const b of r.body) for (const t of tokenize(b.text)) if (t.isWord) add(t.surface, `tap:${r.id}`);
  }
  const only = process.env.ONLY?.split(",").map((s) => s.trim());
  return [...out].map(([text, from]) => ({ text, from })).filter((x) => !only || only.includes(x.text));
}

async function scribe(bytes: ArrayBuffer, lang?: string): Promise<{ text: string; lang: string; prob: number }> {
  const form = new FormData();
  form.append("model_id", process.env.SCRIBE_MODEL || "scribe_v2");
  if (lang) form.append("language_code", lang);
  form.append("file", new Blob([new Uint8Array(bytes)], { type: "audio/mpeg" }), "clip.mp3");
  for (let tries = 0; ; tries++) {
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! }, body: form });
    if (res.ok) { const d = (await res.json()) as { text?: string; language_code?: string; language_probability?: number }; return { text: (d.text ?? "").trim(), lang: d.language_code ?? "?", prob: d.language_probability ?? 0 }; }
    if (res.status === 429 && tries < 4) { await new Promise((r) => setTimeout(r, 2000 * (tries + 1))); continue; }
    throw new Error(`Scribe ${res.status}: ${(await res.text()).slice(0, 160)}`);
  }
}

async function main() {
  const work = lines();
  console.log(`auditing ${work.length} lines…`);
  const results: { text: string; from: string; cached: boolean; heard?: string; heardMk?: string; lang?: string; prob?: number; sim?: number; secs?: number; flags: string[] }[] = [];
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < work.length; i = next++) {
      const w = work[i]!;
      const r = resolveTts(w.text, VOICE);
      const bytes = await getCached(r.path);
      if (!bytes) { results.push({ ...w, cached: false, flags: ["not cached yet"] }); continue; }
      try {
        // Heard as Macedonian (does the clip say the line?) and with no hint (does it sound like another language?).
        const [mkH, h] = await Promise.all([scribe(bytes, "mkd"), scribe(bytes)]);
        const sim = lineSimilarity(w.text, mkH.text);
        // ElevenLabs mp3 is 128 kbps: 16 000 bytes a second.
        const secs = bytes.byteLength / 16000;
        const words = w.text.replace(/…/g, "").split(/\s+/).filter(Boolean).length;
        const flags: string[] = [];
        if (sim < 0.6) flags.push(`doesn't match (${sim.toFixed(2)})`);
        if (!SLAVIC.has(h.lang) && h.prob >= 0.5) flags.push(`sounds ${h.lang} (${h.prob.toFixed(2)})`);
        if (/\(.*\)/.test(mkH.text + h.text)) flags.push("sounds/noises");
        if (mkH.text.split(/\s+/).filter(Boolean).length > words + 1) flags.push("extra words");
        if (secs > 1.2 + 0.09 * w.text.length) flags.push(`long clip (${secs.toFixed(1)}s)`);
        results.push({ ...w, cached: true, heard: h.text, heardMk: mkH.text, lang: h.lang, prob: h.prob, sim, secs, flags });
      } catch (e) {
        results.push({ ...w, cached: true, flags: [`scribe error: ${e instanceof Error ? e.message : e}`] });
      }
      if (results.length % 50 === 0) console.log(`  ${results.length}/${work.length}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  writeFileSync(OUT, JSON.stringify(results, null, 2));
  const flagged = results.filter((r) => r.flags.length && r.cached);
  console.log(`\n${results.filter((r) => r.cached).length} cached clips checked · ${results.filter((r) => !r.cached).length} not cached · ${flagged.length} flagged → ${OUT.pathname}`);
  for (const r of flagged.sort((a, b) => (a.sim ?? 0) - (b.sim ?? 0))) console.log(`  ${r.text}  →  mk “${r.heardMk}” · free “${r.heard}” [${r.lang} ${r.prob?.toFixed(2)}] ${r.secs?.toFixed(1)}s · ${r.flags.join(", ")}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
