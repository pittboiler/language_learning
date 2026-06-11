// Macedonian speaking-feedback spike — throwaway backend.
// One job: prove whether ASR can give a beginner useful, non-misleading
// spoken-Macedonian feedback today. Clarity over polish.

import "dotenv/config";
import { existsSync } from "node:fs";
import express from "express";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import speech from "@google-cloud/speech";
import { phrases } from "./phrases.js";
import { alphabet, scenarios, grammar, readers, reviewItems } from "./pack.js";

const PORT = process.env.PORT || 5050;

// ---- Provider availability (defensive: treat untouched placeholders as missing)
const ELEVEN_KEY = clean(process.env.ELEVENLABS_API_KEY);
const ANTHROPIC_KEY = clean(process.env.ANTHROPIC_API_KEY);
const GOOGLE_CREDS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const hasEleven = !!ELEVEN_KEY;
const hasAnthropic = !!ANTHROPIC_KEY;
const hasGoogle = !!GOOGLE_CREDS && existsSync(GOOGLE_CREDS);

function clean(v) {
  if (!v || v.startsWith("PASTE_")) return "";
  return v.trim();
}

const SCRIBE_MODEL = process.env.SCRIBE_MODEL || "scribe_v2";
const SCRIBE_LANG = process.env.SCRIBE_LANG || "mkd"; // retried without on 4xx
const TTS_MODEL = process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2";
const LLM_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const anthropic = hasAnthropic ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;
let googleClient = null;
function getGoogle() {
  if (!hasGoogle) throw new Error("Google STT not configured");
  if (!googleClient) googleClient = new speech.SpeechClient();
  return googleClient;
}

