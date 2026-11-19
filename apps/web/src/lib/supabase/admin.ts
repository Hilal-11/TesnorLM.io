import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { readEnv } from "@/lib/env";

/** Service-role client: bypasses RLS. Server code and scripts only, and only when RLS can't apply. */
export function createAdmin() {
  const env = readEnv("supabaseAdmin");
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
