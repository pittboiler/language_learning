// Save cached TTS clips to a folder for a closer look: DIR=/tmp/x TEXTS="тие|тој" tsx pipeline/src/dump-tts.ts
// (MODEL=eleven_multilingual_v2 to fetch / synthesize that model's take instead; SYNTH=1 synthesizes a miss
// WITHOUT caching it.)
import "./env.js";
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { macedonian as mk } from "@ll/pack-mk";
import { resolveTts, getCached, synthesize } from "../../apps/web/lib/tts-cache.js";

const VOICE = process.env.ELEVENLABS_VOICE_ID || mk.voiceId;
for (const text of (process.env.TEXTS ?? "").split("|").filter(Boolean)) {
  const r = resolveTts(text, VOICE);
  const model = process.env.MODEL ?? r.model;
  const path = model === r.model ? r.path : `${createHash("sha256").update(`${r.speakText}|${r.voice}|${model}`).digest("hex")}.mp3`;
  let bytes = await getCached(path);
  if (!bytes && process.env.SYNTH) bytes = await synthesize(r.speakText, model, r.voice);
  const name = `${process.env.DIR}/${createHash("md5").update(text + model).digest("hex").slice(0, 8)}.mp3`;
  if (bytes) writeFileSync(name, Buffer.from(bytes));
  console.log(`${text}\t${model}\t${bytes ? name : "(not cached)"}`);
}