const app = express();
app.use(express.json({ limit: "2mb" }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ---------------------------------------------------------------------------
// ElevenLabs — TTS
// ---------------------------------------------------------------------------
// Default to a stable premade voice so we don't need the `voices_read`
// permission. Override with ELEVENLABS_VOICE_ID for a different/native voice.
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // "Rachel" — premade, multilingual
async function resolveVoiceId() {
  return DEFAULT_VOICE_ID;
}

async function synthesize(text, speed) {
  const voiceId = await resolveVoiceId();
  const voice_settings = { stability: 0.5, similarity_boost: 0.75 };
  if (speed) voice_settings.speed = Math.max(0.7, Math.min(1.2, Number(speed))); // 0.7 = slowest
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": ELEVEN_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: TTS_MODEL, voice_settings }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------------------
// ASR — ElevenLabs Scribe + Google STT
// ---------------------------------------------------------------------------
async function transcribeEleven(buffer, mime = "audio/webm") {
  // Try v2+lang, then v2 auto-detect, then v1 auto-detect. Robust to an
  // unsupported language code or an account without v2.
  const attempts = [
    { model: SCRIBE_MODEL, lang: SCRIBE_LANG },
    { model: SCRIBE_MODEL, lang: null },
    { model: "scribe_v1", lang: null },
  ];
  let lastErr = "";
  for (const a of attempts) {
    const form = new FormData();
    form.append("model_id", a.model);
    if (a.lang) form.append("language_code", a.lang);
    form.append("file", new Blob([buffer], { type: mime }), "audio.webm");
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": ELEVEN_KEY },
      body: form,
    });
    if (res.ok) {
      const data = await res.json();
      return { text: (data.text ?? "").trim(), language: data.language_code ?? null, via: a };
    }
    lastErr = `${res.status}: ${await res.text()}`;
    if (res.status !== 400 && res.status !== 422) break; // not a param problem — stop retrying
  }
  throw new Error(`Scribe ${lastErr}`);
}

function googleEncoding(mime = "audio/webm") {
  if (mime.includes("webm")) return { encoding: "WEBM_OPUS" };
  if (mime.includes("ogg")) return { encoding: "OGG_OPUS" };
  if (mime.includes("mpeg") || mime.includes("mp3")) return { encoding: "MP3", sampleRateHertz: 44100 };
  if (mime.includes("wav")) return { encoding: "LINEAR16", sampleRateHertz: 16000 };
  return { encoding: "WEBM_OPUS" };
}

async function transcribeGoogle(buffer, mime = "audio/webm") {
  const client = getGoogle();
  const [resp] = await client.recognize({
    config: {
      ...googleEncoding(mime),
      languageCode: "mk-MK",
      enableAutomaticPunctuation: true,
    },
    audio: { content: buffer.toString("base64") },
  });
  const text = (resp.results || [])
    .map((r) => r.alternatives?.[0]?.transcript || "")
    .join(" ")
    .trim();
  return { text };
}

// Run whichever engines are configured, with per-engine timing + errors.
async function runAsr(buffer, mime) {
  const out = {};
  if (hasEleven) out.eleven = await timed(() => transcribeEleven(buffer, mime));
  if (hasGoogle) out.google = await timed(() => transcribeGoogle(buffer, mime));
  return out;
}

async function timed(fn) {
  const t = Date.now();
  try {
    const r = await fn();
    return { ...r, ms: Date.now() - t, ok: true };
  } catch (e) {
    return { error: String(e.message || e), ms: Date.now() - t, ok: false };
  }
}

// ---------------------------------------------------------------------------
// Claude — feedback + conversation
// ---------------------------------------------------------------------------
const FEEDBACK_SYSTEM = `You are an expert, encouraging Macedonian tutor coaching an ABSOLUTE BEGINNER who has just spoken a target phrase aloud.

You receive: the TARGET phrase (Cyrillic + transliteration + English) and one or two ASR (speech-to-text) transcripts of the learner's spoken attempt.

CRITICAL — ASR on beginner Macedonian is unreliable. The transcripts may misrecognise correct speech. Before judging the learner:
- If the two transcripts disagree with each other, or a transcript contains an implausible word/substitution, treat the discrepancy as a likely ASR artifact, NOT a learner error. Set asrCaveat.likelyAsrError = true and explain.
- Never harshly mark the learner "wrong" for something that is plausibly just a recognition error.

Pedagogy:
- Apply the antepenultimate stress rule (stress on the 3rd-from-last syllable) and flag obvious violations, but note known loanword exceptions (e.g. кафе → ka-FE).
- Keep coaching short, warm, and level-appropriate. One concrete tip only.
- Be honest but kind; this learner cannot yet read Cyrillic fluently.`;

const FEEDBACK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    overall: { type: "string", description: "One short, friendly paragraph assessing the attempt." },
    words: {
      type: "array",
      description: "Per-word judgement of the target phrase.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          target: { type: "string" },
          status: { type: "string", enum: ["correct", "mispronounced", "wrong", "missed", "uncertain"] },
          note: { type: "string" },
        },
        required: ["target", "status", "note"],
      },
    },
    pronunciation: { type: "string", description: "Pronunciation/accuracy assessment." },
    stress: { type: "string", description: "Stress comment (antepenultimate rule; note exceptions)." },
    tip: { type: "string", description: "One concrete improvement tip." },
    asrCaveat: {
      type: "object",
      additionalProperties: false,
      properties: {
        likelyAsrError: { type: "boolean", description: "True if the diff looks like an ASR artifact, not a learner error." },
        explanation: { type: "string" },
      },
      required: ["likelyAsrError", "explanation"],
    },
    score: { type: "integer", description: "Rough accuracy 0-100." },
  },
  required: ["overall", "words", "pronunciation", "stress", "tip", "asrCaveat", "score"],
};

const CHAT_SYSTEM = `You are a warm, patient Macedonian conversation partner chatting with an ABSOLUTE BEGINNER in a relaxed bar/café setting. You receive the learner's spoken turn as an ASR transcript (which may contain recognition errors — be charitable).

Reply in SIMPLE, short, natural Macedonian (one or two sentences). Provide a faithful English gloss. Gently correct ONE thing from their attempt — pick the most useful single fix, phrased kindly. If their turn was fine (or the transcript is too garbled to correct meaningfully), leave correction empty and instead keep the conversation going.

Also suggest 2-3 very simple, natural things the learner could say NEXT to continue the conversation, each with an English gloss — short enough for an absolute beginner to attempt out loud.`;

const CHAT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    replyMk: { type: "string", description: "Your reply in simple Macedonian (Cyrillic)." },
    replyGloss: { type: "string", description: "English gloss of your reply." },
    correction: { type: "string", description: "Gentle correction of one thing, or empty string." },
    suggestions: {
      type: "array",
      description: "2-3 short, simple things the learner could say NEXT to continue.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { mk: { type: "string" }, en: { type: "string" } },
        required: ["mk", "en"],
      },
    },
  },
  required: ["replyMk", "replyGloss", "correction", "suggestions"],
};

