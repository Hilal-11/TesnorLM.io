import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Level } from "@/lib/answers/format";
import type { Database } from "@/lib/database.types";

/** The person's default answer level from their profile (onboarding), else Intermediate. */
export async function profileLevel(db: SupabaseClient<Database>, userId: string): Promise<Level> {
  const { data } = await db.from("profiles").select("level").eq("id", userId).maybeSingle();
  return (data?.level as Level | undefined) ?? "intermediate";
}
