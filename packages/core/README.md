# @ll/core

The language-agnostic engine room. **Zero hardcoded language** — every function operates on shapes
from `@ll/pack-schema`, populated by whatever pack is active. If you find yourself typing Macedonian
in here, it belongs in a pack instead.

| Module | Responsibility |
|---|---|
| `srs/` | Spaced repetition over `ReviewItem`s (vocab, phrases, grammar). Wraps `ts-fsrs`; we own only the item↔card mapping and due selection. |
| `scenario/` | Runs a `Scenario`: tracks turns, checks `successCriteria`, reports completion. |
| `speaking/` | **Dual-ASR confidence gate + feedback composer.** The spike-proven mechanism — record → Scribe + Google → agreement gate → structured coaching that hedges when the engines disagree. Ported from `spike/server.js`. |
| `tutor/` | Open conversation loop: simple-Macedonian reply + gloss + one correction + suggested next replies, with spoken (TTS) replies. Ported from `spike/server.js`. Runs on the **Sonnet 4.6** tier (generates language → see DESIGN.md §0). |
| `leveling/` | The i+1 model: current level estimate + selecting content just above it. |

LLM and provider calls are injected (the app wires keys server-side); `core` defines the logic and
prompts, not the transport.
