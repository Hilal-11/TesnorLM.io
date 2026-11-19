"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUserForApi } from "@/lib/auth";
import { badRequest, defineAction } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { onboardingStepSchema } from "./schema";

/** Saves one step immediately and records progress, so closing the tab resumes here. */
export const saveOnboardingStep = defineAction(onboardingStepSchema, async (input) => {
  const user = await requireUserForApi();
  const supabase = await createClient();
  const { step, ...fields } = input;
  const { error } = await supabase
    .from("profiles")
    .update({ ...fields, onboarding_step: step })
    .eq("id", user.id);
  if (error) throw badRequest("We couldn't save that step. Try again.", "save_failed");
  return { ok: true };
});

/** Finish or "Skip for now": onboarding is done and never shown again. */
export const finishOnboarding = defineAction(
  z.object({ skip: z.boolean().optional() }),
  async () => {
    const user = await requireUserForApi();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ onboarding_done: true })
      .eq("id", user.id)
      .select("first_source")
      .maybeSingle();
    if (error) throw badRequest("We couldn't finish setup. Try again.", "save_failed");
    redirect(data?.first_source === "sample" ? "/app?welcome=sample" : "/app?welcome=1");
  },
);
