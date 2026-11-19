import type { Metadata } from "next";
import { Suspense } from "react";
import { firstName, getProfile } from "@/lib/profile";
import { HomeDashboard } from "./_components/home-dashboard";
import { WelcomeToast } from "./_components/welcome-toast";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const profile = await getProfile();
  return (
    <>
      <Suspense>
        <WelcomeToast />
      </Suspense>
      <HomeDashboard
        firstName={firstName(profile?.full_name)}
        level={profile?.level ?? "intermediate"}
      />
    </>
  );
}
