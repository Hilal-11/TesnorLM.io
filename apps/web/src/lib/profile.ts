import "server-only";
import { cache } from "react";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { LEVELS, ROLES } from "@/lib/levels";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export { LEVELS, ROLES, type Level } from "@/lib/levels";
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** The current person's profile (RLS limits the query to their own row), cached per request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  await connection(); // request time: the session check reads the clock (see lib/auth.ts)
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
  return data;
});

/**
 * Fields a person may change from settings. Onboarding fields are only changed by the onboarding
 * actions; id, created_at and updated_at can't be changed at all (column privileges in 0002).
 */
export const profilePatchSchema = z
  .object({
    full_name: z.string().trim().min(1, "Enter your name.").max(80, "Use 80 characters or fewer."),
    avatar_url: z.url().nullable(),
    role: z.enum(ROLES),
    level: z.enum(LEVELS),
    subjects: z.array(z.string().trim().min(1).max(60)).max(8, "Choose up to 8 subjects."),
  })
  .partial()
  .strict();

export type ProfilePatch = z.infer<typeof profilePatchSchema>;

/** First word of the name, for greetings ("Welcome, Asha"). */
export function firstName(fullName: string | null | undefined) {
  return fullName?.trim().split(/\s+/)[0] || null;
}
