# PROMPT 2 — Speaking & Pronunciation Feedback Spike
### De-risk the hardest part before building the rest

> Paste below the line into Claude Code. This is a deliberately throwaway **spike**: a
> minimal, standalone prototype whose only job is to answer one question — *can we give
> useful spoken-Macedonian feedback to a beginner with today's tooling?* Build the smallest
> thing that tests that. Do not build the full app here.

---

You are helping me run a focused technical spike. The single biggest risk in my
conversation-first Macedonian learning app is the **speaking-feedback loop**: capturing my
voice, recognizing error-filled beginner Macedonian, and giving feedback useful enough to
actually improve my pronunciation and word choice. ASR (automatic speech recognition) on
non-native, mistake-prone speech in a lower-resource language is the weak link, so I want to
validate it BEFORE committing to a full architecture.

Build a **minimal standalone web prototype** (throwaway quality is fine — clarity over
polish) that does end to end:

1. **Prompt me to say a target Macedonian phrase** — show the Cyrillic, a transliteration,
   and play native TTS audio of it (use a provider with confirmed Macedonian support;
   recommend one and justify briefly).
2. **Record my microphone** in the browser and run it through **Macedonian ASR**
   (speech-to-text). Use a provider with confirmed Macedonian support (e.g. Google Cloud
   Speech-to-Text or ElevenLabs Scribe); recommend one and explain the choice.
3. **Compare my transcription to the target** and produce **structured feedback**:
   - which words I got right / wrong / missed,
   - a pronunciation/accuracy assessment,
   - a note on stress where detectable (Macedonian stress falls on the 3rd-from-last
     syllable — flag obvious violations),
   - one concrete tip to improve.
   Use an LLM (e.g. Claude) to turn the raw comparison into friendly, level-appropriate
   coaching.
4. **One open conversational turn:** let me say something freeform in Macedonian; have the
   LLM respond in simple Macedonian (with optional English gloss) and gently correct one
   thing. This tests the live-tutor experience.

Then give me an **honest assessment**, since the point of the spike is the verdict, not the
demo:
- How accurate was Macedonian ASR on clear native-like audio vs. on my error-filled
  beginner attempts? Where did it fail?
- Is the feedback good enough to actually help a beginner, or does ASR noise make it
  misleading (e.g. marking correct speech wrong)?
- Latency and rough cost per practice turn.
- Your recommendation: is speaking-first feedback viable for Macedonian today? If ASR is too
  weak, what's the fallback (e.g. shadowing native audio, self-assessment, scripted-response
  matching instead of open ASR)?
- What this implies for the full architecture in Prompt 1.

Constraints: keep it to the smallest codebase that proves the point. Tell me exactly what
API keys/env vars I need to supply and how to run it locally. Ask me which providers I
already have access to before assuming.
