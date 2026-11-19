import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabasePublicConfig } from "@/lib/public-env";

/** Supabase client for Client Components (uses the publishable key; RLS applies). */
export function createClient() {
  const { url, key } = supabasePublicConfig();
  return createBrowserClient<Database>(url, key);
}
