import "server-only";
/**
 * Per-person chat limits (protects the API bill): CHAT_LIMIT_PER_MINUTE and
 * CHAT_LIMIT_PER_DAY_FREE. Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN are set (fast, shared
 * across instances); otherwise the person's own questions in the database are counted.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type LimitResult =
  { ok: true } | { ok: false; retryAfterSeconds: number; scope: "minute" | "day" };

const num = (name: string, fallback: number) => {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
export const chatLimits = () => ({
  perMinute: num("CHAT_LIMIT_PER_MINUTE", 10),
  perDay: num("CHAT_LIMIT_PER_DAY_FREE", 50),
});

let upstash: Promise<null | ((userId: string) => Promise<LimitResult>)> | undefined;

async function upstashLimiter() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import("@upstash/ratelimit"),
    import("@upstash/redis"),
  ]);
  const redis = new Redis({ url, token });
  const { perMinute, perDay } = chatLimits();
  const minute = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(perMinute, "1 m"),
    prefix: "tlm:chat:m",
  });
  const day = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(perDay, "1 d"),
    prefix: "tlm:chat:d",
  });
  return async (userId: string): Promise<LimitResult> => {
    const m = await minute.limit(userId);
    if (!m.success)
      return {
        ok: false,
        scope: "minute",
        retryAfterSeconds: Math.max(1, Math.ceil((m.reset - Date.now()) / 1000)),
      };
    const d = await day.limit(userId);
    if (!d.success)
      return {
        ok: false,
        scope: "day",
        retryAfterSeconds: Math.max(60, Math.ceil((d.reset - Date.now()) / 1000)),
      };
    return { ok: true };
  };
}

/** Counts the person's questions in the last minute and day (fallback without Redis). */
export async function databaseLimit(
  admin: SupabaseClient<Database>,
  userId: string,
  now = Date.now(),
): Promise<LimitResult> {
  const { perMinute, perDay } = chatLimits();
  const count = async (sinceMs: number) => {
    const { count: n } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user")
      .gte("created_at", new Date(now - sinceMs).toISOString());
    return n ?? 0;
  };
  if ((await count(60_000)) >= perMinute)
    return { ok: false, scope: "minute", retryAfterSeconds: 60 };
  if ((await count(86_400_000)) >= perDay)
    return { ok: false, scope: "day", retryAfterSeconds: 3600 };
  return { ok: true };
}

export async function checkChatLimit(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<LimitResult> {
  upstash ??= upstashLimiter().catch(() => null);
  const limiter = await upstash;
  return limiter ? limiter(userId) : databaseLimit(admin, userId);
}
