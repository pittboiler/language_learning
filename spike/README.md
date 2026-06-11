# Macedonian Speaking-Feedback Spike

Throwaway prototype answering **one** question: *can ASR give a beginner useful,
non-misleading spoken-Macedonian feedback today?*

Loop: native TTS prompt → record your mic → Macedonian ASR (ElevenLabs Scribe **and**
Google STT, head-to-head) → an LLM turns the diff into coaching → one open conversational
turn. Deliberately throwaway — clarity over polish. Do not grow it into the real app.

---

## 1. Prerequisites
- **Node 20+** (for built-in `fetch` / `FormData`)
- Three credentials (below): Anthropic ✅, ElevenLabs, Google Cloud STT

## 2. Get your keys

### Anthropic — you already have it
Paste your existing key into `.env` as `ANTHROPIC_API_KEY`.

### ElevenLabs (TTS + Scribe ASR) — one key, ~1 min
1. Sign in at <https://elevenlabs.io>
2. Click your **profile (bottom-left)** → **API Keys**, or go straight to
   <https://elevenlabs.io/app/settings/api-keys>
3. **Create API Key** → name it `macedonian-spike` → **Create**
4. **Copy it now** (shown only once). Paste into `.env` as `ELEVENLABS_API_KEY`.

> Scribe (speech-to-text) is billed per minute of audio; spike usage is pennies. If a call
> fails on quota with a bare free account, add the smallest credit top-up.

### Google Cloud Speech-to-Text — service account, NOT an API key (~5 min)
Google STT rejects plain API keys; it needs a **service-account JSON file**.
1. <https://console.cloud.google.com> → create or select a project (e.g. `macedonian-spike`)
2. Enable **billing** on the project (STT has a free **60 min/month** tier — you won't be
   charged within it, but billing must be on)
3. Top search bar → **"Cloud Speech-to-Text API"** → open it → **Enable**
4. **IAM & Admin → Service Accounts → Create Service Account** → name `stt-spike` →
   **Continue** → (you can skip granting a role) → **Done**
5. Click the new service account → **Keys** tab → **Add Key → Create new key → JSON** →
   a `.json` file downloads
6. Move that file into **this `spike/` folder** and rename it **`gcp-stt-key.json`**
   (already gitignored)

> If you later hit a `403 PERMISSION_DENIED`, come back to the service account and grant it
> a basic role (e.g. Editor) — but with the API enabled and billing on it usually just works.

## 3. Configure
```bash
cp .env.example .env
# fill in ANTHROPIC_API_KEY and ELEVENLABS_API_KEY
# (GOOGLE_APPLICATION_CREDENTIALS already points at ./gcp-stt-key.json)
```

## 4. Run
```bash
npm install
npm start          # → http://localhost:5050
```
Open **http://localhost:5050 in Chrome** (mic capture needs a real tab, not a preview pane); allow the mic when prompted.

- **Phrase practice** — pick a phrase → ▶︎ Play native → ⏺ Record → see *both* ASR transcripts + Claude's coaching. The card flags **"likely ASR error"** when the two engines disagree.
- **⚙ Clean-audio baseline** — TTS → both ASR engines. Mismatches here are pure ASR limits, not your speech.
- **Open conversation** — speak (or type) a freeform turn; the tutor replies in simple Macedonian + gloss + one gentle correction.

## Gotchas (already resolved)
- ElevenLabs **Scribe ASR works on the free plan**, but **TTS needs a paid tier** (Starter, ~$6/mo) to use library voices via the API. Google Cloud has **no Macedonian TTS** voice.
- **Google STT** needs the *Cloud Speech-to-Text API* explicitly enabled in your project (separate step from creating the service account); the service-account JSON alone isn't enough.
- Google STT encoding must match the audio: `WEBM_OPUS` for the browser mic, `MP3` for the TTS baseline.
