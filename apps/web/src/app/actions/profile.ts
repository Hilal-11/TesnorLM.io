"use server";

import { revalidatePath } from "next/cache";
import { requireUserForApi } from "@/lib/auth";
import { badRequest, defineAction } from "@/lib/errors";
import { profilePatchSchema } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

/** Settings: update name, avatar, role, level or subjects (never onboarding or id fields). */
export const updateProfile = defineAction(profilePatchSchema, async (patch) => {
  if (Object.keys(patch).length === 0) throw badRequest("Nothing to save.");
  const user = await requireUserForApi();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) throw badRequest("We couldn't save your profile. Try again.", "save_failed");
  revalidatePath("/app", "layout");
  return { ok: true, message: "Saved" };
});
