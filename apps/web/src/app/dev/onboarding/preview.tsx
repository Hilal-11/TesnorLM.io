"use client";

import { useSearchParams } from "next/navigation";
import { OnboardingWizard } from "../../onboarding/onboarding-wizard";

export function OnboardingPreview() {
  const step = Number(useSearchParams().get("step") ?? "1");
  return (
    <OnboardingWizard
      key={step}
      firstName="Asha"
      initial={{
        step,
        role: step > 1 ? "researcher" : null,
        subjects: step > 2 ? ["Machine learning & AI", "Mathematics"] : ["Machine learning & AI"],
        level: "intermediate",
        firstSource: null,
      }}
    />
  );
}
