import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OnboardingPreview } from "./preview";

export const metadata: Metadata = { title: "Onboarding preview" };

/** Dev only: onboarding at any step (?step=1–4), for design review and axe. Nothing is saved. */
export default function OnboardingPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <OnboardingPreview />
    </Suspense>
  );
}