function priceUsd(usage) {
  // claude-opus-4-8: $5 / 1M input, $25 / 1M output
  const inTok = usage?.input_tokens ?? 0;
  const outTok = usage?.output_tokens ?? 0;
  return +((inTok / 1e6) * 5 + (outTok / 1e6) * 25).toFixed(5);
}

async function claudeStructured({ system, user, schema, effort, maxTokens }) {
  const t = Date.now();
  const msg = await anthropic.messages.create({
    model: LLM_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort, format: { type: "json_schema", schema } },
  });
  const textBlock = msg.content.find((b) => b.type === "text");
  const data = JSON.parse(textBlock.text);
  return { data, ms: Date.now() - t, usage: msg.usage, costUsd: priceUsd(msg.usage), stopReason: msg.stop_reason };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get("/api/config", (_req, res) => {
  res.json({
    engines: { eleven: hasEleven, google: hasGoogle, anthropic: hasAnthropic },
    models: { llm: LLM_MODEL, scribe: SCRIBE_MODEL, tts: TTS_MODEL },
  });
});

app.get("/api/phrases", (_req, res) => res.json({ phrases }));
app.get("/api/pack", (_req, res) => res.json({ alphabet, scenarios, grammar, readers, reviewItems }));

app.post("/api/tts", async (req, res) => {
  try {
    if (!hasEleven) return res.status(400).json({ error: "ElevenLabs not configured" });
    const audio = await synthesize(req.body.text, req.body.speed);
    res.set("Content-Type", "audio/mpeg").send(audio);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/asr", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "no audio uploaded" });
    const result = await runAsr(req.file.buffer, req.file.mimetype || "audio/webm");
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/feedback", async (req, res) => {
  try {
    if (!hasAnthropic) return res.status(400).json({ error: "Anthropic not configured" });
    const { target, transcriptEleven, transcriptGoogle } = req.body;
    const user = [
      "TARGET (what they were asked to say):",
      `  Cyrillic: ${target.cyrillic}`,
      `  Translit: ${target.translit}`,
      `  English: ${target.english}`,
      target.note ? `  Note: ${target.note}` : "",
      "",
      "ASR TRANSCRIPTS of the learner's spoken attempt:",
      `  ElevenLabs Scribe: ${transcriptEleven ?? "(not available)"}`,
      `  Google STT: ${transcriptGoogle ?? "(not available)"}`,
      "",
      "Give structured coaching feedback for an absolute beginner.",
    ].filter(Boolean).join("\n");
    const out = await claudeStructured({ system: FEEDBACK_SYSTEM, user, schema: FEEDBACK_SCHEMA, effort: "medium", maxTokens: 4000 });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!hasAnthropic) return res.status(400).json({ error: "Anthropic not configured" });
    const { userText, history } = req.body;
    const convo = (history || []).map((h) => `${h.role === "user" ? "Learner" : "You"}: ${h.text}`).join("\n");
    const user = [
      convo ? `Conversation so far:\n${convo}\n` : "",
      `Learner's latest spoken turn (ASR transcript): ${userText}`,
    ].filter(Boolean).join("\n");
    const out = await claudeStructured({ system: CHAT_SYSTEM, user, schema: CHAT_SCHEMA, effort: "low", maxTokens: 1500 });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Clean-audio baseline: TTS the target, feed that native audio back through
// both ASR engines. This is the "native-like" control — no human voice needed.
app.post("/api/baseline", async (req, res) => {
  try {
    if (!hasEleven) return res.status(400).json({ error: "ElevenLabs (TTS) not configured" });
    const text = req.body.text;
    const tts = await timed(async () => ({ buffer: await synthesize(text) }));
    if (!tts.ok) return res.status(500).json({ error: `TTS failed: ${tts.error}` });
    const asr = await runAsr(tts.buffer, "audio/mpeg");
    res.json({ target: text, ttsMs: tts.ms, ...asr });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`\n  Macedonian speaking spike → http://localhost:${PORT}\n`);
  console.log(`  Engines: ElevenLabs=${hasEleven}  Google STT=${hasGoogle}  Anthropic=${hasAnthropic}`);
  if (!hasEleven) console.log("  ⚠ ELEVENLABS_API_KEY missing — TTS and Scribe ASR disabled.");
  if (!hasGoogle) console.log("  ⚠ Google creds missing — Google STT disabled (Scribe-only is fine).");
  if (!hasAnthropic) console.log("  ⚠ ANTHROPIC_API_KEY missing — feedback/chat disabled.");
  console.log("");
});
