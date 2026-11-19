/**
 * Environment values that are safe in the browser. Each `process.env.NEXT_PUBLIC_*` is written out
 * literally so Next.js can inline it at build time.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined,
};

/** Supabase URL + publishable key, or a readable error naming what's missing (never values). */
export function supabasePublicConfig() {
  const missing = [
    !publicEnv.supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !publicEnv.supabaseAnonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}. See .env.example.`);
  }
  return { url: publicEnv.supabaseUrl, key: publicEnv.supabaseAnonKey };
}
