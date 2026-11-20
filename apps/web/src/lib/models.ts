/**
 * The single place that chooses models and knows their prices. Everything that calls a model
 * imports from here, so changing a model is one line. Prices are USD per million tokens (Anthropic
 * and OpenAI list prices, November 2026); cache reads and writes follow Anthropic's multipliers.
 */
import "server-only";

export const MODELS = {
  /** Answers: grounding and reasoning matter most. */
  strong: process.env.LLM_MODEL || "claude-sonnet-5-5",
  /** Rewrites, titles, follow-ups, diagram repair: fast and cheap. */
  fast: process.env.FAST_MODEL || "claude-haiku-5-5",
  embedding: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
} as const;

type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };

const PRICES: Record<string, Price> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "text-embedding-3-small": { input: 0.02, output: 0, cacheRead: 0, cacheWrite: 0 },
};

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
};

/** USD cost of one call; unknown models cost 0 and are logged by the caller. */
export function costUsd(model: string, usage: Usage) {
  const price = PRICES[model];
  if (!price) return 0;
  const uncached = Math.max(0, usage.input_tokens - usage.cache_read_tokens - usage.cache_write_tokens);
  const usd =
    (uncached * price.input +
      usage.cache_read_tokens * price.cacheRead +
      usage.cache_write_tokens * price.cacheWrite +
      usage.output_tokens * price.output) /
    1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

export const knownModel = (model: string) => model in PRICES;
