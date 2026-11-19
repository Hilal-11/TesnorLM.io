import { z } from "zod";
import { LEVELS, ROLES } from "@/lib/levels";

/** One onboarding step's answer. Kept out of actions.ts: "use server" files export only actions. */
export const onboardingStepSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal(1), role: z.enum(ROLES) }),
  z.object({
    step: z.literal(2),
    subjects: z.array(z.string().trim().min(1).max(60)).max(8, "Choose up to 8 subjects."),
  }),
  z.object({ step: z.literal(3), level: z.enum(LEVELS) }),
  z.object({ step: z.literal(4), first_source: z.enum(["sample", "upload"]) }),
]);
