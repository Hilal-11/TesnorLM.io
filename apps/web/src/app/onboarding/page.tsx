import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { firstName, getProfile } from "@/lib/profile";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata: Metadata = { title: "Welcome" };

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-6 py-24">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-80 max-w-full" />
          <Skeleton className="h-48 w-full rounded-md" />
        </div>
      }
    >
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  await requireUser("/onboarding");
  const profile = await getProfile();
  if (!profile || profile.onboarding_done) redirect("/app");
  return (
    <OnboardingWizard
      firstName={firstName(profile.full_name)}
      initial={{
        step: Math.min(4, (profile.onboarding_step ?? 0) + 1),
        role: profile.role,
        subjects: profile.subjects ?? [],
        level: profile.level,
        firstSource: (profile.first_source as "sample" | "upload" | null) ?? null,
      }}
    />
  );
}
