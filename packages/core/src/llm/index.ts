// Shared Anthropic client + structured-output helper + model tiering + per-model cost meter.
// This is the ONLY place core talks to the LLM. It is language-agnostic: prompts that generate
// target-language text are built by the callers (speaking/tutor) from pack-supplied values.
import Anthropic from "@anthropic-ai/sdk";

/**
 * Model tiers — measured, not assumed (DESIGN.md §0):
 * - `live`: Sonnet 4.6 — any live turn that GENERATES target language (tutor, feedback). Cheaper
 *   tiers (Haiku) make gender-agreement errors in low-resource languages; Sonnet is clean.
 * - `offline`: Opus 4.8 — one-time content generation + validation (correctness-critical).
 * - `mechanical`: Haiku 4.5 — live calls that produce NO novel target language (routing, scoring).
 */
export const MODELS = {
  live: "claude-sonnet-4-6",
  offline: "claude-opus-4-8",
  mechanical: "claude-haiku-4-5",
} as const;

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** USD per 1M tokens, per model (for the dev cost meter). */
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

export function priceUsd(model: string, usage?: { input_tokens?: number; output_tokens?: number } | null): number {
  const p = PRICING[model];
  if (!p) return 0;
  const inTok = usage?.input_tokens ?? 0;
  const outTok = usage?.output_tokens ?? 0;
  return +((inTok / 1e6) * p.in + (outTok / 1e6) * p.out).toFixed(5);
}

let _client: Anthropic | null = null;
/** Inject a client (tests) or reset with null. */
export function setClient(c: Anthropic | null): void {
  _client = c;
}
/** Lazily construct a shared client. Reads ANTHROPIC_API_KEY from the server env (route handler / pipeline). */
export function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export interface StructuredCallOpts {
  model: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  effort?: Effort;
  maxTokens: number;
  /** Adaptive thinking — on for offline correctness work; omit for fast live turns. */
  thinking?: boolean;
}

export interface StructuredResult<T> {
  data: T;
  ms: number;
  usage: Anthropic.Usage;
  costUsd: number;
  stopReason: string | null;
}

/**
 * One structured-output call. Mirrors the spike's proven shape (`output_config.format` json_schema),
 * generalized over the model tier. Throws on truncation or unparseable output.
 */
export async function structuredCall<T>(opts: StructuredCallOpts): Promise<StructuredResult<T>> {
  const t = Date.now();
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    output_config: {
      ...(opts.effort ? { effort: opts.effort } : {}),
      format: { type: "json_schema", schema: opts.schema },
    },
  };
  if (opts.thinking) params.thinking = { type: "adaptive" };

  const msg = await getClient().messages.create(params);
  if (msg.stop_reason === "refusal") throw new Error("LLM refused the request");
  if (msg.stop_reason === "max_tokens") throw new Error("Response truncated (max_tokens) — raise maxTokens");
  const textBlock = msg.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) throw new Error(`No text block in LLM response (stop_reason=${msg.stop_reason})`);
  let data: T;
  try {
    data = JSON.parse(textBlock.text) as T;
  } catch {
    throw new Error(`Failed to parse structured output: ${textBlock.text.slice(0, 200)}`);
  }
  return { data, ms: Date.now() - t, usage: msg.usage, costUsd: priceUsd(opts.model, msg.usage), stopReason: msg.stop_reason };
}
