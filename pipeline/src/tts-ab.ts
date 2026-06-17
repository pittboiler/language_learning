// Throwaway A/B helper: synthesize a Macedonian "stress-trap" test set across TTS models (and any
// voices you pass), save the clips, and write a compare.html you open in a browser to listen.
//
//   pipeline/node_modules/.bin/tsx pipeline/src/tts-ab.ts
//   VOICES="<id>:Label,<id2>:Label2" pipeline/node_modules/.bin/tsx pipeline/src/tts-ab.ts   # add library voices
//
// The app key is TTS/STT-scoped (can't list voices), so voice candidates are passed in by id.
import "./env.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "pipeline", "output", "tts-ab");
const KEY = process.env.ELEVENLABS_API_KEY!;
const RACHEL = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // current pack voice

// Models to compare (quality-relevant; latency irrelevant for offline pre-warm). v3 may not be API-enabled.
const MODELS = ["eleven_multilingual_v2", "eleven_v3", "eleven_turbo_v2_5"];

// voice candidates: current voice + any passed via VOICES="id:Label,..."
const VOICES: { id: string; label: string }[] = [{ id: RACHEL, label: "current (Rachel)" }];
for (const pair of (process.env.VOICES || "").split(",").map((s) => s.trim()).filter(Boolean)) {
  const [id, ...rest] = pair.split(":");
  if (id) VOICES.push({ id: id.trim(), label: (rest.join(":") || id).trim() });
}

// The stress-trap test set — each line targets a known MK TTS failure mode.
const LINES: { slug: string; text: string; gloss: string; targets: string }[] = [
  { slug: "01-kafe", text: "кафе", gloss: "coffee", targets: "loanword FINAL stress (ka-FE), not antepenultimate" },
  { slug: "02-kafe-price", text: "Колку чини кафето?", gloss: "How much is the coffee?", targets: "кафе stress in a sentence + чини" },
  { slug: "03-unique-gj-kj", text: "Ѓорѓи и Ќира пијат чај.", gloss: "Gjorgji and Kjira drink tea.", targets: "ѓ / ќ palatals (often Russified)" },
  { slug: "04-unique-letters", text: "Ѕвезда, џезве, њива, љубов.", gloss: "Star, coffee-pot, field, love.", targets: "ѕ(dz) џ(dzh) њ(nj) љ(lj)" },
  { slug: "05-still-learning", text: "Сѐ уште учам македонски.", gloss: "I'm still learning Macedonian.", targets: "сѐ + natural sentence stress" },
  { slug: "06-benchmark", text: "Здраво! Едно пиво, ве молам.", gloss: "Hi! One beer, please.", targets: "the café benchmark line" },
  { slug: "07-numbers", text: "Сто и педесет денари.", gloss: "A hundred and fifty denars.", targets: "numbers + денари" },
  { slug: "08-repair", text: "Не разбирам, побавно те молам.", gloss: "I don't understand, slower please.", targets: "разбирам / побавно stress" },
];

async function synth(voice: string, model: string, text: string): Promise<{ ok: true; buf: ArrayBuffer } | { ok: false; err: string }> {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  });
  if (!r.ok) return { ok: false, err: `${r.status} ${(await r.text()).slice(0, 120)}` };
  return { ok: true, buf: await r.arrayBuffer() };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  // probe which models actually work (with the current voice + a 1-char-ish line), to skip dead ones.
  const liveModels: string[] = [];
  console.log("Probing models…");
  for (const m of MODELS) {
    const p = await synth(RACHEL, m, "Здраво.");
    console.log(`  ${m}: ${p.ok ? "OK ✓" : "✗ " + p.err}`);
    if (p.ok) liveModels.push(m);
  }
  if (!liveModels.length) { console.error("No working models — aborting."); process.exit(1); }

  const grid: Record<string, Record<string, string>> = {}; // slug -> `${voiceLabel} · ${model}` -> filename
  let chars = 0;
  for (const v of VOICES) {
    for (const m of liveModels) {
      for (const l of LINES) {
        const res = await synth(v.id, m, l.text);
        const colKey = `${v.label} · ${m.replace("eleven_", "")}`;
        const row = (grid[l.slug] ??= {});
        if (res.ok) {
          const fn = `${l.slug}__${v.label.replace(/[^a-z0-9]+/gi, "-")}__${m.replace("eleven_", "")}.mp3`;
          writeFileSync(join(OUT, fn), Buffer.from(res.buf));
          row[colKey] = fn;
          chars += l.text.length;
        } else {
          row[colKey] = `ERR: ${res.err}`;
        }
      }
      console.log(`  synthesized: ${v.label} · ${m}`);
    }
  }

  // compare.html
  const cols = [...new Set(VOICES.flatMap((v) => liveModels.map((m) => `${v.label} · ${m.replace("eleven_", "")}`)))];
  const rows = LINES.map((l) => {
    const cells = cols.map((c) => {
      const val = grid[l.slug]?.[c] || "";
      return val.endsWith(".mp3")
        ? `<td><audio controls preload="none" src="./${val}"></audio></td>`
        : `<td style="color:#c00;font-size:12px">${val || "—"}</td>`;
    }).join("");
    return `<tr><td><b style="font-size:20px">${l.text}</b><br><span style="color:#666">${l.gloss}</span><br><span style="color:#999;font-size:12px">🎯 ${l.targets}</span></td>${cells}</tr>`;
  }).join("\n");
  const html = `<!doctype html><meta charset="utf-8"><title>MK TTS A/B</title>
<body style="font-family:system-ui;max-width:1100px;margin:24px auto;padding:0 16px">
<h1>Macedonian TTS — voice/model A/B</h1>
<p>Listen across each row. Pick the column that gets <b>stress</b> and the <b>unique letters</b> (ѓ ќ ѕ џ њ љ ј) right and sounds least foreign. Tell me the winner; add voices with <code>VOICES="id:Label"</code>.</p>
<table cellpadding="8" style="border-collapse:collapse" border="1">
<tr><th align="left">Line (🎯 = what to judge)</th>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>
${rows}
</table></body>`;
  writeFileSync(join(OUT, "compare.html"), html);

  console.log(`\nWrote ${cols.length}×${LINES.length} clips + compare.html to pipeline/output/tts-ab/  (~${chars} chars synthesized)`);
  console.log(`Open:  open pipeline/output/tts-ab/compare.html`);
}

main().catch((e) => { console.error(e); process.exit(1); });
