import "server-only";
import { z } from "zod";

/**
 * Server-only environment, validated lazily per area so one missing AI key doesn't stop sign-in.
 * Errors list variable NAMES only — values are never printed.
 */
const schemas = {
  supabaseAdmin: z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  }),
  ai: z.object({
    ANTHROPIC_API_KEY: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    LLM_MODEL: z.string().min(1).default("claude-sonnet-5-5"),
    EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  }),
  worker: z.object({
    WORKER_URL: z.url(),
    WORKER_SECRET: z.string().min(16, "must be at least 16 characters"),
  }),
} as const;

type Area = keyof typeof schemas;
const cache = new Map<Area, unknown>();

export function readEnv<A extends Area>(
  area: A,
  source: Record<string, string | undefined> = process.env,
): z.infer<(typeof schemas)[A]> {
  if (source === process.env && cache.has(area))
    return cache.get(area) as z.infer<(typeof schemas)[A]>;
  const result = schemas[area].safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const name = String(issue.path[0]);
      return source[name] ? `${name} (${issue.message})` : `${name} (missing)`;
    });
    throw new Error(`Invalid environment for ${area}: ${problems.join(", ")}. See .env.example.`);
  }
  if (source === process.env) cache.set(area, result.data);
  return result.data as z.infer<(typeof schemas)[A]>;
}
