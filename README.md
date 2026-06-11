# Languages — conversation-first language learning

Macedonian-first, **language-agnostic core**. North star: get from zero to holding a simple real
conversation in a Macedonian bar/café. See **[DESIGN.md](DESIGN.md)** for the full architecture,
data models, content pipeline, phased roadmap, and risk decisions.

> Status: **scaffold** (Prompt 1 output). Stub interfaces + per-module READMEs, no feature logic yet.
> The throwaway speaking-feedback prototype lives in [`spike/`](spike/) and is the reference the
> Phase-0 speaking pipeline is ported from.

## The one rule

```
packages/core   = ALL logic, ZERO hardcoded language   ─┐
packages/pack-* = ALL language data, ZERO logic         ─┴─ contract: packages/pack-schema
```

Adding a language must be **producing + validating a new pack**, never editing `core`. The explicit
test (DESIGN.md §6, Phase 3): generate a Bulgarian pack and confirm it touches no `core` code.

## Monorepo map

| Path | What |
|---|---|
| `packages/pack-schema` | The `LanguagePack` contract (types). Core and packs both import it. |
| `packages/core` | Language-agnostic engines: SRS, scenario, **speaking (dual-ASR gate)**, tutor, leveling. |
| `packages/pack-mk` | Macedonian pack — data only. First bar scenario hand-authored as the known-good reference. |
| `pipeline` | Offline content agents: profiler → architect → generator → validator (deferred). |
| `apps/web` | Next.js app: practice UI + server API routes that hold the keys. |
| `spike/` | Throwaway reference prototype (kept; nothing depends on it). |

## Toolchain (intended)

pnpm workspaces · TypeScript · Next.js on Vercel · Supabase (Postgres + Auth + Storage) ·
`ts-fsrs` · Anthropic (Sonnet live / Opus offline) · ElevenLabs (TTS + Scribe) · Google STT.

`pnpm install` then `pnpm dev` once the stubs are filled in — not wired yet.
