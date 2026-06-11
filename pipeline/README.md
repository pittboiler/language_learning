# @ll/pipeline — offline content agents

Produces a **validated, cached** `LanguagePack` for any sufficiently-resourced language. Runs
**offline** (cost + consistency) — never at request time. Generation runs on **Opus 4.8** (the
quality tier; DESIGN.md §0).

```
profiler ──▶ architect ──▶ generator ──▶ [validator: DEFERRED] ──▶ cached LanguagePack
```

| Agent | In → Out |
|---|---|
| `profiler` | language code → structured profile (script, phonology, the grammar features that matter, high-freq vocab, social norms). |
| `architect` | profile → leveled skill tree + scenario sequence, built **backwards** from the conversation goal. |
| `generator` | curriculum → graded dialogues / readers / drills / SRS items at i+1, plus TTS jobs. Every item starts `confidence: "unreviewed"`. |
| `validator` | **Deferred for v1** (DESIGN.md §5). The human spot-checks instead; items stay `unreviewed` and are gated until reviewed. Turning this on later is additive. |

The generator validates its output against the hand-authored reference scenario in `@ll/pack-mk`
(`order-a-drink`) for style + correctness.
