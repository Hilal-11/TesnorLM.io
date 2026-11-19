"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUserForApi } from "@/lib/auth";
import { badRequest, defineAction } from "@/lib/errors";
import { createNotebook } from "@/lib/notebooks/repo";
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

/**
 * Finish or "Skip for now": onboarding is done and never shown again. Finishing creates the first
 * notebook and opens it: "sample" loads the sample paper there, "upload" opens Add sources.
 */
export const finishOnboarding = defineAction(
  z.object({ skip: z.boolean().optional() }),
  async ({ skip }) => {
    const user = await requireUserForApi();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ onboarding_done: true })
      .eq("id", user.id)
      .select("first_source")
      .maybeSingle();
    if (error) throw badRequest("We couldn't finish setup. Try again.", "save_failed");
    if (skip || !data?.first_source) redirect("/app?welcome=1");
    const sample = data.first_source === "sample";
    const notebook = await createNotebook(supabase, user.id, {
      title: sample ? "Sample paper" : "My first notebook",
      color: "cobalt",
      status: "to_read",
    });
    redirect(`/app/notebooks/${notebook.id}?${sample ? "sample=1" : "add=1"}`);
  },
);
